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
      className={`group flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border px-6 py-8 transition-all duration-200 ${
        dragOver
          ? "border-green/30 bg-green/[0.04]"
          : fileName
            ? "border-green/20 bg-green/[0.03]"
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
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${fileName ? "bg-green/10" : "bg-white/[0.05]"}`}>
        {fileName ? (
          <CheckCircle size={20} className="text-green" />
        ) : (
          <FileUp size={20} className="text-text-faint transition-colors group-hover:text-text-muted" />
        )}
      </div>

      <span className={`text-[15px] ${fileName ? "font-medium text-text" : "text-text-muted"}`}>
        {fileName || "Drop a PDF here or click to browse"}
      </span>

      <span className={`mt-1 text-[12px] ${fileName ? "text-green" : "text-text-faint"}`}>
        {fileName ? "Ready to parse" : "Supports any PDF up to 50MB"}
      </span>

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
            const arr = Array.from(files).filter(f => f.type === "application/pdf" || f.name.endsWith(".pdf"));
            if (arr.length === 1) handleFile(arr[0]);
            else if (arr.length > 1 && onBatch) onBatch(arr);
          }
        }}
      />
    </div>
  );
}
