import { Clock, Settings, Plus } from "lucide-react";

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
    <div className="fixed top-0 right-0 left-0 z-50 px-5 pt-4">
      <nav className="mx-auto flex h-14 w-full items-center rounded-2xl border border-white/[0.06] bg-white/[0.03] px-5 shadow-[0_4px_24px_rgba(0,0,0,0.3)] ring-1 ring-white/[0.02] backdrop-blur-2xl">
        {/* Logo - left */}
        <div className="flex items-center gap-3">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M7 2h10l5 5v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="url(#logo-grad)" />
            <path d="M17 2v5h5" stroke="#0a0a0a" strokeWidth="1.2" />
            <path d="M9 13h6M9 16h4" stroke="#0a0a0a" strokeWidth="1.2" strokeLinecap="round" />
            <defs>
              <linearGradient id="logo-grad" x1="5" y1="2" x2="22" y2="22">
                <stop stopColor="#4ade80" />
                <stop offset="1" stopColor="#22c55e" />
              </linearGradient>
            </defs>
          </svg>
          <span className="text-[15px] font-semibold tracking-[-0.01em]">DocParser</span>
        </div>

        {/* Right side - everything else */}
        <div className="ml-auto flex items-center gap-1">
          {/* Nav links (landing) or doc info (active) */}
          {!showDoc ? (
            <div className="mr-2 flex items-center gap-0.5">
              <a
                href="#how-it-works"
                className="rounded-xl px-3.5 py-1.5 text-[13px] text-text-muted transition-colors hover:bg-white/[0.05] hover:text-text"
              >
                How it works
              </a>
              <a
                href="#features"
                className="rounded-xl px-3.5 py-1.5 text-[13px] text-text-muted transition-colors hover:bg-white/[0.05] hover:text-text"
              >
                Features
              </a>
            </div>
          ) : (
            <div className="mr-3 flex items-center gap-2.5 text-[13px]">
              <span className="max-w-[220px] truncate text-text-2">{fileName}</span>
              <span className="inline-flex h-[22px] items-center rounded-lg bg-green/10 px-2 text-[11px] font-medium text-green">
                {pageCount} pg{elapsed ? ` · ${elapsed}s` : ""}
              </span>
            </div>
          )}

          {showDoc && (
            <button
              onClick={onNewDoc}
              className="mr-1 flex items-center gap-1.5 rounded-xl bg-white/[0.06] px-3.5 py-1.5 text-[13px] font-medium text-text-2 transition-colors hover:bg-white/[0.1] hover:text-text"
            >
              <Plus size={14} strokeWidth={2} />
              New
            </button>
          )}

          <div className="mx-1 h-4 w-px bg-white/[0.06]" />

          <button
            onClick={onHistory}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-text-muted transition-colors hover:bg-white/[0.05] hover:text-text"
            title="History"
          >
            <Clock size={16} />
          </button>
          <button
            onClick={onSettings}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-text-muted transition-colors hover:bg-white/[0.05] hover:text-text"
            title="Settings"
          >
            <Settings size={16} />
          </button>
        </div>
      </nav>
    </div>
  );
}
