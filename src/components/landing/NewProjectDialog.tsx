"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/components/Modal";
import { useProjectStore } from "@/store/useProjectStore";
import { ARCHITECTURE_FIXTURES } from "@/lib/architecture/fixtures";
import { BLANK_HOUSE_JSON } from "@/types/house";

export function NewProjectDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const router = useRouter();
  const createProject = useProjectStore((s) => s.createProject);
  const updateHouseConfig = useProjectStore((s) => s.updateHouseConfig);

  const handleCreate = () => {
    const project = createProject(name);
    router.push(`/workspace/${project.id}`);
  };

  /** Dev-only: opens the deterministic architecture fixture through the exact same HouseRenderer path live generation uses, for visual testing. */
  const handleLoadFixture = () => {
    const project = createProject(name || "Fixture: Modern Tropical Pavilion House");
    updateHouseConfig(project.id, JSON.stringify({
      ...JSON.parse(BLANK_HOUSE_JSON),
      architecturalDesignDocument: ARCHITECTURE_FIXTURES.modernTropicalPavilionHouse,
    }), "landing-fixture");
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
        {process.env.NODE_ENV !== "production" && (
          <button
            type="button"
            onClick={handleLoadFixture}
            className="text-xs font-medium text-neutral-500 underline decoration-dotted hover:text-neutral-300"
          >
            Dev: load visual test fixture (Modern Tropical Pavilion House)
          </button>
        )}
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
