import { useState, useRef, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api-client";
import { Bot, Send, Trash2, Sparkles, User, Loader2, AlertCircle, ChevronDown } from "lucide-react";
import { Footer } from "@/components/ui/footer";

// ==================== TYPES ====================

interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
  timestamp: Date;
  error?: boolean;
}

// ==================== COMPONENT ====================

export default function AiAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ==================== SCROLL ====================

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "instant",
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const container = chatContainerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 100);
  }, []);

  // ==================== SEND ====================

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: "user",
      text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    // Auto-resize textarea back
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    try {
      // Build history for API (exclude current message)
      const history = messages.map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const response = await apiFetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Gagal mendapat respons dari AI.");
      }

      const aiMsg: ChatMessage = {
        id: `a_${Date.now()}`,
        role: "model",
        text: data.reply,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `e_${Date.now()}`,
        role: "model",
        text: err.message || "Terjadi kesalahan. Coba lagi.",
        timestamp: new Date(),
        error: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
  };

  // ==================== FORMAT ====================

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  };

  /** Simple markdown-ish rendering: bold, italic, code, newlines */
  const renderText = (text: string) => {
    // Split by code blocks first
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, i) => {
      if (part.startsWith("```") && part.endsWith("```")) {
        const code = part.slice(3, -3).replace(/^\w*\n/, "");
        return (
          <pre
            key={i}
            className="my-2 p-3 rounded-xl bg-[#1A1C22] border border-[rgba(79,209,255,0.08)] text-xs font-mono overflow-x-auto text-[#E5E7EB]"
          >
            <code>{code}</code>
          </pre>
        );
      }
      // Inline formatting
      return (
        <span key={i}>
          {part.split("\n").map((line, j) => (
            <span key={j}>
              {j > 0 && <br />}
              {renderInline(line)}
            </span>
          ))}
        </span>
      );
    });
  };

  const renderInline = (text: string) => {
    // Bold: **text**
    const parts = text.split(/(\*\*.*?\*\*|`[^`]+`)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} className="font-semibold text-[#E5E7EB]">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code
            key={i}
            className="px-1.5 py-0.5 rounded-md bg-[#1A1C22] text-[#4FD1FF] text-xs font-mono border border-[rgba(79,209,255,0.1)]"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  // ==================== RENDER ====================

  return (
    <div className="flex flex-col h-[calc(100dvh-64px)] lg:h-screen max-w-3xl mx-auto">
      {/* ===== HEADER ===== */}
      <div className="flex-shrink-0 px-4 pt-4 pb-3">
        <div
          className="rounded-2xl bg-[#23262F] border border-[rgba(79,209,255,0.1)] p-4
          shadow-[6px_6px_12px_rgba(0,0,0,0.4),-3px_-3px_8px_rgba(255,255,255,0.02)]"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#4FD1FF]/20 to-[#9F7AEA]/20
                flex items-center justify-center border border-[rgba(79,209,255,0.15)]
                shadow-[4px_4px_8px_rgba(0,0,0,0.3),-2px_-2px_6px_rgba(255,255,255,0.02)]"
              >
                <Sparkles className="w-5 h-5 text-[#4FD1FF]" />
              </div>
              <div>
                <h1 className="text-base font-bold text-[#E5E7EB]">AWAS AI</h1>
                <p className="text-xs text-[#9CA3AF]">
                  Powered by Gemini 3.1 Flash-Lite
                </p>
              </div>
            </div>

            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="p-2.5 rounded-xl text-[#9CA3AF] hover:text-red-400 hover:bg-red-500/10
                border border-transparent hover:border-red-900/20
                transition-all duration-200 active:scale-95"
                title="Hapus percakapan"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ===== MESSAGES ===== */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 space-y-3 scroll-smooth"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 pb-8">
            <div
              className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#4FD1FF]/15 to-[#9F7AEA]/15
              flex items-center justify-center mb-4 border border-[rgba(79,209,255,0.1)]
              shadow-[6px_6px_12px_rgba(0,0,0,0.4),-3px_-3px_8px_rgba(255,255,255,0.02)]"
            >
              <Bot className="w-8 h-8 text-[#4FD1FF]" />
            </div>
            <h2 className="text-lg font-bold text-[#E5E7EB] mb-2">
              Hai! Gw AWAS AI 👋
            </h2>
            <p className="text-sm text-[#9CA3AF] max-w-sm mb-6">
              Asisten cerdas buat bantu kamu soal waste management, food safety, dan penggunaan aplikasi AWAS.
            </p>

            {/* Quick prompts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
              {[
                "💡 Tips mengurangi waste di kitchen",
                "📊 Cara analisis data waste harian",
                "🔒 Standar food safety yang harus dipenuhi",
                "📱 Cara pakai fitur auto-waste",
              ].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => {
                    setInput(prompt.replace(/^[^\s]+\s/, ""));
                    inputRef.current?.focus();
                  }}
                  className="text-left text-xs text-[#9CA3AF] px-3 py-2.5 rounded-xl
                  bg-[#23262F] border border-[rgba(79,209,255,0.08)]
                  shadow-[4px_4px_8px_rgba(0,0,0,0.3),-2px_-2px_6px_rgba(255,255,255,0.02)]
                  hover:border-[rgba(79,209,255,0.2)] hover:text-[#E5E7EB]
                  hover:-translate-y-0.5 active:translate-y-0 active:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3)]
                  transition-all duration-200"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {/* AI Avatar */}
            {msg.role === "model" && (
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center mt-1
                ${
                  msg.error
                    ? "bg-red-500/10 border border-red-900/20"
                    : "bg-gradient-to-br from-[#4FD1FF]/15 to-[#9F7AEA]/15 border border-[rgba(79,209,255,0.1)]"
                }
                shadow-[3px_3px_6px_rgba(0,0,0,0.3),-1px_-1px_4px_rgba(255,255,255,0.02)]`}
              >
                {msg.error ? (
                  <AlertCircle className="w-4 h-4 text-red-400" />
                ) : (
                  <Bot className="w-4 h-4 text-[#4FD1FF]" />
                )}
              </div>
            )}

            {/* Message bubble */}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed
              ${
                msg.role === "user"
                  ? "bg-gradient-to-br from-[#4FD1FF]/15 to-[#4FD1FF]/5 border border-[rgba(79,209,255,0.15)] text-[#E5E7EB] shadow-[4px_4px_8px_rgba(0,0,0,0.3),-2px_-2px_6px_rgba(255,255,255,0.02)]"
                  : msg.error
                  ? "bg-red-500/5 border border-red-900/20 text-red-300"
                  : "bg-[#23262F] border border-[rgba(79,209,255,0.08)] text-[#E5E7EB] shadow-[4px_4px_8px_rgba(0,0,0,0.3),-2px_-2px_6px_rgba(255,255,255,0.02)]"
              }`}
            >
              <div className="whitespace-pre-wrap break-words">
                {msg.role === "model" ? renderText(msg.text) : msg.text}
              </div>
              <div
                className={`text-[10px] mt-1.5 ${
                  msg.role === "user" ? "text-[#4FD1FF]/40 text-right" : "text-[#9CA3AF]/50"
                }`}
              >
                {formatTime(msg.timestamp)}
              </div>
            </div>

            {/* User Avatar */}
            {msg.role === "user" && (
              <div
                className="flex-shrink-0 w-8 h-8 rounded-xl bg-[#23262F] flex items-center justify-center mt-1
                border border-[rgba(79,209,255,0.08)]
                shadow-[3px_3px_6px_rgba(0,0,0,0.3),-1px_-1px_4px_rgba(255,255,255,0.02)]"
              >
                <User className="w-4 h-4 text-[#9CA3AF]" />
              </div>
            )}
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex gap-2.5 justify-start">
            <div
              className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-[#4FD1FF]/15 to-[#9F7AEA]/15
              flex items-center justify-center border border-[rgba(79,209,255,0.1)]
              shadow-[3px_3px_6px_rgba(0,0,0,0.3),-1px_-1px_4px_rgba(255,255,255,0.02)]"
            >
              <Bot className="w-4 h-4 text-[#4FD1FF] animate-pulse" />
            </div>
            <div
              className="rounded-2xl px-4 py-3 bg-[#23262F] border border-[rgba(79,209,255,0.08)]
              shadow-[4px_4px_8px_rgba(0,0,0,0.3),-2px_-2px_6px_rgba(255,255,255,0.02)]"
            >
              <div className="flex items-center gap-2 text-sm text-[#9CA3AF]">
                <Loader2 className="w-4 h-4 animate-spin text-[#4FD1FF]" />
                <span>Lagi mikir...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom button */}
      {showScrollBtn && (
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-10">
          <button
            onClick={() => scrollToBottom()}
            className="p-2 rounded-full bg-[#23262F] border border-[rgba(79,209,255,0.15)]
            shadow-[4px_4px_8px_rgba(0,0,0,0.4),-2px_-2px_6px_rgba(255,255,255,0.02)]
            hover:-translate-y-0.5 active:scale-95 transition-all duration-200"
          >
            <ChevronDown className="w-4 h-4 text-[#4FD1FF]" />
          </button>
        </div>
      )}

      {/* ===== INPUT ===== */}
      <div className="flex-shrink-0 px-4 pt-2 pb-4">
        <div
          className="flex items-end gap-2 rounded-2xl bg-[#23262F] border border-[rgba(79,209,255,0.1)] p-2
          shadow-[6px_6px_12px_rgba(0,0,0,0.4),-3px_-3px_8px_rgba(255,255,255,0.02)]
          focus-within:border-[rgba(79,209,255,0.25)] transition-colors duration-200"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Tanya apa aja..."
            rows={1}
            disabled={isLoading}
            className="flex-1 bg-transparent text-sm text-[#E5E7EB] placeholder-[#9CA3AF]/50
            resize-none outline-none px-3 py-2.5 max-h-[120px]
            disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="flex-shrink-0 p-2.5 rounded-xl
            bg-gradient-to-br from-[#4FD1FF] to-[#4FD1FF]/80 text-[#1A1C22]
            shadow-[4px_4px_8px_rgba(0,0,0,0.3),-2px_-2px_6px_rgba(79,209,255,0.1)]
            hover:-translate-y-0.5 hover:shadow-[4px_4px_8px_rgba(0,0,0,0.3),-2px_-2px_6px_rgba(79,209,255,0.2),0_0_12px_rgba(79,209,255,0.15)]
            active:translate-y-0 active:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3)]
            disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none
            transition-all duration-200"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-[#9CA3AF]/40 text-center mt-2">
          AWAS AI powered by Gemini · Bisa salah, selalu verifikasi info penting
        </p>
      </div>
    </div>
  );
}
