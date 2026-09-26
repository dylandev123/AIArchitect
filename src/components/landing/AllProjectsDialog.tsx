"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Copy, FolderOpen, Pencil, Trash2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import { useProjectStore } from "@/store/useProjectStore";
import { formatRelativeTime } from "@/lib/format";
import { DeleteProjectDialog } from "./DeleteProjectDialog";

const actionClass =
  "flex items-center gap-1 rounded-md px-2 py-1 text-xs text-neutral-400 hover:bg-white/5 hover:text-neutral-100";

export function AllProjectsDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const projects = useProjectStore((s) => s.projects);
  const renameProject = useProjectStore((s) => s.renameProject);
  const duplicateProject = useProjectStore((s) => s.duplicateProject);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  const sorted = [...projects].sort((a, b) => b.updatedAt - a.updatedAt);

  const commitRename = () => {
    if (renaming) renameProject(renaming.id, renaming.name);
    setRenaming(null);
  };

  return (
    <Modal title="Projects" onClose={onClose} wide>
      {sorted.length === 0 ? (
        <p className="py-6 text-center text-sm text-neutral-500">No projects yet.</p>
      ) : (
        <div className="grid max-h-[60vh] grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2">
          {sorted.map((project) => (
            <div
              key={project.id}
              className="rounded-xl border border-white/10 bg-neutral-900/60 p-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-800">
                  <Building2 size={16} className="text-neutral-500" />
                </div>
                <div className="min-w-0 flex-1">
                  {renaming?.id === project.id ? (
                    <input
                      autoFocus
                      value={renaming.name}
                      onChange={(e) => setRenaming({ id: project.id, name: e.target.value })}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename();
                        if (e.key === "Escape") {
                          e.stopPropagation();
                          setRenaming(null);
                        }
                      }}
                      aria-label="Project name"
                      className="w-full rounded bg-neutral-800 px-2 py-1 text-sm text-neutral-100 outline-none ring-1 ring-amber-500/50"
                    />
                  ) : (
                    <p className="truncate text-sm font-medium text-neutral-200">{project.name}</p>
                  )}
                  <p className="text-xs text-neutral-500">
                    Edited {formatRelativeTime(project.updatedAt)}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                <button
                  onClick={() => router.push(`/workspace/${project.id}`)}
                  className={actionClass}
                >
                  <FolderOpen size={12} /> Open
                </button>
                <button
                  onClick={() => setRenaming({ id: project.id, name: project.name })}
                  className={actionClass}
                >
                  <Pencil size={12} /> Rename
                </button>
                <button onClick={() => duplicateProject(project.id)} className={actionClass}>
                  <Copy size={12} /> Duplicate
                </button>
                <button
                  onClick={() => setPendingDelete({ id: project.id, name: project.name })}
                  className={`${actionClass} hover:!bg-red-500/10 hover:!text-red-400`}
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {pendingDelete && (
        <DeleteProjectDialog project={pendingDelete} onClose={() => setPendingDelete(null)} />
      )}
    </Modal>
  );
}
