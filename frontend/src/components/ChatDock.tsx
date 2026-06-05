import { useRef, useState, useEffect } from "react";
import { ArrowUp, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import type { ChatMessage } from "../lib/types";

interface Props {
  messages: ChatMessage[];
  onSend: (question: string) => void;
  disabled: boolean;
}

export function ChatDock({ messages, onSend, disabled }: Props) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-expand when messages arrive
  useEffect(() => {
    if (messages.length > 0) setExpanded(true);
  }, [messages.length]);

  // Scroll to bottom on new messages
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
    }
  }, [input]);

  const handleSend = async () => {
    const q = input.trim();
    if (!q || disabled || sending) return;
    setInput("");
    setSending(true);
    setExpanded(true);
    await onSend(q);
    setSending(false);
  };

  const hasMessages = messages.length > 0 || sending;

  return (
    <div className="shrink-0 border-t border-border bg-bg">
      {/* Expand/collapse toggle */}
      {hasMessages && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-center gap-1 py-1.5 text-[10px] text-text-faint hover:text-text-muted"
        >
          {expanded ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          {expanded ? "Collapse" : `${messages.length} messages`}
        </button>
      )}

      {/* Messages area */}
      {expanded && hasMessages && (
        <div
          ref={scrollRef}
          className="flex max-h-[50vh] flex-col gap-4 overflow-y-auto px-5 pb-3"
        >
          {messages.map((m, i) => (
            <MessageBubble key={i} message={m} />
          ))}

          {/* Typing indicator */}
          {sending && (
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2">
                <Sparkles size={12} className="text-text-faint" />
              </div>
              <div className="rounded-xl rounded-tl-sm border border-border bg-surface px-4 py-3">
                <div className="flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-faint [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-faint [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-faint [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Input area */}
      <div className="px-5 pb-4 pt-2">
        <div className="flex items-end gap-2 rounded-xl border border-border bg-surface p-1.5 focus-within:border-border-active">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={disabled ? "Parse a document first..." : "Ask about this document..."}
            disabled={disabled || sending}
            rows={1}
            className="max-h-[120px] min-h-[36px] flex-1 resize-none bg-transparent px-2.5 py-2 text-[14px] text-text outline-none placeholder:text-text-faint disabled:opacity-40"
          />
          <button
            onClick={handleSend}
            disabled={disabled || sending || !input.trim()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-text text-bg transition-opacity disabled:opacity-15"
          >
            <ArrowUp size={15} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message: m }: { message: ChatMessage }) {
  const [showCitations, setShowCitations] = useState(false);
  const hasCitations = m.citations && m.citations.length > 0;

  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-xl rounded-br-sm bg-surface-2 px-4 py-2.5 text-[14px] leading-relaxed text-text">
          {m.text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-2 mt-0.5">
        <Sparkles size={12} className="text-text-faint" />
      </div>
      <div className="max-w-[85%]">
        <div className="rounded-xl rounded-tl-sm border border-border bg-surface px-4 py-3 text-[14px] leading-relaxed text-text-2">
          {m.text}
        </div>

        {/* Meta row: source badge + citations toggle */}
        <div className="mt-1.5 flex items-center gap-2">
          <span className="rounded-full border border-border bg-surface px-2 py-0.5 font-mono text-[10px] text-text-faint">
            {m.source === "rag" ? "RAG" : "LLM"}
            {m.confidence != null &&
              m.confidence > 0 &&
              ` ${(m.confidence * 100).toFixed(0)}%`}
          </span>

          {hasCitations && (
            <button
              onClick={() => setShowCitations(!showCitations)}
              className="text-[11px] text-text-faint hover:text-text-muted"
            >
              {showCitations
                ? "Hide sources"
                : `${m.citations!.length} source${m.citations!.length > 1 ? "s" : ""}`}
            </button>
          )}
        </div>

        {/* Citations */}
        {showCitations && hasCitations && (
          <div className="mt-2 flex flex-col gap-1.5">
            {m.citations!.map((c) => (
              <div
                key={c.index}
                className="rounded-lg border border-border bg-surface px-3 py-2"
              >
                <div className="mb-0.5 font-mono text-[10px] font-semibold text-text-muted">
                  [{c.index}]
                </div>
                <div className="line-clamp-3 text-[12px] leading-relaxed text-text-faint">
                  {c.snippet || c.source}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
