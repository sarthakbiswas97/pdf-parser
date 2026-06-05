import type { ReactNode } from "react";
import { SideRail } from "./SideRail";

interface ShellProps {
  readonly children: ReactNode;
  readonly topBar: ReactNode;
}

export function Shell({ children, topBar }: ShellProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <SideRail />
      <div className="ml-14 flex flex-1 flex-col">
        {topBar}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
