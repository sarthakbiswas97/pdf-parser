export const MAX_FILE_SIZE_MB = 50;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
export const ACCEPTED_FILE_TYPES = ".pdf";
export const MAX_HISTORY_ITEMS = 20;
export const MAX_BATCH_FILES = 20;

export const DOC_TYPE_COLORS: Record<string, string> = {
  invoice: "text-green-400 bg-green-900",
  resume: "text-blue-400 bg-blue-400/10",
  contract: "text-purple-400 bg-purple-400/10",
  bank_statement: "text-amber-400 bg-amber-900",
  report: "text-cyan-400 bg-cyan-400/10",
  other: "text-muted-foreground bg-muted",
} as const;

export const CHAT_SUGGESTIONS: Record<string, readonly string[]> = {
  invoice: [
    "What is the total amount due?",
    "When is the payment deadline?",
    "Who is the vendor?",
  ],
  resume: [
    "What are the key skills listed?",
    "How many years of experience?",
    "What is the most recent role?",
  ],
  contract: [
    "What is the contract term?",
    "What are the key obligations?",
    "Are there any penalties?",
  ],
  default: [
    "Summarize the key points",
    "What dates are mentioned?",
    "List all names and entities",
  ],
} as const;

export const GMAIL_FOLDERS = [
  { value: "all", label: "All Mail" },
  { value: "inbox", label: "Inbox" },
  { value: "sent", label: "Sent" },
  { value: "spam", label: "Spam" },
  { value: "promotions", label: "Promotions" },
] as const;

export const DATE_PRESETS = [
  { value: "today", label: "Today" },
  { value: "7days", label: "Last 7 Days" },
  { value: "30days", label: "Last 30 Days" },
  { value: "custom", label: "Custom Range" },
] as const;
