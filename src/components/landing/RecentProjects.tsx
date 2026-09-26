"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, Trash2 } from "lucide-react";
import { useProjectStore } from "@/store/useProjectStore";
import { useHydrated } from "@/lib/useHydrated";
import { formatRelativeTime } from "@/lib/format";
import { DeleteProjectDialog } from "./DeleteProjectDialog";

const RECENT_LIMIT = 8;

export function RecentProjects() {
  const hydrated = useHydrated();
  const projects = useProjectStore((s) => s.projects);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  if (!hydrated) return null;

  const recent = [...projects]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, RECENT_LIMIT);

  if (recent.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 px-6 py-12 text-center">
        <Building2 size={28} className="mx-auto mb-3 text-neutral-700" />
        <p className="text-sm text-neutral-500">
          No projects yet. Start a new project to open the workspace.
        </p>
      </div>
    );
  }

  return (
    <>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {recent.map((project) => (
        <Link
          key={project.id}
          href={`/workspace/${project.id}`}
          className="group relative overflow-hidden rounded-xl border border-white/10 bg-neutral-900/60 p-4 transition hover:border-amber-500/40 hover:bg-neutral-900"
        >
          <div className="mb-6 flex h-20 items-center justify-center rounded-lg bg-gradient-to-br from-neutral-800 to-neutral-900">
            <Building2 size={26} className="text-neutral-600 transition group-hover:text-amber-500" />
          </div>
          <p className="truncate text-sm font-medium text-neutral-200">{project.name}</p>
          <p className="mt-0.5 text-xs text-neutral-500">
            Edited {formatRelativeTime(project.updatedAt)}
          </p>
          <button
            onClick={(e) => {
              e.preventDefault();
              setPendingDelete({ id: project.id, name: project.name });
            }}
            className="absolute right-2 top-2 rounded-md bg-neutral-950/60 p-1.5 text-neutral-500 opacity-0 backdrop-blur transition hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
            aria-label={`Delete ${project.name}`}
          >
            <Trash2 size={14} />
          </button>
        </Link>
      ))}
    </div>
    {pendingDelete && (
      <DeleteProjectDialog project={pendingDelete} onClose={() => setPendingDelete(null)} />
    )}
    </>
  );
}
