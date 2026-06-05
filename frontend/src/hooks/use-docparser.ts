import { useCallback, useRef, useState } from "react";
import {
  streamParse,
  streamDriveParse,
  streamGmailParse,
  analyzeDocument,
  chatWithDoc,
} from "../lib/api";
import type {
  PageResult,
  AnalysisResult,
  ChatMessage,
  DocumentRecord,
  AppStatus,
} from "../lib/types";

const MAX_HISTORY = 20;
const BATCH_INTERVAL_MS = 100; // batch page updates every 100ms

export function useDocParser() {
  const [status, setStatus] = useState<AppStatus>("idle");
  const [pages, setPages] = useState<PageResult[]>([]);
  const [fullText, setFullText] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [counts, setCounts] = useState({ total: 0, native: 0, ocr: 0 });
  const [elapsed, setElapsed] = useState("");
  const [error, setError] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);

  const chatSessionRef = useRef<string | null>(null);

  // Use refs for processStream to avoid stale closures + unnecessary rebuilds
  const stateRef = useRef({ pages: [] as PageResult[], fileName: "", fullText: "", analysis: null as AnalysisResult | null });
  stateRef.current = { pages, fileName, fullText, analysis };

  const saveToHistory = useCallback(
    (name: string, pg: PageResult[], ft: string, an: AnalysisResult | null) => {
      if (!pg.length) return;
      const doc: DocumentRecord = {
        id: Date.now().toString(),
        name,
        pages: pg,
        fullText: ft,
        analysis: an,
        timestamp: new Date(),
      };
      setDocuments((prev) => [doc, ...prev].slice(0, MAX_HISTORY));
      setActiveDocId(doc.id);
    },
    []
  );

  const processStream = useCallback(
    async (stream: AsyncGenerator<PageResult>, name: string) => {
      // Save previous doc using ref (avoids stale closure)
      const prev = stateRef.current;
      if (prev.pages.length) {
        saveToHistory(prev.fileName, prev.pages, prev.fullText, prev.analysis);
      }

      setStatus("parsing");
      setPages([]);
      setFullText("");
      setAnalysis(null);
      setFileName(name);
      setCounts({ total: 0, native: 0, ocr: 0 });
      setError("");
      setChatMessages([]);
      chatSessionRef.current = null;

      const t0 = performance.now();
      const collected: PageResult[] = [];
      const c = { total: 0, native: 0, ocr: 0 };
      let batchTimer: ReturnType<typeof setTimeout> | null = null;

      const flushBatch = () => {
        setPages([...collected]);
        setCounts({ ...c });
        batchTimer = null;
      };

      try {
        for await (const page of stream) {
          collected.push(page);
          c.total++;
          if (page.source === "native") c.native++;
          else c.ocr++;

          // Batch: only update React state every BATCH_INTERVAL_MS
          if (!batchTimer) {
            batchTimer = setTimeout(flushBatch, BATCH_INTERVAL_MS);
          }
        }
      } catch (err) {
        setError(`Parse error: ${err}`);
        setStatus("error");
        return;
      } finally {
        if (batchTimer) clearTimeout(batchTimer);
      }

      // Final flush
      setPages([...collected]);
      setCounts({ ...c });

      const el = ((performance.now() - t0) / 1000).toFixed(1);
      setElapsed(el);
      const ft = collected.map((p) => p.text).join("\n\n");
      setFullText(ft);

      setStatus("analyzing");
      try {
        const result = await analyzeDocument(ft, name);
        setAnalysis(result);
        setStatus("done");
        saveToHistory(name, collected, ft, result);
      } catch {
        setStatus("done");
        setError("Analysis failed. You can still chat.");
        saveToHistory(name, collected, ft, null);
      }
    },
    [saveToHistory] // stable deps only
  );

  const parseFile = useCallback(
    (file: File) => processStream(streamParse(file), file.name),
    [processStream]
  );

  const parseDriveFile = useCallback(
    (fileId: string, name: string) =>
      processStream(streamDriveParse(fileId), name),
    [processStream]
  );

  const parseGmailAttachment = useCallback(
    (messageId: string, attachmentId: string, filename: string) =>
      processStream(streamGmailParse(messageId, attachmentId, filename), filename),
    [processStream]
  );

  const sendChat = useCallback(
    async (question: string) => {
      if (!fullText) return;
      setChatMessages((prev) => [...prev, { role: "user", text: question }]);

      try {
        const res = await chatWithDoc(fullText, question, chatSessionRef.current);
        if (res.session_id) chatSessionRef.current = res.session_id;
        setChatMessages((prev) => [
          ...prev,
          {
            role: "bot",
            text: res.answer,
            citations: res.citations,
            confidence: res.confidence,
            source: res.source,
          },
        ]);
      } catch (err) {
        setChatMessages((prev) => [
          ...prev,
          { role: "bot", text: `Error: ${err}` },
        ]);
      }
    },
    [fullText]
  );

  const loadFromHistory = useCallback(
    (id: string) => {
      const doc = documents.find((d) => d.id === id);
      if (!doc) return;
      setActiveDocId(id);
      setPages(doc.pages);
      setFullText(doc.fullText);
      setAnalysis(doc.analysis);
      setFileName(doc.name);
      // Precomputed in one pass
      let native = 0;
      let ocr = 0;
      for (const p of doc.pages) {
        if (p.source === "native") native++;
        else ocr++;
      }
      setCounts({ total: doc.pages.length, native, ocr });
      setStatus(doc.analysis ? "done" : "idle");
      setError("");
      setChatMessages([]);
      chatSessionRef.current = null;
    },
    [documents]
  );

  const reset = useCallback(() => {
    const prev = stateRef.current;
    if (prev.pages.length) {
      saveToHistory(prev.fileName, prev.pages, prev.fullText, prev.analysis);
    }
    setStatus("idle");
    setPages([]);
    setFullText("");
    setAnalysis(null);
    setFileName("");
    setCounts({ total: 0, native: 0, ocr: 0 });
    setError("");
    setChatMessages([]);
    chatSessionRef.current = null;
  }, [saveToHistory]);

  return {
    status, pages, fullText, analysis, fileName, counts, elapsed, error,
    chatMessages, documents, activeDocId,
    parseFile, parseDriveFile, parseGmailAttachment, sendChat, loadFromHistory, reset,
  };
}
