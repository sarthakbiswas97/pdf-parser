export interface PageResult {
  page_number: number;
  text: string;
  source: "native" | "ocr";
  confidence: number | null;
  error: string | null;
  image?: string; // base64 JPEG thumbnail
}

export interface AnalysisResult {
  doc_type: string;
  doc_type_confidence: number;
  doc_type_label: string;
  fields: Record<string, FieldValue>;
  summary: string;
  rag_ingested: boolean;
}

export interface FieldValue {
  value: unknown;
  confidence: number;
}

export interface ChatMessage {
  role: "user" | "bot";
  text: string;
  citations?: Citation[];
  confidence?: number | null;
  source?: "rag" | "fallback";
}

export interface Citation {
  index: number;
  source: string;
  snippet: string;
}

export interface DocumentRecord {
  id: string;
  name: string;
  pages: PageResult[];
  fullText: string;
  analysis: AnalysisResult | null;
  timestamp: Date;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType?: string;
  size?: string;
  modifiedTime?: string;
}

export type AppStatus = "idle" | "parsing" | "analyzing" | "done" | "error";

export interface EmailDigest {
  total_emails: number;
  highlights: { title: string; detail: string; sender: string; date: string }[];
  deadlines: { what: string; when: string; sender: string; urgency: "high" | "medium" | "low" }[];
  action_items: { action: string; from: string; priority: "high" | "medium" | "low" }[];
  topics: { topic: string; email_count: number; key_senders: string[] }[];
  emails?: EmailSummary[];
  error?: string;
}

export interface EmailAttachment {
  id: string;
  filename: string;
  size: number;
}

export interface EmailSummary {
  message_id: string;
  subject: string;
  sender: string;
  date: string;
  body: string;
  attachments?: EmailAttachment[];
}
