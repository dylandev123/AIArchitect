"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Send,
  Sparkles,
} from "lucide-react";
import { useUIStore } from "@/store/useUIStore";
import { useProjectStore } from "@/store/useProjectStore";
import { requestHouseEdit, STALE_PROJECT_MESSAGE } from "@/lib/ai/client";
import { needsInitialGeneration } from "@/lib/house/blank";

// ── Step generator ──────────────────────────────────────────────────────────
// Reads the prompt for keywords and returns steps that feel relevant.
// This is presentation-only — the generation logic never changes.
function getArchitectSteps(prompt: string): string[] {
  const p = prompt.toLowerCase();

  const steps = ["Sketching the layout"];

  if (
    p.includes("material") || p.includes("stucco") || p.includes("stone") ||
    p.includes("wood") || p.includes("brick") || p.includes("exterior") ||
    p.includes("white") || p.includes("colour") || p.includes("color") ||
    p.includes("metal") || p.includes("tile")
  ) {
    steps.push("Selecting the perfect materials");
  } else {
    steps.push("Designing the exterior");
  }

  if (p.includes("window")) {
    steps.push("Placing the windows");
  } else if (p.includes("door") || p.includes("entrance")) {
    steps.push("Setting the entrance");
  } else {
    steps.push("Positioning windows & doors");
  }

  if (
    p.includes("pool") || p.includes("deck") || p.includes("terrace") ||
    p.includes("patio") || p.includes("garden") || p.includes("balcony") ||
    p.includes("lawn") || p.includes("landscap")
  ) {
    steps.push("Designing the outdoor spaces");
  } else if (
    p.includes("villa") || p.includes("hotel") || p.includes("resort") ||
    p.includes("building") || p.includes("road") || p.includes("parking")
  ) {
    steps.push("Laying out the site");
  } else if (
    p.includes("room") || p.includes("bedroom") || p.includes("kitchen") ||
    p.includes("bath") || p.includes("living") || p.includes("interior")
  ) {
    steps.push("Planning the interior");
  } else {
    steps.push("Creating outdoor spaces");
  }

  steps.push("Adding the finishing details");
  return steps;
}

// ── Error humanizer ─────────────────────────────────────────────────────────
// Turns technical error strings into friendly messages.
// No logic change — purely cosmetic.
function humanizeError(raw: string): string {
  if (raw === STALE_PROJECT_MESSAGE) {
    return "The design changed while I was working, so I held back my edit. Ask again and I'll use the latest version.";
  }
  if (raw.includes("couldn't produce a valid design")) {
    return "I couldn't turn that into a valid design. Try describing the house a little differently.";
  }
  if (raw.includes("didn't produce any valid edit")) {
    return "I couldn't find a precise change to make for that. Could you say what should change?";
  }
  if (raw.includes("configured") || raw.includes("OPENAI_API_KEY") || raw.includes("503")) {
    return "Your architect isn't connected yet. Set up the AI service to get started.";
  }
  if (raw.includes("schema") || raw.includes("rephrase")) {
    return "I got a little confused by that one. Try describing it a different way?";
  }
  if (raw.toLowerCase().includes("network")) {
    return "Lost my connection for a moment — shall we try again?";
  }
  return "I hit a small snag. Mind giving that another go?";
}

// ── Completion phrases ───────────────────────────────────────────────────────
const COMPLETION_HEADER = "Your architect has finished the latest revision.";

// ── Quick-start prompts ──────────────────────────────────────────────────────
const BRIEF_PROMPTS = [
  "A modern two-storey family home with a pool and double garage",
  "A cozy single-storey beach cottage with a wooden deck",
  "A Mediterranean villa with a courtyard garden and driveway",
];

const QUICK_PROMPTS = [
  "Design a rooftop terrace",
  "Make it two storeys",
  "Add a pool with wooden decking",
  "Give it white stucco walls",
];

// ── Types ────────────────────────────────────────────────────────────────────
interface ChatMessage {
  role: "user" | "assistant" | "error";
  content: string;
}

