"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Clock, FolderOpen } from "lucide-react";
import { useProjectStore } from "@/store/useProjectStore";
import { useHydrated } from "@/lib/useHydrated";
import { formatRelativeTime } from "@/lib/format";
import { TEMPLATES } from "@/lib/templates";

export default function Home() {
  const router = useRouter();
  const createProject = useProjectStore((s) => s.createProject);
  const updateHouseConfig = useProjectStore((s) => s.updateHouseConfig);
  const projects = useProjectStore((s) => s.projects);
  const hydrated = useHydrated();
  const [creating, setCreating] = useState<string | null>(null);

  const handleTemplate = async (templateId: string) => {
    const template = TEMPLATES.find((t) => t.id === templateId);
    if (!template || creating) return;
    setCreating(templateId);
    const project = createProject(template.name);
    updateHouseConfig(project.id, JSON.stringify(template.site, null, 2));
    router.push(`/workspace/${project.id}`);
  };

  const recentProjects = hydrated
    ? [...projects].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4)
    : [];

  return (
    <div className="relative flex min-h-screen flex-col bg-neutral-950 overflow-x-hidden">
      {/* Subtle grid background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      {/* Radial glow */}
      <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-amber-500/5 blur-3xl" />

      {/* Header */}
      <header className="relative flex items-center justify-between px-6 py-5 sm:px-10">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 shadow-lg shadow-orange-950/30">
            <span className="text-neutral-950 font-bold text-base">A</span>
          </div>
          <span className="text-base font-semibold tracking-tight text-neutral-100">AI Architect</span>
        </div>
        {hydrated && projects.length > 0 && (
          <Link
            href="#recent"
            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-neutral-300 hover:bg-white/10 transition"
          >
            <Clock size={12} />
            {projects.length} project{projects.length === 1 ? "" : "s"}
          </Link>
        )}
      </header>

      {/* Hero */}
      <main className="relative flex-1 flex flex-col items-center px-4 sm:px-8 pb-24 pt-12 sm:pt-20">
        <div className="text-center mb-12 sm:mb-16">
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-neutral-50 leading-tight">
            What would you like
            <br className="hidden sm:block" />
            <span className="sm:hidden"> </span>
            to create today?
          </h1>
          <p className="mt-4 text-base sm:text-lg text-neutral-500 max-w-md mx-auto">
            Choose a starting point — or describe anything in the AI chat.
          </p>
        </div>

        {/* Template cards grid */}
        <div className="w-full max-w-5xl grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => handleTemplate(template.id)}
              disabled={creating !== null}
              className={`group relative flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/10 p-5 sm:p-7 text-center transition-all duration-200
                bg-gradient-to-br ${template.gradient}
                hover:border-white/20 hover:scale-[1.03] hover:shadow-2xl
                active:scale-[0.97]
                disabled:opacity-50 disabled:cursor-wait
                ${creating === template.id ? "scale-[0.97] opacity-70" : ""}
              `}
            >
              <span className="text-4xl sm:text-5xl leading-none">{template.emoji}</span>
              <div>
                <p className="text-sm sm:text-base font-semibold text-neutral-100">{template.name}</p>
                <p className="mt-0.5 text-[11px] sm:text-xs text-neutral-500 leading-snug hidden sm:block">
                  {template.description}
                </p>
              </div>
              {creating === template.id && (
                <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-neutral-950/40">
                  <div className="h-5 w-5 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin" />
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Recent projects */}
        {hydrated && recentProjects.length > 0 && (
          <section id="recent" className="w-full max-w-5xl mt-16 sm:mt-20">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-neutral-500 uppercase tracking-wider">
                Recent Projects
              </h2>
              {projects.length > 4 && (
                <button className="flex items-center gap-1 text-xs text-neutral-600 hover:text-neutral-400 transition">
                  <FolderOpen size={12} />
                  View all
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {recentProjects.map((project) => (
                <Link
                  key={project.id}
                  href={`/workspace/${project.id}`}
                  className="group flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] p-4 hover:bg-white/[0.06] hover:border-white/15 transition"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400/20 to-orange-600/20 text-amber-400">
                    <span className="text-sm">🏗</span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-200 group-hover:text-white transition">
                      {project.name}
                    </p>
                    <p className="text-xs text-neutral-600">
                      {formatRelativeTime(project.updatedAt)}
                    </p>
                  </div>
                  <ChevronRight size={14} className="shrink-0 text-neutral-700 group-hover:text-neutral-400 transition" />
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="relative pb-8 text-center">
        <p className="text-xs text-neutral-700">
          AI Architect · Built with love for creators everywhere
        </p>
      </footer>
    </div>
  );
}
