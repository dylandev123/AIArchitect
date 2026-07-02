"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/components/Modal";
import { useProjectStore } from "@/store/useProjectStore";

export function NewProjectDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const router = useRouter();
  const createProject = useProjectStore((s) => s.createProject);

  const handleCreate = () => {
    const project = createProject(name);
    router.push(`/workspace/${project.id}`);
  };

  return (
    <Modal title="New Project" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleCreate();
        }}
        className="space-y-4"
      >
        <div className="space-y-1.5">
          <label htmlFor="project-name" className="text-xs font-medium text-neutral-400">
            Project name
          </label>
          <input
            id="project-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Untitled Project"
            className="w-full rounded-lg border border-white/10 bg-neutral-800/80 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/60"
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-400 hover:text-neutral-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-amber-400"
          >
            Create Project
          </button>
        </div>
      </form>
    </Modal>
  );
}
