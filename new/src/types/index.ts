// --- PDF Parsing ---

export interface PageResult {
  readonly page_number: number;
  readonly text: string;
  readonly source: "native" | "ocr";
  readonly confidence: number | null;
  readonly error: string | null;
  readonly image?: string; // base64 JPEG thumbnail
}

// --- Document Analysis ---

export interface FieldValue {
  readonly value: string;
  readonly confidence: number;
}

export interface AnalysisResult {
  readonly doc_type: string;
  readonly doc_type_confidence: number;
  readonly doc_type_label: string;
  readonly fields: Record<string, FieldValue>;
  readonly summary: string;
  readonly rag_ingested: boolean;
}

// --- Chat ---

export interface Citation {
  readonly chunk: string;
  readonly confidence: number;
}

export interface ChatResponse {
  readonly answer: string;
  readonly citations: readonly Citation[];
  readonly confidence: number | null;
  readonly is_abstention: boolean;
  readonly source: "rag" | "fallback";
  readonly session_id: string | null;
}

export interface ChatMessage {
  readonly id: string;
  readonly role: "user" | "assistant";
  readonly text: string;
  readonly citations?: readonly Citation[];
  readonly confidence?: number | null;
  readonly source?: "rag" | "fallback";
}

// --- Batch ---

export interface BatchResult {
  readonly filename: string;
  readonly status: "done" | "error";
  readonly doc_type?: string;
  readonly doc_type_label?: string;
  readonly summary?: string;
  readonly key_fields?: Record<string, string>;
  readonly pages?: number;
  readonly error?: string;
}

// --- Google Drive ---

export interface DriveFolder {
  readonly id: string;
  readonly name: string;
}

export interface DrivePdf {
  readonly id: string;
  readonly name: string;
  readonly size?: number;
  readonly modifiedTime?: string;
}

export interface DriveBrowseResponse {
  readonly folders: readonly DriveFolder[];
  readonly pdfs: readonly DrivePdf[];
}

// --- Gmail ---

export interface GmailAttachment {
  readonly id: string;
  readonly filename: string;
  readonly size: number;
}

export interface GmailEmail {
  readonly message_id: string;
  readonly subject: string;
  readonly sender: string;
  readonly date: string;
  readonly attachments: readonly GmailAttachment[];
}

// --- Email Digest ---

export interface DigestHighlight {
  readonly title: string;
  readonly detail: string;
  readonly sender: string;
  readonly date: string;
}

export interface DigestDeadline {
  readonly what: string;
  readonly when: string;
  readonly sender: string;
  readonly urgency: string;
}

export interface DigestActionItem {
  readonly action: string;
  readonly from: string;
  readonly priority: string;
}

export interface DigestTopic {
  readonly topic: string;
  readonly email_count: number;
  readonly key_senders: readonly string[];
}

export interface EmailDigestResponse {
  readonly total_emails: number;
  readonly highlights: readonly DigestHighlight[];
  readonly deadlines: readonly DigestDeadline[];
  readonly action_items: readonly DigestActionItem[];
  readonly topics: readonly DigestTopic[];
  readonly emails?: readonly EmailSummary[];
}

export interface EmailSummary {
  readonly message_id: string;
  readonly subject: string;
  readonly sender: string;
  readonly date: string;
  readonly summary: string;
}

// --- Settings ---

export interface Settings {
  readonly webhook_url?: string;
  readonly webhook_enabled?: boolean;
  readonly sheets_spreadsheet_id?: string;
  readonly sheets_enabled?: boolean;
  readonly drive_folder_id?: string;
  readonly drive_enabled?: boolean;
}

// --- Schemas ---

export interface SchemaField {
  readonly [fieldName: string]: string;
}

export interface DocumentSchema {
  readonly label: string;
  readonly description: string;
  readonly fields: SchemaField;
  readonly is_custom?: boolean;
}

// --- App State ---

export type AppStatus =
  | "idle"
  | "parsing"
  | "analyzing"
  | "done"
  | "error";

export interface ParsedDocument {
  readonly id: string;
  readonly filename: string;
  readonly pages: readonly PageResult[];
  readonly analysis: AnalysisResult | null;
  readonly status: AppStatus;
  readonly createdAt: string;
  readonly error?: string;
}

// --- Google Sheets ---

export interface GoogleSheet {
  readonly id: string;
  readonly name: string;
}
