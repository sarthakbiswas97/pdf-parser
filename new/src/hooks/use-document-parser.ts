import { useCallback, useRef, useState } from "react";
import { parsePDF, analyzePDF } from "@/lib/api";
import type {
  PageResult,
  ParsedDocument,
  AppStatus,
} from "@/types";
import { MAX_HISTORY_ITEMS } from "@/lib/constants";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface UseDocumentParserReturn {
  readonly currentDocument: ParsedDocument | null;
  readonly history: readonly ParsedDocument[];
  readonly status: AppStatus;
  readonly pages: readonly PageResult[];
  readonly totalPages: number | null;
  readonly parseFile: (file: File) => Promise<void>;
  readonly parseStream: (
    stream: AsyncGenerator<PageResult>,
    filename: string
  ) => Promise<void>;
  readonly loadFromHistory: (id: string) => void;
  readonly clearCurrent: () => void;
  readonly error: string | null;
}

export function useDocumentParser(): UseDocumentParserReturn {
  const [currentDocument, setCurrentDocument] =
    useState<ParsedDocument | null>(null);
  const [history, setHistory] = useState<readonly ParsedDocument[]>([]);
  const [status, setStatus] = useState<AppStatus>("idle");
  const [pages, setPages] = useState<readonly PageResult[]>([]);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  const addToHistory = useCallback((doc: ParsedDocument) => {
    setHistory((prev) => {
      const filtered = prev.filter((d) => d.id !== doc.id);
      return [doc, ...filtered].slice(0, MAX_HISTORY_ITEMS);
    });
  }, []);

  const parseStream = useCallback(
    async (stream: AsyncGenerator<PageResult>, filename: string) => {
      const docId = generateId();
      setStatus("parsing");
      setPages([]);
      setTotalPages(null);
      setError(null);
      sessionIdRef.current = null;

      const collectedPages: PageResult[] = [];

      try {
        for await (const page of stream) {
          collectedPages.push(page);
          setPages([...collectedPages]);
        }

        setTotalPages(collectedPages.length);
        setStatus("analyzing");

        const fullText = collectedPages.map((p) => p.text).join("\n\n");
        const analysis = await analyzePDF(fullText, filename);

        const doc: ParsedDocument = {
          id: docId,
          filename,
          pages: collectedPages,
          analysis,
          status: "done",
          createdAt: new Date().toISOString(),
        };

        setCurrentDocument(doc);
        setStatus("done");
        addToHistory(doc);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error";
        setError(message);
        setStatus("error");

        const doc: ParsedDocument = {
          id: docId,
          filename,
          pages: collectedPages,
          analysis: null,
          status: "error",
          createdAt: new Date().toISOString(),
          error: message,
        };
        setCurrentDocument(doc);
      }
    },
    [addToHistory]
  );

  const parseFile = useCallback(
    async (file: File) => {
      const stream = parsePDF(file);
      await parseStream(stream, file.name);
    },
    [parseStream]
  );

  const loadFromHistory = useCallback(
    (id: string) => {
      const doc = history.find((d) => d.id === id);
      if (doc) {
        setCurrentDocument(doc);
        setPages(doc.pages);
        setTotalPages(doc.pages.length);
        setStatus(doc.status);
        setError(doc.error ?? null);
      }
    },
    [history]
  );

  const clearCurrent = useCallback(() => {
    setCurrentDocument(null);
    setPages([]);
    setTotalPages(null);
    setStatus("idle");
    setError(null);
    sessionIdRef.current = null;
  }, []);

  return {
    currentDocument,
    history,
    status,
    pages,
    totalPages,
    parseFile,
    parseStream,
    loadFromHistory,
    clearCurrent,
    error,
  };
}

export type { UseDocumentParserReturn };
