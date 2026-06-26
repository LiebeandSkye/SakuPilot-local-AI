import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Sparkles,
  Loader2,
  Trash2,
  Menu,
  Plus,
  HelpCircle,
  History,
  Settings,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Share2,
  Database,
  BrainCircuit,
  MessageSquareText,
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
  ChevronUp
} from 'lucide-react';
import './index.css';
import { AdvancedChatInput, Button } from './chatinput';

// Local storage keys
const STORAGE_HISTORY_KEY = 'sakupilot_chat_history';
const STORAGE_THEME_KEY = 'sakupilot_theme';

const starterMessages = [
  {
    id: crypto.randomUUID(),
    role: 'assistant',
    content: 'Hello! I am trained locally from intents.json and ready to chat. Feel free to ask me anything or click a suggestion below to start!',
    tag: 'system',
    confidence: 1,
  },
];

// Helper to join classes
function classNames(...values) {
  return values.filter(Boolean).join(' ');
}

// Codeblock Formatter
function CodeBlock({ code, language }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className="my-4 rounded-xl overflow-hidden border border-neutral-800 bg-[#0e0e10] font-mono text-sm shadow-md">
      <div className="flex items-center justify-between px-4 py-2 bg-neutral-900 text-neutral-400 text-xs border-b border-neutral-800">
        <span className="uppercase tracking-wider font-semibold">{language}</span>
        <button 
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-white transition py-1 px-2 rounded hover:bg-neutral-800"
          type="button"
        >
          {copied ? (
            <>
              <Check size={13} className="text-green-400" />
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
      <pre className="p-4 overflow-x-auto text-neutral-200 leading-6 text-[13px] chat-scrollbar">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// Formats message contents, pulling out code blocks and backticks
function formatMessageContent(content) {
  if (!content) return null;
  
  const parts = content.split(/(```[\s\S]*?```)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      const codeLines = part.slice(3, -3).trim().split('\n');
      let language = 'code';
      let code = part.slice(3, -3).trim();
      
      if (codeLines[0] && codeLines[0].length < 15 && !codeLines[0].includes(' ') && !codeLines[0].includes('(')) {
        language = codeLines[0];
        code = codeLines.slice(1).join('\n');
      }
      
      return <CodeBlock key={idx} code={code} language={language} />;
    }
    
    // Support inline backticks
    const inlineParts = part.split(/(`[^`\n]+`)/g);
    return (
      <p key={idx} className="whitespace-pre-wrap break-words leading-7 my-2 text-[15px] text-[#e3e3e3]">
        {inlineParts.map((subPart, subIdx) => {
          if (subPart.startsWith('`') && subPart.endsWith('`')) {
            return (
              <code key={subIdx} className="bg-neutral-800 text-neutral-200 px-1.5 py-0.5 rounded text-sm font-mono border border-neutral-700/30">
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

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [files, setFiles] = useState([]);
  
  // Local Chat History List
  const [chatSessions, setChatSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);

  const bottomRef = useRef(null);

  // Suggested Prompts Grid Data
  const suggestedPrompts = [
    {
      title: "Introduce yourself",
      subtitle: "Ask who the bot is and what its core functionalities are.",
      prompt: "Who are you and what can you do?",
      icon: <Compass className="h-5 w-5 text-blue-400" />
    },
    {
      title: "Analyze Intents database",
      subtitle: "Query the chatbot about how intent-based training works.",
      prompt: "How does intents.json train this model?",
      icon: <BrainCircuit className="h-5 w-5 text-purple-400" />
    },
    {
      title: "Model capabilities",
      subtitle: "Inquire about TF-IDF text representation and confidence rates.",
      prompt: "Tell me how the TF-IDF and SVC classifiers work.",
      icon: <Code className="h-5 w-5 text-red-400" />
    },
    {
      title: "Retraining procedure",
      subtitle: "Ask how to edit intents.json to add new chat prompts.",
      prompt: "How can I retrain you on new intents?",
      icon: <Lightbulb className="h-5 w-5 text-amber-400" />
    }
  ];

  // Fetch status of local backend
  useEffect(() => {
    fetch('/api/status')
      .then((response) => response.json())
      .then((data) => {
        setStatus(data);
      })
      .catch(() => setError('Backend is not reachable. Start Python with: python server.py'));
  }, []);

  // Load chat history from localStorage on startup
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_HISTORY_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setChatSessions(parsed);
        if (parsed.length > 0) {
          // Load the latest active session
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

  // Save chat sessions to local storage when changed
  const saveSessions = (updatedSessions) => {
    setChatSessions(updatedSessions);
    localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(updatedSessions));
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isSending]);

  // Handler to start a completely new chat session
  const startNewChat = () => {
    setCurrentSessionId(null);
    setMessages(starterMessages);
    setFiles([]);
    setInput('');
  };

  // Handler to load a saved session
  const loadChatSession = (id) => {
    const session = chatSessions.find(s => s.id === id);
    if (session) {
      setCurrentSessionId(id);
      setMessages(session.messages);
      setFiles([]);
    }
  };

  // Handler to delete a saved session
  const deleteChatSession = (id, event) => {
    event.stopPropagation();
    const updated = chatSessions.filter(s => s.id !== id);
    saveSessions(updated);
    if (currentSessionId === id) {
      startNewChat();
    }
  };

  // Handler to add a mock file attachment inside main.jsx
  const handleAddFile = () => {
    const newFile = {
      id: Date.now(),
      name: `document_${files.length + 1}.pdf`,
      icon: <FileText className="h-4 w-4 text-blue-400" />,
    };
    setFiles((prevFiles) => [...prevFiles, newFile]);
  };

  const handleRemoveFile = (id) => {
    setFiles((prevFiles) => prevFiles.filter((file) => file.id !== id));
  };

  // Main sendMessage function adapted to handle chat sessions
  async function sendMessage(customText = '') {
    const messageText = (typeof customText === 'string' && customText) ? customText.trim() : input.trim();
    if (!messageText && files.length === 0) return;
    if (isSending) return;

    const userMessageId = crypto.randomUUID();
    const userMessage = {
      id: userMessageId,
      role: 'user',
      content: messageText,
      files: [...files] // snapshot attachments
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setFiles([]);
    setError('');
    setIsSending(true);

    // Save/update session immediately in local history
    let sessionId = currentSessionId;
    let updatedSessions = [...chatSessions];

    if (!sessionId) {
      sessionId = crypto.randomUUID();
      setCurrentSessionId(sessionId);
      
      const newSession = {
        id: sessionId,
        title: messageText.length > 26 ? messageText.substring(0, 26) + '...' : messageText,
        messages: newMessages,
        timestamp: Date.now()
      };
      updatedSessions.unshift(newSession);
    } else {
      updatedSessions = updatedSessions.map(s => {
        if (s.id === sessionId) {
          return {
            ...s,
            messages: newMessages,
            timestamp: Date.now()
          };
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

      // Save updated assistant response in history
      const savedSessions = updatedSessions.map(s => {
        if (s.id === sessionId) {
          return {
            ...s,
            messages: finalMessages
          };
        }
        return s;
      });
      saveSessions(savedSessions);

    } catch (requestError) {
      setError('The chatbot API did not respond. Check that the Python server is running.');
      const errMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'I could not reach the local chatbot API. Please check that your Python server.py backend is active and retrain status is ok.',
        tag: 'network_error',
        confidence: 0,
      };
      
      const finalErrMessages = [...newMessages, errMessage];
      setMessages(finalErrMessages);

      const savedSessions = updatedSessions.map(s => {
        if (s.id === sessionId) {
          return {
            ...s,
            messages: finalErrMessages
          };
        }
        return s;
      });
      saveSessions(savedSessions);
    } finally {
      setIsSending(false);
    }
  }

  function clearAllHistory() {
    if (window.confirm("Are you sure you want to clear all chat history sessions?")) {
      setMessages(starterMessages);
      setCurrentSessionId(null);
      saveSessions([]);
      setError('');
    }
  }

  // Pre-fill input box with prompt card suggestion
  const handleSuggestionClick = (promptText) => {
    sendMessage(promptText);
  };

  // Determine if we should show the Greeting screen
  // If there are no user messages in the thread, we display the welcome page
  const hasUserMessages = useMemo(() => {
    return messages.some(msg => msg.role === 'user');
  }, [messages]);

  // Filter custom actions icons
  const actionIcons = [
    <Button 
      key="link" 
      variant="ghost" 
      size="icon" 
      onClick={handleAddFile}
      aria-label="Attach link"
    >
      <Link className="h-4.5 w-4.5 text-neutral-400" />
    </Button>,
    <Button 
      key="mic" 
      variant="ghost" 
      size="icon" 
      onClick={() => {
        setInput(prev => prev + " [Voice input activated] ");
      }}
      aria-label="Use microphone"
    >
      <Mic className="h-4.5 w-4.5 text-neutral-400" />
    </Button>,
  ];

  return (
    <div className="flex h-screen bg-[#131314] text-neutral-200 overflow-hidden font-sans">
      {/* --- Sidebar Area --- */}
      <aside 
        className={classNames(
          "bg-[#1e1f20] border-r border-neutral-800 flex flex-col justify-between transition-all duration-300 shrink-0",
          sidebarOpen ? "w-[280px]" : "w-0 lg:w-[68px] overflow-hidden lg:items-center"
        )}
      >
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Sidebar Toggle & Header */}
          <div className="h-[60px] flex items-center px-4.5 gap-4">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-neutral-800 rounded-full text-neutral-400 hover:text-white transition"
              aria-label="Toggle sidebar"
            >
              <Menu size={20} />
            </button>
            {sidebarOpen && (
              <span className="font-bold text-white text-[16px] tracking-wide flex items-center gap-1.5">
                <BrainCircuit size={18} className="text-blue-400" /> SakuPilot
              </span>
            )}
          </div>

          {/* New Chat Button */}
          <div className="p-3">
            <button
              onClick={startNewChat}
              className={classNames(
                "flex items-center justify-center gap-3 bg-[#1a1a1a] hover:bg-[#252525] border border-neutral-800 text-neutral-300 hover:text-white font-medium transition duration-200 shadow-sm",
                sidebarOpen 
                  ? "w-full h-11 px-4 rounded-full text-[14px]" 
                  : "w-11 h-11 rounded-full"
              )}
              title="New Chat"
            >
              <Plus size={18} className="text-blue-400" />
              {sidebarOpen && <span>New chat</span>}
            </button>
          </div>

          {/* Recent History List */}
          {sidebarOpen && (
            <div className="flex-1 flex flex-col min-h-0 mt-2 px-3 overflow-hidden">
              <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider px-3 mb-2">Recent</h3>
              <div className="flex-1 overflow-y-auto chat-scrollbar pr-1 space-y-1">
                {chatSessions.length === 0 ? (
                  <p className="text-xs text-neutral-500 italic px-3 py-2">No recent chats. Conversations appear here.</p>
                ) : (
                  chatSessions.map((session) => (
                    <div
                      key={session.id}
                      onClick={() => loadChatSession(session.id)}
                      className={classNames(
                        "group flex items-center justify-between rounded-full py-2 px-4 text-[13.5px] cursor-pointer transition select-none",
                        currentSessionId === session.id 
                          ? "bg-neutral-800/80 text-white font-medium" 
                          : "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200"
                      )}
                    >
                      <span className="truncate max-w-[160px]">{session.title}</span>
                      <button
                        onClick={(e) => deleteChatSession(session.id, e)}
                        className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-0.5 transition rounded-full hover:bg-neutral-700/50"
                        title="Delete Session"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Bottom Controls */}
        <div className="p-3 border-t border-neutral-800 bg-[#1a1b1c]/40">
          {sidebarOpen ? (
            <div className="space-y-2">
              {/* Local NLP Status Details Card */}
              <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-3.5 text-xs text-neutral-400 shadow-inner">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-neutral-300">Local Engine</span>
                  <span className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    {status?.status ? "Online" : "Trained"}
                  </span>
                </div>
                <div className="space-y-1 text-[11.5px]">
                  <div className="flex justify-between">
                    <span>Intents:</span>
                    <span className="font-mono text-neutral-200 font-semibold">{status?.intent_count ?? '--'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Patterns:</span>
                    <span className="font-mono text-neutral-200 font-semibold">{status?.pattern_count ?? '--'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>File:</span>
                    <span className="truncate max-w-[110px] font-mono text-neutral-200">{status?.model_file ?? '--'}</span>
                  </div>
                </div>
              </div>

              {/* History Clear button */}
              {chatSessions.length > 0 && (
                <button
                  onClick={clearAllHistory}
                  className="flex w-full items-center justify-center gap-2 rounded-full border border-neutral-800 bg-[#1e1f20] hover:bg-neutral-800 px-3 py-2 text-xs font-semibold text-neutral-300 hover:text-red-300 transition"
                >
                  <Trash2 size={13} />
                  Clear All History
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 text-neutral-400">
              <div className="h-2 w-2 rounded-full bg-emerald-400" title="NLP Engine Online" />
              <button 
                onClick={clearAllHistory}
                className="hover:text-red-400 transition"
                title="Clear All History"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* --- Main Chat Section Area --- */}
      <section className="flex flex-col flex-1 min-w-0 bg-[#131314] relative">
        {/* Top Header navbar */}
        <header className="h-[60px] border-b border-neutral-800/40 px-6 flex items-center justify-between z-10 bg-[#131314]/80 backdrop-blur-md">
          <div className="flex items-center gap-3">
            {/* Show hamburger button inside header if sidebar is collapsed */}
            {!sidebarOpen && (
              <button 
                onClick={() => setSidebarOpen(true)}
                className="p-2 hover:bg-neutral-800 rounded-full text-neutral-400 hover:text-white transition lg:mr-2"
                aria-label="Open sidebar"
              >
                <Menu size={20} />
              </button>
            )}
            <div className="flex items-center gap-2">
              <span className="text-[17px] font-medium text-neutral-200">SakuPilot</span>
              <span className="text-xs bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded font-medium border border-neutral-700/30">Local 1.0</span>
            </div>
          </div>

          {/* Profile User Icon */}
          <div className="flex items-center gap-4">
            {status?.knowledge_base && (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-neutral-400 bg-neutral-800/40 px-3 py-1 rounded-full border border-neutral-800">
                <Database size={12} className="text-neutral-500" />
                Data: {status.knowledge_base}
              </span>
            )}
            <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-md border border-white/10 select-none">
              SP
            </div>
          </div>
        </header>

        {/* Messages / Welcome View Scroll Area */}
        <div className="flex-1 overflow-y-auto chat-scrollbar px-4 sm:px-6 lg:px-8 py-6 pb-[160px]">
          <div className="mx-auto max-w-[820px] w-full">
            {!hasUserMessages ? (
              /* Welcome Page */
              <div className="py-12 flex flex-col justify-center animate-fadeIn">
                {/* Greeting Headers */}
                <h2 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-tight mt-6">
                  <span className="bg-gradient-to-r from-[#4285f4] via-[#9b72cb] to-[#d96570] bg-clip-text text-transparent font-bold">
                    Hello, User
                  </span>
                </h2>
                <h3 className="text-3xl sm:text-4xl text-neutral-500 font-semibold tracking-tight mt-2">
                  How can I help you today?
                </h3>
                <p className="text-neutral-400 text-sm mt-3 max-w-xl leading-relaxed">
                  Ask questions, test intents or analyze response metrics using the locally trained TF-IDF & Support Vector Classifier backend.
                </p>

                {/* Suggestions Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-12">
                  {suggestedPrompts.map((card, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleSuggestionClick(card.prompt)}
                      className="group relative bg-[#1e1f20] hover:bg-[#282a2c] border border-neutral-800 hover:border-neutral-700/80 rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 flex flex-col justify-between min-h-[140px] shadow-sm select-none"
                    >
                      <div>
                        <h4 className="text-neutral-200 font-semibold text-[14.5px] group-hover:text-white transition">
                          {card.title}
                        </h4>
                        <p className="text-neutral-400 text-[12.5px] mt-1.5 leading-relaxed">
                          {card.subtitle}
                        </p>
                      </div>
                      <div className="self-end bg-neutral-900 border border-neutral-800 rounded-full p-2 group-hover:bg-neutral-800 group-hover:scale-105 transition duration-200">
                        {card.icon}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Conversation Messages Thread */
              <div className="space-y-8 py-4 animate-fadeIn">
                {messages.map((message) => (
                  <ChatMessageRow key={message.id} message={message} />
                ))}

                {/* Loading state indicator */}
                {isSending && (
                  <div className="flex items-start gap-4">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-blue-600 to-purple-500 flex items-center justify-center text-white shadow-lg shrink-0 animate-pulseGlow">
                      <Sparkles size={16} />
                    </div>
                    <div className="flex-1 space-y-2.5 pt-1.5">
                      <div className="text-[14px] text-neutral-400 flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin text-blue-400" />
                        <span>SakuPilot AI is searching intents...</span>
                      </div>
                      <div className="space-y-2 max-w-[640px]">
                        <div className="h-3 bg-[#1e1f20] rounded shimmer-bg w-[90%]"></div>
                        <div className="h-3 bg-[#1e1f20] rounded shimmer-bg w-[75%]"></div>
                        <div className="h-3 bg-[#1e1f20] rounded shimmer-bg w-[50%]"></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Error notifications */}
            {error && (
              <div className="mt-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs flex items-center gap-2.5 animate-fadeIn">
                <Info size={16} className="text-amber-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* --- Floating Bottom Chat Input Area --- */}
        <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-6 lg:px-8 py-5 bg-gradient-to-t from-[#131314] via-[#131314]/95 to-transparent">
          <div className="mx-auto max-w-[820px] w-full flex flex-col items-center">
            {/* Redesigned Pill Chat Input */}
            <div className="w-full">
              <AdvancedChatInput
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask SakuPilot local AI..."
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
            
            {/* Small disclaimer footer matching Gemini */}
            <p className="text-[11px] text-neutral-500 mt-2.5 text-center leading-normal max-w-[600px] select-none">
              SakuPilot local NLP model may display inaccurate info. Your database files: <code className="bg-neutral-850 px-1 py-0.5 rounded border border-neutral-800 text-[10px] text-neutral-400">intents.json</code>. Retrains automatically on modifications.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

// Single Chat Message Row component
function ChatMessageRow({ message }) {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [showMetadata, setShowMetadata] = useState(false);

  const confidencePct = typeof message.confidence === 'number' 
    ? Math.round(message.confidence * 100) 
    : null;

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={classNames("flex items-start gap-4", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar Icon */}
      {isUser ? (
        <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-700 flex items-center justify-center text-white border border-white/10 shadow-md shrink-0 select-none">
          <UserRound size={15} />
        </div>
      ) : (
        <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-blue-600 to-purple-500 flex items-center justify-center text-white shadow-lg shrink-0 select-none">
          <Sparkles size={15} />
        </div>
      )}

      {/* Message Content Container */}
      <div className={classNames("flex-1 overflow-hidden", isUser ? "text-right" : "text-left")}>
        {/* User Prompt Box */}
        {isUser ? (
          <div className="inline-block text-left bg-neutral-800 text-[#e3e3e3] rounded-2xl rounded-tr-none px-4 py-3.5 text-[15px] leading-relaxed max-w-[85%] shadow-sm">
            <div className="whitespace-pre-wrap break-words">{message.content}</div>
            
            {/* File attachments visual display */}
            {message.files && message.files.length > 0 && (
              <div className="mt-2.5 pt-2 border-t border-neutral-700/50 flex flex-wrap gap-1.5 justify-end">
                {message.files.map((file) => (
                  <div 
                    key={file.id} 
                    className="flex items-center gap-1 bg-neutral-900 border border-neutral-700/40 text-[10px] text-neutral-300 rounded-full px-2 py-0.5"
                  >
                    <FileText size={10} className="text-blue-400" />
                    <span className="truncate max-w-[100px]">{file.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Assistant response */
          <div className="space-y-3 pt-1">
            <div className="prose prose-invert max-w-none text-[#e3e3e3]">
              {formatMessageContent(message.content)}
            </div>

            {/* Local NLP Intent inspector */}
            {message.tag && message.tag !== 'system' && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => setShowMetadata(!showMetadata)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold tracking-wider uppercase text-neutral-400 hover:text-neutral-200 transition py-1 px-2.5 rounded-md bg-neutral-850 hover:bg-neutral-800 border border-neutral-800"
                >
                  <Info size={11} className="text-blue-400" />
                  <span>Intent Inspector</span>
                  {showMetadata ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>

                {showMetadata && (
                  <div className="mt-2 p-3 bg-neutral-900/80 border border-neutral-800 rounded-xl max-w-sm space-y-1.5 text-xs text-neutral-400 animate-fadeIn">
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Matched Intent:</span>
                      <code className="bg-neutral-850 px-1 py-0.5 rounded text-blue-300 font-mono font-medium">{message.tag}</code>
                    </div>
                    {confidencePct !== null && (
                      <div className="flex justify-between">
                        <span className="text-neutral-500">Classification Confidence:</span>
                        <span className="font-mono text-neutral-200 font-semibold">{confidencePct}%</span>
                      </div>
                    )}
                    <div className="h-[1px] bg-neutral-800 my-1"></div>
                    <p className="text-[10px] text-neutral-500 leading-normal">
                      Matched using TF-IDF representation and Linear Support Vector Classifier trained offline.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Quick Action row */}
            {message.tag !== 'system' && (
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleCopy}
                  className="p-2 hover:bg-neutral-800/80 hover:text-white rounded-full text-neutral-400 transition"
                  title="Copy response"
                  type="button"
                >
                  {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                </button>
                <button
                  className="p-2 hover:bg-neutral-800/80 hover:text-white rounded-full text-neutral-400 transition"
                  title="Good response"
                  type="button"
                >
                  <ThumbsUp size={14} />
                </button>
                <button
                  className="p-2 hover:bg-neutral-800/80 hover:text-white rounded-full text-neutral-400 transition"
                  title="Bad response"
                  type="button"
                >
                  <ThumbsDown size={14} />
                </button>
                <button
                  className="p-2 hover:bg-neutral-800/80 hover:text-white rounded-full text-neutral-400 transition"
                  title="Share response"
                  type="button"
                >
                  <Share2 size={14} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);