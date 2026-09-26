"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderOpen, Trash2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import { useProjectStore } from "@/store/useProjectStore";
import { formatRelativeTime } from "@/lib/format";
import { DeleteProjectDialog } from "./DeleteProjectDialog";

export function OpenProjectDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const projects = useProjectStore((s) => s.projects);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  const sorted = [...projects].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <Modal title="Open Project" onClose={onClose}>
      {sorted.length === 0 ? (
        <p className="py-6 text-center text-sm text-neutral-500">
          No projects yet. Create one to get started.
        </p>
      ) : (
        <ul className="-mx-2 max-h-80 space-y-1 overflow-y-auto">
          {sorted.map((project) => (
            <li
              key={project.id}
              className="group flex items-center justify-between rounded-lg pr-2 hover:bg-white/5"
            >
              <button
                onClick={() => router.push(`/workspace/${project.id}`)}
                className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left"
              >
                <FolderOpen size={16} className="shrink-0 text-amber-500" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-neutral-200">
                    {project.name}
                  </span>
                  <span className="block text-xs text-neutral-500">
                    Edited {formatRelativeTime(project.updatedAt)}
                  </span>
                </span>
              </button>
              <button
                onClick={() => setPendingDelete({ id: project.id, name: project.name })}
                className="shrink-0 rounded-md p-1.5 text-neutral-600 opacity-0 hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                aria-label={`Delete ${project.name}`}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {pendingDelete && (
        <DeleteProjectDialog project={pendingDelete} onClose={() => setPendingDelete(null)} />
      )}
    </Modal>
  );
}
