import { useState, useCallback } from "react";
import { Routes, Route, useNavigate } from "react-router";
import { Shell } from "@/components/layout/Shell";
import { TopBar } from "@/components/layout/TopBar";
import { HistoryPanel } from "@/components/layout/HistoryPanel";
import { HomePage } from "@/pages/HomePage";
import { DocumentPage } from "@/pages/DocumentPage";
import { BatchPage } from "@/pages/BatchPage";
import { DrivePage } from "@/pages/DrivePage";
import { GmailPage } from "@/pages/GmailPage";
import { DigestPage } from "@/pages/DigestPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { useDocumentParser } from "@/hooks/use-document-parser";
import type { PageResult } from "@/types";

export default function App() {
  const navigate = useNavigate();
  const {
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
  } = useDocumentParser();

  const [showHistory, setShowHistory] = useState(false);
  const [batchFiles, setBatchFiles] = useState<File[]>([]);

  const handleFileSelect = useCallback(
    (file: File) => {
      parseFile(file);
    },
    [parseFile]
  );

  const handleParseStream = useCallback(
    async (stream: AsyncGenerator<PageResult>, filename: string) => {
      await parseStream(stream, filename);
    },
    [parseStream]
  );

  const handleNewDocument = useCallback(() => {
    clearCurrent();
  }, [clearCurrent]);

  const handleHistorySelect = useCallback(
    (id: string) => {
      loadFromHistory(id);
      navigate("/document");
    },
    [loadFromHistory, navigate]
  );

  return (
    <>
      <Shell
        topBar={
          <TopBar
            document={currentDocument}
            status={status}
            onNewDocument={handleNewDocument}
            onToggleHistory={() => setShowHistory((v) => !v)}
          />
        }
      >
        <Routes>
          <Route
            path="/"
            element={
              <HomePage
                onFileSelect={(file) => {
                  handleFileSelect(file);
                  navigate("/document");
                }}
                onBatchSelect={(files) => {
                  setBatchFiles(files);
                  navigate("/batch");
                }}
              />
            }
          />
          <Route
            path="/document"
            element={
              <DocumentPage
                document={currentDocument}
                status={status}
                pages={pages}
                totalPages={totalPages}
                error={error}
              />
            }
          />
          <Route
            path="/batch"
            element={<BatchPage initialFiles={batchFiles} />}
          />
          <Route
            path="/drive"
            element={<DrivePage onParseStream={handleParseStream} />}
          />
          <Route
            path="/gmail"
            element={<GmailPage onParseStream={handleParseStream} />}
          />
          <Route path="/digest" element={<DigestPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Shell>

      <HistoryPanel
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        documents={history}
        onSelect={handleHistorySelect}
        currentId={currentDocument?.id}
      />
    </>
  );
}
