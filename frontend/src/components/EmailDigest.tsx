import { useCallback, useEffect, useRef, useState } from "react";
import {
  X, Search, AlertTriangle, Clock, CheckCircle, Tag,
  Sparkles, ArrowUp, Loader2, Mail, Inbox, Paperclip, FileText,
  CalendarRange, CalendarPlus,
} from "lucide-react";
import { fetchEmailDigest, chatWithEmails, getGoogleStatus, openGoogleAuth, addCalendarEvent } from "../lib/api";
import type { EmailDigest as DigestType, EmailSummary } from "../lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onParseAttachment?: (messageId: string, attachmentId: string, filename: string) => void;
}

type Preset = "today" | "3days" | "7days" | "30days" | "custom";
type LeftTab = "digest" | "emails";

function daysAgo(n: number): string {
  const d = new Date(); d.setDate(d.getDate() - n);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}
function tomorrow(): string {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

export function EmailDigest({ open, onClose, onParseAttachment }: Props) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [preset, setPreset] = useState<Preset>("7days");
  const [folder, setFolder] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [digest, setDigest] = useState<DigestType | null>(null);
  const [leftTab, setLeftTab] = useState<LeftTab>("digest");
  const [selectedEmail, setSelectedEmail] = useState<EmailSummary | null>(null);

  const [chatMsgs, setChatMsgs] = useState<{ role: string; text: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);

  useEffect(() => { chatRef.current?.scrollTo(0, chatRef.current.scrollHeight); }, [chatMsgs]);

  const runDigest = useCallback(async (after: string, before: string) => {
    const thisReq = ++requestIdRef.current;
    setLoading(true); setDigest(null); setChatMsgs([]); setSelectedEmail(null); setLeftTab("digest");
    try {
      const result = await fetchEmailDigest(after, before, folder);
      if (thisReq !== requestIdRef.current) return;
      setDigest(result);
    } catch (err) {
      if (thisReq !== requestIdRef.current) return;
      setDigest({ total_emails: 0, highlights: [], deadlines: [], action_items: [], topics: [], error: String(err) });
    }
    if (thisReq !== requestIdRef.current) return;
    setLoading(false);
  }, [folder]);

  const handlePreset = (p: Preset) => {
    setPreset(p);
    if (p === "today") runDigest(daysAgo(0), tomorrow());
    else if (p === "3days") runDigest(daysAgo(3), tomorrow());
    else if (p === "7days") runDigest(daysAgo(7), tomorrow());
    else if (p === "30days") runDigest(daysAgo(30), tomorrow());
  };

  const handleCustom = () => {
    if (!fromDate) return;
    runDigest(fromDate.replace(/-/g, "/"), toDate ? toDate.replace(/-/g, "/") : tomorrow());
  };

  const handleConnect = async () => {
    const ok = await openGoogleAuth();
    if (ok) setConnected(true);
  };

  const handleSelectEmail = (email: EmailSummary) => {
    setSelectedEmail(email);
    setChatMsgs([{ role: "bot", text: `Selected: "${email.subject}" from ${email.sender}\n\n${email.body}` }]);
  };

  const handleChat = async () => {
    const q = chatInput.trim();
    if (!q || chatSending) return;
    setChatInput("");
    setChatMsgs(prev => [...prev, { role: "user", text: q }]);
    setChatSending(true);
    try {
      const res = await chatWithEmails(q, selectedEmail?.message_id);
      setChatMsgs(prev => [...prev, { role: "bot", text: res.answer }]);
    } catch (err) {
      setChatMsgs(prev => [...prev, { role: "bot", text: `Error: ${err}` }]);
    }
    setChatSending(false);
  };

  useEffect(() => {
    if (!open) return;
    getGoogleStatus().then(s => setConnected(s.connected));
  }, [open]);

  if (!open) return null;

  const emails = digest?.emails || [];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      {/* ──── Header ──── */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-green/15 to-green/5">
          <Mail size={16} className="text-green" />
        </div>
        <div className="flex-1">
          <div className="text-[15px] font-semibold">Email Digest</div>
          {digest && (
            <div className="text-[11px] text-text-faint">
              {digest.total_emails} emails · {digest.highlights.length} highlights · {digest.deadlines.length} deadlines
            </div>
          )}
        </div>
        <button onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-text-faint transition-colors hover:border-border-active hover:text-text">
          <X size={15} />
        </button>
      </div>

      {/* ──── Not connected ──── */}
      {connected === false && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-surface">
            <Mail size={24} className="text-text-faint" />
          </div>
          <div className="text-center">
            <div className="text-sm font-medium">Connect Google</div>
            <div className="mt-1 text-xs text-text-faint">Analyze your emails with AI</div>
          </div>
          <button onClick={handleConnect}
            className="rounded-full bg-text px-5 py-2 text-sm font-medium text-bg hover:opacity-90">
            Connect
          </button>
        </div>
      )}

      {connected && (
        <>
          {/* ──── Controls ──── */}
          <div className="flex items-center gap-4 border-b border-border px-6 py-3">
            {/* Date presets */}
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface p-1">
              {([["today", "Today"], ["3days", "3 days"], ["7days", "7 days"], ["30days", "30 days"]] as [Preset, string][]).map(([k, label]) => (
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
                <CalendarRange size={12} className="inline mr-1" />Custom
              </button>
            </div>

            {/* Folder */}
            <div className="flex items-center gap-1">
              {(["all", "inbox", "spam", "sent"] as string[]).map(f => (
                <button key={f} onClick={() => setFolder(f)}
                  className={`rounded-full px-2.5 py-1 text-[11px] transition-colors ${
                    folder === f ? "bg-surface-3 text-text font-medium" : "text-text-faint hover:text-text-muted"
                  }`}>
                  {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            {/* Custom inputs */}
            {preset === "custom" && (
              <div className="flex items-center gap-2">
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                  className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-text outline-none focus:border-border-active" />
                <span className="text-[11px] text-text-faint">to</span>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                  className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-text outline-none focus:border-border-active" />
                <button onClick={handleCustom}
                  className="flex items-center gap-1 rounded-lg bg-text px-3 py-1.5 text-xs font-medium text-bg hover:opacity-90">
                  <Search size={11} /> Go
                </button>
              </div>
            )}
          </div>

          {/* ──── Main ──── */}
          <div className="flex flex-1 overflow-hidden">
            {/* ── Left panel ── */}
            <div className="flex flex-1 flex-col">
              {/* Tabs */}
              {digest && digest.total_emails > 0 && (
                <div className="flex border-b border-border px-5">
                  {([
                    ["digest", Sparkles, "Digest"],
                    ["emails", Inbox, `Emails (${emails.length})`],
                  ] as [LeftTab, typeof Sparkles, string][]).map(([key, Icon, label]) => (
                    <button key={key} onClick={() => setLeftTab(key)}
                      className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-xs font-medium transition-colors ${
                        leftTab === key
                          ? "border-green text-green"
                          : "border-transparent text-text-faint hover:text-text-muted"
                      }`}>
                      <Icon size={13} /> {label}
                    </button>
                  ))}
                </div>
              )}

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-5">
                {/* Empty state */}
                {!loading && !digest && (
                  <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-surface">
                      <CalendarRange size={24} className="text-text-faint" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-text-muted">Select a date range</div>
                      <div className="mt-1 max-w-[260px] text-xs leading-relaxed text-text-faint">
                        Pick a time period above to fetch and analyze your emails
                      </div>
                    </div>
                  </div>
                )}

                {/* Loading */}
                {loading && (
                  <div className="flex flex-col items-center justify-center gap-4 py-24">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-surface">
                      <Loader2 size={24} className="animate-spin text-green" />
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-medium">Analyzing emails...</div>
                      <div className="mt-1 text-xs text-text-faint">Fetching content and processing with AI</div>
                    </div>
                  </div>
                )}

                {/* Digest tab */}
                {!loading && digest && leftTab === "digest" && <DigestView digest={digest} />}

                {/* Emails tab */}
                {!loading && digest && leftTab === "emails" && (
                  <div className="flex flex-col gap-2">
                    {emails.map(email => {
                      const hasAtt = email.attachments && email.attachments.length > 0;
                      const isSelected = selectedEmail?.message_id === email.message_id;

                      return (
                        <div key={email.message_id}
                          className={`overflow-hidden rounded-xl border transition-all ${
                            isSelected
                              ? "border-green/30 bg-green/[0.03] shadow-[0_0_0_1px_rgba(74,222,128,0.1)]"
                              : "border-border bg-surface hover:border-border-active"
                          }`}>
                          <button onClick={() => handleSelectEmail(email)}
                            className="w-full px-4 py-3.5 text-left">
                            <div className="flex items-start gap-3">
                              {/* Avatar */}
                              <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${
                                isSelected ? "bg-green/15 text-green" : "bg-surface-2 text-text-faint"
                              }`}>
                                {email.sender.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="truncate text-[13px] font-medium">{email.subject}</span>
                                  {hasAtt && (
                                    <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-amber/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber">
                                      <Paperclip size={9} /> {email.attachments!.length}
                                    </span>
                                  )}
                                </div>
                                <div className="mt-0.5 truncate text-[12px] leading-relaxed text-text-muted">
                                  {email.body.slice(0, 120)}
                                </div>
                                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-text-faint">
                                  <span className="font-medium text-text-muted">{email.sender}</span>
                                  <span>·</span>
                                  <span>{formatDate(email.date)}</span>
                                </div>
                              </div>
                            </div>
                          </button>

                          {/* Attachments */}
                          {hasAtt && (
                            <div className="border-t border-border/50 bg-surface-2/30 px-4 py-2">
                              {email.attachments!.map(att => (
                                <div key={att.id} className="flex items-center gap-2.5 py-1">
                                  <FileText size={13} className="shrink-0 text-amber/70" />
                                  <span className="flex-1 truncate text-[12px] text-text-muted">{att.filename}</span>
                                  <span className="font-mono text-[10px] text-text-faint">{(att.size / 1024).toFixed(0)} KB</span>
                                  {onParseAttachment && (
                                    <button onClick={(e) => { e.stopPropagation(); onParseAttachment(email.message_id, att.id, att.filename); }}
                                      className="rounded-md bg-text px-2.5 py-1 text-[10px] font-semibold text-bg transition-opacity hover:opacity-90">
                                      Parse
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── Right: chat ── */}
            {digest && digest.total_emails > 0 && (
              <div className="flex w-[380px] shrink-0 flex-col border-l border-border">
                {/* Chat header */}
                <div className="border-b border-border px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-text-faint">
                        {selectedEmail ? "Chat · single email" : "Chat · all emails"}
                      </div>
                      {selectedEmail && (
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <div className="h-1.5 w-1.5 rounded-full bg-green" />
                          <span className="max-w-[260px] truncate text-[12px] text-text-muted">{selectedEmail.subject}</span>
                        </div>
                      )}
                    </div>
                    {selectedEmail && (
                      <button onClick={() => { setSelectedEmail(null); setChatMsgs([]); }}
                        className="rounded-md border border-border px-2 py-1 text-[10px] text-text-faint hover:border-border-active hover:text-text">
                        All emails
                      </button>
                    )}
                  </div>
                </div>

                {/* Messages */}
                <div ref={chatRef} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
                  {chatMsgs.length === 0 && (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface">
                        <Sparkles size={16} className="text-text-faint" />
                      </div>
                      <p className="text-[12px] leading-relaxed text-text-faint">
                        {selectedEmail
                          ? "Ask anything about this email"
                          : `Ask about your ${digest.total_emails} emails`}
                      </p>
                      <div className="flex flex-col gap-1.5">
                        {(selectedEmail
                          ? ["Summarize this email", "What action is needed?", "Any deadlines?"]
                          : ["Any urgent deadlines?", "Summarize top highlights", "What needs my reply?"]
                        ).map(q => (
                          <button key={q} onClick={() => setChatInput(q)}
                            className="rounded-lg border border-border px-3 py-2 text-left text-[12px] text-text-muted transition-colors hover:border-border-active hover:text-text">
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {chatMsgs.map((m, i) => (
                    <div key={i} className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${
                      m.role === "user"
                        ? "self-end rounded-br-md bg-surface-2 text-text"
                        : "self-start rounded-bl-md border border-border bg-surface text-text-2"
                    }`}>
                      {m.text}
                    </div>
                  ))}

                  {chatSending && (
                    <div className="self-start rounded-2xl rounded-bl-md border border-border bg-surface px-4 py-3">
                      <div className="flex gap-1">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-faint [animation-delay:0ms]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-faint [animation-delay:150ms]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-faint [animation-delay:300ms]" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Input */}
                <div className="border-t border-border p-3">
                  <div className="flex items-end gap-2 rounded-xl border border-border bg-surface p-1.5 transition-colors focus-within:border-border-active">
                    <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleChat(); } }}
                      placeholder={selectedEmail ? "Ask about this email..." : "Ask about all emails..."}
                      className="min-h-[34px] flex-1 bg-transparent px-2.5 py-1.5 text-[13px] text-text outline-none placeholder:text-text-faint" />
                    <button onClick={handleChat} disabled={!chatInput.trim() || chatSending}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-text text-bg transition-opacity disabled:opacity-15">
                      <ArrowUp size={14} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Digest sub-view
// ─────────────────────────────────────────────

function DigestView({ digest }: { digest: DigestType }) {
  if (digest.error) return <div className="rounded-xl border border-red/20 bg-red-bg px-4 py-3 text-sm text-red">{digest.error}</div>;
  if (digest.total_emails === 0) return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <Inbox size={24} className="text-text-faint" />
      <div className="text-sm text-text-faint">No emails found in this range.</div>
    </div>
  );

  return (
    <div className="max-w-2xl space-y-8">
      {digest.highlights.length > 0 && (
        <Section icon={<Sparkles size={14} className="text-green" />} title="Highlights" count={digest.highlights.length} accent="green">
          {digest.highlights.map((h, i) => (
            <div key={i} className="rounded-xl border border-border bg-surface px-4 py-3.5">
              <div className="text-[13px] font-semibold leading-snug">{h.title}</div>
              <div className="mt-1.5 text-[12px] leading-relaxed text-text-2">{h.detail}</div>
              <div className="mt-2 text-[11px] text-text-faint">{h.sender} · {h.date}</div>
            </div>
          ))}
        </Section>
      )}

      {digest.deadlines.length > 0 && (
        <Section icon={<AlertTriangle size={14} className="text-red" />} title="Deadlines" count={digest.deadlines.length} accent="red">
          {digest.deadlines.map((d, i) => (
            <DeadlineCard key={i} deadline={d} />
          ))}
        </Section>
      )}

      {digest.action_items.length > 0 && (
        <Section icon={<CheckCircle size={14} className="text-amber" />} title="Action Items" count={digest.action_items.length} accent="amber">
          {digest.action_items.map((a, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3.5">
              <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                a.priority === "high" ? "bg-red" : a.priority === "medium" ? "bg-amber" : "bg-text-faint"
              }`} />
              <div>
                <div className="text-[13px]">{a.action}</div>
                <div className="mt-0.5 text-[11px] text-text-faint">from {a.from}</div>
              </div>
            </div>
          ))}
        </Section>
      )}

      {digest.topics.length > 0 && (
        <Section icon={<Tag size={14} className="text-text-muted" />} title="Topics" count={digest.topics.length} accent="text">
          <div className="flex flex-wrap gap-2">
            {digest.topics.map((t, i) => (
              <div key={i} className="rounded-xl border border-border bg-surface px-4 py-3">
                <div className="text-[13px] font-medium">{t.topic}</div>
                <div className="mt-1 text-[11px] text-text-faint">
                  {t.email_count} email{t.email_count > 1 ? "s" : ""} · {t.key_senders.slice(0, 2).join(", ")}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function DeadlineCard({ deadline: d }: { deadline: { what: string; when: string; sender: string; urgency: string } }) {
  const [added, setAdded] = useState(false);
  const [adding, setAdding] = useState(false);

  const handleAdd = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (added || adding) return;
    setAdding(true);
    try {
      await addCalendarEvent(d.what, d.when, `Deadline from ${d.sender}`);
      setAdded(true);
    } catch { /* ignore */ }
    setAdding(false);
  };

  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 ${
      d.urgency === "high" ? "border-red/20 bg-red/[0.04]" :
      d.urgency === "medium" ? "border-amber/20 bg-amber/[0.04]" :
      "border-border bg-surface"
    }`}>
      <Clock size={14} className={`mt-0.5 shrink-0 ${
        d.urgency === "high" ? "text-red" : d.urgency === "medium" ? "text-amber" : "text-text-faint"
      }`} />
      <div className="flex-1">
        <div className="text-[13px] font-medium">{d.what}</div>
        <div className="mt-0.5 text-[11px] text-text-muted">{d.when} · from {d.sender}</div>
      </div>
      <div className="flex items-center gap-1.5">
        <button onClick={handleAdd} title={added ? "Added to calendar" : "Add to calendar"}
          className={`flex h-7 w-7 items-center justify-center rounded-lg border transition-all ${
            added ? "border-green/30 bg-green/10 text-green" :
            "border-border text-text-faint hover:border-border-active hover:text-text"
          }`}>
          {adding ? <Loader2 size={12} className="animate-spin" /> :
           added ? <CheckCircle size={12} /> : <CalendarPlus size={12} />}
        </button>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
          d.urgency === "high" ? "bg-red/10 text-red" :
          d.urgency === "medium" ? "bg-amber/10 text-amber" :
          "bg-surface-2 text-text-faint"
        }`}>{d.urgency}</span>
      </div>
    </div>
  );
}

function Section({ icon, title, count, children }: {
  icon: React.ReactNode; title: string; count: number; accent?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">{title}</span>
        <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[10px] font-medium text-text-faint">{count}</span>
      </div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
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
