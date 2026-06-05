import { useCallback, useRef, useState } from "react";
import { Upload, FileText, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from "@/lib/constants";

interface UploadZoneProps {
  readonly onFileSelect: (file: File) => void;
  readonly onBatchSelect?: (files: File[]) => void;
  readonly disabled?: boolean;
  readonly compact?: boolean;
}

export function UploadZone({
  onFileSelect,
  onBatchSelect,
  disabled = false,
  compact = false,
}: UploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndHandle = useCallback(
    (files: FileList | File[]) => {
      setError(null);
      const fileArray = Array.from(files);
      const pdfFiles = fileArray.filter(
        (f) =>
          f.type === "application/pdf" ||
          f.name.toLowerCase().endsWith(".pdf")
      );

      if (pdfFiles.length === 0) {
        setError("Only PDF files are supported");
        return;
      }

      const oversized = pdfFiles.find(
        (f) => f.size > MAX_FILE_SIZE_BYTES
      );
      if (oversized) {
        setError(
          `File "${oversized.name}" exceeds ${MAX_FILE_SIZE_MB}MB limit`
        );
        return;
      }

      if (pdfFiles.length > 1 && onBatchSelect) {
        onBatchSelect(pdfFiles);
      } else if (pdfFiles.length >= 1) {
        onFileSelect(pdfFiles[0]);
      }
    },
    [onFileSelect, onBatchSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (disabled) return;
      validateAndHandle(e.dataTransfer.files);
    },
    [disabled, validateAndHandle]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) setIsDragOver(true);
    },
    [disabled]
  );

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handleClick = useCallback(() => {
    if (!disabled) inputRef.current?.click();
  }, [disabled]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        validateAndHandle(e.target.files);
        e.target.value = "";
      }
    },
    [validateAndHandle]
  );

  return (
    <div className="w-full">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") handleClick();
        }}
        aria-label="Upload PDF file"
        className={cn(
          "group relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all duration-200",
          compact ? "gap-2 p-6" : "gap-4 p-10",
          disabled && "pointer-events-none opacity-50",
          isDragOver
            ? "border-green-500/50 bg-green-500/5 scale-[1.005]"
            : "border-border hover:border-green-500/30 hover:bg-surface/50"
        )}
      >
        <div
          className={cn(
            "flex items-center justify-center rounded-xl border border-border transition-colors",
            compact ? "h-10 w-10" : "h-14 w-14",
            isDragOver
              ? "border-green-500/30 bg-green-500/10"
              : "group-hover:border-green-500/20 group-hover:bg-green-500/5"
          )}
        >
          {isDragOver ? (
            <FileText
              className={cn(
                "text-green-400",
                compact ? "h-4 w-4" : "h-6 w-6"
              )}
            />
          ) : (
            <Upload
              className={cn(
                "text-muted-foreground group-hover:text-green-400 transition-colors",
                compact ? "h-4 w-4" : "h-6 w-6"
              )}
            />
          )}
        </div>

        <div className="text-center">
          <p
            className={cn(
              "font-medium",
              compact ? "text-sm" : "text-base"
            )}
          >
            {isDragOver ? "Drop your PDF here" : "Drop a PDF or click to browse"}
          </p>
          {!compact && (
            <p className="mt-1 text-xs text-muted-foreground">
              PDF files up to {MAX_FILE_SIZE_MB}MB
              {onBatchSelect && " -- drop multiple for batch processing"}
            </p>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple={!!onBatchSelect}
          onChange={handleInputChange}
          className="hidden"
          aria-hidden
        />
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-900 px-3 py-2 text-sm text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}
