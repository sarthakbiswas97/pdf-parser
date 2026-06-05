import { X, FileText, Clock } from "lucide-react";
import type { DocumentRecord } from "../lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  documents: DocumentRecord[];
  activeDocId: string | null;
  onSelect: (id: string) => void;
}

export function HistorySidebar({ open, onClose, documents, activeDocId, onSelect }: Props) {
  return (
    <>
      {open && <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />}
      <div
        className={`fixed left-0 top-0 bottom-0 z-50 flex w-[min(340px,85vw)] flex-col border-r border-border bg-bg transition-transform duration-250 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
          <Clock size={15} className="text-text-muted" />
          <span className="flex-1 text-sm font-semibold">History</span>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-text-muted hover:text-text"
          >
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {documents.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface">
                <FileText size={20} className="text-text-faint" />
              </div>
              <div>
                <div className="text-sm text-text-muted">No documents yet</div>
                <div className="mt-0.5 text-xs text-text-faint">Parsed documents will appear here</div>
              </div>
            </div>
          )}
          {documents.map((doc) => (
            <div
              key={doc.id}
              onClick={() => {
                onSelect(doc.id);
                onClose();
              }}
              className={`mb-1 flex cursor-pointer items-start gap-3 rounded-lg px-3.5 py-3 transition-colors ${
                doc.id === activeDocId
                  ? "border border-border bg-surface-2"
                  : "hover:bg-surface"
              }`}
            >
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2">
                <FileText size={14} className="text-text-faint" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium">{doc.name}</div>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-text-faint">
                  {doc.analysis && (
                    <span className="rounded-full bg-green/10 px-1.5 py-0.5 text-[10px] font-semibold text-green">
                      {doc.analysis.doc_type_label}
                    </span>
                  )}
                  <span>{doc.pages.length} pages</span>
                  <span>
                    {doc.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
