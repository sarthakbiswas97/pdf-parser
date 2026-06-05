import { UploadBar } from "./UploadBar";
import { HardDrive, Mail, Upload, Sparkles, FileText, MessageSquare, Inbox } from "lucide-react";

interface Props {
  onFile: (file: File) => void;
  onBatch: (files: File[]) => void;
  onDriveImport: () => void;
  onGmailImport: () => void;
  onEmailDigest: () => void;
}

export function HeroView({ onFile, onBatch, onDriveImport, onGmailImport, onEmailDigest }: Props) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      {/* Headline */}
      <h1 className="text-center text-4xl font-bold leading-[1.1] tracking-tight md:text-5xl">
        Turn documents into
        <br />
        <span className="bg-gradient-to-r from-green to-green/60 bg-clip-text text-transparent">
          structured intelligence
        </span>
      </h1>

      <p className="mt-5 max-w-md text-center text-[15px] leading-relaxed text-text-muted">
        Upload any PDF. Get classified fields, summaries, and a chat interface — powered by AI.
      </p>

      {/* Upload bar */}
      <div className="mt-10 w-full max-w-lg">
        <UploadBar onFile={onFile} onBatch={onBatch} />
      </div>

      {/* Import sources */}
      <div className="mt-8 flex flex-col items-center gap-3">
        <span className="text-xs tracking-wide text-text-faint">or import from</span>
        <div className="flex gap-3">
          <ImportCard
            icon={<HardDrive size={20} />}
            label="Google Drive"
            desc="Browse your files"
            onClick={onDriveImport}
          />
          <ImportCard
            icon={<Mail size={20} />}
            label="Gmail"
            desc="PDF attachments"
            onClick={onGmailImport}
          />
          <ImportCard
            icon={<Inbox size={20} />}
            label="Email Digest"
            desc="Chat with emails"
            onClick={onEmailDigest}
          />
        </div>
      </div>

      {/* How it works */}
      <div className="mt-16 flex flex-col items-center">
        <span className="mb-6 text-xs tracking-wide text-text-faint">How it works</span>
        <div className="grid max-w-xl grid-cols-3 gap-4">
          <Step
            num={1}
            icon={<Upload size={18} />}
            title="Upload"
            desc="Drop a PDF, pick from Drive, or grab a Gmail attachment"
          />
          <Step
            num={2}
            icon={<Sparkles size={18} />}
            title="Analyze"
            desc="AI classifies your doc and extracts structured fields"
          />
          <Step
            num={3}
            icon={<MessageSquare size={18} />}
            title="Chat & Export"
            desc="Ask questions, export JSON/CSV, or push to Sheets"
          />
        </div>
      </div>

      {/* Supported types */}
      <p className="mt-12 text-xs text-text-faint">
        Invoices · Resumes · Contracts · Bank statements · Reports · and more
      </p>
    </div>
  );
}

function ImportCard({
  icon,
  label,
  desc,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex w-40 flex-col items-center gap-2 rounded-xl border border-border bg-surface p-5 text-center transition-all hover:border-border-active hover:bg-surface-2"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-2 text-text-muted transition-colors group-hover:bg-surface-3 group-hover:text-text">
        {icon}
      </div>
      <span className="text-sm font-medium text-text">{label}</span>
      <span className="text-[11px] text-text-faint">{desc}</span>
    </button>
  );
}

function Step({
  num,
  icon,
  title,
  desc,
}: {
  num: number;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative mb-3 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface text-text-muted">
        {icon}
        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-green text-[10px] font-bold text-bg">
          {num}
        </span>
      </div>
      <span className="mb-1 text-sm font-medium">{title}</span>
      <span className="text-[12px] leading-relaxed text-text-faint">{desc}</span>
    </div>
  );
}
