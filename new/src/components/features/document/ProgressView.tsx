import { CheckCircle2, Eye, ScanText, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { PageResult, AppStatus } from "@/types";
import { cn } from "@/lib/utils";

interface ProgressViewProps {
  readonly status: AppStatus;
  readonly pages: readonly PageResult[];
  readonly totalPages: number | null;
  readonly filename?: string;
}

export function ProgressView({
  status,
  pages,
  totalPages,
  filename,
}: ProgressViewProps) {
  const progressPercent =
    totalPages && totalPages > 0
      ? Math.round((pages.length / totalPages) * 100)
      : 0;

  const nativeCount = pages.filter((p) => p.source === "native").length;
  const ocrCount = pages.filter((p) => p.source === "ocr").length;

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-6 py-12">
      {/* Header */}
      <div className="mb-8 text-center">
        <h2 className="text-lg font-semibold">
          {status === "parsing"
            ? "Parsing document..."
            : "Analyzing document..."}
        </h2>
        {filename && (
          <p className="mt-1 font-mono text-sm text-muted-foreground">
            {filename}
          </p>
        )}
      </div>

      {/* Progress bar */}
      {status === "parsing" && (
        <div className="mb-8 w-full max-w-md">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {pages.length}
              {totalPages ? ` / ${totalPages}` : ""} pages
            </span>
            {totalPages && <span>{progressPercent}%</span>}
          </div>
          <Progress
            value={totalPages ? progressPercent : null}
            className="h-1.5"
          />
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
              {nativeCount} native
            </span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              {ocrCount} OCR
            </span>
          </div>
        </div>
      )}

      {/* Analyzing checklist */}
      {status === "analyzing" && (
        <div className="mb-8 w-full max-w-sm space-y-3">
          <AnalysisStep label="Pages extracted" done />
          <AnalysisStep label="Classifying document" active />
          <AnalysisStep label="Extracting fields" />
          <AnalysisStep label="Generating summary" />
        </div>
      )}

      {/* Page stream list */}
      {pages.length > 0 && (
        <div className="w-full max-w-md">
          <ScrollArea className="h-64 rounded-xl border border-border bg-surface">
            <div className="p-2">
              {pages.map((page) => (
                <div
                  key={page.page_number}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 animate-slide-up"
                  style={{
                    animationDelay: `${page.page_number * 30}ms`,
                  }}
                >
                  <span className="w-8 shrink-0 text-right font-mono text-xs text-muted-foreground">
                    {page.page_number}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "border-none font-mono text-[10px] shrink-0",
                      page.source === "native"
                        ? "bg-green-500/10 text-green-400"
                        : "bg-amber-400/10 text-amber-400"
                    )}
                  >
                    {page.source === "native" ? (
                      <Eye className="mr-1 h-2.5 w-2.5" />
                    ) : (
                      <ScanText className="mr-1 h-2.5 w-2.5" />
                    )}
                    {page.source}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {page.text.slice(0, 80).replace(/\n/g, " ")}
                  </span>
                  {page.confidence != null && (
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                      {Math.round(page.confidence * 100)}%
                    </span>
                  )}
                </div>
              ))}

              {/* Current processing indicator */}
              {status === "parsing" && (
                <div className="flex items-center gap-3 px-3 py-2">
                  <span className="w-8 shrink-0 text-right font-mono text-xs text-muted-foreground">
                    {pages.length + 1}
                  </span>
                  <div className="flex flex-1 gap-2">
                    <div className="h-3 w-16 rounded bg-surface-2 shimmer" />
                    <div className="h-3 w-32 rounded bg-surface-2 shimmer" />
                    <div className="h-3 w-24 rounded bg-surface-2 shimmer" />
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}

function AnalysisStep({
  label,
  done = false,
  active = false,
}: {
  readonly label: string;
  readonly done?: boolean;
  readonly active?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      {done ? (
        <CheckCircle2 className="h-4 w-4 text-green-400" />
      ) : active ? (
        <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
      ) : (
        <div className="h-4 w-4 rounded-full border border-border" />
      )}
      <span
        className={cn(
          "text-sm",
          done
            ? "text-muted-foreground line-through"
            : active
              ? "text-foreground"
              : "text-muted-foreground"
        )}
      >
        {label}
      </span>
    </div>
  );
}
