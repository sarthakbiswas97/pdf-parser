import { useState } from "react";
import { ProgressView } from "@/components/features/document/ProgressView";
import { ResultsView } from "@/components/features/document/ResultsView";
import { ChatDock } from "@/components/features/chat/ChatDock";
import { PagePanel } from "@/components/features/document/PagePanel";
import type { ParsedDocument, PageResult, AppStatus } from "@/types";
import { AlertCircle } from "lucide-react";

interface DocumentPageProps {
  readonly document: ParsedDocument | null;
  readonly status: AppStatus;
  readonly pages: readonly PageResult[];
  readonly totalPages: number | null;
  readonly error: string | null;
}

export function DocumentPage({
  document: doc,
  status,
  pages,
  totalPages,
  error,
}: DocumentPageProps) {
  const [showPages, setShowPages] = useState(false);

  const fullText = pages.map((p) => p.text).join("\n\n");

  // Error state
  if (status === "error" && error) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-6 py-20 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-red-400/20 bg-red-900">
          <AlertCircle className="h-6 w-6 text-red-400" />
        </div>
        <h2 className="mb-2 text-lg font-semibold">Something went wrong</h2>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  // Parsing or analyzing
  if (status === "parsing" || status === "analyzing") {
    return (
      <ProgressView
        status={status}
        pages={pages}
        totalPages={totalPages}
        filename={doc?.filename}
      />
    );
  }

  // Done with results
  if (status === "done" && doc) {
    return (
      <>
        <div className="pb-32">
          <ResultsView document={doc} onViewPages={() => setShowPages(true)} />
        </div>

        <ChatDock fullText={fullText} docType={doc.analysis?.doc_type} />

        <PagePanel
          isOpen={showPages}
          onClose={() => setShowPages(false)}
          pages={pages}
        />
      </>
    );
  }

  // Idle / no document - shouldn't normally reach here
  return null;
}
