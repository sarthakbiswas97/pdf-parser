import { useState } from "react";
import { X, ChevronDown } from "lucide-react";
import type { PageResult } from "../lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  pages: PageResult[];
}

export function PageDrawer({ open, onClose, pages }: Props) {
  return (
    <>
      {open && (
        <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />
      )}
      <div
        className={`fixed right-0 top-0 bottom-0 z-50 flex w-[min(520px,90vw)] flex-col border-l border-border bg-bg transition-transform duration-250 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <span className="text-sm font-semibold">{pages.length} Pages</span>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-text-muted hover:text-text"
          >
            <X size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {pages.map((pg) => (
            <PageCard key={pg.page_number} page={pg} />
          ))}
        </div>
      </div>
    </>
  );
}

function PageCard({ page }: { page: PageResult }) {
  const [open, setOpen] = useState(false);
  const conf = page.confidence !== null ? `${(page.confidence * 100).toFixed(0)}%` : "";
  const preview = (page.text || "").substring(0, 80).replace(/\n/g, " ").trim() || "(empty)";

  return (
    <div
      className={`mb-1 overflow-hidden rounded-lg border transition-colors ${
        open ? "border-text-faint" : "border-border hover:border-border-active"
      } bg-surface`}
    >
      <div
        onClick={() => setOpen(!open)}
        className="flex cursor-pointer items-center gap-2 px-3.5 py-2.5"
      >
        <span className="font-mono text-xs font-medium text-text-muted">{page.page_number}</span>
        <span
          className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase ${
            page.source === "native"
              ? "bg-green-bg text-green"
              : "bg-amber-bg text-amber"
          }`}
        >
          {page.source}
        </span>
        {conf && <span className="font-mono text-[11px] text-text-faint">{conf}</span>}
        {!open && (
          <span className="ml-auto max-w-[160px] truncate text-[11px] text-text-faint">
            {preview}
          </span>
        )}
        <ChevronDown
          size={12}
          className={`ml-auto shrink-0 text-text-faint transition-transform ${open ? "rotate-180" : ""}`}
        />
      </div>

      {open && (
        <div className="border-t border-border px-3.5 pb-3 pt-2.5">
          <div className="flex gap-3">
            {page.image && (
              <div className="w-[120px] shrink-0 overflow-hidden rounded-md border border-border bg-surface-2">
                <img
                  src={`data:image/jpeg;base64,${page.image}`}
                  alt={`Page ${page.page_number}`}
                  className="w-full"
                />
              </div>
            )}
            <pre className="max-h-[250px] flex-1 overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-surface-2 p-2.5 font-mono text-[11px] leading-relaxed text-text-2">
              {page.text || "(no text)"}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
