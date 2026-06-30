"""SakuPilot Meta — Groq-backed streaming engine.

Uses requests against Groq's OpenAI-compatible chat endpoint so the
project needs no extra SDK dependency (requests + python-dotenv are
already installed). The local NLP intents.json corpus is compiled into
the system instruction so Meta answers with the same knowledge and tone.
"""

from __future__ import annotations

import json
import os
from typing import Iterator

import requests
from dotenv import load_dotenv

from bot_engine import INTENTS_PATH

# Load .env from the project root once at import time.
load_dotenv()

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "").strip()
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"


def is_available() -> bool:
    """True when a Groq API key is configured."""
    return bool(GROQ_API_KEY)


def _load_intents() -> dict:
    with INTENTS_PATH.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def build_system_prompt() -> str:
    """Compile a system instruction from intents.json.

    The model is told it is SakuPilot, shown every intent (tag +
    patterns + sample responses) so it shares the local knowledge base,
    and required to answer in a delimiter format so we can stream the
    human-readable text live and recover the tag/confidence afterwards.
    """
    data = _load_intents()
    intents = data.get("intents", [])

    lines = []
    for intent in intents:
        tag = intent.get("tag", "")
        patterns = intent.get("patterns", [])
        responses = intent.get("responses", [])
        sample_responses = " | ".join(responses[:3])
        lines.append(
            f"- tag: {tag}\n"
            f"  patterns: {', '.join(patterns[:8])}\n"
            f"  sample responses: {sample_responses}"
        )

    knowledge_block = "\n".join(lines)

    return (
        "You are SakuPilot (Meta edition), a friendly, concise assistant. "
        "You share one brain with a local TF-IDF/SVC chatbot trained on the "
        "intent corpus below. Use it as your knowledge base: stay on these "
        "topics, mirror the tone of the sample responses, and prefer the "
        "intent tag that best matches the user's message.\n\n"
        "INTENT KNOWLEDGE BASE:\n"
        f"{knowledge_block}\n\n"
        "RULES:\n"
        "1. Reply helpfully and naturally. If the user's message matches an "
        "intent, answer in the spirit of that intent's sample responses.\n"
        "2. For anything off-corpus, still help — but keep it brief.\n"
        "3. Format your ENTIRE reply as TWO parts, exactly:\n"
        "   PART 1 — your natural answer to the user (plain text, may use "
        "markdown).\n"
        "   PART 2 — on a new line, the marker |||META||| followed by a JSON "
        "object with the matched intent metadata.\n"
        "4. Example:\n"
        "   Hello! I'm a local chatbot built with Python and scikit-learn.\n"
        "   |||META||| {\"tag\": \"about_bot\", \"confidence\": 0.95}\n"
        "5. The 'tag' must be one intent tag from the knowledge base that "
        "best matches the user's message, or 'meta_chat' if none fits. "
        "'confidence' is a number from 0 to 1.\n"
        "6. Never put the |||META||| marker anywhere except on its own line "
        "between PART 1 and PART 2. Do not explain the marker to the user.\n"
    )


# Separates the human-facing answer (PART 1) from the metadata (PART 2).
META_DELIMITER = "|||META|||"


def _sse_objects(response: "requests.Response") -> Iterator[dict]:
    """Yield parsed JSON dicts from a Groq streaming response.

    Groq streams Server-Sent Events: each chunk starts with 'data: '
    and holds a JSON payload. 'data: [DONE]' terminates the stream.
    """
    buffer = ""
    for raw in response.iter_content(chunk_size=None, decode_unicode=True):
        if not raw:
            continue
        buffer += raw
        # SSE events are separated by blank lines; Groq sends one per line.
        while "\n" in buffer:
            line, buffer = buffer.split("\n", 1)
            line = line.strip()
            if not line or not line.startswith("data:"):
                continue
            payload = line[len("data:"):].strip()
            if payload == "[DONE]":
                return
            try:
                yield json.loads(payload)
            except json.JSONDecodeError:
                # Skip malformed keep-alive/heartbeat lines.
                continue


