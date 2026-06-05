import { X, Eye, ScanText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { PageResult } from "@/types";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface PagePanelProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly pages: readonly PageResult[];
}

export function PagePanel({ isOpen, onClose, pages }: PagePanelProps) {
  const [selectedPage, setSelectedPage] = useState<number | null>(null);

  if (!isOpen) return null;

  const activePage =
    selectedPage !== null
      ? pages.find((p) => p.page_number === selectedPage)
      : null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 z-50 flex h-screen w-96 flex-col border-l border-border bg-background animate-fade-in-up">
        {/* Header */}
        <div className="flex h-12 items-center justify-between border-b border-border px-4">
          <span className="text-sm font-medium">
            Pages ({pages.length})
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          {activePage ? (
            /* Page detail view */
            <div className="p-4">
              <Button
                variant="ghost"
                size="sm"
                className="mb-4 h-7 text-xs text-muted-foreground"
                onClick={() => setSelectedPage(null)}
              >
                Back to all pages
              </Button>

              <div className="mb-4 flex items-center gap-2">
                <span className="font-mono text-sm font-medium">
                  Page {activePage.page_number}
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    "border-none font-mono text-[10px]",
                    activePage.source === "native"
                      ? "bg-green-500/10 text-green-400"
                      : "bg-amber-400/10 text-amber-400"
                  )}
                >
                  {activePage.source}
                </Badge>
              </div>

              {activePage.image && (
                <div className="mb-4 overflow-hidden rounded-lg border border-border">
                  <img
                    src={`data:image/jpeg;base64,${activePage.image}`}
                    alt={`Page ${activePage.page_number}`}
                    className="w-full"
                  />
                </div>
              )}

              <pre className="whitespace-pre-wrap rounded-lg bg-surface p-3 font-mono text-xs leading-relaxed text-muted-foreground">
                {activePage.text}
              </pre>
            </div>
          ) : (
            /* Page list */
            <div className="p-2">
              {pages.map((page) => (
                <button
                  key={page.page_number}
                  onClick={() => setSelectedPage(page.page_number)}
                  className="flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-surface-hover"
                >
                  {page.image ? (
                    <div className="h-16 w-12 shrink-0 overflow-hidden rounded border border-border bg-surface-2">
                      <img
                        src={`data:image/jpeg;base64,${page.image}`}
                        alt={`Page ${page.page_number}`}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded border border-border bg-surface-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {page.page_number}
                      </span>
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-sm font-medium">
                        Page {page.page_number}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "border-none font-mono text-[10px]",
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
                      {page.confidence != null && (
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {Math.round(page.confidence * 100)}%
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {page.text.slice(0, 100).replace(/\n/g, " ")}
                    </p>
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
