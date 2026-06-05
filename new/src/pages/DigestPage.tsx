import { useCallback, useEffect, useState } from "react";
import {
  Sparkles,
  Loader2,
  AlertCircle,
  Calendar,
  Target,
  Lightbulb,
  Tag,
  MessageSquare,
  CalendarPlus,
  User,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getGoogleAuthStatus,
  openGoogleAuth,
  getEmailDigest,
  addCalendarEvent,
} from "@/lib/api";
import { EmailChatPanel } from "@/components/features/chat/EmailChatPanel";
import { DATE_PRESETS, GMAIL_FOLDERS } from "@/lib/constants";
import type { EmailDigestResponse, EmailSummary } from "@/types";
import { cn } from "@/lib/utils";

function getDateRange(preset: string): { after?: string; before?: string } {
  const today = new Date();
  const format = (d: Date) => d.toISOString().split("T")[0];
  switch (preset) {
    case "today":
      return { after: format(today) };
    case "7days": {
      const d = new Date(today);
      d.setDate(d.getDate() - 7);
      return { after: format(d) };
    }
    case "30days": {
      const d = new Date(today);
      d.setDate(d.getDate() - 30);
      return { after: format(d) };
    }
    default:
      return {};
  }
}

export function DigestPage() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [digest, setDigest] = useState<EmailDigestResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState("7days");
  const [folder, setFolder] = useState("all");
  const [activeTab, setActiveTab] = useState<"digest" | "emails" | "chat">(
    "digest"
  );
  const [selectedEmail, setSelectedEmail] = useState<EmailSummary | null>(
    null
  );

  useEffect(() => {
    getGoogleAuthStatus()
      .then((r) => setIsConnected(r.connected))
      .catch(() => setIsConnected(false));
  }, []);

  const loadDigest = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const range = getDateRange(datePreset);
      const result = await getEmailDigest({
        ...range,
        folder: folder === "all" ? undefined : folder,
      });
      setDigest(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load digest");
    } finally {
      setIsLoading(false);
    }
  }, [datePreset, folder]);

  useEffect(() => {
    if (isConnected) {
      loadDigest();
    }
  }, [isConnected, loadDigest]);

  const handleAddToCalendar = useCallback(
    async (what: string, when: string) => {
      try {
        await addCalendarEvent({ title: what, when });
      } catch {
        // Silently fail - user can retry
      }
    },
    []
  );

  const handleChatAboutEmail = useCallback((email: EmailSummary) => {
    setSelectedEmail(email);
    setActiveTab("chat");
  }, []);

  const handleConnect = useCallback(() => {
    const popup = openGoogleAuth();
    const handler = (e: MessageEvent) => {
      if (e.data === "google_connected") {
        setIsConnected(true);
        window.removeEventListener("message", handler);
        popup?.close();
      }
    };
    window.addEventListener("message", handler);
  }, []);

  if (isConnected === false) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-6 py-20 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-border">
          <Sparkles className="h-6 w-6 text-muted-foreground" />
        </div>
        <h2 className="mb-2 text-lg font-semibold">Email Digest</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Connect your Google account for AI-powered email summaries, deadlines,
          and action items.
        </p>
        <Button
          className="bg-green-500 text-green-950 hover:bg-green-400"
          onClick={handleConnect}
        >
          Connect Google Account
        </Button>
      </div>
    );
  }

  if (isConnected === null || isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        {isLoading && (
          <p className="text-sm text-muted-foreground">
            Analyzing your emails...
          </p>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md px-6 py-12">
        <div className="flex items-center gap-2 rounded-lg bg-red-900 px-3 py-2 text-sm text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      </div>
    );
  }

  if (!digest) return null;

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">Email Digest</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {digest.total_emails} emails analyzed
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={folder}
            onValueChange={(v) => v !== null && setFolder(v)}
          >
            <SelectTrigger className="w-28 h-8 text-xs bg-surface border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GMAIL_FOLDERS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={datePreset}
            onValueChange={(v) => v !== null && setDatePreset(v)}
          >
            <SelectTrigger className="w-36 h-8 text-xs bg-surface border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_PRESETS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tab toggle */}
      <div className="mb-6 flex gap-1 rounded-lg bg-surface p-1">
        <button
          onClick={() => setActiveTab("digest")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            activeTab === "digest"
              ? "bg-surface-2 text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Digest
        </button>
        <button
          onClick={() => setActiveTab("emails")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            activeTab === "emails"
              ? "bg-surface-2 text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Mail className="h-3.5 w-3.5" />
          Emails
          {digest.emails && (
            <span className="font-mono text-[10px] text-muted-foreground">
              {digest.emails.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("chat")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            activeTab === "chat"
              ? "bg-surface-2 text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Chat
        </button>
      </div>

      {/* Digest tab */}
      {activeTab === "digest" && (
        <div className="space-y-6">
          {/* Highlights */}
          {digest.highlights.length > 0 && (
            <Section
              icon={Lightbulb}
              title="Highlights"
              color="text-amber-400"
            >
              <div className="space-y-2">
                {digest.highlights.map((h, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-border bg-surface p-3"
                  >
                    <p className="text-sm font-medium">{h.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {h.detail}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                      <User className="h-2.5 w-2.5" />
                      {h.sender}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Deadlines */}
          {digest.deadlines.length > 0 && (
            <Section
              icon={Calendar}
              title="Deadlines"
              color="text-red-400"
            >
              <div className="space-y-2">
                {digest.deadlines.map((d, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-border bg-surface p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{d.what}</p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {d.when}
                        <Badge
                          variant="outline"
                          className={cn(
                            "border-none font-mono text-[10px]",
                            d.urgency === "high"
                              ? "bg-red-900 text-red-400"
                              : "bg-amber-900 text-amber-400"
                          )}
                        >
                          {d.urgency}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground hover:text-green-400"
                      onClick={() => handleAddToCalendar(d.what, d.when)}
                    >
                      <CalendarPlus className="mr-1 h-3 w-3" />
                      Add
                    </Button>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Action Items */}
          {digest.action_items.length > 0 && (
            <Section
              icon={Target}
              title="Action Items"
              color="text-green-400"
            >
              <div className="space-y-2">
                {digest.action_items.map((a, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-border bg-surface p-3"
                  >
                    <p className="text-sm">{a.action}</p>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                      <User className="h-2.5 w-2.5" />
                      {a.from}
                      <Badge
                        variant="outline"
                        className="border-none bg-surface-2 font-mono text-[10px] text-muted-foreground"
                      >
                        {a.priority}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Topics */}
          {digest.topics.length > 0 && (
            <Section icon={Tag} title="Topics" color="text-blue-400">
              <div className="flex flex-wrap gap-2">
                {digest.topics.map((t, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-border bg-surface px-3 py-2"
                  >
                    <p className="text-sm font-medium">{t.topic}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                      {t.email_count} emails
                    </p>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}

      {/* Emails tab */}
      {activeTab === "emails" && (
        <div className="space-y-2">
          {digest.emails && digest.emails.length > 0 ? (
            digest.emails.map((email) => (
              <div
                key={email.message_id}
                className="rounded-xl border border-border bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {email.subject}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span className="truncate">{email.sender}</span>
                      <span>--</span>
                      <Calendar className="h-3 w-3" />
                      <span>
                        {new Date(email.date).toLocaleDateString()}
                      </span>
                    </div>
                    {email.summary && (
                      <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                        {email.summary}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 text-xs text-muted-foreground hover:text-green-400"
                    onClick={() => handleChatAboutEmail(email)}
                  >
                    <MessageSquare className="mr-1 h-3 w-3" />
                    Chat
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border">
                <Mail className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                No individual email details available
              </p>
              <p className="text-xs text-muted-foreground">
                Try the Chat tab to ask questions about your emails
              </p>
            </div>
          )}
        </div>
      )}

      {/* Chat tab */}
      {activeTab === "chat" && (
        <div style={{ height: "calc(100vh - 280px)" }}>
          <EmailChatPanel
            selectedEmailId={selectedEmail?.message_id}
            selectedEmailSubject={selectedEmail?.subject}
            onClearSelection={() => setSelectedEmail(null)}
            className="h-full"
          />
        </div>
      )}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  color,
  children,
}: {
  readonly icon: React.ElementType;
  readonly title: string;
  readonly color: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Icon className={cn("h-4 w-4", color)} />
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      {children}
    </div>
  );
}
