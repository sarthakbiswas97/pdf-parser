import { useCallback, useState } from "react";
import { X, Mail, Paperclip, FileText, Search, Loader2, CalendarRange } from "lucide-react";
import { listGmailAttachments, getGoogleStatus, openGoogleAuth } from "../lib/api";
import type { GmailEmail } from "../lib/api";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelectAttachment: (messageId: string, attachmentId: string, filename: string) => void;
}

type Preset = "today" | "7days" | "30days" | "custom";

function daysAgo(n: number): string {
  const d = new Date(); d.setDate(d.getDate() - n);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}
function todayStr(): string {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

export function GmailBrowser({ open, onClose, onSelectAttachment }: Props) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [emails, setEmails] = useState<GmailEmail[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [preset, setPreset] = useState<Preset>("7days");
  const [folder, setFolder] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const search = useCallback(async (after: string, before: string, f?: string) => {
    setLoading(true); setSearched(true);
    try {
      const data = await listGmailAttachments(after, before, f ?? folder);
      setEmails(data.emails);
    } catch { setEmails([]); }
    setLoading(false);
  }, [folder]);

  const handlePreset = (p: Preset) => {
    setPreset(p);
    if (p === "today") search(daysAgo(0), todayStr());
    else if (p === "7days") search(daysAgo(7), todayStr());
    else if (p === "30days") search(daysAgo(30), todayStr());
  };

  const handleCustomSearch = () => {
    if (!fromDate) return;
    search(fromDate.replace(/-/g, "/"), toDate ? toDate.replace(/-/g, "/") : todayStr());
  };

  const handleOpen = async () => {
    const s = await getGoogleStatus();
    setConnected(s.connected);
    if (s.connected) handlePreset("7days");
  };

  const handleConnect = async () => {
    const ok = await openGoogleAuth();
    if (ok) { setConnected(true); handlePreset("7days"); }
  };

  if (!open) return null;
  if (connected === null) handleOpen();

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 flex h-[85vh] w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-bg shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-green/15 to-green/5">
            <Mail size={16} className="text-green" />
          </div>
          <div className="flex-1">
            <div className="text-[15px] font-semibold">Gmail Attachments</div>
            <div className="text-[11px] text-text-faint">PDF files from your emails</div>
          </div>
          <button onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-text-faint transition-colors hover:border-border-active hover:text-text">
            <X size={14} />
          </button>
        </div>

        {/* Not connected */}
        {connected === false && (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-surface">
              <Mail size={22} className="text-text-faint" />
            </div>
            <div>
              <div className="text-sm font-medium text-text-muted">Connect Gmail</div>
              <div className="mt-1 text-xs text-text-faint">Access PDF attachments from your emails</div>
            </div>
            <button onClick={handleConnect}
              className="rounded-full bg-text px-5 py-2 text-sm font-medium text-bg hover:opacity-90">
              Connect
            </button>
          </div>
        )}

        {connected && (
          <>
            {/* Controls */}
            <div className="border-t border-b border-border px-6 py-4">
              <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface p-1">
                {([["today", "Today"], ["7days", "7 days"], ["30days", "30 days"]] as [Preset, string][]).map(([k, label]) => (
                  <button key={k} onClick={() => handlePreset(k)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                      preset === k ? "bg-text text-bg shadow-sm" : "text-text-muted hover:text-text"
                    }`}>
                    {label}
                  </button>
                ))}
                <button onClick={() => setPreset("custom")}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                    preset === "custom" ? "bg-text text-bg shadow-sm" : "text-text-muted hover:text-text"
                  }`}>
                  <CalendarRange size={12} className="mr-1 inline" />Custom
                </button>
              </div>

              <div className="mt-3 flex items-center gap-1">
                {(["all", "inbox", "spam", "sent", "promotions"] as string[]).map(f => (
                  <button key={f} onClick={() => {
                    setFolder(f);
                    const after = preset === "today" ? daysAgo(0) : preset === "7days" ? daysAgo(7) : preset === "30days" ? daysAgo(30) : fromDate.replace(/-/g, "/");
                    if (after) search(after, todayStr(), f);
                  }}
                    className={`rounded-full px-2.5 py-1 text-[11px] transition-colors ${
                      folder === f ? "bg-surface-3 font-medium text-text" : "text-text-faint hover:text-text-muted"
                    }`}>
                    {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>

              {preset === "custom" && (
                <div className="mt-3 flex items-center gap-2">
                  <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                    className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-text outline-none focus:border-border-active" />
                  <span className="text-[11px] text-text-faint">to</span>
                  <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                    className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-text outline-none focus:border-border-active" />
                  <button onClick={handleCustomSearch}
                    className="flex items-center gap-1 rounded-lg bg-text px-3 py-1.5 text-xs font-medium text-bg hover:opacity-90">
                    <Search size={11} /> Go
                  </button>
                </div>
              )}
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {loading && (
                <div className="flex flex-col items-center gap-3 py-16">
                  <Loader2 size={20} className="animate-spin text-text-faint" />
                  <span className="text-xs text-text-faint">Searching emails...</span>
                </div>
              )}

              {!loading && searched && emails.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-16 text-center">
                  <Mail size={20} className="text-text-faint" />
                  <span className="text-xs text-text-faint">No emails with PDF attachments in this range</span>
                </div>
              )}

              {!loading && emails.map(email => (
                <div key={email.message_id} className="mb-2.5 overflow-hidden rounded-xl border border-border bg-surface">
                  {/* Email header */}
                  <div className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-[11px] font-bold text-text-faint">
                          {email.sender.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[13px] font-semibold text-text">{email.sender}</div>
                          <div className="mt-0.5 text-[12px] text-text-muted">{email.subject}</div>
                        </div>
                      </div>
                      <span className="shrink-0 text-[11px] text-text-faint">{formatDate(email.date)}</span>
                    </div>
                  </div>

                  {/* Attachments */}
                  <div className="border-t border-border/50 bg-surface-2/30 px-4 py-2.5">
                    <div className="flex flex-col gap-1.5">
                      {email.attachments.map(att => (
                        <div key={att.id}
                          onClick={() => { onSelectAttachment(email.message_id, att.id, att.filename); onClose(); }}
                          className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-bg px-4 py-2.5 transition-colors hover:border-border-active hover:bg-surface">
                          <FileText size={15} className="shrink-0 text-amber" />
                          <span className="flex-1 truncate text-[13px] text-text-2">{att.filename}</span>
                          <span className="font-mono text-[11px] text-text-faint">{(att.size / 1024).toFixed(0)} KB</span>
                          <span className="rounded-lg bg-text px-3 py-1 text-[11px] font-semibold text-bg">Parse</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function formatDate(raw: string): string {
  try {
    const d = new Date(raw);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Yesterday";
    if (diff < 7) return `${diff}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch { return raw; }
}
