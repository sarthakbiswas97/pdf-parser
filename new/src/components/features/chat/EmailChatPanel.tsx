import { useCallback, useEffect, useRef, useState } from "react";
import {
  Send,
  Sparkles,
  Loader2,
  Mail,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { chatAboutEmails } from "@/lib/api";
import { cn } from "@/lib/utils";

interface EmailChatMessage {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly text: string;
}

interface EmailChatPanelProps {
  readonly selectedEmailId?: string;
  readonly selectedEmailSubject?: string;
  readonly onClearSelection?: () => void;
  readonly suggestions?: readonly string[];
  readonly placeholder?: string;
  readonly className?: string;
}

const DEFAULT_SUGGESTIONS = [
  "Any urgent deadlines?",
  "Summarize top highlights",
  "What needs my reply?",
] as const;

const SINGLE_EMAIL_SUGGESTIONS = [
  "Summarize this email",
  "What action is needed?",
  "Any deadlines mentioned?",
] as const;

function generateId(): string {
  return `emsg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function EmailChatPanel({
  selectedEmailId,
  selectedEmailSubject,
  onClearSelection,
  suggestions,
  placeholder,
  className,
}: EmailChatPanelProps) {
  const [messages, setMessages] = useState<readonly EmailChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeSuggestions = suggestions
    ?? (selectedEmailId ? SINGLE_EMAIL_SUGGESTIONS : DEFAULT_SUGGESTIONS);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(async () => {
    const q = input.trim();
    if (!q || isLoading) return;
    setInput("");

    const userMsg: EmailChatMessage = {
      id: generateId(),
      role: "user",
      text: q,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const result = await chatAboutEmails(q, selectedEmailId);
      const assistantMsg: EmailChatMessage = {
        id: generateId(),
        role: "assistant",
        text: result.answer,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const errorMsg: EmailChatMessage = {
        id: generateId(),
        role: "assistant",
        text: "Failed to get a response. Please try again.",
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, selectedEmailId]);

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      setInput("");
      const userMsg: EmailChatMessage = {
        id: generateId(),
        role: "user",
        text: suggestion,
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      chatAboutEmails(suggestion, selectedEmailId)
        .then((result) => {
          const assistantMsg: EmailChatMessage = {
            id: generateId(),
            role: "assistant",
            text: result.answer,
          };
          setMessages((prev) => [...prev, assistantMsg]);
        })
        .catch(() => {
          const errorMsg: EmailChatMessage = {
            id: generateId(),
            role: "assistant",
            text: "Failed to get a response. Please try again.",
          };
          setMessages((prev) => [...prev, errorMsg]);
        })
        .finally(() => setIsLoading(false));
    },
    [selectedEmailId]
  );

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Context indicator */}
      {selectedEmailId && selectedEmailSubject && (
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-surface px-3 py-2">
          <Mail className="h-3 w-3 shrink-0 text-green-400" />
          <span className="flex-1 truncate text-xs text-muted-foreground">
            Chatting about: {selectedEmailSubject}
          </span>
          {onClearSelection && (
            <button
              onClick={onClearSelection}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="space-y-4 p-1">
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border">
                <Sparkles className="h-4 w-4 text-green-400" />
              </div>
              <p className="text-sm text-muted-foreground">
                {selectedEmailId
                  ? "Ask about this email"
                  : "Ask questions about your emails"}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {activeSuggestions.map((s) => (
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
            <div
              key={msg.id}
              className={cn(
                "animate-slide-up",
                msg.role === "user" ? "flex justify-end" : "flex items-start gap-3"
              )}
            >
              {msg.role === "assistant" && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-500/10">
                  <Sparkles className="h-3.5 w-3.5 text-green-400" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                  msg.role === "user" ? "bg-surface-2" : "bg-surface"
                )}
              >
                <p className="whitespace-pre-wrap leading-relaxed">
                  {msg.text}
                </p>
              </div>
            </div>
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

      {/* Input */}
      <div className="mt-3 flex items-end gap-2">
        <Textarea
          value={input}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={
            placeholder ??
            (selectedEmailId
              ? "Ask about this email..."
              : "Ask about your emails...")
          }
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
  );
}
