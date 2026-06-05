import { useState } from "react";
import {
  FileText,
  Download,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  ScanText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ParsedDocument } from "@/types";
import { DOC_TYPE_COLORS } from "@/lib/constants";
import { exportData } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ResultsViewProps {
  readonly document: ParsedDocument;
  readonly onViewPages: () => void;
}

export function ResultsView({ document: doc, onViewPages }: ResultsViewProps) {
  const [showAllFields, setShowAllFields] = useState(false);
  const [copied, setCopied] = useState(false);
  const analysis = doc.analysis;

  if (!analysis) return null;

  const fieldEntries = Object.entries(analysis.fields);
  const visibleFields = showAllFields
    ? fieldEntries
    : fieldEntries.slice(0, 6);

  const handleCopy = async () => {
    const text = fieldEntries
      .map(([k, v]) => `${k}: ${v.value}`)
      .join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = async (format: "json" | "csv") => {
    try {
      const blob = await exportData(
        analysis.fields,
        analysis.doc_type,
        format
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${doc.filename.replace(".pdf", "")}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Export failed silently - user can retry
    }
  };

  const nativeCount = doc.pages.filter((p) => p.source === "native").length;
  const ocrCount = doc.pages.filter((p) => p.source === "ocr").length;

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      {/* Document header */}
      <div className="mb-6 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className={cn(
              "border-none font-mono text-xs px-2.5 py-1",
              DOC_TYPE_COLORS[analysis.doc_type] ?? DOC_TYPE_COLORS.other
            )}
          >
            {analysis.doc_type_label}
          </Badge>
          <span className="font-mono text-xs text-muted-foreground">
            {Math.round(analysis.doc_type_confidence * 100)}% confidence
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground"
            onClick={onViewPages}
          >
            <FileText className="mr-1.5 h-3 w-3" />
            {doc.pages.length} pages
          </Button>
        </div>
      </div>

      {/* Page stats */}
      <div className="mb-6 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Eye className="h-3 w-3 text-green-400" />
          {nativeCount} native
        </span>
        <span className="flex items-center gap-1.5">
          <ScanText className="h-3 w-3 text-amber-400" />
          {ocrCount} OCR
        </span>
      </div>

      {/* Summary card */}
      <Card className="mb-6 border-border bg-surface">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{analysis.summary}</p>
        </CardContent>
      </Card>

      {/* Fields grid */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          Extracted Fields
        </h3>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="mr-1 h-3 w-3 text-green-400" />
            ) : (
              <Copy className="mr-1 h-3 w-3" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => handleExport("json")}
          >
            <Download className="mr-1 h-3 w-3" />
            JSON
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => handleExport("csv")}
          >
            <Download className="mr-1 h-3 w-3" />
            CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {visibleFields.map(([key, field], i) => (
          <div
            key={key}
            className="rounded-lg border border-border bg-surface p-3 transition-all duration-100 hover:-translate-y-px hover:shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                {key.replace(/_/g, " ")}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {Math.round(field.confidence * 100)}%
              </span>
            </div>
            <p className="text-sm font-medium">
              {String(field.value) || "--"}
            </p>
          </div>
        ))}
      </div>

      {fieldEntries.length > 6 && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-3 w-full text-xs text-muted-foreground"
          onClick={() => setShowAllFields((v) => !v)}
        >
          {showAllFields ? (
            <>
              <ChevronUp className="mr-1 h-3 w-3" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="mr-1 h-3 w-3" />
              Show all {fieldEntries.length} fields
            </>
          )}
        </Button>
      )}
    </div>
  );
}
