import * as React from "react";
import { FileText, Link, Mic, Plus, X, SendHorizontal } from "lucide-react";

// Standard Button component style replacement
export function Button({ children, className = "", variant = "outline", size, ...props }) {
  const baseStyle = "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none disabled:opacity-50 disabled:pointer-events-none";
  
  const variants = {
    ghost: "text-neutral-400 hover:bg-neutral-800 hover:text-white rounded-full",
    outline: "border border-neutral-700/60 bg-transparent text-neutral-300 hover:bg-neutral-800 hover:text-white px-3 py-1.5 rounded-full",
    primary: "bg-[#a8c7fa] text-[#041e49] hover:bg-[#c2e7ff] font-semibold rounded-full"
  };

  const sizes = {
    icon: "h-9 w-9 p-1.5",
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

// Self-contained AdvancedChatInput implementation
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
}) {
  const textareaRef = React.useRef(null);

  // Auto-resize the text area dynamically
  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
    }
  }, [value]);

  return (
    <div className="w-full rounded-[28px] border border-neutral-800 bg-[#1e1f20] px-4 py-3 shadow-lg focus-within:border-neutral-700/80 transition duration-200">
      {/* File attachment preview chips */}
      {files.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2 animate-fadeIn">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-1.5 rounded-full bg-neutral-800 px-3 py-1 text-xs text-neutral-300 border border-neutral-700/50"
            >
              {file.icon || <FileText className="h-3 w-3 text-neutral-400" />}
              <span className="max-w-[120px] truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => onFileRemove(file.id)}
                className="rounded-full p-0.5 hover:bg-neutral-700 text-neutral-400 hover:text-neutral-200 transition"
                aria-label="Remove attachment"
              >
                <X className="h-3.5 w-3.5" />
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
          placeholder={placeholder}
          rows={1}
          className="flex-1 resize-none bg-transparent py-1 px-1 text-[15px] leading-6 text-neutral-100 outline-none placeholder:text-neutral-500 max-h-[180px] min-h-[28px]"
          {...textareaProps}
        />

        {/* Buttons Row */}
        <div className="flex items-center gap-1 shrink-0 pb-0.5">
          {/* Custom controls (Mic, Link, etc.) */}
          {actionIcons}

          {/* Send Button */}
          <button
            type="button"
            onClick={onSend}
            disabled={(!value.trim() && files.length === 0) || isSending}
            className={`grid h-9 w-9 place-items-center rounded-full transition-all duration-200 ${
              value.trim() || files.length > 0
                ? "bg-[#a8c7fa] text-[#041e49] hover:bg-[#c2e7ff] active:scale-95"
                : "bg-transparent text-neutral-500 cursor-not-allowed"
            }`}
            aria-label="Send message"
          >
            <SendHorizontal className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Keeping the demo structure if they want to run it independently, converted to JS
export default function AdvancedChatInputDemo() {
  const [inputValue, setInputValue] = React.useState("");
  const [files, setFiles] = React.useState([]);

  // Handler to add a new file attachment
  const handleAddFile = () => {
    const newFile = {
      id: Date.now(),
      name: `document_${files.length + 1}.pdf`,
      icon: <FileText className="h-4 w-4 text-neutral-400" />,
    };
    setFiles((prevFiles) => [...prevFiles, newFile]);
  };

  // Handler to remove a file by its ID
  const handleRemoveFile = (id) => {
    setFiles((prevFiles) => prevFiles.filter((file) => file.id !== id));
  };

  // Handler for the send action
  const handleSend = () => {
    if (!inputValue && files.length === 0) return;
    console.log("Sending:", {
      message: inputValue,
      files: files.map((f) => f.name),
    });
    // Reset state after sending
    setInputValue("");
    setFiles([]);
  };

  // Define action icons to be passed as a prop
  const actionIcons = [
    <Button key="link" variant="ghost" size="icon" aria-label="Attach link">
      <Link className="h-4 w-4 text-neutral-400" />
    </Button>,
    <Button key="mic" variant="ghost" size="icon" aria-label="Use microphone">
      <Mic className="h-4 w-4 text-neutral-400" />
    </Button>,
  ];

  return (
    <div className="flex min-h-[400px] w-full flex-col items-center justify-center gap-4 bg-[#131314] p-4">
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

      {/* Demo control to add files dynamically */}
      <Button variant="outline" onClick={handleAddFile}>
        <Plus className="mr-2 h-4 w-4" />
        Attach a file
      </Button>
    </div>
  );
}