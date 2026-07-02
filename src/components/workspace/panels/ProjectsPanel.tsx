"use client";

import { useParams, useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import { useProjectStore } from "@/store/useProjectStore";
import { formatRelativeTime } from "@/lib/format";

export function ProjectsPanel() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const projects = useProjectStore((s) => s.projects);
  const sorted = [...projects].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="flex flex-col gap-1 p-3">
      <p className="px-1 pb-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
        Projects
      </p>
      {sorted.map((project) => {
        const active = project.id === params.projectId;
        return (
          <button
            key={project.id}
            onClick={() => router.push(`/workspace/${project.id}`)}
            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition ${
              active
                ? "bg-amber-500/10 text-amber-400"
                : "text-neutral-300 hover:bg-white/5"
            }`}
          >
            <Building2 size={15} className="shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{project.name}</span>
              <span className="block truncate text-xs text-neutral-500">
                {formatRelativeTime(project.updatedAt)}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