interface ArchitectWork {
  steps: string[];
  visibleCount: number;
}

// ── Component ────────────────────────────────────────────────────────────────
export function ChatPanel() {
  const isOpen = useUIStore((s) => s.isChatOpen);
  const toggle = useUIStore((s) => s.toggleChat);

  const params = useParams<{ projectId: string }>();
  const project = useProjectStore((s) => s.getProject(params.projectId));
  const appendVersion = useProjectStore((s) => s.appendVersion);
  const needsGeneration = !!project && needsInitialGeneration(project);
  const setAiWorking = useUIStore((s) => s.setAiWorking);
  const setGenerationError = useUIStore((s) => s.setGenerationError);
  const takePendingBrief = useUIStore((s) => s.takePendingBrief);

  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [work, setWork] = useState<ArchitectWork | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Always scroll to the bottom as content changes
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, work?.visibleCount]);

  // Cancel any running step timers
  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  // Start the animated step sequence for a given prompt
  const beginWork = (prompt: string) => {
    clearTimers();
    const steps = getArchitectSteps(prompt);
    setWork({ steps, visibleCount: 0 });

    steps.forEach((_, i) => {
      const t = setTimeout(() => {
        setWork((prev) => prev ? { ...prev, visibleCount: i + 1 } : prev);
      }, 900 + i * 1150);
      timersRef.current.push(t);
    });
  };

  const endWork = () => {
    clearTimers();
    setWork(null);
  };

  // ── Send a message ──────────────────────────────────────────────────────
  const send = async (text: string) => {
    const prompt = text.trim();
    if (!prompt || isLoading || !project) return;
    const wasBlank = needsInitialGeneration(project);

    setMessages((prev) => [...prev, { role: "user", content: prompt }]);
    setDraft("");
    setIsLoading(true);
    setAiWorking(true);
    setGenerationError(null);
    beginWork(prompt);

    try {
      const result = await requestHouseEdit({
        projectId: project.id,
        prompt,
        history: messages
          .filter((m): m is ChatMessage & { role: "user" | "assistant" } => m.role !== "error")
          .map((m) => ({ role: m.role, content: m.content })),
        apply: (summary, json) => appendVersion(project.id, summary, json),
      });

      const failure = result.ok ? undefined : humanizeError(result.error);
      setMessages((prev) => [
        ...prev,
        result.ok ? { role: "assistant", content: result.summary } : { role: "error", content: failure! },
      ]);
      if (failure && wasBlank) {
        setGenerationError(failure);
        setDraft(prompt);
      }
    } catch {
      const failure = humanizeError("network error");
      setMessages((prev) => [...prev, { role: "error", content: failure }]);
      if (wasBlank) {
        setGenerationError(failure);
        setDraft(prompt);
      }
    } finally {
      setIsLoading(false);
      setAiWorking(false);
      endWork();
    }
  };

  // A brief typed on the home page starts the initial generation as soon as the workspace opens.
  useEffect(() => {
    if (!project) return;
    const brief = takePendingBrief(project.id);
    if (brief) queueMicrotask(() => void send(brief));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="flex shrink-0 flex-col border-t border-white/[0.07] bg-neutral-950/90 backdrop-blur">

      {/* Header toggle */}
      <button
        onClick={toggle}
        className="flex w-full items-center justify-between px-4 py-2.5 transition hover:bg-white/[0.03]"
      >
        <span className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-amber-400 to-orange-500 shadow-sm shadow-orange-900/20">
            <Sparkles size={11} className="text-neutral-950" />
          </div>
          <span className="text-xs font-semibold text-neutral-300">Your AI Architect</span>

          {isLoading && (
            <span className="flex items-center gap-1.5 rounded-full bg-amber-500/12 px-2 py-0.5 text-[10px] font-medium text-amber-400">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
              </span>
              At work…
            </span>
          )}
        </span>
        {isOpen
          ? <ChevronDown size={13} className="text-neutral-600" />
          : <ChevronUp size={13} className="text-neutral-600" />}
      </button>

      {isOpen && (
        <div className="flex flex-col">
          <div ref={scrollRef} className="max-h-56 overflow-y-auto">

            {/* Empty state — welcome + quick prompts */}
            {messages.length === 0 && !isLoading && (
              <div className="space-y-3 px-4 pb-3 pt-1">
                <p className="text-xs leading-relaxed text-neutral-500">
                  {needsGeneration
                    ? "Describe the house you'd like — style, size, floors, garage, pool, garden — and I'll design it from scratch."
                    : "Tell me what you'd like to build or change, and I'll bring it to life."}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(needsGeneration ? BRIEF_PROMPTS : QUICK_PROMPTS).map((p) => (
                    <button
                      key={p}
                      onClick={() => send(p)}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-neutral-400 transition hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-300"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Message history */}
            {messages.length > 0 && (
              <div className="space-y-3 px-4 py-3">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>

                    {m.role === "error" && (
                      <div className="flex max-w-[85%] items-start gap-2 rounded-xl bg-red-500/10 px-3 py-2.5">
                        <AlertTriangle size={12} className="mt-0.5 shrink-0 text-red-400" />
                        <span className="text-xs leading-relaxed text-red-400">{m.content}</span>
                      </div>
                    )}

                    {m.role === "user" && (
                      <span className="max-w-[80%] rounded-xl bg-amber-500/20 px-3 py-2 text-xs leading-relaxed text-amber-100">
                        {m.content}
                      </span>
                    )}

                    {m.role === "assistant" && (
                      <div className="max-w-[88%] space-y-1.5">
                        <p className="pl-1 text-[11px] font-semibold text-amber-400/90">
                          {COMPLETION_HEADER}
                        </p>
                        <div className="rounded-xl bg-white/[0.05] px-3.5 py-2.5 text-xs leading-relaxed text-neutral-300">
                          {m.content}
                        </div>
                      </div>
                    )}

                  </div>
                ))}
              </div>
            )}

            {/* Architect working — animated step tracker */}
            {isLoading && work && (
              <div className="px-4 pb-3">
                <div className="rounded-xl border border-amber-500/15 bg-gradient-to-br from-amber-500/[0.07] to-transparent p-4 space-y-2.5">

                  {/* "Planning" header with pulsing dot */}
                  <div className="flex items-center gap-2.5">
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                    </span>
                    <span className="text-xs font-semibold text-amber-300">
                      Planning your dream…
                    </span>
                  </div>

                  {/* Steps appear one by one */}
                  <div className="space-y-1.5 pl-4">
                    {work.steps.slice(0, work.visibleCount).map((step, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <CheckCircle2 size={12} className="shrink-0 text-amber-500" />
                        <span className="text-[11px] text-neutral-400">{step}</span>
                      </div>
                    ))}

                    {/* Bouncing dots while waiting for the next step */}
                    {work.visibleCount < work.steps.length && (
                      <div className="flex items-center gap-1 pt-0.5">
                        {[0, 150, 300].map((delay) => (
                          <span
                            key={delay}
                            className="h-1 w-1 animate-bounce rounded-full bg-amber-500/50"
                            style={{ animationDelay: `${delay}ms` }}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              </div>
            )}

          </div>

          {/* Input row */}
          <div className="flex items-center gap-2 px-4 pb-3">
            <input
              value={draft}
              disabled={isLoading}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(draft); }}
              placeholder={
                isLoading
                  ? "Your architect is designing…"
                  : needsGeneration
                    ? "Describe your project…"
                    : "Tell your architect what to create…"
              }
              className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-neutral-100 outline-none placeholder:text-neutral-600 transition focus:border-amber-500/40 focus:bg-white/[0.06] disabled:opacity-50"
            />
            <button
              onClick={() => send(draft)}
              disabled={isLoading || !draft.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-neutral-950 transition hover:bg-amber-400 active:scale-95 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-600"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
