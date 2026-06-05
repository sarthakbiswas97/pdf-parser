import { useCallback, useRef, useState } from "react";
import { chatWithDocument } from "@/lib/api";
import type { ChatMessage } from "@/types";

function generateMsgId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

interface UseChatReturn {
  readonly messages: readonly ChatMessage[];
  readonly isLoading: boolean;
  readonly sendMessage: (question: string) => Promise<void>;
  readonly clearChat: () => void;
}

export function useChat(fullText: string): UseChatReturn {
  const [messages, setMessages] = useState<readonly ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const sessionIdRef = useRef<string | null>(null);

  const sendMessage = useCallback(
    async (question: string) => {
      const userMessage: ChatMessage = {
        id: generateMsgId(),
        role: "user",
        text: question,
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      try {
        const response = await chatWithDocument(
          fullText,
          question,
          sessionIdRef.current ?? undefined
        );

        if (response.session_id) {
          sessionIdRef.current = response.session_id;
        }

        const assistantMessage: ChatMessage = {
          id: generateMsgId(),
          role: "assistant",
          text: response.answer,
          citations: response.citations,
          confidence: response.confidence,
          source: response.source,
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err) {
        const errorMessage: ChatMessage = {
          id: generateMsgId(),
          role: "assistant",
          text:
            err instanceof Error
              ? `Error: ${err.message}`
              : "Something went wrong. Please try again.",
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [fullText]
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    sessionIdRef.current = null;
  }, []);

  return { messages, isLoading, sendMessage, clearChat };
}
