import { useNavigate } from "react-router";
import { FileSearch, Cpu, MessageSquare, ArrowRight } from "lucide-react";
import { UploadZone } from "@/components/features/upload/UploadZone";
import { ImportCards } from "@/components/features/upload/ImportCards";

interface HomePageProps {
  readonly onFileSelect: (file: File) => void;
  readonly onBatchSelect: (files: File[]) => void;
}

const STEPS = [
  {
    icon: FileSearch,
    title: "Upload",
    description:
      "Drop a PDF and we extract text using intelligent OCR routing",
  },
  {
    icon: Cpu,
    title: "Analyze",
    description:
      "AI classifies the document and extracts structured fields",
  },
  {
    icon: MessageSquare,
    title: "Interact",
    description:
      "Ask questions about your document with RAG-powered answers",
  },
] as const;

export function HomePage({ onFileSelect, onBatchSelect }: HomePageProps) {
  const navigate = useNavigate();

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-6 py-16">
      {/* Hero heading */}
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Parse any{" "}
          <span className="bg-gradient-to-r from-green-400 to-emerald-300 bg-clip-text text-transparent">
            document
          </span>
        </h1>
        <p className="mt-3 text-base text-muted-foreground">
          AI-powered PDF parsing, classification, and Q&A.
          <br />
          Extract structured data from invoices, contracts, resumes, and more.
        </p>
      </div>

      {/* Upload zone */}
      <div className="w-full max-w-lg">
        <UploadZone
          onFileSelect={(file) => {
            onFileSelect(file);
            navigate("/document");
          }}
          onBatchSelect={(files) => {
            onBatchSelect(files);
            navigate("/batch");
          }}
        />
      </div>

      {/* Import options */}
      <div className="mt-6 w-full">
        <div className="mb-3 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or import from</span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <ImportCards />
      </div>

      {/* How it works */}
      <div className="mt-16 w-full">
        <h2 className="mb-6 text-center text-sm font-medium text-muted-foreground uppercase tracking-wider">
          How it works
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <div
              key={step.title}
              className="relative flex flex-col items-center rounded-xl border border-border bg-surface p-6 text-center"
              style={{
                animationDelay: `${i * 100}ms`,
              }}
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                <step.icon className="h-5 w-5 text-green-400" />
              </div>
              <h3 className="mb-1 text-sm font-semibold">{step.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {step.description}
              </p>
              {i < STEPS.length - 1 && (
                <ArrowRight className="absolute -right-2.5 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-muted-foreground/50 sm:block" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Supported types */}
      <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
        {["Invoices", "Contracts", "Resumes", "Bank Statements", "Reports"].map(
          (type) => (
            <span
              key={type}
              className="rounded-full border border-border bg-surface px-3 py-1 font-mono text-[11px] text-muted-foreground"
            >
              {type}
            </span>
          )
        )}
      </div>
    </div>
  );
}
