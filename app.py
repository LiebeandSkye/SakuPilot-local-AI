import streamlit as st

from bot_engine import INTENTS_PATH, generate_response, load_or_train_bot


def get_bot_runtime():
    current_hash = None
    try:
        from bot_engine import file_hash

        current_hash = file_hash(INTENTS_PATH)
    except Exception:
        pass

    cached_hash = st.session_state.get("intents_hash")
    runtime = st.session_state.get("bot_runtime")

    if runtime is None or cached_hash != current_hash:
        runtime = load_or_train_bot()
        st.session_state.bot_runtime = runtime
        st.session_state.intents_hash = current_hash

    return runtime


def inject_styles() -> None:
    st.markdown(
        """
        <style>
            .stApp {
                background: linear-gradient(180deg, #0b1220 0%, #0f172a 100%);
                color: #f8fafc;
            }

            [data-testid="stSidebar"] {
                background-color: #111827;
                border-right: 1px solid #334155;
            }

            [data-testid="stSidebar"] * {
                color: #e2e8f0 !important;
            }

            .sidebar-title {
                font-size: 1.35rem;
                font-weight: 700;
                margin-bottom: 0.25rem;
            }

            .sidebar-subtitle {
                color: #94a3b8;
                font-size: 0.9rem;
                margin-bottom: 1.25rem;
            }

            .status-pill {
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.45rem 0.75rem;
                border-radius: 999px;
                background: rgba(34, 197, 94, 0.12);
                border: 1px solid rgba(34, 197, 94, 0.35);
                color: #86efac;
                font-size: 0.85rem;
                font-weight: 600;
            }

            .status-dot {
                width: 0.55rem;
                height: 0.55rem;
                border-radius: 50%;
                background: #22c55e;
                box-shadow: 0 0 10px rgba(34, 197, 94, 0.8);
            }

            .metric-card {
                background: rgba(15, 23, 42, 0.85);
                border: 1px solid #334155;
                border-radius: 0.85rem;
                padding: 0.85rem 1rem;
                margin-bottom: 0.75rem;
            }

            .metric-label {
                color: #94a3b8;
                font-size: 0.78rem;
                text-transform: uppercase;
                letter-spacing: 0.04em;
            }

            .metric-value {
                font-size: 1.15rem;
                font-weight: 700;
                margin-top: 0.15rem;
            }

            .chat-header {
                padding: 0.25rem 0 1rem 0;
                border-bottom: 1px solid #334155;
                margin-bottom: 1rem;
            }

            .chat-header h1 {
                font-size: 1.6rem;
                margin: 0;
            }

            .chat-header p {
                color: #94a3b8;
                margin: 0.35rem 0 0 0;
            }

            [data-testid="stChatMessage"] {
                background: rgba(15, 23, 42, 0.55);
                border: 1px solid #334155;
                border-radius: 1rem;
                padding: 0.85rem 1rem;
                margin-bottom: 0.75rem;
            }

            [data-testid="stChatMessageAvatarUser"],
            [data-testid="stChatMessageAvatarAssistant"] {
                background: #1e293b;
                border: 1px solid #475569;
            }

            [data-testid="stChatInput"] {
                border-top: 1px solid #334155;
                background: rgba(15, 23, 42, 0.95);
                padding-top: 0.75rem;
            }

            [data-testid="stChatInput"] textarea {
                background: #111827 !important;
                color: #f8fafc !important;
                border: 1px solid #475569 !important;
                border-radius: 0.85rem !important;
            }

            div[data-testid="stVerticalBlock"] > div:has(> div[data-testid="stChatInput"]) {
                position: sticky;
                bottom: 0;
                z-index: 999;
                background: linear-gradient(180deg, rgba(15, 23, 42, 0) 0%, #0f172a 24%);
                padding-bottom: 0.5rem;
            }

            .stButton > button {
                width: 100%;
                background: #1e293b;
                color: #f8fafc;
                border: 1px solid #475569;
                border-radius: 0.75rem;
                padding: 0.55rem 0.85rem;
            }

            .stButton > button:hover {
                background: #334155;
                border-color: #64748b;
                color: #ffffff;
            }
        </style>
        """,
        unsafe_allow_html=True,
    )


def init_session_state() -> None:
    if "messages" not in st.session_state:
        st.session_state.messages = []


def render_sidebar(runtime) -> None:
    with st.sidebar:
        st.markdown('<div class="sidebar-title">SakuPilot AI</div>', unsafe_allow_html=True)
        st.markdown(
            '<div class="sidebar-subtitle">Local NLP chatbot powered by TF-IDF + SVC</div>',
            unsafe_allow_html=True,
        )

        st.markdown(
            '<div class="status-pill"><span class="status-dot"></span>AI Status: Online / Trained</div>',
            unsafe_allow_html=True,
        )

        st.markdown("---")

        st.markdown(
            f"""
            <div class="metric-card">
                <div class="metric-label">Intents</div>
                <div class="metric-value">{runtime.intent_count}</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Training Patterns</div>
                <div class="metric-value">{runtime.pattern_count}</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Knowledge Base</div>
                <div class="metric-value">{INTENTS_PATH.name}</div>
            </div>
            """,
            unsafe_allow_html=True,
        )

        if st.button("Clear Chat", use_container_width=True):
            st.session_state.messages = []
            st.rerun()

        st.markdown("---")
        st.caption("No external LLM APIs. All responses come from your local intents.json file.")


def render_chat_history() -> None:
    for message in st.session_state.messages:
        avatar = "👤" if message["role"] == "user" else "🧠"
        with st.chat_message(message["role"], avatar=avatar):
            st.markdown(message["content"])


def main() -> None:
    st.set_page_config(
        page_title="SakuPilot AI Chatbot",
        page_icon="🧠",
        layout="wide",
        initial_sidebar_state="expanded",
    )

    inject_styles()
    init_session_state()

    try:
        runtime = get_bot_runtime()
    except Exception as exc:
        st.error(f"Failed to load or train the chatbot: {exc}")
        st.stop()

    render_sidebar(runtime)

    st.markdown(
        """
        <div class="chat-header">
            <h1>Chat</h1>
            <p>Ask about greetings, capabilities, training, privacy, or how this local bot works.</p>
        </div>
        """,
        unsafe_allow_html=True,
    )

    render_chat_history()

    if prompt := st.chat_input("Message SakuPilot..."):
        st.session_state.messages.append({"role": "user", "content": prompt})

        runtime = get_bot_runtime()
        result = generate_response(prompt, runtime)
        bot_reply = result["response"]

        st.session_state.messages.append({"role": "assistant", "content": bot_reply})
        st.rerun()


if __name__ == "__main__":
    main()
