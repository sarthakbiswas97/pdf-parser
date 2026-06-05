import { useNavigate } from "react-router";
import { FileText, Plus, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ParsedDocument, AppStatus } from "@/types";
import { cn } from "@/lib/utils";

interface TopBarProps {
  readonly document: ParsedDocument | null;
  readonly status: AppStatus;
  readonly onNewDocument: () => void;
  readonly onToggleHistory: () => void;
}

function StatusIndicator({ status }: { readonly status: AppStatus }) {
  if (status === "idle") return null;

  const config = {
    parsing: { label: "Parsing", className: "bg-amber-400/10 text-amber-400" },
    analyzing: {
      label: "Analyzing",
      className: "bg-blue-400/10 text-blue-400",
    },
    done: { label: "Complete", className: "bg-green-500/10 text-green-400" },
    error: { label: "Error", className: "bg-red-400/10 text-red-400" },
  }[status];

  if (!config) return null;

  return (
    <Badge
      variant="outline"
      className={cn(
        "border-none font-mono text-xs",
        config.className
      )}
    >
      {(status === "parsing" || status === "analyzing") && (
        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current animate-pulse-dot" />
      )}
      {config.label}
    </Badge>
  );
}

export function TopBar({
  document: doc,
  status,
  onNewDocument,
  onToggleHistory,
}: TopBarProps) {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-border px-4 glass">
      <div className="flex items-center gap-3 min-w-0">
        {doc ? (
          <>
            <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm font-medium">
              {doc.filename}
            </span>
            {doc.pages.length > 0 && (
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {doc.pages.length} pages
              </span>
            )}
            <StatusIndicator status={status} />
          </>
        ) : (
          <span className="text-sm text-muted-foreground">DocParser</span>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={onToggleHistory}
            >
              <History className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>History</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => {
                onNewDocument();
                navigate("/");
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>New Document</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
