"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ChevronDown, Pencil, Redo2, Undo2 } from "lucide-react";
import { useProjectStore } from "@/store/useProjectStore";
import {
  PROJECT_TYPE_EMOJI,
  PROJECT_TYPE_LABELS,
  type Project,
  type ProjectType,
} from "@/types/project";
import {
  getProjectTypeSwitchWarning,
} from "@/lib/elementRegistry";

const PROJECT_TYPES: ProjectType[] = ["house", "villa", "resort", "restaurant", "commercial"];

function ProjectTypePill({ project }: { project: Project }) {
  const setProjectType = useProjectStore((s) => s.setProjectType);
  const [open, setOpen] = useState(false);

  const handleChange = (newType: ProjectType) => {
    setOpen(false);
    if (newType === project.projectType) return;
    const warning = getProjectTypeSwitchWarning(project.houseConfigJson, newType);
    if (warning) {
      const ok = window.confirm(`${warning}\n\nContinue?`);
      if (!ok) return;
    }
    setProjectType(project.id, newType);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-1 text-[11px] font-medium text-neutral-400 transition hover:border-white/15 hover:text-neutral-200"
      >
        <span>{PROJECT_TYPE_EMOJI[project.projectType]}</span>
        <span className="hidden sm:inline">{PROJECT_TYPE_LABELS[project.projectType]}</span>
        <ChevronDown size={10} className="opacity-50" />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          {/* Dropdown */}
          <div className="absolute left-0 top-full z-50 mt-1 min-w-[150px] overflow-hidden rounded-xl border border-white/10 bg-neutral-900 shadow-2xl">
            {PROJECT_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => handleChange(type)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition hover:bg-white/5 ${
                  type === project.projectType
                    ? "text-amber-300"
                    : "text-neutral-300"
                }`}
              >
                <span className="text-base leading-none">{PROJECT_TYPE_EMOJI[type]}</span>
                <span>{PROJECT_TYPE_LABELS[type]}</span>
                {type === project.projectType && (
                  <span className="ml-auto text-[10px] text-amber-500">✓</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function TopBar({ project }: { project: Project }) {
  const renameProject = useProjectStore((s) => s.renameProject);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(project.name);

  const canUndo = project.currentVersionIndex > 0;
  const canRedo = project.currentVersionIndex < project.versions.length - 1;

  const commitRename = () => {
    renameProject(project.id, draft);
    setEditing(false);
  };

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-white/[0.07] bg-neutral-950/95 px-3 backdrop-blur md:px-4">
      {/* Left: back + logo */}
      <div className="flex items-center gap-2">
        <Link
          href="/"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-white/8 hover:text-neutral-300 transition"
          title="Back to home"
        >
          <ArrowLeft size={16} />
        </Link>

        <div className="hidden sm:flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-amber-400 to-orange-600 shadow-sm">
          <span className="text-[10px] font-bold text-neutral-950">A</span>
        </div>
      </div>

      {/* Center: project name + type pill */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") { setDraft(project.name); setEditing(false); }
            }}
            className="w-40 rounded-lg border border-amber-500/40 bg-neutral-900 px-2.5 py-1 text-sm font-medium text-neutral-100 outline-none text-center"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="group flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-semibold text-neutral-200 hover:text-white hover:bg-white/5 transition"
          >
            <span className="max-w-[130px] truncate">{project.name}</span>
            <Pencil size={11} className="shrink-0 text-neutral-600 group-hover:text-neutral-400 transition" />
          </button>
        )}

        <ProjectTypePill project={project} />
      </div>

      {/* Right: undo/redo */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => undo(project.id)}
          disabled={!canUndo}
          title="Undo"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-white/8 hover:text-neutral-200 disabled:text-neutral-700 disabled:hover:bg-transparent transition"
        >
          <Undo2 size={15} />
        </button>
        <button
          onClick={() => redo(project.id)}
          disabled={!canRedo}
          title="Redo"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-white/8 hover:text-neutral-200 disabled:text-neutral-700 disabled:hover:bg-transparent transition"
        >
          <Redo2 size={15} />
        </button>
      </div>
    </header>
  );
}
