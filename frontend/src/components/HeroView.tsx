import { UploadBar } from "./UploadBar";
import { HardDrive, Mail, Upload, Sparkles, MessageSquare, Inbox, ArrowRight, FileText, Zap, Shield } from "lucide-react";

interface Props {
  onFile: (file: File) => void;
  onBatch: (files: File[]) => void;
  onDriveImport: () => void;
  onGmailImport: () => void;
  onEmailDigest: () => void;
}

export function HeroView({ onFile, onBatch, onDriveImport, onGmailImport, onEmailDigest }: Props) {
  return (
    <div className="flex-1 overflow-y-auto">
      {/* ── Hero section: fills viewport ── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6">
        {/* Subtle radial glow behind hero */}
        <div className="pointer-events-none absolute top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-green/[0.03] blur-[120px]" />

        <div className="relative z-10 flex w-full max-w-[620px] flex-col items-center">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 text-[12px] text-text-muted">
            <Sparkles size={12} className="text-green" />
            AI-powered document parsing
          </div>

          {/* Headline */}
          <h1 className="text-center text-[44px] font-bold leading-[1.1] tracking-[-0.03em] md:text-[56px]">
            Turn documents into{" "}
            <span className="bg-gradient-to-r from-green to-emerald-300 bg-clip-text text-transparent">
              structured intelligence
            </span>
          </h1>

          <p className="mt-5 max-w-[460px] text-center text-[16px] leading-[1.6] text-text-muted">
            Upload any PDF. Get classified fields, summaries, and a chat interface — powered by AI.
          </p>

          {/* Upload bar */}
          <div className="mt-10 w-full max-w-[520px]">
            <UploadBar onFile={onFile} onBatch={onBatch} />
          </div>

          {/* Import cards */}
          <div className="mt-8 flex w-full max-w-[520px] flex-col items-center gap-4">
            <span className="text-[12px] uppercase tracking-[0.1em] text-text-faint">
              or import from
            </span>
            <div className="grid w-full grid-cols-3 gap-3">
              <ImportCard
                icon={<HardDrive size={18} />}
                label="Google Drive"
                desc="Browse your files"
                onClick={onDriveImport}
              />
              <ImportCard
                icon={<Mail size={18} />}
                label="Gmail"
                desc="PDF attachments"
                onClick={onGmailImport}
              />
              <ImportCard
                icon={<Inbox size={18} />}
                label="Email Digest"
                desc="Chat with emails"
                onClick={onEmailDigest}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="border-t border-border px-6 py-24">
        <div className="mx-auto max-w-[800px]">
          <div className="mb-14 text-center">
            <h2 className="text-[22px] font-semibold tracking-[-0.02em]">How it works</h2>
            <p className="mt-2 text-[14px] text-text-muted">Three steps to structured data</p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <StepCard
              num={1}
              icon={<Upload size={20} />}
              title="Upload"
              desc="Drop a PDF, pick from Drive, or grab a Gmail attachment"
            />
            <StepCard
              num={2}
              icon={<Sparkles size={20} />}
              title="Analyze"
              desc="AI classifies your doc and extracts structured fields"
            />
            <StepCard
              num={3}
              icon={<MessageSquare size={20} />}
              title="Chat & Export"
              desc="Ask questions, export JSON/CSV, or push to Sheets"
            />
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="border-t border-border px-6 py-24">
        <div className="mx-auto max-w-[800px]">
          <div className="mb-14 text-center">
            <h2 className="text-[22px] font-semibold tracking-[-0.02em]">Built for every document</h2>
            <p className="mt-2 text-[14px] text-text-muted">
              Powerful features to handle any PDF workflow
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <FeatureCard
              icon={<FileText size={20} />}
              title="Smart Classification"
              desc="Automatically detects invoices, resumes, contracts, bank statements, and more"
            />
            <FeatureCard
              icon={<Zap size={20} />}
              title="Field Extraction"
              desc="Pulls out structured fields like names, dates, amounts, and line items"
            />
            <FeatureCard
              icon={<Shield size={20} />}
              title="Secure Processing"
              desc="Your documents are processed securely and never stored permanently"
            />
          </div>
        </div>
      </section>

      {/* ── Supported types ── */}
      <section className="border-t border-border px-6 py-14">
        <div className="mx-auto max-w-[800px] text-center">
          <p className="mb-3 text-[12px] uppercase tracking-[0.1em] text-text-faint">
            Supported document types
          </p>
          <p className="text-[14px] leading-[2] text-text-muted">
            Invoices · Resumes · Contracts · Bank statements · Reports · and more
          </p>
        </div>
      </section>
    </div>
  );
}

/* ── Import card ── */

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
      className="group flex flex-col items-center gap-2.5 rounded-xl border border-border bg-surface px-4 py-5 text-center transition-all duration-200 hover:border-border-active hover:bg-surface-2"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.04] text-text-muted transition-colors group-hover:text-text">
        {icon}
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] font-medium text-text-2">{label}</span>
        <span className="text-[11px] text-text-faint">{desc}</span>
      </div>
      <ArrowRight size={13} className="text-text-faint opacity-0 transition-all group-hover:opacity-100" />
    </button>
  );
}

/* ── Feature card ── */

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-surface p-6">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-green/[0.08] text-green">
        {icon}
      </div>
      <span className="mb-1.5 text-[14px] font-semibold">{title}</span>
      <span className="text-[13px] leading-[1.5] text-text-muted">{desc}</span>
    </div>
  );
}

/* ── Step card ── */

function StepCard({
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
    <div className="flex flex-col rounded-xl border border-border bg-surface p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.04] text-text-muted">
          {icon}
        </div>
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green text-[11px] font-bold text-bg">
          {num}
        </span>
      </div>
      <span className="mb-1.5 text-[14px] font-semibold">{title}</span>
      <span className="text-[13px] leading-[1.5] text-text-muted">{desc}</span>
    </div>
  );
}