def stream_groq_response(message: str) -> Iterator[str]:
    """Stream a SakuPilot Meta reply as SSE 'data:' events.

    The model writes its answer, then a |||META||| delimiter, then a
    tag/confidence JSON. We stream the human-readable answer text live
    while holding back just enough characters to keep the delimiter and
    metadata hidden. A final 'done' event carries the parsed tag/confidence.
    Each yielded string is one SSE frame: 'data: <json>\\n\\n'.
    """
    if not is_available():
        yield _sse({"error": "Groq API key is not configured on the server."})
        return

    clean = (message or "").strip()
    if not clean:
        yield _sse({"error": "Tell me what you would like to chat about."})
        return

    try:
        response = requests.post(
            GROQ_URL,
            headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": GROQ_MODEL,
                "stream": True,
                "temperature": 0.6,
                "max_tokens": 1024,
                "messages": [
                    {"role": "system", "content": build_system_prompt()},
                    {"role": "user", "content": clean},
                ],
            },
            stream=True,
            timeout=30,
        )
    except requests.RequestException as exc:
        yield _sse({"error": f"Could not reach Groq: {exc}"})
        return

    if response.status_code != 200:
        body = response.text[:300]
        yield _sse({"error": f"Groq API error ({response.status_code}): {body}"})
        return

    # We stream PART 1 (the answer) but keep a tail buffer so the
    # delimiter and metadata never leak into the visible stream.
    full_text = ""
    emitted = 0  # how many chars of full_text have already been streamed
    try:
        for chunk in _sse_objects(response):
            choices = chunk.get("choices") or []
            if not choices:
                continue
            delta = choices[0].get("delta", {}).get("content")
            if not delta:
                continue
            full_text += delta

            delim_idx = full_text.find(META_DELIMITER)
            if delim_idx != -1:
                # Delimiter found: flush any held-back text before it, stop.
                if delim_idx > emitted:
                    yield _sse({"type": "delta", "text": full_text[emitted:delim_idx]})
                    emitted = delim_idx
                break

            # No delimiter yet: emit up to a safe point, holding back enough
            # characters that a delimiter starting mid-buffer can't leak.
            safe_end = len(full_text) - (len(META_DELIMITER) - 1)
            if safe_end > emitted:
                yield _sse({"type": "delta", "text": full_text[emitted:safe_end]})
                emitted = safe_end
    except requests.RequestException as exc:
        yield _sse({"error": f"Stream interrupted: {exc}"})
        return

    # Split the completed text into answer + metadata.
    tag, confidence = _extract_meta(full_text)
    answer_text = _extract_response_text(full_text)
    # If we broke early on the delimiter, flush any remaining answer chars.
    if answer_text and emitted < len(answer_text):
        yield _sse({"type": "delta", "text": answer_text[emitted:]})

    yield _sse({
        "type": "done",
        "response": answer_text,
        "tag": tag,
        "confidence": confidence,
    })


def _sse(obj: dict) -> str:
    """Wrap a dict as one SSE data frame."""
    return f"data: {json.dumps(obj)}\n\n"


def _extract_response_text(full_text: str) -> str:
    """Return PART 1 (the human-facing answer), before the delimiter."""
    idx = full_text.find(META_DELIMITER)
    answer = full_text[:idx] if idx != -1 else full_text
    return answer.strip()


def _extract_meta(full_text: str) -> tuple[str, float]:
    """Parse the JSON after the delimiter into (tag, confidence)."""
    idx = full_text.find(META_DELIMITER)
    if idx == -1:
        return "meta_chat", 0.9
    tail = full_text[idx + len(META_DELIMITER):].strip()
    parsed = _safe_parse(tail)
    if not parsed:
        return "meta_chat", 0.9
    tag = str(parsed.get("tag") or "meta_chat")
    try:
        confidence = float(parsed.get("confidence", 0.9))
    except (TypeError, ValueError):
        confidence = 0.9
    return tag, max(0.0, min(1.0, confidence))


def _safe_parse(text: str) -> dict | None:
    """Best-effort JSON extraction from a possibly-fenced snippet."""
    candidate = text.strip()
    if candidate.startswith("```"):
        candidate = candidate.strip("`")
        nl = candidate.find("\n")
        if nl != -1:
            candidate = candidate[nl + 1:]
    start = candidate.find("{")
    end = candidate.rfind("}")
    if start != -1 and end != -1 and end > start:
        candidate = candidate[start:end + 1]
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        return None
