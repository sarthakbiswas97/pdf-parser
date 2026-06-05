import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  Folder,
  FileText,
  ChevronRight,
  HardDrive,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { browseDrive, getGoogleAuthStatus, openGoogleAuth, parseDriveFile, validateAndReplayStream } from "@/lib/api";
import type { DriveFolder, DrivePdf, PageResult } from "@/types";
import { cn } from "@/lib/utils";

interface DrivePageProps {
  readonly onParseStream: (
    stream: AsyncGenerator<PageResult>,
    filename: string
  ) => Promise<void>;
}

interface BreadcrumbItem {
  readonly id: string;
  readonly name: string;
}

export function DrivePage({ onParseStream }: DrivePageProps) {
  const navigate = useNavigate();
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [folders, setFolders] = useState<readonly DriveFolder[]>([]);
  const [pdfs, setPdfs] = useState<readonly DrivePdf[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<readonly BreadcrumbItem[]>([
    { id: "root", name: "My Drive" },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsingFileId, setParsingFileId] = useState<string | null>(null);

  useEffect(() => {
    getGoogleAuthStatus()
      .then((r) => setIsConnected(r.connected))
      .catch(() => setIsConnected(false));
  }, []);

  const loadFolder = useCallback(async (folderId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await browseDrive(folderId);
      setFolders(result.folders);
      setPdfs(result.pdfs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load folder");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isConnected) {
      loadFolder("root");
    }
  }, [isConnected, loadFolder]);

  const handleFolderClick = useCallback(
    (folder: DriveFolder) => {
      setBreadcrumbs((prev) => [...prev, { id: folder.id, name: folder.name }]);
      loadFolder(folder.id);
    },
    [loadFolder]
  );

  const handleBreadcrumbClick = useCallback(
    (index: number) => {
      const item = breadcrumbs[index];
      setBreadcrumbs(breadcrumbs.slice(0, index + 1));
      loadFolder(item.id);
    },
    [breadcrumbs, loadFolder]
  );

  const handleParseFile = useCallback(
    async (pdf: DrivePdf) => {
      setParsingFileId(pdf.id);
      setError(null);
      try {
        const stream = parseDriveFile(pdf.id, pdf.name);
        const { replayStream } = await validateAndReplayStream(stream);
        navigate("/document");
        await onParseStream(replayStream, pdf.name);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : `Failed to parse "${pdf.name}"`
        );
      } finally {
        setParsingFileId(null);
      }
    },
    [navigate, onParseStream]
  );

  const handleConnect = useCallback(() => {
    const popup = openGoogleAuth();
    const handler = (e: MessageEvent) => {
      if (e.data === "google_connected") {
        setIsConnected(true);
        window.removeEventListener("message", handler);
        popup?.close();
      }
    };
    window.addEventListener("message", handler);
  }, []);

  // Not connected state
  if (isConnected === false) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-6 py-20 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-border">
          <HardDrive className="h-6 w-6 text-muted-foreground" />
        </div>
        <h2 className="mb-2 text-lg font-semibold">Connect Google Drive</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Link your Google account to browse and parse PDFs directly from Drive.
        </p>
        <Button
          className="bg-green-500 text-green-950 hover:bg-green-400"
          onClick={handleConnect}
        >
          Connect Google Account
        </Button>
      </div>
    );
  }

  // Loading initial state
  if (isConnected === null) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold">Google Drive</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse and parse PDFs from your Drive
        </p>
      </div>

      {/* Breadcrumbs */}
      <div className="mb-4 flex items-center gap-1 text-sm">
        {breadcrumbs.map((item, i) => (
          <div key={item.id} className="flex items-center gap-1">
            {i > 0 && (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )}
            <button
              onClick={() => handleBreadcrumbClick(i)}
              className={cn(
                "rounded px-1.5 py-0.5 transition-colors",
                i === breadcrumbs.length - 1
                  ? "font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.name}
            </button>
          </div>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-900 px-3 py-2 text-sm text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-1">
          {/* Folders */}
          {folders.map((folder) => (
            <button
              key={folder.id}
              onClick={() => handleFolderClick(folder)}
              className="flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-surface-hover"
            >
              <Folder className="h-4 w-4 shrink-0 text-amber-400" />
              <span className="flex-1 text-sm">{folder.name}</span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          ))}

          {/* PDFs */}
          {pdfs.map((pdf) => (
            <button
              key={pdf.id}
              onClick={() => handleParseFile(pdf)}
              disabled={parsingFileId === pdf.id}
              className="flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-surface-hover disabled:opacity-50"
            >
              <FileText className="h-4 w-4 shrink-0 text-green-400" />
              <span className="flex-1 truncate text-sm">{pdf.name}</span>
              {parsingFileId === pdf.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-green-400" />
              ) : (
                <Badge
                  variant="outline"
                  className="border-none bg-green-500/10 text-green-400 font-mono text-[10px]"
                >
                  Parse
                </Badge>
              )}
            </button>
          ))}

          {/* Empty state */}
          {folders.length === 0 && pdfs.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                No folders or PDFs found here
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
