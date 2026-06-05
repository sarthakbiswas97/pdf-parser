import { Clock, Settings, Plus, FileSearch } from "lucide-react";

interface Props {
  fileName: string;
  status: string;
  pageCount: number;
  elapsed: string;
  onNewDoc: () => void;
  onHistory: () => void;
  onSettings: () => void;
}

export function Navbar({
  fileName,
  status,
  pageCount,
  elapsed,
  onNewDoc,
  onHistory,
  onSettings,
}: Props) {
  const showDoc = status !== "idle";

  return (
    <nav className="sticky top-0 z-50 flex items-center gap-3 border-b border-border bg-bg/95 px-5 py-3 backdrop-blur-sm">
      <button
        onClick={onHistory}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-text-faint transition-colors hover:border-border-active hover:text-text-muted"
        title="History"
      >
        <Clock size={15} />
      </button>

      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-green/20 to-green/5">
          <FileSearch size={14} className="text-green" />
        </div>
        <span className="text-[15px] font-semibold tracking-tight">DocParser</span>
      </div>

      {showDoc && (
        <>
          <span className="h-1 w-1 rounded-full bg-text-faint" />
          <div className="flex items-center gap-2 text-[13px] text-text-muted">
            <div className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-green/10">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-green">
                <path d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="max-w-[300px] truncate">{fileName}</span>
            <span className="text-text-faint">{pageCount} pages{elapsed ? ` / ${elapsed}s` : ""}</span>
          </div>
        </>
      )}

      <div className="ml-auto flex items-center gap-2">
        {showDoc && (
          <button
            onClick={onNewDoc}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-text-muted transition-colors hover:border-border-active hover:text-text"
          >
            <Plus size={13} />
            New
          </button>
        )}
        <button
          onClick={onSettings}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-text-faint transition-colors hover:border-border-active hover:text-text-muted"
          title="Settings"
        >
          <Settings size={15} />
        </button>
      </div>
    </nav>
  );
}
