import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Sparkles,
  Loader2,
  Trash2,
  PanelLeft,
  Plus,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Share2,
  Database,
  BrainCircuit,
  X,
  FileText,
  Link,
  Mic,
  Lightbulb,
  Compass,
  Code,
  UserRound,
  Info,
  ChevronDown,
  ChevronUp,
  Search,
  Settings,
  Sun,
  Moon,
  ArrowUp,
  Zap,
  Square,
  Cpu,
  Cloud,
} from 'lucide-react';
import './index.css';
import { AdvancedChatInput, Button } from './chatinput';

/* ---------------------------------------------------------------- */
/* Constants                                                        */
/* ---------------------------------------------------------------- */
const STORAGE_HISTORY_KEY = 'sakupilot_chat_history';
const STORAGE_THEME_KEY = 'sakupilot_theme';
const STORAGE_ENGINE_KEY = 'sakupilot_engine';

/* Engine catalog shown in the header dropdown. */
const ENGINES = {
  local: {
    id: 'local',
    name: 'SakuPilot',
    badge: 'Local 1.0',
    description: 'On-device TF-IDF + SVC classifier trained from intents.json.',
    icon: Cpu,
  },
  meta: {
    id: 'meta',
    name: 'SakuPilot Meta',
    badge: 'Meta · Groq',
    description: 'Cloud LLM (llama-3.3-70b) grounded in your intents corpus.',
    icon: Cloud,
  },
};

const starterMessages = [
  {
    id: crypto.randomUUID(),
    role: 'assistant',
    content:
      "Hi, I'm SakuPilot — a local NLP assistant trained from `intents.json`. Ask me anything, or pick a prompt below to get started.",
    tag: 'system',
    confidence: 1,
  },
];

function classNames(...values) {
  return values.filter(Boolean).join(' ');
}

