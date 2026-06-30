import * as React from "react";
import {
  FileText,
  Link,
  Mic,
  Plus,
  X,
  SendHorizontal,
  ArrowUp,
  Square,
} from "lucide-react";

/* ----------------------------------------------------------------
 * Button — soft, cream-themed, with three variants
 * ---------------------------------------------------------------- */
export function Button({ children, className = "", variant = "outline", size, ...props }) {
  const baseStyle =
    "inline-flex items-center justify-center rounded-full text-[13px] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-40 disabled:pointer-events-none";

  const variants = {
    ghost:
      "text-text-tertiary hover:bg-surface-subtle hover:text-text hover:shadow-soft",
    outline:
      "border border-border bg-surface text-text-secondary hover:border-border-strong hover:bg-bg hover:text-text px-3.5 py-1.5 shadow-soft",
    primary:
      "bg-accent text-white hover:bg-accent-hover font-medium shadow-soft",
    soft:
      "bg-accent-soft text-accent-hover hover:brightness-95 hover:text-accent-hover px-3.5 py-1.5",
  };

  const sizes = {
    icon: "h-9 w-9 p-0",
    sm: "px-3 py-1 text-xs",
    md: "px-4 py-2",
  };

  const selectedVariant = variants[variant] || variants.outline;
  const selectedSize = sizes[size] || "";

  return (
    <button
      className={`${baseStyle} ${selectedVariant} ${selectedSize} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/* ----------------------------------------------------------------
 * AdvancedChatInput — Claude-style soft pill input on cream surface
 * ---------------------------------------------------------------- */
export function AdvancedChatInput({
  value,
  onChange,
  placeholder,
  files = [],
  onFileRemove,
  onSend,
  actionIcons = [],
  textareaProps = {},
  isSending = false,
  isStreaming = false,
  onStop,
}) {
  const textareaRef = React.useRef(null);
  const [isFocused, setIsFocused] = React.useState(false);

  // Auto-resize the textarea dynamically
  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [value]);

  const hasContent = value.trim() || files.length > 0;

  return (
    <div
      className={`w-full rounded-[24px] bg-surface px-3 py-2 transition-all duration-200 border ${
        isFocused
          ? "border-accent/40 shadow-input-focus"
          : "border-border shadow-input hover:border-border-strong hover:shadow-soft-lg"
      }`}
    >
      {/* File attachment preview chips */}
      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5 animate-fadeIn px-1 pt-1">
          {files.map((file) => (
            <div
              key={file.id}
              className="group flex items-center gap-1.5 rounded-full bg-surface-subtle border border-border px-2.5 py-1 text-xs text-text-secondary hover:border-border-strong transition"
            >
              {file.icon || <FileText className="h-3 w-3 text-accent" />}
              <span className="max-w-[120px] truncate font-medium">
                {file.name}
              </span>
              <button
                type="button"
                onClick={() => onFileRemove(file.id)}
                className="rounded-full p-0.5 hover:bg-border text-text-tertiary hover:text-text transition"
                aria-label="Remove attachment"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input textbox and controls */}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={onChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          rows={1}
          className="flex-1 resize-none bg-transparent py-2 px-2 text-[15px] leading-6 text-text outline-none placeholder:text-text-faint max-h-[200px] min-h-[28px]"
          {...textareaProps}
        />

        {/* Buttons Row */}
        <div className="flex items-center gap-0.5 shrink-0 pb-1">
          {/* Custom controls (Mic, Link, etc.) */}
          {actionIcons}

          {/* Send Button */}
          <button
            type="button"
            onClick={onSend}
            disabled={!hasContent || isSending}
            className={`grid h-9 w-9 place-items-center rounded-full transition-all duration-200 ${
              hasContent
                ? "bg-accent text-white hover:bg-accent-hover active:scale-90 shadow-soft"
                : "bg-surface-subtle text-text-faint cursor-not-allowed"
            }`}
            aria-label="Send message"
          >
            {isSending ? (
              <div className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            ) : (
              <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.5} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------
 * Standalone demo (kept for parity with original)
 * ---------------------------------------------------------------- */
export default function AdvancedChatInputDemo() {
  const [inputValue, setInputValue] = React.useState("");
  const [files, setFiles] = React.useState([]);

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

  const handleSend = () => {
    if (!inputValue && files.length === 0) return;
    console.log("Sending:", {
      message: inputValue,
      files: files.map((f) => f.name),
    });
    setInputValue("");
    setFiles([]);
  };

  const actionIcons = [
    <Button key="link" variant="ghost" size="icon" aria-label="Attach link">
      <Link className="h-4 w-4" />
    </Button>,
    <Button key="mic" variant="ghost" size="icon" aria-label="Use microphone">
      <Mic className="h-4 w-4" />
    </Button>,
  ];

  return (
    <div className="flex min-h-[400px] w-full flex-col items-center justify-center gap-4 bg-bg p-4">
      <div className="w-full max-w-lg">
        <AdvancedChatInput
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="What's on your mind?"
          files={files}
          onFileRemove={handleRemoveFile}
          onSend={handleSend}
          actionIcons={actionIcons}
          textareaProps={{
            onKeyDown: (e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            },
          }}
        />
      </div>

      <Button variant="outline" onClick={handleAddFile}>
        <Plus className="mr-2 h-4 w-4" />
        Attach a file
      </Button>
    </div>
  );
}
