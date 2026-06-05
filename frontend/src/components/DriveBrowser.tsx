import { useCallback, useEffect, useState } from "react";
import { X, Folder, FileText, HardDrive, ChevronRight, Loader2 } from "lucide-react";
import { browseDrive, getGoogleStatus, openGoogleAuth } from "../lib/api";
import type { DriveFile } from "../lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onSelectFile: (fileId: string, name: string) => void;
}

interface Crumb { id: string; name: string; }

export function DriveBrowser({ open, onClose, onSelectFile }: Props) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [folders, setFolders] = useState<DriveFile[]>([]);
  const [pdfs, setPdfs] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [breadcrumb, setBreadcrumb] = useState<Crumb[]>([{ id: "root", name: "My Drive" }]);

  const loadFolder = useCallback(async (folderId: string) => {
    setLoading(true);
    try {
      const data = await browseDrive(folderId);
      setFolders(data.folders);
      setPdfs(data.pdfs);
    } catch { setFolders([]); setPdfs([]); }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    getGoogleStatus().then((s) => {
      setConnected(s.connected);
      if (s.connected) { setBreadcrumb([{ id: "root", name: "My Drive" }]); loadFolder("root"); }
    });
  }, [open, loadFolder]);

  const navigateTo = (crumb: Crumb, index: number) => {
    setBreadcrumb((prev) => prev.slice(0, index + 1));
    loadFolder(crumb.id);
  };

  const enterFolder = (folder: DriveFile) => {
    setBreadcrumb((prev) => [...prev, { id: folder.id, name: folder.name }]);
    loadFolder(folder.id);
  };

  const handleConnect = async () => {
    const ok = await openGoogleAuth();
    if (ok) { setConnected(true); loadFolder("root"); }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-50 flex h-[80vh] w-[min(520px,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-bg shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-green/15 to-green/5">
            <HardDrive size={16} className="text-green" />
          </div>
          <div className="flex-1">
            <div className="text-[15px] font-semibold">Google Drive</div>
            <div className="text-[11px] text-text-faint">Select a PDF to parse</div>
          </div>
          <button onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-text-faint transition-colors hover:border-border-active hover:text-text">
            <X size={14} />
          </button>
        </div>

        {/* Breadcrumb */}
        {connected && (
          <div className="flex items-center gap-1 border-t border-b border-border px-6 py-2.5">
            {breadcrumb.map((c, i) => (
              <span key={c.id} className="flex items-center gap-1">
                {i > 0 && <ChevronRight size={12} className="text-text-faint" />}
                <button
                  onClick={() => navigateTo(c, i)}
                  className={`rounded-md px-1.5 py-0.5 text-xs transition-colors ${
                    i === breadcrumb.length - 1
                      ? "font-medium text-text"
                      : "text-text-muted hover:bg-surface hover:text-text"
                  }`}>
                  {c.name}
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {connected === false && (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-surface">
                <HardDrive size={22} className="text-text-faint" />
              </div>
              <div>
                <div className="text-sm font-medium text-text-muted">Connect Google Drive</div>
                <div className="mt-1 text-xs text-text-faint">Browse and parse your PDF files</div>
              </div>
              <button onClick={handleConnect}
                className="rounded-full bg-text px-5 py-2 text-sm font-medium text-bg hover:opacity-90">
                Connect
              </button>
            </div>
          )}

          {connected && loading && (
            <div className="flex flex-col items-center gap-3 py-16">
              <Loader2 size={20} className="animate-spin text-text-faint" />
              <span className="text-xs text-text-faint">Loading...</span>
            </div>
          )}

          {connected && !loading && !folders.length && !pdfs.length && (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <Folder size={20} className="text-text-faint" />
              <span className="text-xs text-text-faint">No folders or PDFs here</span>
            </div>
          )}

          {/* Folders */}
          {connected && !loading && folders.length > 0 && (
            <div className="mb-2">
              <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-text-faint">Folders</div>
              <div className="flex flex-col gap-0.5">
                {folders.map((f) => (
                  <div key={f.id} onClick={() => enterFolder(f)}
                    className="flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-surface">
                    <Folder size={16} className="shrink-0 text-text-muted" />
                    <span className="text-[13px] text-text-2">{f.name}</span>
                    <ChevronRight size={14} className="ml-auto text-text-faint" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PDFs */}
          {connected && !loading && pdfs.length > 0 && (
            <div>
              <div className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-text-faint">PDF Files</div>
              <div className="flex flex-col gap-0.5">
                {pdfs.map((f) => (
                  <div key={f.id}
                    onClick={() => { onSelectFile(f.id, f.name); onClose(); }}
                    className="flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-surface-2">
                    <FileText size={16} className="shrink-0 text-amber" />
                    <span className="flex-1 text-[13px] text-text-2">{f.name}</span>
                    {f.size && (
                      <span className="font-mono text-[11px] text-text-faint">
                        {(parseInt(f.size) / 1024).toFixed(0)} KB
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
