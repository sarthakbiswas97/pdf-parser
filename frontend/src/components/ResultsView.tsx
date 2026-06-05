import { useState } from "react";
import { ChevronDown, Download, Copy, FileText, Sparkles } from "lucide-react";
import type { AnalysisResult } from "../lib/types";
import { downloadFile } from "../lib/api";

interface Props {
  analysis: AnalysisResult;
  onViewPages: () => void;
  pageCount: number;
}

export function ResultsView({ analysis, onViewPages, pageCount }: Props) {
  const [showAll, setShowAll] = useState(false);
  const [copied, setCopied] = useState(false);

  const entries = Object.entries(analysis.fields);
  const scalars = entries.filter(
    ([, v]) => v.value !== null && typeof v.value !== "object" && !Array.isArray(v.value)
  );

  const exportJSON = () =>
    downloadFile(JSON.stringify(analysis.fields, null, 2), `${analysis.doc_type}_data.json`, "application/json");

  const exportCSV = () => {
    let csv = "Field,Value,Confidence\n";
    for (const [k, v] of entries) {
      let val = v.value;
      if (typeof val === "object") val = JSON.stringify(val);
      csv += `"${k}","${String(val).replace(/"/g, '""')}","${v.confidence}"\n`;
    }
    downloadFile(csv, `${analysis.doc_type}_data.csv`, "text/csv");
  };

  const copyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(analysis.fields, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="max-w-2xl">
      {/* Summary card */}
      <div className="mb-6 rounded-xl border border-border bg-surface p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green/10">
            <Sparkles size={16} className="text-green" />
          </div>
          <div>
            <span className="rounded-full border border-green/20 bg-green/10 px-3 py-0.5 font-mono text-xs font-semibold text-green">
              {analysis.doc_type_label}
            </span>
            <span className="ml-2 font-mono text-[11px] text-text-faint">
              {(analysis.doc_type_confidence * 100).toFixed(0)}% confidence
            </span>
          </div>
        </div>
        <p className="text-[15px] leading-[1.8] text-text-2">{analysis.summary}</p>
      </div>

      {/* Key fields */}
      <div className="mb-6">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-faint">
          Key Fields
        </h3>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-2.5">
          {scalars.slice(0, 6).map(([k, v]) => (
            <div
              key={k}
              className="rounded-lg border border-border bg-surface px-4 py-3.5"
            >
              <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wide text-text-faint">
                {k.replace(/_/g, " ")}
              </div>
              <div className="text-[14px] font-medium leading-snug">{String(v.value)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* All fields */}
      <div className="mb-6">
        <button
          onClick={() => setShowAll(!showAll)}
          className="flex w-full items-center gap-2 rounded-lg border border-border bg-surface px-4 py-3 text-[13px] font-medium text-text-muted transition-colors hover:border-border-active hover:text-text"
        >
          <ChevronDown
            size={14}
            className={`transition-transform ${showAll ? "rotate-180" : ""}`}
          />
          All extracted fields ({entries.length})
        </button>

        {showAll && (
          <div className="mt-2 flex flex-col gap-2">
            {entries.map(([k, v]) => {
              const conf = v.confidence;
              const isLow = conf < 0.8;
              return (
                <div
                  key={k}
                  className={`rounded-lg border px-4 py-3.5 ${
                    isLow
                      ? "border-amber/20 bg-amber/5"
                      : "border-border bg-surface"
                  }`}
                >
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="font-mono text-[11px] uppercase tracking-wide text-text-muted">
                      {k.replace(/_/g, " ")}
                    </span>
                    <span className={`font-mono text-[11px] ${isLow ? "font-semibold text-amber" : "text-text-faint"}`}>
                      {(conf * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="text-[14px] leading-relaxed">{formatValue(v.value)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <ActionBtn icon={<Download size={14} />} label="JSON" onClick={exportJSON} />
        <ActionBtn icon={<Download size={14} />} label="CSV" onClick={exportCSV} />
        <ActionBtn icon={<Copy size={14} />} label={copied ? "Copied!" : "Copy"} onClick={copyJSON} />
        <ActionBtn icon={<FileText size={14} />} label={`${pageCount} Pages`} onClick={onViewPages} />
      </div>
    </div>
  );
}

function ActionBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-xs font-medium text-text-muted transition-colors hover:border-border-active hover:text-text"
    >
      {icon}
      {label}
    </button>
  );
}

function formatValue(v: unknown): React.ReactNode {
  if (v === null || v === undefined)
    return <span className="italic text-text-faint">Not found</span>;
  if (Array.isArray(v)) {
    if (!v.length) return <span className="italic text-text-faint">Empty</span>;
    if (typeof v[0] === "object")
      return (
        <pre className="mt-1.5 overflow-x-auto rounded-lg border border-border bg-surface-2 p-3 font-mono text-[11px] leading-relaxed text-text-2">
          {JSON.stringify(v, null, 2)}
        </pre>
      );
    return <span>{v.map(String).join(", ")}</span>;
  }
  if (typeof v === "object")
    return (
      <pre className="mt-1.5 overflow-x-auto rounded-lg border border-border bg-surface-2 p-3 font-mono text-[11px] leading-relaxed text-text-2">
        {JSON.stringify(v, null, 2)}
      </pre>
    );
  return <span>{String(v)}</span>;
}
