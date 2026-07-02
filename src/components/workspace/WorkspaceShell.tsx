"use client";

import type { Project } from "@/types/project";
import { TopBar } from "./TopBar";
import { LeftSidebar } from "./LeftSidebar";
import { RightSidebar } from "./RightSidebar";
import { ChatPanel } from "./ChatPanel";
import { MobileNav } from "./MobileNav";
import { Viewport } from "./viewport/Viewport";
import { useUndoRedoShortcuts } from "@/lib/useUndoRedoShortcuts";

export function WorkspaceShell({ project }: { project: Project }) {
  useUndoRedoShortcuts(project.id);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-neutral-950 text-neutral-100">
      <TopBar project={project} />
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — hidden on mobile, shown on md+ */}
        <div className="hidden md:flex">
          <LeftSidebar />
        </div>

        <main className="relative flex-1 overflow-hidden">
          <Viewport />
        </main>

        {/* Right sidebar — hidden on mobile, shown on md+ */}
        <div className="hidden md:flex">
          <RightSidebar />
        </div>
      </div>

      {/* AI Chat — hidden on mobile (available via dedicated flow) */}
      <div className="hidden md:block">
        <ChatPanel />
      </div>

      {/* Mobile bottom navigation */}
      <MobileNav />

      {/* Mobile spacing so viewport isn't behind the bottom nav */}
      <div className="h-14 shrink-0 md:hidden" />
    </div>
  );
}
