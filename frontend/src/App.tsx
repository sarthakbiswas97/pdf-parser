import { useState } from "react";
import { useDocParser } from "./hooks/use-docparser";
import { Navbar } from "./components/Navbar";
import { HeroView } from "./components/HeroView";
import { ResultsView } from "./components/ResultsView";
import { ChatDock } from "./components/ChatDock";
import { PageDrawer } from "./components/PageDrawer";
import { DriveBrowser } from "./components/DriveBrowser";
import { GmailBrowser } from "./components/GmailBrowser";
import { EmailDigest } from "./components/EmailDigest";
import { BatchView } from "./components/BatchView";
import { SettingsDrawer } from "./components/SettingsDrawer";
import { HistorySidebar } from "./components/HistorySidebar";
import { Loader2 } from "lucide-react";

export default function App() {
  const dp = useDocParser();
  const [showPages, setShowPages] = useState(false);
  const [showDrive, setShowDrive] = useState(false);
  const [showGmail, setShowGmail] = useState(false);
  const [showEmailDigest, setShowEmailDigest] = useState(false);
  const [batchFiles, setBatchFiles] = useState<File[] | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const isActive = dp.status !== "idle";

  return (
    <div className="flex h-screen flex-col">
      <Navbar
        fileName={dp.fileName}
        status={dp.status}
        pageCount={dp.counts.total}
        elapsed={dp.elapsed}
        onNewDoc={dp.reset}
        onHistory={() => setShowHistory(true)}
        onSettings={() => setShowSettings(true)}
      />

      {batchFiles ? (
        <BatchView files={batchFiles} onClose={() => setBatchFiles(null)} />
      ) : !isActive ? (
        <HeroView
          onFile={dp.parseFile}
          onBatch={(files) => setBatchFiles(files)}
          onDriveImport={() => setShowDrive(true)}
          onGmailImport={() => setShowGmail(true)}
          onEmailDigest={() => setShowEmailDigest(true)}
        />
      ) : (
        <>
          {/* Progress strip */}
          {(dp.status === "parsing" || dp.status === "analyzing") && (
            <div className="h-[2px] overflow-hidden bg-surface-2">
              <div className="h-full w-[30%] animate-pulse rounded-full bg-green/60" />
            </div>
          )}

          {/* Main content area */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {dp.status === "parsing" && (
              <div className="flex flex-col items-center justify-center gap-4 py-20">
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-surface">
                  <Loader2 size={24} className="animate-spin text-green" />
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium">Parsing pages...</div>
                  <div className="mt-1 font-mono text-xs text-text-faint">
                    Page {dp.counts.total} ·{" "}
                    <span className="text-green">{dp.counts.native} native</span>{" · "}
                    <span className="text-amber">{dp.counts.ocr} OCR</span>
                  </div>
                </div>
              </div>
            )}

            {dp.status === "analyzing" && (
              <div className="flex flex-col items-center justify-center gap-4 py-20">
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-surface">
                  <Loader2 size={24} className="animate-spin text-green" />
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium">Analyzing document...</div>
                  <div className="mt-1 text-xs text-text-faint">
                    Classifying, extracting fields, generating summary
                  </div>
                </div>
              </div>
            )}

            {dp.status === "done" && dp.analysis && (
              <ResultsView
                analysis={dp.analysis}
                onViewPages={() => setShowPages(true)}
                pageCount={dp.counts.total}
              />
            )}

            {dp.error && (
              <div className="mt-2 rounded-lg border border-red/20 bg-red-bg px-4 py-3 text-[13px] text-red">
                {dp.error}
              </div>
            )}
          </div>

          <ChatDock
            messages={dp.chatMessages}
            onSend={dp.sendChat}
            disabled={!dp.fullText}
          />
        </>
      )}

      <PageDrawer open={showPages} onClose={() => setShowPages(false)} pages={dp.pages} />
      <DriveBrowser
        open={showDrive}
        onClose={() => setShowDrive(false)}
        onSelectFile={(id, name) => dp.parseDriveFile(id, name)}
      />
      <GmailBrowser
        open={showGmail}
        onClose={() => setShowGmail(false)}
        onSelectAttachment={(msgId, attId, filename) => {
          setShowGmail(false);
          dp.parseGmailAttachment(msgId, attId, filename);
        }}
      />
      <EmailDigest
        open={showEmailDigest}
        onClose={() => setShowEmailDigest(false)}
        onParseAttachment={(msgId, attId, filename) => {
          setShowEmailDigest(false);
          dp.parseGmailAttachment(msgId, attId, filename);
        }}
      />
      <SettingsDrawer open={showSettings} onClose={() => setShowSettings(false)} />
      <HistorySidebar
        open={showHistory}
        onClose={() => setShowHistory(false)}
        documents={dp.documents}
        activeDocId={dp.activeDocId}
        onSelect={(id) => {
          dp.loadFromHistory(id);
          setShowHistory(false);
        }}
      />
    </div>
  );
}
