import type { PageResult, AnalysisResult, DriveFile } from "./types";

const API = import.meta.env.VITE_API_URL || "";

// -- NDJSON stream reader --

export async function* streamParse(
  file: File
): AsyncGenerator<PageResult> {
  const form = new FormData();
  form.append("file", file);
  const resp = await fetch(`${API}/parse`, { method: "POST", body: form });
  if (!resp.ok) throw new Error(`Parse failed: ${resp.status}`);
  yield* readNDJSON<PageResult>(resp);
}

export async function* streamDriveParse(
  fileId: string
): AsyncGenerator<PageResult> {
  const resp = await fetch(
    `${API}/integrations/drive/parse/${fileId}`,
    { method: "POST" }
  );
  if (!resp.ok) throw new Error(`Drive parse failed: ${resp.status}`);
  yield* readNDJSON<PageResult>(resp);
}

async function* readNDJSON<T>(resp: Response): AsyncGenerator<T> {
  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop()!;
    for (const line of lines) {
      if (!line.trim()) continue;
      yield JSON.parse(line) as T;
    }
  }
  if (buffer.trim()) {
    yield JSON.parse(buffer) as T;
  }
}

// -- Analysis --

export async function analyzeDocument(
  fullText: string,
  filename: string
): Promise<AnalysisResult> {
  const resp = await fetch(`${API}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ full_text: fullText, filename }),
  });
  if (!resp.ok) throw new Error(`Analysis failed: ${resp.status}`);
  return resp.json();
}

// -- Chat --

export async function chatWithDoc(
  fullText: string,
  question: string,
  sessionId?: string | null
): Promise<{
  answer: string;
  citations: { index: number; source: string; snippet: string }[];
  confidence: number | null;
  source: "rag" | "fallback";
  session_id: string | null;
}> {
  const resp = await fetch(`${API}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ full_text: fullText, question, session_id: sessionId }),
  });
  if (!resp.ok) throw new Error(`Chat failed: ${resp.status}`);
  return resp.json();
}

// -- Settings --

export async function getSettings(): Promise<Record<string, unknown>> {
  return (await fetch(`${API}/settings`)).json();
}

export async function saveSettings(
  updates: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const resp = await fetch(`${API}/settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  return resp.json();
}

// -- Google Auth --

export async function getGoogleStatus(): Promise<{ connected: boolean }> {
  return (await fetch(`${API}/auth/google/status`)).json();
}

export function openGoogleAuth(): Promise<boolean> {
  return new Promise((resolve) => {
    window.open(`${API}/auth/google`, "google_auth", "width=500,height=600");
    const handler = (e: MessageEvent) => {
      if (e.data === "google_connected") {
        resolve(true);
        window.removeEventListener("message", handler);
      }
    };
    window.addEventListener("message", handler);
    // Timeout after 2 minutes
    setTimeout(() => { resolve(false); window.removeEventListener("message", handler); }, 120000);
  });
}

export async function disconnectGoogle(): Promise<void> {
  await fetch(`${API}/auth/google/disconnect`, { method: "POST" });
}

// -- Google Drive --

export async function browseDrive(
  folderId = "root"
): Promise<{ folders: DriveFile[]; pdfs: DriveFile[] }> {
  const resp = await fetch(`${API}/integrations/drive/browse?folder_id=${encodeURIComponent(folderId)}`);
  if (!resp.ok) throw new Error("Drive browse failed");
  return resp.json();
}

// -- Gmail --

export interface GmailAttachment {
  id: string;
  filename: string;
  size: number;
}

export interface GmailEmail {
  message_id: string;
  subject: string;
  sender: string;
  date: string;
  attachments: GmailAttachment[];
}

export async function listGmailAttachments(
  after = "",
  before = "",
  folder = ""
): Promise<{ emails: GmailEmail[] }> {
  const params = new URLSearchParams();
  if (after) params.set("after", after);
  if (before) params.set("before", before);
  if (folder) params.set("folder", folder);
  const resp = await fetch(`${API}/integrations/gmail/attachments?${params}`);
  if (!resp.ok) throw new Error("Gmail fetch failed");
  return resp.json();
}

export async function* streamGmailParse(
  messageId: string,
  attachmentId: string,
  filename: string
): AsyncGenerator<PageResult> {
  const resp = await fetch(
    `${API}/integrations/gmail/parse/${messageId}/${attachmentId}?filename=${encodeURIComponent(filename)}`,
    { method: "POST" }
  );
  if (!resp.ok) throw new Error(`Gmail parse failed: ${resp.status}`);
  yield* readNDJSON<PageResult>(resp);
}

// -- Google Sheets --

export async function listSheets(): Promise<{ sheets: { id: string; name: string }[] }> {
  return (await fetch(`${API}/integrations/sheets/list`)).json();
}

export async function listDriveFolders(): Promise<{ folders: { id: string; name: string }[] }> {
  return (await fetch(`${API}/integrations/drive/folders`)).json();
}

// -- Webhook --

export async function testWebhook(): Promise<{ delivered: boolean }> {
  return (await fetch(`${API}/integrations/webhook/test`, { method: "POST" })).json();
}

// -- Email Digest --

import type { EmailDigest } from "./types";

export async function fetchEmailDigest(
  after: string,
  before: string,
  folder = ""
): Promise<EmailDigest> {
  const params = new URLSearchParams({ after, before });
  if (folder) params.set("folder", folder);
  const resp = await fetch(`${API}/integrations/gmail/digest?${params}`);
  if (!resp.ok) throw new Error(`Digest failed: ${resp.status}`);
  return resp.json();
}

export async function chatWithEmails(
  question: string,
  messageId?: string | null,
): Promise<{ answer: string; context: string }> {
  const body: Record<string, string> = { question };
  if (messageId) body.message_id = messageId;
  const resp = await fetch(`${API}/integrations/gmail/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`Email chat failed: ${resp.status}`);
  return resp.json();
}

// -- Calendar --

export async function addCalendarEvent(
  title: string, when: string, description = ""
): Promise<{ status: string; link?: string }> {
  const resp = await fetch(`${API}/integrations/calendar/add`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, when, description }),
  });
  if (!resp.ok) throw new Error(`Calendar failed: ${resp.status}`);
  return resp.json();
}

// -- Batch Upload --

export interface BatchResult {
  filename: string;
  status: "done" | "error";
  doc_type?: string;
  doc_type_label?: string;
  summary?: string;
  key_fields?: Record<string, string>;
  pages?: number;
  error?: string;
}

export async function* streamBatchUpload(
  files: File[]
): AsyncGenerator<BatchResult> {
  const form = new FormData();
  for (const f of files) form.append("files", f);
  const resp = await fetch(`${API}/batch`, { method: "POST", body: form });
  if (!resp.ok) throw new Error(`Batch failed: ${resp.status}`);
  yield* readNDJSON<BatchResult>(resp);
}

// -- Export helpers (client-side) --

export function downloadFile(content: string, filename: string, mime: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
