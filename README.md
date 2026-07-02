# Local NLP Chatbot

A self-contained AI chatbot web application with a Python NLP backend and a React + TailwindCSS frontend. It does not use OpenAI, Anthropic, Google, or any external LLM API.

## Project Structure

```text
SakuPilot/
+-- app.py                    # Flask API, local NLP training, model reload, static frontend serving
+-- intents.json              # Local knowledge base with tags, patterns, and responses
+-- requirements.txt          # Python dependencies
+-- chatbot_model.pkl         # Generated model artifact after training
+-- frontend/
    +-- package.json          # React/Vite/Tailwind dependencies and scripts
    +-- index.html
    +-- vite.config.js        # Dev proxy to Python backend
    +-- postcss.config.js
    +-- tailwind.config.js
    +-- src/
        +-- index.css
        +-- main.jsx          # Full React chat interface
```

## Install

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt

cd frontend
npm install
```

## Development Run

Start the Python API from the project root:

```powershell
python app.py
```

In a second terminal, start React:

```powershell
cd frontend
npm run dev
```

Open the Vite URL shown in the terminal, usually `http://127.0.0.1:5173`.

## Production-Style Run

Build React first:

```powershell
cd frontend
npm run build
cd ..
python app.py
```

Then open `http://127.0.0.1:5000`. Flask serves the compiled React app from `frontend/dist`.

## Editing The Bot

Update `intents.json` with new tags, patterns, and responses. The backend checks the file hash on each API request and retrains automatically when the knowledge base changes. The trained model is saved as `chatbot_model.pkl`. Tiny changes.Tiny