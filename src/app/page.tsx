"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUp, ChevronRight, Clock, FolderOpen } from "lucide-react";
import { useProjectStore } from "@/store/useProjectStore";
import { useUIStore } from "@/store/useUIStore";
import { useHydrated } from "@/lib/useHydrated";
import { formatRelativeTime } from "@/lib/format";
import { PROMPT_SUGGESTIONS } from "@/lib/promptSuggestions";
import { AdminButton } from "@/components/admin/AdminButton";
import { HeroInspiration } from "@/components/landing/HeroInspiration";

/** "A modern two-storey house with a pool…" → "A modern two-storey house with a". */
function projectNameFromBrief(brief: string): string {
  const words = brief.trim().replace(/[.,;:!?]+$/, "").split(/\s+/).slice(0, 6);
  return words.join(" ");
}

export default function Home() {
  const router = useRouter();
  const createProject = useProjectStore((s) => s.createProject);
  const setPendingBrief = useUIStore((s) => s.setPendingBrief);
  const projects = useProjectStore((s) => s.projects);
  const hydrated = useHydrated();
  const [prompt, setPrompt] = useState("");
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /** Suggestions and inspiration only tailor the prompt; the user still presses Generate. */
  const prefill = (text: string) => {
    setPrompt(text);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(text.length, text.length);
    });
  };

  const handleGenerate = () => {
    const brief = prompt.trim();
    if (!brief || creating) return;
    setCreating(true);
    const project = createProject(projectNameFromBrief(brief));
    setPendingBrief(project.id, brief);
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
        <div className="flex items-center gap-2">
          {hydrated && projects.length > 0 && (
            <Link
              href="#recent"
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-neutral-300 hover:bg-white/10 transition"
            >
              <Clock size={12} />
              {projects.length} project{projects.length === 1 ? "" : "s"}
            </Link>
          )}
          <AdminButton />
        </div>
      </header>

      {/* Hero */}
      <main className="relative flex-1 flex flex-col items-center px-4 sm:px-8 pb-24 pt-8 sm:pt-14">
        <div className="grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14">
          <div>
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-neutral-50 leading-[1.08]">
              Describe your
              <br />
              <span className="bg-gradient-to-r from-amber-300 to-orange-500 bg-clip-text text-transparent">dream home</span>
            </h1>
            <p className="mt-4 max-w-md text-base sm:text-lg text-neutral-500">
              Tell the AI architect what you imagine. It designs the whole site in seconds — then you refine it, one edit at a time.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleGenerate();
              }}
              className="mt-7 rounded-2xl border border-white/10 bg-neutral-900/80 p-3 shadow-2xl shadow-black/30 backdrop-blur transition focus-within:border-amber-500/50"
            >
              <textarea
                ref={inputRef}
                value={prompt}
                disabled={creating}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleGenerate();
                  }
                }}
                rows={4}
                autoFocus
                aria-label="Describe your dream home"
                placeholder="Describe your dream home… e.g. a modern two-storey house with a pool, double garage and a garden, facing the sunset"
                className="w-full resize-none bg-transparent px-2 py-1.5 text-base leading-relaxed text-neutral-100 outline-none placeholder:text-neutral-600 disabled:opacity-60"
              />
              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="pl-2 text-[11px] text-neutral-600">Enter to generate · Shift+Enter for a new line</span>
                <button
                  type="submit"
                  disabled={!prompt.trim() || creating}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 px-5 py-2.5 text-sm font-semibold text-neutral-950 shadow-lg shadow-orange-950/30 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:from-neutral-800 disabled:to-neutral-800 disabled:text-neutral-600 disabled:shadow-none"
                >
                  {creating ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-950/30 border-t-neutral-950" />
                  ) : (
                    <ArrowUp size={16} />
                  )}
                  Generate
                </button>
              </div>
            </form>
          </div>

          <HeroInspiration onPick={prefill} />
        </div>

        {/* Style cards — prompt suggestions only */}
        <section className="mt-14 w-full max-w-6xl">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-neutral-500">Need a spark? Start from an idea</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {PROMPT_SUGGESTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => prefill(s.prompt)}
                disabled={creating}
                aria-pressed={prompt === s.prompt}
                className={`group flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-all duration-200 bg-gradient-to-br ${s.gradient}
                  ${prompt === s.prompt ? "border-amber-400/60 ring-1 ring-amber-400/40" : "border-white/10 hover:border-white/20"}
                  hover:-translate-y-0.5 hover:shadow-2xl active:scale-[0.98] disabled:opacity-50`}
              >
                <span className="text-3xl leading-none">{s.emoji}</span>
                <div>
                  <p className="text-sm font-semibold text-neutral-100">{s.name}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-neutral-500">{s.description}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Recent projects */}
        {hydrated && recentProjects.length > 0 && (
          <section id="recent" className="w-full max-w-6xl mt-16 sm:mt-20">
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
