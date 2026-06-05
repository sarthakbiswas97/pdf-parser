import { useState } from "react";
import { Loader2, CheckCircle, AlertCircle, Download, FileText, X } from "lucide-react";
import { streamBatchUpload, downloadFile } from "../lib/api";
import type { BatchResult } from "../lib/api";

interface Props {
  files: File[];
  onClose: () => void;
}

export function BatchView({ files, onClose }: Props) {
  const [results, setResults] = useState<BatchResult[]>([]);
  const [processing, setProcessing] = useState(true);
  const [started, setStarted] = useState(false);

  const start = async () => {
    if (started) return;
    setStarted(true);
    setProcessing(true);
    try {
      for await (const result of streamBatchUpload(files)) {
        setResults(prev => [...prev, result]);
      }
    } catch (err) {
      setResults(prev => [...prev, { filename: "batch", status: "error", error: String(err) }]);
    }
    setProcessing(false);
  };

  // Auto-start
  if (!started) start();

  const done = results.filter(r => r.status === "done").length;
  const errors = results.filter(r => r.status === "error").length;

  const exportAll = () => {
    const data = results.filter(r => r.status === "done").map(r => ({
      filename: r.filename,
      doc_type: r.doc_type_label,
      summary: r.summary,
      ...r.key_fields,
    }));

    // CSV
    if (!data.length) return;
    const headers = Object.keys(data[0]);
    let csv = headers.join(",") + "\n";
    for (const row of data) {
      csv += headers.map(h => `"${String((row as Record<string, unknown>)[h] || "").replace(/"/g, '""')}"`).join(",") + "\n";
    }
    downloadFile(csv, "batch_results.csv", "text/csv");
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-green/15 to-green/5">
          <FileText size={16} className="text-green" />
        </div>
        <div className="flex-1">
          <div className="text-[15px] font-semibold">Batch Processing</div>
          <div className="text-[11px] text-text-faint">
            {processing
              ? `Processing ${results.length} of ${files.length}...`
              : `Done: ${done} parsed, ${errors} errors`}
          </div>
        </div>
        {!processing && (
          <button onClick={exportAll}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text">
            <Download size={13} /> Export CSV
          </button>
        )}
        <button onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-text-faint hover:text-text">
          <X size={14} />
        </button>
      </div>

      {/* Progress bar */}
      {processing && (
        <div className="h-1 bg-surface-2">
          <div className="h-full bg-green transition-all" style={{ width: `${(results.length / files.length) * 100}%` }} />
        </div>
      )}

      {/* Results as compact cards (not a long list) */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Pending files (not yet processed) */}
          {files.slice(results.length).map((f, i) => (
            <div key={`pending-${i}`} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3.5 opacity-40">
              <Loader2 size={14} className={i === 0 && processing ? "animate-spin text-text-muted" : "text-text-faint"} />
              <span className="flex-1 truncate text-[13px] text-text-faint">{f.name}</span>
              <span className="text-[11px] text-text-faint">{(f.size / 1024).toFixed(0)} KB</span>
            </div>
          ))}

          {/* Completed results */}
          {results.map((r, i) => (
            <div key={i} className={`rounded-xl border px-4 py-3.5 ${
              r.status === "done" ? "border-green/20 bg-green/[0.03]" : "border-red/20 bg-red/[0.03]"
            }`}>
              <div className="flex items-start gap-2.5">
                {r.status === "done" ? (
                  <CheckCircle size={14} className="mt-0.5 shrink-0 text-green" />
                ) : (
                  <AlertCircle size={14} className="mt-0.5 shrink-0 text-red" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">{r.filename}</div>
                  {r.status === "done" && (
                    <>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="rounded-full bg-green/10 px-1.5 py-0.5 text-[10px] font-semibold text-green">
                          {r.doc_type_label}
                        </span>
                        <span className="text-[10px] text-text-faint">{r.pages} pages</span>
                      </div>
                      {r.key_fields && Object.keys(r.key_fields).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {Object.entries(r.key_fields).slice(0, 3).map(([k, v]) => (
                            <span key={k} className="rounded-md bg-surface-2 px-2 py-0.5 text-[10px] text-text-muted">
                              {k.replace(/_/g, " ")}: <span className="text-text">{v}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  {r.status === "error" && (
                    <div className="mt-1 text-[11px] text-red">{r.error}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