/* ---------------------------------------------------------------- */
/* CodeBlock — soft code panel (theme-aware)                        */
/* ---------------------------------------------------------------- */
function CodeBlock({ code, language }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 rounded-xl overflow-hidden border border-border bg-surface-subtle font-mono text-sm shadow-soft">
      <div className="flex items-center justify-between px-4 py-2 bg-surface-hover text-text-tertiary text-xs border-b border-border">
        <span className="uppercase tracking-wider font-semibold">{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 hover:text-text transition py-1 px-2 rounded-md hover:bg-surface-subtle"
          type="button"
        >
          {copied ? (
            <>
              <Check size={13} className="text-success" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy size={13} />
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-text leading-6 text-[13px] chat-scrollbar">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* formatMessageContent — code blocks + inline code                 */
/* ---------------------------------------------------------------- */
function formatMessageContent(content) {
  if (!content) return null;

  const parts = content.split(/(```[\s\S]*?```)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const codeLines = part.slice(3, -3).trim().split('\n');
      let language = 'code';
      let code = part.slice(3, -3).trim();

      if (
        codeLines[0] &&
        codeLines[0].length < 15 &&
        !codeLines[0].includes(' ') &&
        !codeLines[0].includes('(')
      ) {
        language = codeLines[0];
        code = codeLines.slice(1).join('\n');
      }

      return <CodeBlock key={idx} code={code} language={language} />;
    }

    const inlineParts = part.split(/(`[^`\n]+`)/g);
    return (
      <p
        key={idx}
        className="whitespace-pre-wrap break-words leading-7 my-2 text-[15px] text-text"
      >
        {inlineParts.map((subPart, subIdx) => {
          if (subPart.startsWith('`') && subPart.endsWith('`')) {
            return (
              <code
                key={subIdx}
                className="bg-surface-hover text-accent-hover px-1.5 py-0.5 rounded-md text-[13px] font-mono border border-border"
              >
                {subPart.slice(1, -1)}
              </code>
            );
          }
          return subPart;
        })}
      </p>
    );
  });
}

/* ---------------------------------------------------------------- */
/* Avatar — small reusable avatar with sparkle / user icon          */
/* ---------------------------------------------------------------- */
function Avatar({ role, size = 32 }) {
  const dim = { width: size, height: size };
  if (role === 'user') {
    return (
      <div
        style={dim}
        className="rounded-full bg-text text-bg flex items-center justify-center shadow-soft shrink-0 select-none ring-2 ring-surface"
      >
        <UserRound size={size * 0.5} />
      </div>
    );
  }
  return (
    <div
      style={dim}
      className="rounded-full bg-gradient-to-br from-accent to-accent-hover text-white flex items-center justify-center shadow-soft shrink-0 select-none ring-2 ring-surface"
    >
      <Sparkles size={size * 0.5} />
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* App                                                              */
/* ---------------------------------------------------------------- */
function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [files, setFiles] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [chatSessions, setChatSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);

  /* ----- Engine (local vs Meta) ----- */
  const [engine, setEngine] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_ENGINE_KEY) === 'meta'
        ? 'meta'
        : 'local';
    } catch {
      return 'local';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_ENGINE_KEY, engine);
    } catch {
      /* ignore */
    }
  }, [engine]);

  /* Abort controller for an in-flight Meta stream, so the Stop button
   * (and unmount) can cancel it cleanly. */
  const abortRef = useRef(null);
  const stopStreaming = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  useEffect(() => () => stopStreaming(), [stopStreaming]);

  /* ----- Theme ----- */
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_THEME_KEY) === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(STORAGE_THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  /* ----- Settings dropdown ----- */
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef(null);

  /* ----- Engine dropdown ----- */
  const [engineOpen, setEngineOpen] = useState(false);
  const engineRef = useRef(null);

  useEffect(() => {
    if (!settingsOpen && !engineOpen) return;
    const onPointerDown = (e) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) {
        setSettingsOpen(false);
      }
      if (engineRef.current && !engineRef.current.contains(e.target)) {
        setEngineOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setSettingsOpen(false);
        setEngineOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [settingsOpen]);

  /* ----- Smart auto-scroll -----
   * The view sticks to the bottom while the AI is responding. If the
   * user scrolls up (even a little) we release the stick for the rest
   * of the current output so they can read undisturbed. Sending a new
   * message — or clicking the scroll-to-bottom button — re-engages it. */
  const scrollContainerRef = useRef(null);
  const lastScrollTopRef = useRef(0);
  const stickToBottomRef = useRef(true);
  const [stickToBottom, setStickToBottom] = useState(true);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const scrollToBottom = useCallback((behavior = 'auto') => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const prevTop = lastScrollTopRef.current;
    const movedUp = el.scrollTop < prevTop - 5; // user scrolled upward
    lastScrollTopRef.current = el.scrollTop;

    // Interrupt: any upward scroll releases auto-scroll.
    if (movedUp && stickToBottomRef.current) {
      stickToBottomRef.current = false;
      setStickToBottom(false);
    }
    // Resume when the user manually returns to the bottom.
    if (distanceFromBottom < 12 && !stickToBottomRef.current) {
      stickToBottomRef.current = true;
      setStickToBottom(true);
    }
    setShowScrollBottom(distanceFromBottom > 140);
  }, []);

  const reengageAutoScroll = useCallback(() => {
    stickToBottomRef.current = true;
    setStickToBottom(true);
  }, []);

  /* Suggested prompts */
  const suggestedPrompts = [
    {
      title: 'Introduce yourself',
      subtitle: 'Ask who the bot is and what its core functionalities are.',
      prompt: 'Who are you and what can you do?',
      icon: <Compass className="h-4 w-4 text-[#d97757]" />,
      accent: '#d97757',
    },
    {
      title: 'Analyze intents database',
      subtitle: 'Query the chatbot about how intent-based training works.',
      prompt: 'How does intents.json train this model?',
      icon: <BrainCircuit className="h-4 w-4 text-[#8b5cf6]" />,
      accent: '#8b5cf6',
    },
    {
      title: 'Model capabilities',
      subtitle: 'Inquire about TF-IDF text representation and confidence rates.',
      prompt: 'Tell me how the TF-IDF and SVC classifiers work.',
      icon: <Code className="h-4 w-4 text-[#0ea5e9]" />,
      accent: '#0ea5e9',
    },
    {
      title: 'Retraining procedure',
      subtitle: 'Ask how to edit intents.json to add new chat prompts.',
      prompt: 'How can I retrain you on new intents?',
      icon: <Lightbulb className="h-4 w-4 text-[#d9b13a]" />,
      accent: '#d9b13a',
    },
  ];

  /* Fetch backend status */
  useEffect(() => {
    fetch('/api/status')
      .then((response) => response.json())
      .then((data) => setStatus(data))
      .catch(() =>
        setError('Backend is not reachable. Start Python with: python server.py')
      );
  }, []);

  /* Load chat history */
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_HISTORY_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setChatSessions(parsed);
        if (parsed.length > 0) {
          setCurrentSessionId(parsed[0].id);
          setMessages(parsed[0].messages);
        } else {
          setMessages(starterMessages);
        }
      } catch (e) {
        setMessages(starterMessages);
      }
    } else {
      setMessages(starterMessages);
    }
  }, []);

  const saveSessions = (updatedSessions) => {
    setChatSessions(updatedSessions);
    localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(updatedSessions));
  };

  /* Auto-scroll: follow new content only while stuck to the bottom. */
  useEffect(() => {
    if (stickToBottom) scrollToBottom('auto');
  }, [messages, isSending, stickToBottom, scrollToBottom]);

  /* Session handlers */
  const startNewChat = () => {
    setCurrentSessionId(null);
    setMessages(starterMessages);
    setFiles([]);
    setInput('');
    setError('');
    reengageAutoScroll();
  };

  const loadChatSession = (id) => {
    const session = chatSessions.find((s) => s.id === id);
    if (session) {
      setCurrentSessionId(id);
      setMessages(session.messages);
      setFiles([]);
      reengageAutoScroll();
    }
  };

  const deleteChatSession = (id, event) => {
    event.stopPropagation();
    const updated = chatSessions.filter((s) => s.id !== id);
    saveSessions(updated);
    if (currentSessionId === id) startNewChat();
  };

  const handleAddFile = () => {
    const newFile = {
      id: Date.now(),
      name: `document_${files.length + 1}.pdf`,
      icon: <FileText className="h-4 w-4 text-accent" />,
    };
    setFiles((prevFiles) => [...prevFiles, newFile]);
  };

  const handleRemoveFile = (id) => {
    setFiles((prevFiles) => prevFiles.filter((file) => file.id !== id));
  };

  /* Persist the latest messages for a session (shared by both engines). */
  const persistSession = (sessionId, updatedSessions, finalMessages) => {
    const savedSessions = updatedSessions.map((s) =>
      s.id === sessionId ? { ...s, messages: finalMessages } : s
    );
    saveSessions(savedSessions);
  };

  /**
   * Read an SSE stream from /api/chat/meta, appending text deltas to the
   * assistant message with id `assistantId`. Returns the final { tag,
   * confidence } or { error } delivered by the server.
   */
  async function streamMetaAnswer(messageText, assistantId, baseMessages, sessionId, updatedSessions) {
    const controller = new AbortController();
    abortRef.current = controller;

    let collectedText = '';
    let result = null;

    try {
      const response = await fetch('/api/chat/meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Request failed with ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by a blank line.
        let sep;
        while ((sep = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const dataLine = frame
            .split('\n')
            .find((l) => l.startsWith('data:'));
          if (!dataLine) continue;
          const payload = dataLine.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;

          let evt;
          try {
            evt = JSON.parse(payload);
          } catch {
            continue;
          }

          if (evt.error) {
            result = { error: evt.error };
            break;
          }
          if (evt.type === 'delta') {
            collectedText += evt.text || '';
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: collectedText } : m
              )
            );
          } else if (evt.type === 'done') {
            collectedText = evt.response || collectedText;
            result = { tag: evt.tag, confidence: evt.confidence };
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: collectedText,
                      tag: evt.tag,
                      confidence: evt.confidence,
                      streaming: false,
                    }
                  : m
              )
            );
          }
        }
        if (result && result.error) break;
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        // User pressed Stop — keep whatever streamed so far.
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, streaming: false, tag: 'meta_chat', confidence: 0 }
              : m
          )
        );
        result = { aborted: true, tag: 'meta_chat', confidence: 0 };
      } else {
        result = {
          error: 'The Groq API did not respond. Check your connection and API key.',
        };
      }
    } finally {
      abortRef.current = null;
    }

    return { collectedText, result };
  }

  /* Send message — routes to the local model or the streaming Meta engine. */
  async function sendMessage(customText = '') {
    const messageText =
      typeof customText === 'string' && customText
        ? customText.trim()
        : input.trim();
    if (!messageText && files.length === 0) return;
    if (isSending) return;

    // A new outgoing message always re-engages auto-follow.
    reengageAutoScroll();

    const userMessageId = crypto.randomUUID();
    const userMessage = {
      id: userMessageId,
      role: 'user',
      content: messageText,
      files: [...files],
      engine, // remember which engine answered, for history fidelity
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setFiles([]);
    setError('');
    setIsSending(true);

    let sessionId = currentSessionId;
    let updatedSessions = [...chatSessions];

    if (!sessionId) {
      sessionId = crypto.randomUUID();
      setCurrentSessionId(sessionId);

      const newSession = {
        id: sessionId,
        title:
          messageText.length > 28
            ? messageText.substring(0, 28) + '...'
            : messageText,
        messages: newMessages,
        timestamp: Date.now(),
      };
      updatedSessions.unshift(newSession);
    } else {
      updatedSessions = updatedSessions.map((s) => {
        if (s.id === sessionId) {
          return { ...s, messages: newMessages, timestamp: Date.now() };
        }
        return s;
      });
    }
    saveSessions(updatedSessions);

    /* ---- Meta (streaming) ---- */
    if (engine === 'meta') {
      const assistantId = crypto.randomUUID();
      const assistantMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        tag: 'meta_chat',
        confidence: 0,
        streaming: true,
      };
      const withAssistant = [...newMessages, assistantMessage];
      setMessages(withAssistant);

      const { collectedText, result } = await streamMetaAnswer(
        messageText,
        assistantId,
        withAssistant,
        sessionId,
        updatedSessions
      );

      let finalMessages;
      if (result && result.error) {
        setError(result.error);
        const errMsg = {
          ...assistantMessage,
          content:
            'I could not reach the SakuPilot Meta engine. ' + result.error,
          tag: 'network_error',
          confidence: 0,
          streaming: false,
        };
        finalMessages = [...newMessages, errMsg];
        setMessages(finalMessages);
      } else {
        finalMessages = [
          ...newMessages,
          {
            ...assistantMessage,
            content: collectedText,
            tag: result?.tag || 'meta_chat',
            confidence: result?.confidence ?? 0,
            streaming: false,
          },
        ];
      }
      persistSession(sessionId, updatedSessions, finalMessages);
      setIsSending(false);
      return;
    }

    /* ---- Local model (existing JSON flow) ---- */
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
      const assistantMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response,
        tag: data.tag,
        confidence: data.confidence,
      };

      const finalMessages = [...newMessages, assistantMessage];
      setMessages(finalMessages);
      persistSession(sessionId, updatedSessions, finalMessages);
    } catch (requestError) {
      setError('The chatbot API did not respond. Check that the Python server is running.');
      const errMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content:
          'I could not reach the local chatbot API. Please check that your Python server.py backend is active and retrain status is ok.',
        tag: 'network_error',
        confidence: 0,
      };

      const finalErrMessages = [...newMessages, errMessage];
      setMessages(finalErrMessages);
      persistSession(sessionId, updatedSessions, finalErrMessages);
    } finally {
      setIsSending(false);
    }
  }

  function clearAllHistory() {
    if (
      window.confirm(
        'Are you sure you want to clear all chat history sessions?'
      )
    ) {
      setMessages(starterMessages);
      setCurrentSessionId(null);
      saveSessions([]);
      setError('');
    }
  }

  const handleSuggestionClick = (promptText) => {
    sendMessage(promptText);
  };

  const hasUserMessages = useMemo(
    () => messages.some((msg) => msg.role === 'user'),
    [messages]
  );

  /* Filter sessions by search */
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return chatSessions;
    const q = searchQuery.toLowerCase();
    return chatSessions.filter((s) =>
      (s.title || '').toLowerCase().includes(q)
    );
  }, [chatSessions, searchQuery]);

  /* Action icons inside input */
  const actionIcons = [
    <Button
      key="link"
      variant="ghost"
      size="icon"
      onClick={handleAddFile}
      aria-label="Attach file"
    >
      <Link className="h-[18px] w-[18px]" />
    </Button>,
    <Button
      key="mic"
      variant="ghost"
      size="icon"
      onClick={() => {
        setInput((prev) => prev + ' [Voice input activated] ');
      }}
      aria-label="Use microphone"
    >
      <Mic className="h-[18px] w-[18px]" />
    </Button>,
  ];

  /* ------------------------------------------------------------ */
  /* Render                                                        */
  /* ------------------------------------------------------------ */
  return (
    <div className="flex h-screen bg-bg text-text overflow-hidden">
      {/* ============================================================ */}
      {/* SIDEBAR                                                       */}
      {/* ============================================================ */}
      <aside
        className={classNames(
          'bg-surface-subtle border-r border-border flex flex-col transition-all duration-300 shrink-0 relative z-20',
          sidebarOpen ? 'w-[280px]' : 'w-0 lg:w-[68px] overflow-hidden'
        )}
      >
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Logo & toggle */}
          <div className="h-[64px] flex items-center px-4 gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-surface-hover rounded-lg text-text-secondary hover:text-text transition"
              aria-label="Toggle sidebar"
            >
              <PanelLeft size={18} />
            </button>
            {sidebarOpen && (
              <span className="font-serif font-semibold text-text text-[20px] tracking-tight flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-accent to-accent-hover text-white shadow-soft">
                  <BrainCircuit size={16} />
                </span>
                SakuPilot
              </span>
            )}
          </div>

          {/* New Chat Button */}
          <div className="px-3 pb-3">
            <button
              onClick={startNewChat}
              className={classNames(
                'flex items-center justify-center gap-2 bg-surface hover:bg-bg border border-border hover:border-border-strong text-text font-medium transition duration-200 shadow-soft hover:shadow-soft-lg',
                sidebarOpen
                  ? 'w-full h-10 px-4 rounded-xl text-[13.5px]'
                  : 'w-10 h-10 rounded-xl'
              )}
              title="New Chat"
            >
              <Plus size={16} className="text-accent" strokeWidth={2.5} />
              {sidebarOpen && <span>New chat</span>}
            </button>
          </div>

          {/* Search */}
          {sidebarOpen && (
            <div className="px-3 pb-2">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search chats"
                  className="w-full h-9 pl-9 pr-3 rounded-lg bg-surface border border-border text-[13px] text-text placeholder:text-text-faint outline-none focus:border-accent/40 focus:ring-2 focus:ring-accent/10 transition"
                />
              </div>
            </div>
          )}

          {/* Recent History List */}
          {sidebarOpen && (
            <div className="flex-1 flex flex-col min-h-0 mt-1 px-3 overflow-hidden">
              <h3 className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider px-2 mb-2">
                Recent
              </h3>
              <div className="flex-1 overflow-y-auto sidebar-scrollbar pr-1 space-y-0.5">
                {filteredSessions.length === 0 ? (
                  <div className="text-center py-8 px-3">
                    <p className="text-[12px] text-text-faint leading-relaxed">
                      {chatSessions.length === 0
                        ? 'No chats yet. Start a new conversation to see history here.'
                        : 'No chats match your search.'}
                    </p>
                  </div>
                ) : (
                  filteredSessions.map((session) => (
                    <div
                      key={session.id}
                      onClick={() => loadChatSession(session.id)}
                      className={classNames(
                        'group flex items-center justify-between rounded-lg py-2 px-3 text-[13px] cursor-pointer transition select-none',
                        currentSessionId === session.id
                          ? 'bg-surface text-text font-medium shadow-soft border border-border'
                          : 'text-text-secondary hover:bg-surface-hover hover:text-text'
                      )}
                    >
                      <span className="truncate max-w-[180px]">
                        {session.title}
                      </span>
                      <button
                        onClick={(e) => deleteChatSession(session.id, e)}
                        className="opacity-0 group-hover:opacity-100 hover:text-danger p-1 transition rounded-md hover:bg-danger-soft"
                        title="Delete Session"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Bottom */}
        <div className="p-3 border-t border-border">
          {sidebarOpen ? (
            <div className="space-y-2">
              {/* Local NLP status card */}
              <div className="bg-surface border border-border rounded-xl p-3 text-xs text-text-secondary shadow-soft">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-1.5">
                    <Zap size={12} className="text-accent" />
                    <span className="font-semibold text-text">
                      Local Engine
                    </span>
                  </div>
                  <span className="flex items-center gap-1.5 text-[10.5px] text-success bg-success-soft px-2 py-0.5 rounded-full border border-success/30 font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse"></span>
                    {status?.status ? 'Online' : 'Trained'}
                  </span>
                </div>
                <div className="space-y-1.5 text-[11.5px]">
                  <div className="flex justify-between">
                    <span className="text-text-tertiary">Intents</span>
                    <span className="font-mono text-text font-semibold">
                      {status?.intent_count ?? '--'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-tertiary">Patterns</span>
                    <span className="font-mono text-text font-semibold">
                      {status?.pattern_count ?? '--'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-tertiary">File</span>
                    <span className="truncate max-w-[110px] font-mono text-text">
                      {status?.model_file ?? '--'}
                    </span>
                  </div>
                </div>
              </div>

              {chatSessions.length > 0 && (
                <button
                  onClick={clearAllHistory}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface hover:bg-danger-soft hover:border-danger/30 px-3 py-2 text-xs font-medium text-text-secondary hover:text-danger transition shadow-soft"
                >
                  <Trash2 size={12} />
                  Clear All History
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 text-text-tertiary">
              <div
                className="h-2 w-2 rounded-full bg-success animate-pulse"
                title="NLP Engine Online"
              />
              <button
                onClick={clearAllHistory}
                className="hover:text-danger transition p-1"
                title="Clear All History"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ============================================================ */}
      {/* MAIN CHAT AREA                                                */}
      {/* ============================================================ */}
      <section className="flex flex-col flex-1 min-w-0 bg-bg relative">
        {/* Top Header */}
        <header className="h-[64px] border-b border-border px-6 flex items-center justify-between z-10 bg-bg/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 hover:bg-surface-subtle rounded-lg text-text-secondary hover:text-text transition"
                aria-label="Open sidebar"
              >
                <PanelLeft size={18} />
              </button>
            )}
            {/* Engine selector dropdown */}
            <div className="relative" ref={engineRef}>
              <button
                onClick={() => setEngineOpen((v) => !v)}
                className="flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 hover:bg-surface-subtle transition group"
                aria-label="Switch engine"
                aria-expanded={engineOpen}
              >
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-accent to-accent-hover text-white shadow-soft">
                  {engine === 'meta' ? <Cloud size={15} /> : <BrainCircuit size={15} />}
                </span>
                <span className="flex flex-col items-start leading-tight">
                  <span className="font-serif text-[17px] font-semibold text-text">
                    {ENGINES[engine].name}
                  </span>
                  <span className="text-[10px] text-text-tertiary font-medium uppercase tracking-wider">
                    {ENGINES[engine].badge}
                  </span>
                </span>
                <ChevronDown
                  size={15}
                  className={classNames(
                    'text-text-tertiary transition-transform ml-0.5',
                    engineOpen && 'rotate-180'
                  )}
                />
              </button>

              {engineOpen && (
                <div className="absolute left-0 top-full mt-2 w-[300px] rounded-2xl border border-border bg-surface shadow-soft-lg p-2 animate-popIn z-50">
                  <div className="px-3 pt-2 pb-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                      Engine
                    </span>
                  </div>
                  {Object.values(ENGINES).map((opt) => {
                    const active = opt.id === engine;
                    const disabled = opt.id === 'meta' && status?.meta_available === false;
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        disabled={disabled}
                        onClick={() => {
                          if (disabled) return;
                          setEngine(opt.id);
                          setEngineOpen(false);
                        }}
                        title={
                          disabled
                            ? 'Groq API key not configured on the server.'
                            : undefined
                        }
                        className={classNames(
                          'w-full flex items-start gap-3 rounded-xl p-2.5 text-left transition',
                          active
                            ? 'bg-accent-soft'
                            : disabled
                            ? 'opacity-50 cursor-not-allowed'
                            : 'hover:bg-surface-subtle'
                        )}
                      >
                        <span
                          className={classNames(
                            'grid h-8 w-8 place-items-center rounded-lg shrink-0',
                            active
                              ? 'bg-gradient-to-br from-accent to-accent-hover text-white'
                              : 'bg-surface-subtle text-text-tertiary'
                          )}
                        >
                          <Icon size={16} />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center gap-2">
                            <span className="text-[13.5px] font-semibold text-text">
                              {opt.name}
                            </span>
                            {active && (
                              <span className="text-[9.5px] font-semibold uppercase tracking-wider text-white bg-accent px-0.5 py-0.5 rounded-full whitespace-nowrap items-center">
                                
                              </span>
                            )}
                          </span>
                          <span className="block text-[11.5px] text-text-tertiary leading-snug mt-0.5">
                            {disabled ? 'Unavailable — no API key.' : opt.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {status?.knowledge_base && (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-text-secondary bg-surface px-3 py-1.5 rounded-full border border-border shadow-soft">
                <Database size={12} className="text-text-tertiary" />
                {status.knowledge_base}
              </span>
            )}

            {/* Settings dropdown with Light/Dark toggle */}
            <div className="relative" ref={settingsRef}>
              <button
                onClick={() => setSettingsOpen((v) => !v)}
                className={classNames(
                  'p-2 rounded-lg transition',
                  settingsOpen
                    ? 'bg-surface-subtle text-text'
                    : 'hover:bg-surface-subtle text-text-tertiary hover:text-text'
                )}
                aria-label="Settings"
                aria-expanded={settingsOpen}
              >
                <Settings size={16} />
              </button>

              {settingsOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl border border-border bg-surface shadow-soft-lg p-2 animate-popIn z-50">
                  <div className="px-3 pt-2 pb-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                      Appearance
                    </span>
                  </div>

                  <div className="px-2 pb-2">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-[13px] font-medium text-text">
                      {theme === 'dark' ? (
                        <Moon size={14} className="text-accent" />
                      ) : (
                        <Sun size={14} className="text-accent" />
                      )}
                      <span>Theme</span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-surface-subtle p-1">
                      <button
                        onClick={() => setTheme('light')}
                        className={classNames(
                          'flex items-center justify-center gap-1.5 rounded-lg py-2 text-[12.5px] font-medium transition',
                          theme === 'light'
                            ? 'bg-surface text-text shadow-soft'
                            : 'text-text-tertiary hover:text-text'
                        )}
                      >
                        <Sun size={13} />
                        Light
                      </button>
                      <button
                        onClick={() => setTheme('dark')}
                        className={classNames(
                          'flex items-center justify-center gap-1.5 rounded-lg py-2 text-[12.5px] font-medium transition',
                          theme === 'dark'
                            ? 'bg-surface text-text shadow-soft'
                            : 'text-text-tertiary hover:text-text'
                        )}
                      >
                        <Moon size={13} />
                        Dark
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-border mx-2 my-1" />
                  <div className="px-3 py-2 text-[11px] text-text-tertiary leading-relaxed">
                    Switch between light and dark mode. Your preference is saved
                    on this device.
                  </div>
                </div>
              )}
            </div>

            <div className="h-8 w-8 rounded-full bg-text text-bg flex items-center justify-center font-bold text-xs shadow-soft select-none ring-2 ring-surface">
              SP
            </div>
          </div>
        </header>

        {/* Scroll Area */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto chat-scrollbar px-4 sm:px-6 lg:px-8 py-6 pb-[180px]"
        >
          <div className="mx-auto max-w-[760px] w-full">
            {!hasUserMessages ? (
              /* ---------------- Welcome Page ---------------- */
              <div className="py-8 sm:py-16 flex flex-col justify-center animate-fadeInUp">
                <div className="inline-flex items-center gap-2 self-start mb-6 px-3 py-1.5 rounded-full bg-surface border border-border shadow-soft">
                  <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                  <span className="text-[11.5px] font-medium text-text-secondary tracking-wide">
                    Local NLP engine ready
                  </span>
                </div>

                <h1 className="font-serif text-[44px] sm:text-[56px] font-semibold tracking-tight leading-[1.1] text-text text-balance">
                  Hello, <span className="text-accent">User</span>
                </h1>
                <h2 className="font-serif text-[28px] sm:text-[34px] text-text-tertiary font-normal tracking-tight mt-2 text-balance">
                  How can I help you today?
                </h2>
                <p className="text-text-secondary text-[14.5px] mt-5 max-w-xl leading-relaxed">
                  Ask questions, test intents, or analyze response metrics using
                  the locally trained TF-IDF & Support Vector Classifier backend.
                  All processing happens on your machine.
                </p>

                {/* Suggestion Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-10">
                  {suggestedPrompts.map((card, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSuggestionClick(card.prompt)}
                      className="group relative bg-surface hover:bg-bg border border-border hover:border-border-strong rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft-lg text-left flex flex-col justify-between min-h-[130px] shadow-soft select-none"
                    >
                      <div>
                        <h4 className="text-text font-semibold text-[14.5px] group-hover:text-accent transition">
                          {card.title}
                        </h4>
                        <p className="text-text-tertiary text-[12.5px] mt-1.5 leading-relaxed">
                          {card.subtitle}
                        </p>
                      </div>
                      <div
                        className="self-end rounded-lg p-2 group-hover:scale-110 transition duration-200"
                        style={{ backgroundColor: `${card.accent}15` }}
                      >
                        {card.icon}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* ---------------- Conversation Thread ---------------- */
              <div className="space-y-10 py-4 animate-fadeIn">
                {messages
                  .filter((message) => !(message.streaming && !message.content))
                  .map((message) => (
                    <ChatMessageRow key={message.id} message={message} />
                  ))}

                {/* Loading state — shown while waiting for the assistant's
                    reply to actually start. For the local engine that's the
                    whole request (no placeholder exists until the response
                    lands). For Meta, a placeholder is created immediately so
                    tokens can stream into it — so here we keep showing the
                    dots only until that placeholder has received its first
                    bit of text, then hand off to the live-streaming bubble.
                    Without the `!content` check, this block would keep
                    rendering next to the real message for the whole stream
                    and only disappear at the very end, looking like an empty
                    message got deleted and swapped for the final answer. */}
                {isSending &&
                  (() => {
                    const lastMessage = messages[messages.length - 1];
                    return (
                      !lastMessage ||
                      lastMessage.role !== 'assistant' ||
                      (lastMessage.streaming && !lastMessage.content)
                    );
                  })() && (
                  <div className="flex items-start gap-4 animate-fadeIn">
                    <Avatar role="assistant" size={32} />
                    <div className="flex-1 space-y-3 pt-1">
                      <div className="text-[13px] text-text-tertiary flex items-center gap-2 font-medium">
                        <span className="flex gap-1">
                          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-accent inline-block" />
                          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-accent inline-block" />
                          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-accent inline-block" />
                        </span>
                        <span>Searching intents...</span>
                      </div>
                      <div className="space-y-2 max-w-[600px]">
                        <div className="h-3 bg-surface-subtle rounded-md shimmer-bg w-[90%]"></div>
                        <div className="h-3 bg-surface-subtle rounded-md shimmer-bg w-[75%]"></div>
                        <div className="h-3 bg-surface-subtle rounded-md shimmer-bg w-[55%]"></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mt-4 p-3.5 rounded-xl bg-warning-soft border border-warning/40 text-warning text-xs flex items-center gap-2.5 animate-fadeIn">
                <Info size={15} className="text-warning shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>

        {/* Scroll-to-latest button (only when not stuck to bottom) */}
        {showScrollBottom && (
          <button
            onClick={() => {
              reengageAutoScroll();
              scrollToBottom('smooth');
            }}
            className="absolute bottom-[150px] left-1/2 -translate-x-1/2 z-20 grid h-9 w-9 place-items-center rounded-full border border-border bg-surface text-text-secondary hover:text-text shadow-soft-lg transition animate-popIn"
            aria-label="Scroll to latest message"
            title="Scroll to latest"
          >
            <ChevronDown size={18} />
          </button>
        )}

        {/* ---------------- Floating Bottom Input ---------------- */}
        <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-6 lg:px-8 py-5 bg-gradient-to-t from-bg via-bg/95 to-transparent">
          <div className="mx-auto max-w-[760px] w-full flex flex-col items-center">
            <div className="w-full">
              <AdvancedChatInput
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Ask ${ENGINES[engine].name} anything...`}
                files={files}
                onFileRemove={handleRemoveFile}
                onSend={() => sendMessage()}
                actionIcons={actionIcons}
                isSending={isSending}
                isStreaming={isSending && engine === 'meta'}
                onStop={stopStreaming}
                textareaProps={{
                  onKeyDown: (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  },
                }}
              />
            </div>

            <p className="text-[11px] text-text-faint mt-3 text-center leading-normal max-w-[600px] select-none">
              SakuPilot local NLP model may display inaccurate info. Powered by{' '}
              <code className="bg-surface-subtle px-1.5 py-0.5 rounded-md border border-border text-[10.5px] text-text-secondary font-mono">
                intents.json
              </code>{' '}
              — retrains automatically on modifications.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* ChatMessageRow                                                   */
/* ---------------------------------------------------------------- */
function ChatMessageRow({ message }) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);

  const confidencePct =
    typeof message.confidence === 'number'
      ? Math.round(message.confidence * 100)
      : null;

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ----- User message ----- */
  if (isUser) {
    return (
      <div className="flex items-start gap-4 flex-row-reverse animate-fadeInUp">
        <Avatar role="user" size={32} />

        <div className="flex-1 text-right">
          <div className="inline-block text-left bg-user-bubble border border-border text-text rounded-2xl rounded-tr-md px-4 py-3 text-[15px] leading-relaxed max-w-[85%] shadow-soft">
            <div className="whitespace-pre-wrap break-words">
              {message.content}
            </div>

            {message.files && message.files.length > 0 && (
              <div className="mt-2.5 pt-2 border-t border-border flex flex-wrap gap-1.5 justify-end">
                {message.files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-1 bg-surface border border-border text-[10.5px] text-text-secondary rounded-full px-2 py-0.5"
                  >
                    <FileText size={10} className="text-accent" />
                    <span className="truncate max-w-[100px]">{file.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ----- Assistant message ----- */
  const isSystem = message.tag === 'system';
  const isError = message.tag === 'network_error';

  return (
    <div className="flex items-start gap-4 animate-fadeInUp">
      <Avatar role="assistant" size={32} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[13px] font-semibold text-text">
            SakuPilot
          </span>
          {isSystem && (
            <span className="text-[10px] uppercase tracking-wider text-text-tertiary bg-surface-subtle border border-border px-1.5 py-0.5 rounded-full font-medium">
              System
            </span>
          )}
          {isError && (
            <span className="text-[10px] uppercase tracking-wider text-danger bg-danger-soft border border-danger/30 px-1.5 py-0.5 rounded-full font-medium">
              Error
            </span>
          )}
        </div>

        <div
          className={classNames(
            'prose prose-neutral max-w-none text-text',
            isError && 'text-danger'
          )}
        >
          {formatMessageContent(message.content)}
        </div>

        {/* Intent Inspector */}
        {message.tag && !isSystem && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowMetadata(!showMetadata)}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase text-text-secondary hover:text-text transition py-1.5 px-2.5 rounded-md bg-surface hover:bg-surface-subtle border border-border shadow-soft"
            >
              <Info size={11} className="text-accent" />
              <span>Intent Inspector</span>
              {showMetadata ? (
                <ChevronUp size={12} />
              ) : (
                <ChevronDown size={12} />
              )}
            </button>

            {showMetadata && (
              <div className="mt-2 p-3.5 bg-surface border border-border rounded-xl max-w-md space-y-2 text-xs text-text-secondary shadow-soft animate-fadeIn">
                <div className="flex justify-between items-center">
                  <span className="text-text-tertiary">Matched Intent</span>
                  <code className="bg-accent-soft px-2 py-0.5 rounded-md text-accent-hover font-mono font-medium border border-accent-soft">
                    {message.tag}
                  </code>
                </div>
                {confidencePct !== null && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-text-tertiary">Confidence</span>
                      <span className="font-mono text-text font-semibold">
                        {confidencePct}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-subtle overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-accent to-accent-hover transition-all duration-500"
                        style={{ width: `${confidencePct}%` }}
                      />
                    </div>
                  </>
                )}
                <div className="h-[1px] bg-border my-2"></div>
                <p className="text-[10.5px] text-text-tertiary leading-relaxed">
                  Matched using TF-IDF representation and Linear Support Vector
                  Classifier trained offline from your intents.json corpus.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Quick Actions */}
        {!isSystem && (
          <div className="flex items-center gap-1 mt-3 -ml-1.5">
            <button
              onClick={handleCopy}
              className="p-1.5 hover:bg-surface-hover hover:text-text rounded-md text-text-tertiary transition"
              title="Copy response"
              type="button"
            >
              {copied ? (
                <Check size={14} className="text-success" />
              ) : (
                <Copy size={14} />
              )}
            </button>
            <button
              className="p-1.5 hover:bg-surface-hover hover:text-text rounded-md text-text-tertiary transition"
              title="Good response"
              type="button"
            >
              <ThumbsUp size={14} />
            </button>
            <button
              className="p-1.5 hover:bg-surface-hover hover:text-text rounded-md text-text-tertiary transition"
              title="Bad response"
              type="button"
            >
              <ThumbsDown size={14} />
            </button>
            <button
              className="p-1.5 hover:bg-surface-hover hover:text-text rounded-md text-text-tertiary transition"
              title="Share response"
              type="button"
            >
              <Share2 size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Mount                                                            */
/* ---------------------------------------------------------------- */
const root = createRoot(document.getElementById('root'));
root.render(<App />);