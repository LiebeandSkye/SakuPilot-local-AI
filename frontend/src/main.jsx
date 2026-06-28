import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  ArrowUp,
  Zap,
} from 'lucide-react';
import './index.css';
import { AdvancedChatInput, Button } from './chatinput';

/* ---------------------------------------------------------------- */
/* Constants                                                        */
/* ---------------------------------------------------------------- */
const STORAGE_HISTORY_KEY = 'sakupilot_chat_history';
const STORAGE_THEME_KEY = 'sakupilot_theme';

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
/* CodeBlock — soft cream code panel                                */
/* ---------------------------------------------------------------- */
function CodeBlock({ code, language }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-4 rounded-xl overflow-hidden border border-[#e8e6df] bg-[#fbfaf6] font-mono text-sm shadow-soft">
      <div className="flex items-center justify-between px-4 py-2 bg-[#f4f3ee] text-[#8a8680] text-xs border-b border-[#e8e6df]">
        <span className="uppercase tracking-wider font-semibold">{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 hover:text-[#1a1a1a] transition py-1 px-2 rounded-md hover:bg-[#efece4]"
          type="button"
        >
          {copied ? (
            <>
              <Check size={13} className="text-[#4f7a4f]" />
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
      <pre className="p-4 overflow-x-auto text-[#1a1a1a] leading-6 text-[13px] chat-scrollbar">
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
        className="whitespace-pre-wrap break-words leading-7 my-2 text-[15px] text-[#1a1a1a]"
      >
        {inlineParts.map((subPart, subIdx) => {
          if (subPart.startsWith('`') && subPart.endsWith('`')) {
            return (
              <code
                key={subIdx}
                className="bg-[#f4f3ee] text-[#c4654a] px-1.5 py-0.5 rounded-md text-[13px] font-mono border border-[#e8e6df]"
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
        className="rounded-full bg-[#1a1a1a] text-white flex items-center justify-center shadow-soft shrink-0 select-none ring-2 ring-white"
      >
        <UserRound size={size * 0.5} />
      </div>
    );
  }
  return (
    <div
      style={dim}
      className="rounded-full bg-gradient-to-br from-[#d97757] to-[#c4654a] text-white flex items-center justify-center shadow-soft shrink-0 select-none ring-2 ring-white"
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

  const bottomRef = useRef(null);

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

  /* Auto-scroll */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isSending]);

  /* Session handlers */
  const startNewChat = () => {
    setCurrentSessionId(null);
    setMessages(starterMessages);
    setFiles([]);
    setInput('');
    setError('');
  };

  const loadChatSession = (id) => {
    const session = chatSessions.find((s) => s.id === id);
    if (session) {
      setCurrentSessionId(id);
      setMessages(session.messages);
      setFiles([]);
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
      icon: <FileText className="h-4 w-4 text-[#d97757]" />,
    };
    setFiles((prevFiles) => [...prevFiles, newFile]);
  };

  const handleRemoveFile = (id) => {
    setFiles((prevFiles) => prevFiles.filter((file) => file.id !== id));
  };

  /* Send message */
  async function sendMessage(customText = '') {
    const messageText =
      typeof customText === 'string' && customText
        ? customText.trim()
        : input.trim();
    if (!messageText && files.length === 0) return;
    if (isSending) return;

    const userMessageId = crypto.randomUUID();
    const userMessage = {
      id: userMessageId,
      role: 'user',
      content: messageText,
      files: [...files],
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

      const savedSessions = updatedSessions.map((s) => {
        if (s.id === sessionId) {
          return { ...s, messages: finalMessages };
        }
        return s;
      });
      saveSessions(savedSessions);
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

      const savedSessions = updatedSessions.map((s) => {
        if (s.id === sessionId) {
          return { ...s, messages: finalErrMessages };
        }
        return s;
      });
      saveSessions(savedSessions);
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
    <div className="flex h-screen bg-[#fafaf7] text-[#1a1a1a] overflow-hidden">
      {/* ============================================================ */}
      {/* SIDEBAR                                                       */}
      {/* ============================================================ */}
      <aside
        className={classNames(
          'bg-[#f4f3ee] border-r border-[#e8e6df] flex flex-col transition-all duration-300 shrink-0 relative z-20',
          sidebarOpen ? 'w-[280px]' : 'w-0 lg:w-[68px] overflow-hidden'
        )}
      >
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Logo & toggle */}
          <div className="h-[64px] flex items-center px-4 gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-[#efece4] rounded-lg text-[#57534d] hover:text-[#1a1a1a] transition"
              aria-label="Toggle sidebar"
            >
              <PanelLeft size={18} />
            </button>
            {sidebarOpen && (
              <span className="font-serif font-semibold text-[#1a1a1a] text-[20px] tracking-tight flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-[#d97757] to-[#c4654a] text-white shadow-soft">
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
                'flex items-center justify-center gap-2 bg-white hover:bg-[#fafaf7] border border-[#e8e6df] hover:border-[#d8d4ca] text-[#1a1a1a] font-medium transition duration-200 shadow-soft hover:shadow-soft-lg',
                sidebarOpen
                  ? 'w-full h-10 px-4 rounded-xl text-[13.5px]'
                  : 'w-10 h-10 rounded-xl'
              )}
              title="New Chat"
            >
              <Plus size={16} className="text-[#d97757]" strokeWidth={2.5} />
              {sidebarOpen && <span>New chat</span>}
            </button>
          </div>

          {/* Search */}
          {sidebarOpen && (
            <div className="px-3 pb-2">
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#b8b3aa]"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search chats"
                  className="w-full h-9 pl-9 pr-3 rounded-lg bg-white border border-[#e8e6df] text-[13px] text-[#1a1a1a] placeholder:text-[#b8b3aa] outline-none focus:border-[#d97757]/40 focus:ring-2 focus:ring-[#d97757]/10 transition"
                />
              </div>
            </div>
          )}

          {/* Recent History List */}
          {sidebarOpen && (
            <div className="flex-1 flex flex-col min-h-0 mt-1 px-3 overflow-hidden">
              <h3 className="text-[11px] font-semibold text-[#8a8680] uppercase tracking-wider px-2 mb-2">
                Recent
              </h3>
              <div className="flex-1 overflow-y-auto sidebar-scrollbar pr-1 space-y-0.5">
                {filteredSessions.length === 0 ? (
                  <div className="text-center py-8 px-3">
                    <p className="text-[12px] text-[#b8b3aa] leading-relaxed">
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
                          ? 'bg-white text-[#1a1a1a] font-medium shadow-soft border border-[#e8e6df]'
                          : 'text-[#57534d] hover:bg-[#efece4] hover:text-[#1a1a1a]'
                      )}
                    >
                      <span className="truncate max-w-[180px]">
                        {session.title}
                      </span>
                      <button
                        onClick={(e) => deleteChatSession(session.id, e)}
                        className="opacity-0 group-hover:opacity-100 hover:text-[#c44a3a] p-1 transition rounded-md hover:bg-[#f8e5e0]"
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
        <div className="p-3 border-t border-[#e8e6df]">
          {sidebarOpen ? (
            <div className="space-y-2">
              {/* Local NLP status card */}
              <div className="bg-white border border-[#e8e6df] rounded-xl p-3 text-xs text-[#57534d] shadow-soft">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-1.5">
                    <Zap size={12} className="text-[#d97757]" />
                    <span className="font-semibold text-[#1a1a1a]">
                      Local Engine
                    </span>
                  </div>
                  <span className="flex items-center gap-1.5 text-[10.5px] text-[#4f7a4f] bg-[#e8f0e6] px-2 py-0.5 rounded-full border border-[#d4e4d0] font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#4f7a4f] animate-pulse"></span>
                    {status?.status ? 'Online' : 'Trained'}
                  </span>
                </div>
                <div className="space-y-1.5 text-[11.5px]">
                  <div className="flex justify-between">
                    <span className="text-[#8a8680]">Intents</span>
                    <span className="font-mono text-[#1a1a1a] font-semibold">
                      {status?.intent_count ?? '--'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8a8680]">Patterns</span>
                    <span className="font-mono text-[#1a1a1a] font-semibold">
                      {status?.pattern_count ?? '--'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8a8680]">File</span>
                    <span className="truncate max-w-[110px] font-mono text-[#1a1a1a]">
                      {status?.model_file ?? '--'}
                    </span>
                  </div>
                </div>
              </div>

              {chatSessions.length > 0 && (
                <button
                  onClick={clearAllHistory}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#e8e6df] bg-white hover:bg-[#f8e5e0] hover:border-[#c44a3a]/30 px-3 py-2 text-xs font-medium text-[#57534d] hover:text-[#c44a3a] transition shadow-soft"
                >
                  <Trash2 size={12} />
                  Clear All History
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 text-[#8a8680]">
              <div
                className="h-2 w-2 rounded-full bg-[#4f7a4f] animate-pulse"
                title="NLP Engine Online"
              />
              <button
                onClick={clearAllHistory}
                className="hover:text-[#c44a3a] transition p-1"
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
      <section className="flex flex-col flex-1 min-w-0 bg-[#fafaf7] relative">
        {/* Top Header */}
        <header className="h-[64px] border-b border-[#e8e6df] px-6 flex items-center justify-between z-10 bg-[#fafaf7]/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 hover:bg-[#f4f3ee] rounded-lg text-[#57534d] hover:text-[#1a1a1a] transition"
                aria-label="Open sidebar"
              >
                <PanelLeft size={18} />
              </button>
            )}
            <div className="flex items-center gap-2.5">
              <span className="font-serif text-[18px] font-semibold text-[#1a1a1a]">
                SakuPilot
              </span>
              <span className="text-[10.5px] bg-[#f4f3ee] text-[#57534d] px-2 py-0.5 rounded-full font-medium border border-[#e8e6df] uppercase tracking-wider">
                Local 1.0
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {status?.knowledge_base && (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-[#57534d] bg-white px-3 py-1.5 rounded-full border border-[#e8e6df] shadow-soft">
                <Database size={12} className="text-[#8a8680]" />
                {status.knowledge_base}
              </span>
            )}
            <button className="p-2 hover:bg-[#f4f3ee] rounded-lg text-[#57534d] hover:text-[#1a1a1a] transition">
              <Settings size={16} />
            </button>
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#1a1a1a] to-[#3a3a3a] text-white flex items-center justify-center font-bold text-xs shadow-soft select-none ring-2 ring-white">
              SP
            </div>
          </div>
        </header>

        {/* Scroll Area */}
        <div className="flex-1 overflow-y-auto chat-scrollbar px-4 sm:px-6 lg:px-8 py-6 pb-[180px]">
          <div className="mx-auto max-w-[760px] w-full">
            {!hasUserMessages ? (
              /* ---------------- Welcome Page ---------------- */
              <div className="py-8 sm:py-16 flex flex-col justify-center animate-fadeInUp">
                <div className="inline-flex items-center gap-2 self-start mb-6 px-3 py-1.5 rounded-full bg-white border border-[#e8e6df] shadow-soft">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#4f7a4f] animate-pulse" />
                  <span className="text-[11.5px] font-medium text-[#57534d] tracking-wide">
                    Local NLP engine ready
                  </span>
                </div>

                <h1 className="font-serif text-[44px] sm:text-[56px] font-semibold tracking-tight leading-[1.1] text-[#1a1a1a] text-balance">
                  Hello, <span className="text-[#d97757]">User</span>
                </h1>
                <h2 className="font-serif text-[28px] sm:text-[34px] text-[#8a8680] font-normal tracking-tight mt-2 text-balance">
                  How can I help you today?
                </h2>
                <p className="text-[#57534d] text-[14.5px] mt-5 max-w-xl leading-relaxed">
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
                      className="group relative bg-white hover:bg-[#fafaf7] border border-[#e8e6df] hover:border-[#d8d4ca] rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft-lg text-left flex flex-col justify-between min-h-[130px] shadow-soft select-none"
                    >
                      <div>
                        <h4 className="text-[#1a1a1a] font-semibold text-[14.5px] group-hover:text-[#d97757] transition">
                          {card.title}
                        </h4>
                        <p className="text-[#8a8680] text-[12.5px] mt-1.5 leading-relaxed">
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
                {messages.map((message) => (
                  <ChatMessageRow key={message.id} message={message} />
                ))}

                {/* Loading state */}
                {isSending && (
                  <div className="flex items-start gap-4 animate-fadeIn">
                    <Avatar role="assistant" size={32} />
                    <div className="flex-1 space-y-3 pt-1">
                      <div className="text-[13px] text-[#8a8680] flex items-center gap-2 font-medium">
                        <span className="flex gap-1">
                          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[#d97757] inline-block" />
                          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[#d97757] inline-block" />
                          <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[#d97757] inline-block" />
                        </span>
                        <span>Searching intents...</span>
                      </div>
                      <div className="space-y-2 max-w-[600px]">
                        <div className="h-3 bg-[#f4f3ee] rounded-md shimmer-bg w-[90%]"></div>
                        <div className="h-3 bg-[#f4f3ee] rounded-md shimmer-bg w-[75%]"></div>
                        <div className="h-3 bg-[#f4f3ee] rounded-md shimmer-bg w-[55%]"></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mt-4 p-3.5 rounded-xl bg-[#faf2dc] border border-[#e8d99a] text-[#8a6914] text-xs flex items-center gap-2.5 animate-fadeIn">
                <Info size={15} className="text-[#b8862f] shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* ---------------- Floating Bottom Input ---------------- */}
        <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-6 lg:px-8 py-5 bg-gradient-to-t from-[#fafaf7] via-[#fafaf7]/95 to-transparent">
          <div className="mx-auto max-w-[760px] w-full flex flex-col items-center">
            <div className="w-full">
              <AdvancedChatInput
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask SakuPilot anything..."
                files={files}
                onFileRemove={handleRemoveFile}
                onSend={() => sendMessage()}
                actionIcons={actionIcons}
                isSending={isSending}
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

            <p className="text-[11px] text-[#b8b3aa] mt-3 text-center leading-normal max-w-[600px] select-none">
              SakuPilot local NLP model may display inaccurate info. Powered by{' '}
              <code className="bg-[#f4f3ee] px-1.5 py-0.5 rounded-md border border-[#e8e6df] text-[10.5px] text-[#57534d] font-mono">
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
          <div className="inline-block text-left bg-[#f4f3ee] border border-[#e8e6df] text-[#1a1a1a] rounded-2xl rounded-tr-md px-4 py-3 text-[15px] leading-relaxed max-w-[85%] shadow-soft">
            <div className="whitespace-pre-wrap break-words">
              {message.content}
            </div>

            {message.files && message.files.length > 0 && (
              <div className="mt-2.5 pt-2 border-t border-[#e8e6df] flex flex-wrap gap-1.5 justify-end">
                {message.files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-1 bg-white border border-[#e8e6df] text-[10.5px] text-[#57534d] rounded-full px-2 py-0.5"
                  >
                    <FileText size={10} className="text-[#d97757]" />
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
          <span className="text-[13px] font-semibold text-[#1a1a1a]">
            SakuPilot
          </span>
          {isSystem && (
            <span className="text-[10px] uppercase tracking-wider text-[#8a8680] bg-[#f4f3ee] border border-[#e8e6df] px-1.5 py-0.5 rounded-full font-medium">
              System
            </span>
          )}
          {isError && (
            <span className="text-[10px] uppercase tracking-wider text-[#c44a3a] bg-[#f8e5e0] border border-[#c44a3a]/30 px-1.5 py-0.5 rounded-full font-medium">
              Error
            </span>
          )}
        </div>

        <div
          className={classNames(
            'prose prose-neutral max-w-none text-[#1a1a1a]',
            isError && 'text-[#c44a3a]'
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
              className="inline-flex items-center gap-1.5 text-[11px] font-medium tracking-wide uppercase text-[#57534d] hover:text-[#1a1a1a] transition py-1.5 px-2.5 rounded-md bg-white hover:bg-[#f4f3ee] border border-[#e8e6df] shadow-soft"
            >
              <Info size={11} className="text-[#d97757]" />
              <span>Intent Inspector</span>
              {showMetadata ? (
                <ChevronUp size={12} />
              ) : (
                <ChevronDown size={12} />
              )}
            </button>

            {showMetadata && (
              <div className="mt-2 p-3.5 bg-white border border-[#e8e6df] rounded-xl max-w-md space-y-2 text-xs text-[#57534d] shadow-soft animate-fadeIn">
                <div className="flex justify-between items-center">
                  <span className="text-[#8a8680]">Matched Intent</span>
                  <code className="bg-[#f7ece5] px-2 py-0.5 rounded-md text-[#c4654a] font-mono font-medium border border-[#f0ddd0]">
                    {message.tag}
                  </code>
                </div>
                {confidencePct !== null && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-[#8a8680]">Confidence</span>
                      <span className="font-mono text-[#1a1a1a] font-semibold">
                        {confidencePct}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#f4f3ee] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#d97757] to-[#c4654a] transition-all duration-500"
                        style={{ width: `${confidencePct}%` }}
                      />
                    </div>
                  </>
                )}
                <div className="h-[1px] bg-[#e8e6df] my-2"></div>
                <p className="text-[10.5px] text-[#8a8680] leading-relaxed">
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
              className="p-1.5 hover:bg-[#f4f3ee] hover:text-[#1a1a1a] rounded-md text-[#8a8680] transition"
              title="Copy response"
              type="button"
            >
              {copied ? (
                <Check size={14} className="text-[#4f7a4f]" />
              ) : (
                <Copy size={14} />
              )}
            </button>
            <button
              className="p-1.5 hover:bg-[#f4f3ee] hover:text-[#1a1a1a] rounded-md text-[#8a8680] transition"
              title="Good response"
              type="button"
            >
              <ThumbsUp size={14} />
            </button>
            <button
              className="p-1.5 hover:bg-[#f4f3ee] hover:text-[#1a1a1a] rounded-md text-[#8a8680] transition"
              title="Bad response"
              type="button"
            >
              <ThumbsDown size={14} />
            </button>
            <button
              className="p-1.5 hover:bg-[#f4f3ee] hover:text-[#1a1a1a] rounded-md text-[#8a8680] transition"
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
