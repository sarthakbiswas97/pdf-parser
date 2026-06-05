import { useNavigate } from "react-router";
import { HardDrive, Mail, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImportCard {
  readonly icon: React.ElementType;
  readonly title: string;
  readonly description: string;
  readonly path: string;
}

const IMPORT_OPTIONS: readonly ImportCard[] = [
  {
    icon: HardDrive,
    title: "Google Drive",
    description: "Import PDFs from your Drive",
    path: "/drive",
  },
  {
    icon: Mail,
    title: "Gmail",
    description: "Parse email attachments",
    path: "/gmail",
  },
  {
    icon: Sparkles,
    title: "Email Digest",
    description: "AI-powered email summary",
    path: "/digest",
  },
] as const;

export function ImportCards() {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {IMPORT_OPTIONS.map((option) => (
        <button
          key={option.path}
          onClick={() => navigate(option.path)}
          className={cn(
            "group flex items-center gap-3 rounded-xl border border-border p-4 text-left",
            "transition-all duration-100",
            "hover:border-border hover:bg-surface-hover hover:-translate-y-px",
            "hover:shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface transition-colors group-hover:border-green-500/20 group-hover:bg-green-500/5">
            <option.icon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-green-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">{option.title}</p>
            <p className="text-xs text-muted-foreground">
              {option.description}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}
