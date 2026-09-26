"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { useProjectStore } from "@/store/useProjectStore";
import type { Project } from "@/types/project";

export function DeleteProjectDialog({
  project,
  onClose,
}: {
  project: Pick<Project, "id" | "name">;
  onClose: () => void;
}) {
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const [error, setError] = useState<string | null>(null);

  const confirm = () => {
    if (deleteProject(project.id)) {
      onClose();
    } else {
      setError("Couldn't delete this project. Please try again.");
    }
  };

  return (
    <Modal title="Delete Project" onClose={onClose}>
      <p className="text-sm text-neutral-300">
        Delete this project? This action cannot be undone.
      </p>
      <p className="mt-2 truncate text-xs text-neutral-500">{project.name}</p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-lg px-3 py-2 text-sm text-neutral-300 hover:bg-white/5"
        >
          Cancel
        </button>
        <button
          onClick={confirm}
          className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-500"
        >
          Delete Project
        </button>
      </div>
    </Modal>
  );
}
