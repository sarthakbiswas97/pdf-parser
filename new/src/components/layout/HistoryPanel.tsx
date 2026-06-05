import { X, FileText, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ParsedDocument } from "@/types";
import { DOC_TYPE_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface HistoryPanelProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly documents: readonly ParsedDocument[];
  readonly onSelect: (id: string) => void;
  readonly currentId?: string;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

export function HistoryPanel({
  isOpen,
  onClose,
  documents,
  onSelect,
  currentId,
}: HistoryPanelProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed left-14 top-0 z-50 h-screen w-80 animate-fade-in-up border-r border-border bg-background">
        <div className="flex h-12 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">History</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        <ScrollArea className="h-[calc(100vh-48px)]">
          {documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">No documents yet</p>
                <p className="text-xs text-muted-foreground">
                  Parsed documents will appear here
                </p>
              </div>
            </div>
          ) : (
            <div className="p-2">
              {documents.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => {
                    onSelect(doc.id);
                    onClose();
                  }}
                  className={cn(
                    "flex w-full flex-col gap-1.5 rounded-lg p-3 text-left transition-colors duration-100",
                    currentId === doc.id
                      ? "bg-green-500/5 ring-1 ring-green-500/20"
                      : "hover:bg-surface-hover"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      {doc.filename}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatRelativeTime(doc.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {doc.analysis && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "border-none text-[10px] font-mono",
                          DOC_TYPE_COLORS[doc.analysis.doc_type] ??
                            DOC_TYPE_COLORS.other
                        )}
                      >
                        {doc.analysis.doc_type_label}
                      </Badge>
                    )}
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {doc.pages.length} pages
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </>
  );
}
