import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  Mail,
  Loader2,
  AlertCircle,
  Calendar,
  Paperclip,
  User,
  MessageSquare,
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
  getGmailAttachments,
  getGoogleAuthStatus,
  openGoogleAuth,
  parseGmailAttachment,
  validateAndReplayStream,
} from "@/lib/api";
import { EmailChatPanel } from "@/components/features/chat/EmailChatPanel";
import { GMAIL_FOLDERS, DATE_PRESETS } from "@/lib/constants";
import type { GmailEmail, PageResult } from "@/types";
import { cn } from "@/lib/utils";

interface GmailPageProps {
  readonly onParseStream: (
    stream: AsyncGenerator<PageResult>,
    filename: string
  ) => Promise<void>;
}

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

export function GmailPage({ onParseStream }: GmailPageProps) {
  const navigate = useNavigate();
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [emails, setEmails] = useState<readonly GmailEmail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [datePreset, setDatePreset] = useState("7days");
  const [folder, setFolder] = useState("all");
  const [parsingId, setParsingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"attachments" | "chat">(
    "attachments"
  );
  const [selectedEmail, setSelectedEmail] = useState<GmailEmail | null>(null);

  useEffect(() => {
    getGoogleAuthStatus()
      .then((r) => setIsConnected(r.connected))
      .catch(() => setIsConnected(false));
  }, []);

  const loadEmails = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const range = getDateRange(datePreset);
      const result = await getGmailAttachments({
        ...range,
        folder: folder === "all" ? undefined : folder,
      });
      setEmails(result.emails);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load emails");
    } finally {
      setIsLoading(false);
    }
  }, [datePreset, folder]);

  useEffect(() => {
    if (isConnected) {
      loadEmails();
    }
  }, [isConnected, loadEmails]);

  const handleParse = useCallback(
    async (
      messageId: string,
      attachmentId: string,
      filename: string
    ) => {
      const key = `${messageId}:${attachmentId}`;
      setParsingId(key);
      setError(null);
      try {
        const stream = parseGmailAttachment(messageId, attachmentId, filename);
        const { replayStream } = await validateAndReplayStream(stream);
        navigate("/document");
        await onParseStream(replayStream, filename);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : `Failed to parse "${filename}"`
        );
      } finally {
        setParsingId(null);
      }
    },
    [navigate, onParseStream]
  );

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
          <Mail className="h-6 w-6 text-muted-foreground" />
        </div>
        <h2 className="mb-2 text-lg font-semibold">Connect Gmail</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Link your Google account to find and parse PDF attachments from your
          emails.
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

  if (isConnected === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <div className="mb-6">
        <h2 className="text-lg font-semibold">Gmail</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Parse PDF attachments or chat about your emails
        </p>
      </div>

      {/* Filters */}
      <div className="mb-4 flex items-center gap-3">
        <Select
          value={datePreset}
          onValueChange={(v) => v !== null && setDatePreset(v)}
        >
          <SelectTrigger className="w-40 h-9 text-sm bg-surface border-border">
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

        <Select
          value={folder}
          onValueChange={(v) => v !== null && setFolder(v)}
        >
          <SelectTrigger className="w-36 h-9 text-sm bg-surface border-border">
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
      </div>

      {/* Tab toggle */}
      <div className="mb-6 flex gap-1 rounded-lg bg-surface p-1">
        <button
          onClick={() => setActiveTab("attachments")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            activeTab === "attachments"
              ? "bg-surface-2 text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Paperclip className="h-3.5 w-3.5" />
          Attachments
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

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-900 px-3 py-2 text-sm text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {activeTab === "attachments" ? (
        /* Attachments tab */
        <>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : emails.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border">
                <Mail className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                No emails with PDF attachments found
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {emails.map((email) => (
                <div
                  key={email.message_id}
                  className="rounded-xl border border-border bg-surface p-4"
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
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
                    </div>
                    {/* Chat about this email button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 shrink-0 text-xs text-muted-foreground hover:text-green-400"
                      onClick={() => {
                        setSelectedEmail(email);
                        setActiveTab("chat");
                      }}
                    >
                      <MessageSquare className="mr-1 h-3 w-3" />
                      Chat
                    </Button>
                  </div>

                  <div className="mt-3 space-y-1.5">
                    {email.attachments.map((att) => {
                      const key = `${email.message_id}:${att.id}`;
                      return (
                        <button
                          key={att.id}
                          onClick={() =>
                            handleParse(
                              email.message_id,
                              att.id,
                              att.filename
                            )
                          }
                          disabled={parsingId === key}
                          className="flex w-full items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-left transition-colors hover:bg-surface-hover disabled:opacity-50"
                        >
                          <Paperclip className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <span className="flex-1 truncate text-xs">
                            {att.filename}
                          </span>
                          <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                            {Math.round(att.size / 1024)}KB
                          </span>
                          {parsingId === key ? (
                            <Loader2 className="h-3 w-3 animate-spin text-green-400" />
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-none bg-green-500/10 text-green-400 font-mono text-[10px]"
                            >
                              Parse
                            </Badge>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        /* Chat tab */
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
