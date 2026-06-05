import { useLocation, useNavigate } from "react-router";
import {
  FileText,
  Upload,
  Layers,
  HardDrive,
  Mail,
  Settings,
  Sparkles,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface NavItem {
  readonly icon: React.ElementType;
  readonly label: string;
  readonly path: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  { icon: Upload, label: "New Document", path: "/" },
  { icon: Layers, label: "Batch Process", path: "/batch" },
  { icon: HardDrive, label: "Google Drive", path: "/drive" },
  { icon: Mail, label: "Gmail", path: "/gmail" },
  { icon: Sparkles, label: "Email Digest", path: "/digest" },
] as const;

const BOTTOM_ITEMS: readonly NavItem[] = [
  { icon: Settings, label: "Settings", path: "/settings" },
] as const;

export function SideRail() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed left-0 top-0 z-40 flex h-screen w-14 flex-col items-center border-r border-border bg-background py-3">
      {/* Logo */}
      <button
        onClick={() => navigate("/")}
        className="mb-6 flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10 transition-colors hover:bg-green-500/20"
      >
        <FileText className="h-4.5 w-4.5 text-green-400" />
      </button>

      {/* Main nav */}
      <div className="flex flex-1 flex-col items-center gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavButton
              key={item.path}
              item={item}
              isActive={isActive}
              onClick={() => navigate(item.path)}
            />
          );
        })}
      </div>

      {/* Bottom nav */}
      <div className="flex flex-col items-center gap-1">
        {BOTTOM_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavButton
              key={item.path}
              item={item}
              isActive={isActive}
              onClick={() => navigate(item.path)}
            />
          );
        })}
      </div>
    </nav>
  );
}

function NavButton({
  item,
  isActive,
  onClick,
}: {
  readonly item: NavItem;
  readonly isActive: boolean;
  readonly onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger>
        <button
          onClick={onClick}
          className={cn(
            "relative flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-100",
            isActive
              ? "bg-green-500/10 text-green-400"
              : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
          )}
        >
          {isActive && (
            <span className="absolute -left-[13px] h-5 w-0.5 rounded-r-full bg-green-500 transition-all duration-200" />
          )}
          <item.icon className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {item.label}
      </TooltipContent>
    </Tooltip>
  );
}
