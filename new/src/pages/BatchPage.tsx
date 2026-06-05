import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Download,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { UploadZone } from "@/components/features/upload/UploadZone";
import { batchParse } from "@/lib/api";
import { DOC_TYPE_COLORS } from "@/lib/constants";
import type { BatchResult } from "@/types";
import { cn } from "@/lib/utils";

interface BatchPageProps {
  readonly initialFiles?: File[];
}

export function BatchPage({ initialFiles }: BatchPageProps) {
  const [results, setResults] = useState<readonly BatchResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [totalFiles, setTotalFiles] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const startBatch = useCallback(async (files: File[]) => {
    setIsProcessing(true);
    setResults([]);
    setTotalFiles(files.length);
    setError(null);

    try {
      const stream = batchParse(files);
      for await (const result of stream) {
        setResults((prev) => [...prev, result as unknown as BatchResult]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Batch processing failed");
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Auto-start if initialFiles provided (run once on mount)
  const hasStartedRef = useRef(false);
  useEffect(() => {
    if (!hasStartedRef.current && initialFiles && initialFiles.length > 0) {
      hasStartedRef.current = true;
      startBatch(initialFiles);
    }
  }, [initialFiles, startBatch]);

  const handleExportCSV = useCallback(() => {
    const doneResults = results.filter((r) => r.status === "done");
    if (doneResults.length === 0) return;

    const headers = ["filename", "doc_type", "pages", "summary"];
    const rows = doneResults.map((r) => [
      r.filename,
      r.doc_type_label ?? r.doc_type ?? "",
      String(r.pages ?? ""),
      (r.summary ?? "").replace(/"/g, '""'),
    ]);

    const csv =
      headers.join(",") +
      "\n" +
      rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "batch-results.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [results]);

  const doneCount = results.filter((r) => r.status === "done").length;
  const errorCount = results.filter((r) => r.status === "error").length;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">Batch Processing</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Process multiple PDFs at once
          </p>
        </div>
        {results.length > 0 && !isProcessing && (
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs border-border"
            onClick={handleExportCSV}
          >
            <Download className="mr-1.5 h-3 w-3" />
            Export CSV
          </Button>
        )}
      </div>

      {/* Upload zone when idle */}
      {!isProcessing && results.length === 0 && (
        <UploadZone
          onFileSelect={(file) => startBatch([file])}
          onBatchSelect={startBatch}
        />
      )}

      {/* Progress */}
      {(isProcessing || results.length > 0) && (
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {results.length} / {totalFiles} files processed
            </span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-400" />
                {doneCount}
              </span>
              {errorCount > 0 && (
                <span className="flex items-center gap-1">
                  <XCircle className="h-3 w-3 text-red-400" />
                  {errorCount}
                </span>
              )}
            </div>
          </div>
          <Progress
            value={
              totalFiles > 0
                ? Math.round((results.length / totalFiles) * 100)
                : 0
            }
            className="h-1.5"
          />
        </div>
      )}

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-900 px-3 py-2 text-sm text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Results grid */}
      {results.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {results.map((result, i) => (
            <div
              key={`${result.filename}-${i}`}
              className={cn(
                "rounded-xl border p-4 animate-fade-in-up",
                result.status === "done"
                  ? "border-border bg-surface"
                  : "border-red-400/20 bg-red-900"
              )}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {result.status === "done" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-400" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />
                  )}
                  <span className="truncate text-sm font-medium">
                    {result.filename}
                  </span>
                </div>
                {result.pages && (
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {result.pages}p
                  </span>
                )}
              </div>

              {result.status === "done" && (
                <>
                  {result.doc_type_label && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "mb-2 border-none font-mono text-[10px]",
                        DOC_TYPE_COLORS[result.doc_type ?? "other"] ??
                          DOC_TYPE_COLORS.other
                      )}
                    >
                      {result.doc_type_label}
                    </Badge>
                  )}

                  {result.summary && (
                    <p className="mb-2 text-xs text-muted-foreground line-clamp-2">
                      {result.summary}
                    </p>
                  )}

                  {result.key_fields && (
                    <div className="space-y-1">
                      {Object.entries(result.key_fields)
                        .slice(0, 3)
                        .map(([k, v]) => (
                          <div
                            key={k}
                            className="flex items-center justify-between text-xs"
                          >
                            <span className="font-mono text-muted-foreground uppercase">
                              {k.replace(/_/g, " ")}
                            </span>
                            <span className="font-medium">{v}</span>
                          </div>
                        ))}
                    </div>
                  )}
                </>
              )}

              {result.status === "error" && result.error && (
                <p className="text-xs text-red-400">{result.error}</p>
              )}
            </div>
          ))}

          {/* Processing placeholders */}
          {isProcessing &&
            Array.from({ length: totalFiles - results.length }).map((_, i) => (
              <div
                key={`pending-${i}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4"
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-24 rounded bg-surface-2 shimmer" />
                  <div className="h-3 w-32 rounded bg-surface-2 shimmer" />
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
