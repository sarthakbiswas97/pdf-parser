import { useCallback, useRef, useState } from "react";
import { FileUp, CheckCircle } from "lucide-react";

interface Props {
  onFile: (file: File) => void;
  onBatch?: (files: File[]) => void;
}

export function UploadBar({ onFile, onBatch }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState("");

  const handleFile = useCallback(
    (file: File) => {
      setFileName(file.name);
      onFile(file);
    },
    [onFile]
  );

  return (
    <div
      className={`group flex w-full cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed px-5 py-4 transition-all ${
        dragOver
          ? "border-green/40 bg-green/5"
          : fileName
            ? "border-green/30 bg-green/5"
            : "border-border bg-surface hover:border-border-active hover:bg-surface-2"
      }`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const pdfs = Array.from(e.dataTransfer.files).filter(f => f.type === "application/pdf" || f.name.endsWith(".pdf"));
        if (pdfs.length === 1) handleFile(pdfs[0]);
        else if (pdfs.length > 1 && onBatch) onBatch(pdfs);
      }}
    >
      {fileName ? (
        <CheckCircle size={20} className="shrink-0 text-green" />
      ) : (
        <FileUp size={20} className="shrink-0 text-text-faint transition-colors group-hover:text-text-muted" />
      )}

      <div className="flex flex-1 flex-col">
        <span className={`text-sm ${fileName ? "font-medium text-text" : "text-text-muted"}`}>
          {fileName || "Drop a PDF here or click to browse"}
        </span>
        {!fileName && (
          <span className="text-[11px] text-text-faint">Supports any PDF up to 50MB</span>
        )}
        {fileName && (
          <span className="text-[11px] text-green">Ready to parse</span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          if (!files || !files.length) return;
          if (files.length === 1) {
            handleFile(files[0]);
          } else {
            // Multiple files → batch
            const arr = Array.from(files).filter(f => f.type === "application/pdf" || f.name.endsWith(".pdf"));
            if (arr.length === 1) handleFile(arr[0]);
            else if (arr.length > 1 && onBatch) onBatch(arr);
          }
        }}
      />
    </div>
  );
}
