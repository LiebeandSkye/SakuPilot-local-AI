import threading
from pathlib import Path

from flask import Flask, Response, jsonify, request, send_from_directory

from bot_engine import (
    INTENTS_PATH,
    MODEL_PATH,
    BotRuntime,
    file_hash,
    generate_response,
    load_or_train_bot,
)
from groq_engine import is_available as groq_is_available
from groq_engine import stream_groq_response

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIST = BASE_DIR / "frontend" / "dist"

runtime_lock = threading.Lock()
bot_runtime: BotRuntime | None = None


def get_bot_runtime() -> BotRuntime:
    global bot_runtime

    with runtime_lock:
        current_hash = file_hash(INTENTS_PATH)
        if bot_runtime is None or bot_runtime.data_hash != current_hash:
            bot_runtime = load_or_train_bot()
        return bot_runtime


def create_app() -> Flask:
    flask_app = Flask(__name__, static_folder=str(FRONTEND_DIST), static_url_path="")

    @flask_app.after_request
    def add_dev_cors_headers(response):
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type"
        response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
        return response

    @flask_app.get("/api/status")
    def status():
        runtime = get_bot_runtime()
        return jsonify(
            {
                "status": "Online / Trained",
                "intent_count": runtime.intent_count,
                "pattern_count": runtime.pattern_count,
                "model_file": MODEL_PATH.name,
                "knowledge_base": INTENTS_PATH.name,
                "meta_available": groq_is_available(),
            }
        )

    @flask_app.post("/api/chat")
    def chat():
        payload = request.get_json(silent=True) or {}
        message = str(payload.get("message", ""))
        runtime = get_bot_runtime()
        return jsonify(generate_response(message, runtime))

    @flask_app.post("/api/chat/meta")
    def chat_meta():
        """SakuPilot Meta — streamed (SSE) responses from Groq."""
        payload = request.get_json(silent=True) or {}
        message = str(payload.get("message", ""))
        return Response(
            stream_groq_response(message),
            mimetype="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",  # disable proxy buffering
            },
        )

    @flask_app.route("/", defaults={"path": ""})
    @flask_app.route("/<path:path>")
    def serve_react_app(path: str):
        requested_file = FRONTEND_DIST / path
        if path and requested_file.exists() and requested_file.is_file():
            return send_from_directory(FRONTEND_DIST, path)

        index_file = FRONTEND_DIST / "index.html"
        if index_file.exists():
            return send_from_directory(FRONTEND_DIST, "index.html")

        return jsonify(
            {
                "message": "React frontend has not been built yet.",
                "next_steps": [
                    "cd frontend",
                    "npm install",
                    "npm run dev",
                    "python server.py",
                ],
            }
        )

    return flask_app


app = create_app()


if __name__ == "__main__":
    get_bot_runtime()
    app.run(host="127.0.0.1", port=5000, debug=True)
