import hashlib
import json
import pickle
import random
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from nltk.stem import PorterStemmer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import Pipeline
from sklearn.svm import SVC

BASE_DIR = Path(__file__).resolve().parent
INTENTS_PATH = BASE_DIR / "intents.json"
MODEL_PATH = BASE_DIR / "chatbot_model.pkl"
CONFIDENCE_THRESHOLD = 0.15

stemmer = PorterStemmer()


@dataclass(frozen=True)
class BotRuntime:
    model: Pipeline
    intents: dict[str, Any]
    responses_by_tag: dict[str, list[str]]
    data_hash: str
    pattern_count: int
    intent_count: int


def tokenize_and_stem(text: str) -> list[str]:
    words = re.findall(r"[a-zA-Z0-9']+", text.lower())
    return [stemmer.stem(word) for word in words]


def read_intents() -> dict[str, Any]:
    if not INTENTS_PATH.exists():
        raise FileNotFoundError("intents.json was not found next to app.py.")

    with INTENTS_PATH.open("r", encoding="utf-8") as file:
        data = json.load(file)

    intents = data.get("intents", [])
    if not isinstance(intents, list) or not intents:
        raise ValueError("intents.json must contain a non-empty 'intents' list.")

    for intent in intents:
        if not intent.get("tag") or not intent.get("patterns") or not intent.get("responses"):
            raise ValueError("Each intent needs a tag, patterns, and responses.")
        if not isinstance(intent["patterns"], list) or not isinstance(intent["responses"], list):
            raise ValueError("Intent patterns and responses must be lists.")

    return data


def file_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def compile_training_data(intents: dict[str, Any]) -> tuple[list[str], list[str], dict[str, list[str]]]:
    patterns: list[str] = []
    labels: list[str] = []
    responses_by_tag: dict[str, list[str]] = {}

    for intent in intents["intents"]:
        tag = intent["tag"]
        responses_by_tag[tag] = intent["responses"]
        for pattern in intent["patterns"]:
            patterns.append(pattern)
            labels.append(tag)

    if len(set(labels)) < 2:
        raise ValueError("At least two intent tags are required for SVC training.")

    return patterns, labels, responses_by_tag


def train_bot() -> BotRuntime:
    intents = read_intents()
    patterns, labels, responses_by_tag = compile_training_data(intents)

    model = Pipeline(
        steps=[
            (
                "tfidf",
                TfidfVectorizer(
                    tokenizer=tokenize_and_stem,
                    token_pattern=None,
                    ngram_range=(1, 2),
                    min_df=1,
                ),
            ),
            (
                "classifier",
                SVC(
                    kernel="linear",
                    class_weight="balanced",
                    probability=True,
                    random_state=42,
                ),
            ),
        ]
    )
    model.fit(patterns, labels)

    runtime = BotRuntime(
        model=model,
        intents=intents,
        responses_by_tag=responses_by_tag,
        data_hash=file_hash(INTENTS_PATH),
        pattern_count=len(patterns),
        intent_count=len(responses_by_tag),
    )

    with MODEL_PATH.open("wb") as file:
        pickle.dump(runtime, file)

    return runtime


def load_saved_runtime(current_hash: str) -> BotRuntime | None:
    if not MODEL_PATH.exists():
        return None

    try:
        with MODEL_PATH.open("rb") as file:
            runtime: BotRuntime = pickle.load(file)
        if runtime.data_hash == current_hash:
            return runtime
    except Exception:
        return None

    return None


def load_or_train_bot() -> BotRuntime:
    current_hash = file_hash(INTENTS_PATH)
    saved_runtime = load_saved_runtime(current_hash)
    if saved_runtime:
        return saved_runtime
    return train_bot()


def predict_intent(message: str, runtime: BotRuntime) -> tuple[str, float]:
    probabilities = runtime.model.predict_proba([message])[0]
    best_index = int(probabilities.argmax())
    classifier = runtime.model.named_steps["classifier"]
    tag = str(classifier.classes_[best_index])
    confidence = float(probabilities[best_index])
    return tag, confidence


def generate_response(message: str, runtime: BotRuntime) -> dict[str, Any]:
    clean_message = message.strip()
    if not clean_message:
        return {
            "response": "Tell me what you would like to chat about.",
            "tag": "empty",
            "confidence": 0.0,
        }

    # 1. Exact Pattern Match Check (bypass probability dilution for direct pattern matches)
    input_stemmed = tokenize_and_stem(clean_message)
    for intent in runtime.intents.get("intents", []):
        for pattern in intent.get("patterns", []):
            pattern_stemmed = tokenize_and_stem(pattern)
            if input_stemmed == pattern_stemmed and len(input_stemmed) > 0:
                return {
                    "response": random.choice(intent["responses"]),
                    "tag": intent["tag"],
                    "confidence": 1.0,
                }

    # 2. Classifier Prediction (for variations of patterns)
    tag, confidence = predict_intent(clean_message, runtime)
    if confidence < CONFIDENCE_THRESHOLD:
        fallback = runtime.responses_by_tag.get(
            "fallback_help",
            ["I may need more examples in intents.json for that topic. Try rephrasing with simpler wording."],
        )
        return {
            "response": random.choice(fallback),
            "tag": "fallback_help",
            "confidence": confidence,
        }

    return {
        "response": random.choice(runtime.responses_by_tag[tag]),
        "tag": tag,
        "confidence": confidence,
    }
