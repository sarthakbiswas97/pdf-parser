import type {
  AnalysisResult,
  ChatResponse,
  DriveBrowseResponse,
  DriveFolder,
  EmailDigestResponse,
  GmailEmail,
  GoogleSheet,
  PageResult,
  Settings,
  DocumentSchema,
} from "@/types";

const API_BASE = import.meta.env.VITE_API_URL || "";

// --- Helpers ---

async function fetchJSON<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

// --- Streaming NDJSON ---

export async function* streamNDJSON<T>(
  path: string,
  options?: RequestInit
): AsyncGenerator<T> {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        yield JSON.parse(trimmed) as T;
      }
    }
  }

  if (buffer.trim()) {
    yield JSON.parse(buffer.trim()) as T;
  }
}

/**
 * Validates a stream by reading the first item. Returns a new generator
 * that replays the first item then continues the rest of the stream.
 * Throws on the caller's side if the stream fails or is empty.
 */
export async function validateAndReplayStream<T>(
  stream: AsyncGenerator<T>
): Promise<{ firstItem: T; replayStream: AsyncGenerator<T> }> {
  const iterator = stream[Symbol.asyncIterator]();
  const first = await iterator.next();

  if (first.done) {
    throw new Error("Stream returned no data");
  }

  async function* replay(): AsyncGenerator<T> {
    yield first.value;
    let next = await iterator.next();
    while (!next.done) {
      yield next.value;
      next = await iterator.next();
    }
  }

  return { firstItem: first.value, replayStream: replay() };
}

// --- PDF Parsing ---

export function parsePDF(file: File): AsyncGenerator<PageResult> {
  const formData = new FormData();
  formData.append("file", file);
  return streamNDJSON<PageResult>("/parse", {
    method: "POST",
    body: formData,
  });
}

export function analyzePDF(
  fullText: string,
  filename: string
): Promise<AnalysisResult> {
  return fetchJSON<AnalysisResult>("/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ full_text: fullText, filename }),
  });
}

// --- Chat ---

export function chatWithDocument(
  fullText: string,
  question: string,
  sessionId?: string
): Promise<ChatResponse> {
  return fetchJSON<ChatResponse>("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      full_text: fullText,
      question,
      session_id: sessionId,
    }),
  });
}

// --- Batch ---

export function batchParse(
  files: File[]
): AsyncGenerator<Record<string, unknown>> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }
  return streamNDJSON<Record<string, unknown>>("/batch", {
    method: "POST",
    body: formData,
  });
}

// --- Export ---

export async function exportData(
  fields: Record<string, unknown>,
  docType: string,
  format: "json" | "csv"
): Promise<Blob> {
  const res = await fetch(`${API_BASE}/export`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields, doc_type: docType, format }),
  });
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);
  return res.blob();
}

// --- Settings ---

export function getSettings(): Promise<Settings> {
  return fetchJSON<Settings>("/settings");
}

export function updateSettings(
  settings: Partial<Settings>
): Promise<Settings> {
  return fetchJSON<Settings>("/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
}

// --- Schemas ---

export function getSchemas(): Promise<Record<string, DocumentSchema>> {
  return fetchJSON<Record<string, DocumentSchema>>("/schemas");
}

// --- Google Auth ---

export function getGoogleAuthStatus(): Promise<{ connected: boolean }> {
  return fetchJSON<{ connected: boolean }>("/auth/google/status");
}

export function disconnectGoogle(): Promise<void> {
  return fetchJSON<void>("/auth/google/disconnect", { method: "POST" });
}

export function openGoogleAuth(): Window | null {
  return window.open(
    `${API_BASE}/auth/google`,
    "google-auth",
    "width=500,height=600,menubar=no,toolbar=no"
  );
}

// --- Google Drive ---

export function browseDrive(
  folderId = "root"
): Promise<DriveBrowseResponse> {
  return fetchJSON<DriveBrowseResponse>(
    `/integrations/drive/browse?folder_id=${encodeURIComponent(folderId)}`
  );
}

export function getDriveFolders(): Promise<{ folders: DriveFolder[] }> {
  return fetchJSON<{ folders: DriveFolder[] }>(
    "/integrations/drive/folders"
  );
}

export function parseDriveFile(
  fileId: string,
  filename: string
): AsyncGenerator<PageResult> {
  return streamNDJSON<PageResult>(
    `/integrations/drive/parse/${encodeURIComponent(fileId)}?filename=${encodeURIComponent(filename)}`,
    { method: "POST" }
  );
}

// --- Gmail ---

export function getGmailAttachments(params: {
  after?: string;
  before?: string;
  folder?: string;
}): Promise<{ emails: GmailEmail[] }> {
  const searchParams = new URLSearchParams();
  if (params.after) searchParams.set("after", params.after);
  if (params.before) searchParams.set("before", params.before);
  if (params.folder) searchParams.set("folder", params.folder);
  return fetchJSON<{ emails: GmailEmail[] }>(
    `/integrations/gmail/attachments?${searchParams.toString()}`
  );
}

export function parseGmailAttachment(
  messageId: string,
  attachmentId: string,
  filename: string
): AsyncGenerator<PageResult> {
  return streamNDJSON<PageResult>(
    `/integrations/gmail/parse/${encodeURIComponent(messageId)}/${encodeURIComponent(attachmentId)}?filename=${encodeURIComponent(filename)}`,
    { method: "POST" }
  );
}

// --- Email Digest ---

export function getEmailDigest(params: {
  after?: string;
  before?: string;
  folder?: string;
}): Promise<EmailDigestResponse> {
  const searchParams = new URLSearchParams();
  if (params.after) searchParams.set("after", params.after);
  if (params.before) searchParams.set("before", params.before);
  if (params.folder) searchParams.set("folder", params.folder);
  return fetchJSON<EmailDigestResponse>(
    `/integrations/gmail/digest?${searchParams.toString()}`
  );
}

export function chatAboutEmails(
  question: string,
  messageId?: string
): Promise<{ answer: string; context: string }> {
  return fetchJSON<{ answer: string; context: string }>(
    "/integrations/gmail/chat",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, message_id: messageId }),
    }
  );
}

// --- Google Sheets ---

export function listSheets(): Promise<{ sheets: GoogleSheet[] }> {
  return fetchJSON<{ sheets: GoogleSheet[] }>(
    "/integrations/sheets/list"
  );
}

// --- Google Calendar ---

export function addCalendarEvent(params: {
  title: string;
  when: string;
  description?: string;
}): Promise<{ status: string; id?: string; link?: string }> {
  return fetchJSON<{ status: string; id?: string; link?: string }>(
    "/integrations/calendar/add",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    }
  );
}

// --- Webhook ---

export function testWebhook(): Promise<{ delivered: boolean; url: string }> {
  return fetchJSON<{ delivered: boolean; url: string }>(
    "/integrations/webhook/test",
    { method: "POST" }
  );
}

// --- Health ---

export function healthCheck(): Promise<{ status: string; rag: boolean }> {
  return fetchJSON<{ status: string; rag: boolean }>("/health");
}
