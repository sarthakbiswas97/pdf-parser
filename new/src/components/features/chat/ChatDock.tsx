import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Send,
  Sparkles,
  Database,
  Cpu,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChat } from "@/hooks/use-chat";
import { CHAT_SUGGESTIONS } from "@/lib/constants";
import type { ChatMessage } from "@/types";
import { cn } from "@/lib/utils";

interface ChatDockProps {
  readonly fullText: string;
  readonly docType?: string;
}

export function ChatDock({ fullText, docType }: ChatDockProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState("");
  const { messages, isLoading, sendMessage } = useChat(fullText);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const suggestions =
    CHAT_SUGGESTIONS[docType ?? "default"] ?? CHAT_SUGGESTIONS.default;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput("");
    setIsExpanded(true);
    await sendMessage(trimmed);
  }, [input, isLoading, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      setIsExpanded(true);
      sendMessage(suggestion);
    },
    [sendMessage]
  );

  return (
    <div className="fixed bottom-0 left-14 right-0 z-30 border-t border-border glass">
      {/* Expand/collapse header */}
      <button
        onClick={() => setIsExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="h-3.5 w-3.5 text-green-400" />
          <span className="text-xs font-medium">Ask about this document</span>
          {messages.length > 0 && (
            <span className="font-mono text-[10px] text-muted-foreground">
              {messages.length} messages
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>

      {/* Messages area */}
      {isExpanded && (
        <div className="border-t border-border">
          <ScrollArea className="h-[40vh]" ref={scrollRef}>
            <div className="space-y-4 p-4">
              {messages.length === 0 && !isLoading && (
                <div className="flex flex-col items-center gap-4 py-8 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border">
                    <Sparkles className="h-4 w-4 text-green-400" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Ask a question about your document
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        onClick={() => handleSuggestionClick(s)}
                        className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-green-500/30 hover:text-foreground"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}

              {isLoading && (
                <div className="flex items-start gap-3 animate-slide-up">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-500/10">
                    <Sparkles className="h-3.5 w-3.5 text-green-400" />
                  </div>
                  <div className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2">
                    <Loader2 className="h-3 w-3 animate-spin text-green-400" />
                    <span className="text-xs text-muted-foreground">
                      Thinking...
                    </span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this document..."
            rows={1}
            className="max-h-24 min-h-[36px] resize-none border-border bg-surface text-sm"
          />
          <Button
            size="icon"
            className="h-9 w-9 shrink-0 bg-green-500 text-green-950 hover:bg-green-400"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
}: {
  readonly message: ChatMessage;
}) {
  const [showCitations, setShowCitations] = useState(false);

  if (message.role === "user") {
    return (
      <div className="flex justify-end animate-slide-up">
        <div className="max-w-[80%] rounded-lg bg-surface-2 px-3 py-2">
          <p className="text-sm">{message.text}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 animate-slide-up">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-500/10">
        <Sparkles className="h-3.5 w-3.5 text-green-400" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="rounded-lg bg-surface px-3 py-2">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {message.text}
          </p>
        </div>

        {/* Meta info */}
        <div className="mt-1.5 flex items-center gap-2">
          {message.source && (
            <Badge
              variant="outline"
              className={cn(
                "border-none font-mono text-[10px]",
                message.source === "rag"
                  ? "bg-green-500/10 text-green-400"
                  : "bg-amber-400/10 text-amber-400"
              )}
            >
              {message.source === "rag" ? (
                <Database className="mr-1 h-2.5 w-2.5" />
              ) : (
                <Cpu className="mr-1 h-2.5 w-2.5" />
              )}
              {message.source === "rag" ? "RAG" : "LLM"}
            </Badge>
          )}

          {message.confidence != null && (
            <span className="font-mono text-[10px] text-muted-foreground">
              {Math.round(message.confidence * 100)}% confidence
            </span>
          )}

          {message.citations && message.citations.length > 0 && (
            <button
              onClick={() => setShowCitations((v) => !v)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronRight
                className={cn(
                  "h-2.5 w-2.5 transition-transform",
                  showCitations && "rotate-90"
                )}
              />
              {message.citations.length} citations
            </button>
          )}
        </div>

        {/* Citations */}
        {showCitations && message.citations && (
          <div className="mt-2 space-y-1.5">
            {message.citations.map((citation, i) => (
              <div
                key={i}
                className="rounded-md border-l-2 border-green-500/30 bg-surface px-3 py-2"
              >
                <p className="text-xs text-muted-foreground">
                  {citation.chunk}
                </p>
                <span className="mt-1 block font-mono text-[10px] text-muted-foreground">
                  {Math.round(citation.confidence * 100)}% match
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
