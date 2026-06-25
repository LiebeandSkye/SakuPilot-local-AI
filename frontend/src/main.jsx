import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Bot,
  BrainCircuit,
  CheckCircle2,
  Database,
  Loader2,
  MessageSquareText,
  PanelLeft,
  SendHorizontal,
  Sparkles,
  Trash2,
  UserRound,
} from 'lucide-react';
import './index.css';

const starterMessages = [
  {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: 'Hello. I am trained locally from intents.json and ready to chat.',
    tag: 'system',
    confidence: 1,
  },
];

function classNames(...values) {
  return values.filter(Boolean).join(' ');
}

function App() {
  const [messages, setMessages] = useState(starterMessages);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  const assistantCount = useMemo(
    () => messages.filter((message) => message.role === 'assistant').length,
    [messages],
  );

  useEffect(() => {
    fetch('/api/status')
      .then((response) => response.json())
      .then(setStatus)
      .catch(() => setError('Backend is not reachable. Start Python with: python server.py'));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isSending]);

  async function sendMessage(event) {
    event.preventDefault();
    const messageText = input.trim();
    if (!messageText || isSending) return;

    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: messageText,
    };

    setMessages((current) => [...current, userMessage]);
    setInput('');
    setError('');
    setIsSending(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText }),
      });

      if (!response.ok) {
        throw new Error(`Request failed with ${response.status}`);
      }

      const data = await response.json();
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.response,
          tag: data.tag,
          confidence: data.confidence,
        },
      ]);
    } catch (requestError) {
      setError('The chatbot API did not respond. Check that the Python server is running.');
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'I could not reach the local chatbot API. Please start the backend and try again.',
          tag: 'network_error',
          confidence: 0,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  function clearChat() {
    setMessages([
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Chat cleared. The local model is still trained and online.',
        tag: 'system',
        confidence: 1,
      },
    ]);
    setError('');
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="flex min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.14),transparent_34rem),linear-gradient(180deg,#0f172a_0%,#111827_52%,#0b1120_100%)]">
        <aside className="hidden w-80 shrink-0 border-r border-slate-700/40 bg-slate-950/80 px-5 py-6 backdrop-blur-xl lg:block">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg border border-cyan-400/30 bg-cyan-400/10 text-cyan-200">
              <BrainCircuit size={22} />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-normal text-white">Local NLP Chatbot</h1>
              <p className="text-sm text-slate-400">Python + React + Tailwind</p>
            </div>
          </div>

          <div className="mt-7 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-sm font-semibold text-emerald-100">
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 size={16} /> AI Status: {status?.status ?? 'Training...'}
            </span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <Metric icon={<Database size={16} />} label="Intents" value={status?.intent_count ?? '--'} />
            <Metric icon={<MessageSquareText size={16} />} label="Patterns" value={status?.pattern_count ?? '--'} />
          </div>

          <button
            type="button"
            onClick={clearChat}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-600/70 bg-slate-800/80 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:border-cyan-300/60 hover:bg-slate-700"
          >
            <Trash2 size={16} />
            Clear Chat
          </button>

          <div className="mt-7 rounded-lg border border-slate-700/50 bg-slate-900/70 p-4 text-sm leading-6 text-slate-300">
            <p className="font-semibold text-slate-100">Local knowledge base</p>
            <p className="mt-2">Training data comes from intents.json. Edit it while the app is running and the backend retrains on the next request.</p>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-slate-700/40 bg-slate-950/50 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-cyan-400/30 bg-cyan-400/10 text-cyan-200 lg:hidden">
                  <PanelLeft size={20} />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-semibold tracking-normal text-white">Local AI Chat</h2>
                  <p className="truncate text-sm text-slate-400">No external LLM APIs. Intent matching with TF-IDF and SVC.</p>
                </div>
              </div>
              <div className="hidden items-center gap-2 rounded-lg border border-slate-700/60 bg-slate-900/70 px-3 py-2 text-sm text-slate-300 sm:flex">
                <Sparkles size={16} className="text-cyan-200" />
                {assistantCount} bot messages
              </div>
            </div>
          </header>

          <div className="chat-scrollbar flex-1 overflow-y-auto px-4 py-6 pb-36 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-5xl flex-col gap-4">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}

              {isSending && (
                <div className="flex items-start gap-3">
                  <Avatar role="assistant" />
                  <div className="rounded-lg border border-slate-700/50 bg-slate-900/80 px-4 py-3 text-slate-300 shadow-soft">
                    <span className="inline-flex items-center gap-2 text-sm">
                      <Loader2 size={16} className="animate-spin text-cyan-200" />
                      Thinking locally...
                    </span>
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
                  {error}
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </div>

          <form onSubmit={sendMessage} className="fixed bottom-0 left-0 right-0 border-t border-slate-700/40 bg-slate-950/80 px-4 py-4 backdrop-blur-xl lg:left-80">
            <div className="mx-auto flex max-w-5xl items-end gap-3 rounded-lg border border-slate-600/70 bg-slate-900/90 p-2 shadow-soft focus-within:border-cyan-300/60">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage(event);
                  }
                }}
                rows={1}
                placeholder="Message the local bot..."
                className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-slate-50 outline-none placeholder:text-slate-500"
              />
              <button
                type="submit"
                disabled={!input.trim() || isSending}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-cyan-300 text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                aria-label="Send message"
              >
                <SendHorizontal size={18} />
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}

function Metric({ icon, label, value }) {
  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-900/70 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

function Avatar({ role }) {
  const isAssistant = role === 'assistant';
  return (
    <div
      className={classNames(
        'grid h-9 w-9 shrink-0 place-items-center rounded-lg border',
        isAssistant
          ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-100'
          : 'border-violet-300/30 bg-violet-300/10 text-violet-100',
      )}
    >
      {isAssistant ? <Bot size={18} /> : <UserRound size={18} />}
    </div>
  );
}

function ChatMessage({ message }) {
  const isUser = message.role === 'user';
  const confidence = typeof message.confidence === 'number' ? Math.round(message.confidence * 100) : null;

  return (
    <div className={classNames('flex items-start gap-3', isUser && 'flex-row-reverse')}>
      <Avatar role={message.role} />
      <article
        className={classNames(
          'max-w-[min(780px,calc(100%-3rem))] rounded-lg border px-4 py-3 shadow-soft',
          isUser
            ? 'border-violet-300/20 bg-violet-300/10 text-violet-50'
            : 'border-slate-700/50 bg-slate-900/80 text-slate-100',
        )}
      >
        <p className="whitespace-pre-wrap break-words text-[15px] leading-7">{message.content}</p>
        {!isUser && message.tag && message.tag !== 'system' && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
            <span className="rounded-md border border-slate-700/60 bg-slate-950/50 px-2 py-1">Intent: {message.tag}</span>
            <span className="rounded-md border border-slate-700/60 bg-slate-950/50 px-2 py-1">Confidence: {confidence}%</span>
          </div>
        )}
      </article>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);