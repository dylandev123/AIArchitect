"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";

interface Scene {
  id: string;
  title: string;
  caption: string;
  prompt: string;
  sky: [string, string];
  ground: string;
  art: ReactNode;
}

const WINDOW = "#bfe6f5";

/** Flat, game-style architectural vignettes — illustrations only; they never become projects. */
const SCENES: Scene[] = [
  {
    id: "modern",
    title: "Glass & concrete",
    caption: "A modern two-storey house with a lap pool",
    prompt:
      "A modern minimalist two-storey house with a flat roof, concrete and white render walls, floor-to-ceiling glass, a cantilevered balcony, a lap pool and a garage, on a quiet suburban lot.",
    sky: ["#7cc4ee", "#e6f4fb"],
    ground: "#5fb84a",
    art: (
      <>
        <rect x="90" y="120" width="150" height="62" fill="#e9e6df" />
        <rect x="120" y="82" width="130" height="42" fill="#cfcac0" />
        <rect x="84" y="114" width="164" height="8" fill="#3b3f46" />
        <rect x="114" y="76" width="142" height="8" fill="#3b3f46" />
        <rect x="132" y="92" width="90" height="26" fill={WINDOW} opacity=".85" />
        <rect x="104" y="132" width="60" height="38" fill={WINDOW} opacity=".85" />
        <rect x="178" y="140" width="24" height="42" fill="#3b3f46" />
        <rect x="262" y="176" width="90" height="26" fill="#2fc6e6" />
        <rect x="258" y="172" width="98" height="5" fill="#dcd8cf" />
        <circle cx="46" cy="150" r="20" fill="#3aa844" />
        <rect x="44" y="164" width="4" height="20" fill="#5a3a1c" />
      </>
    ),
  },
  {
    id: "villa",
    title: "Mediterranean warmth",
    caption: "Terracotta roofs around a courtyard garden",
    prompt:
      "A Mediterranean villa with warm stucco walls, a terracotta hip roof, a courtyard garden, a pool with a stone terrace, a garage and a gravel driveway, set in the countryside.",
    sky: ["#f6b56a", "#fde9c8"],
    ground: "#7fb852",
    art: (
      <>
        <rect x="80" y="116" width="200" height="68" fill="#f1dcbc" />
        <polygon points="68,118 110,84 250,84 292,118" fill="#c8623a" />
        <rect x="104" y="132" width="20" height="30" rx="10" fill="#7a4a2a" />
        <rect x="150" y="130" width="22" height="24" rx="11" fill={WINDOW} />
        <rect x="196" y="130" width="22" height="24" rx="11" fill={WINDOW} />
        <rect x="242" y="130" width="22" height="24" rx="11" fill={WINDOW} />
        <rect x="300" y="170" width="70" height="22" fill="#30c0e0" />
        <ellipse cx="44" cy="150" rx="18" ry="24" fill="#3f8f3a" />
        <rect x="42" y="168" width="4" height="18" fill="#5a3a1c" />
      </>
    ),
  },
  {
    id: "beach",
    title: "Coastal escape",
    caption: "A butterfly-roof cottage steps from the sea",
    prompt:
      "A single-storey beach villa with white stucco walls and a butterfly roof, a wide timber deck and a swimming pool facing the ocean at sunset, with palm-style trees and a short driveway.",
    sky: ["#ff9a76", "#ffe3b3"],
    ground: "#e6cf98",
    art: (
      <>
        <rect x="0" y="150" width="400" height="20" fill="#3ab7d8" />
        <rect x="100" y="132" width="150" height="50" fill="#f7f2e8" />
        <polygon points="92,132 175,112 175,124 250,104 258,132" fill="#5a7a6a" />
        <rect x="118" y="146" width="40" height="26" fill={WINDOW} opacity=".9" />
        <rect x="190" y="146" width="40" height="26" fill={WINDOW} opacity=".9" />
        <rect x="250" y="176" width="110" height="10" fill="#b88848" />
        <rect x="60" y="120" width="4" height="60" fill="#6b4a2a" />
        <path d="M62 120 q-24 -6 -30 10 M62 120 q24 -6 30 10 M62 120 q-4 -22 -22 -20 M62 120 q4 -22 22 -20" stroke="#38a83c" strokeWidth="6" fill="none" strokeLinecap="round" />
      </>
    ),
  },
  {
    id: "cabin",
    title: "Forest retreat",
    caption: "A cedar cabin on the hillside at sunrise",
    prompt:
      "A cozy hillside cabin in a pine forest with a steep shed roof, cedar walls, a large deck overlooking the valley at sunrise, and a gravel driveway winding up the slope.",
    sky: ["#a9b6f0", "#ffe0c2"],
    ground: "#4f9a48",
    art: (
      <>
        <polygon points="0,170 120,110 260,150 400,120 400,260 0,260" fill="#3f8a42" opacity=".55" />
        <rect x="150" y="128" width="110" height="52" fill="#a86a3e" />
        <polygon points="142,130 262,100 262,116 142,140" fill="#4a3f38" />
        <rect x="172" y="146" width="30" height="34" fill="#4a2f1a" />
        <rect x="216" y="146" width="28" height="22" fill={WINDOW} opacity=".9" />
        <rect x="262" y="172" width="70" height="7" fill="#c89a5c" />
        <polygon points="70,178 88,110 106,178" fill="#2e7d3a" />
        <polygon points="96,178 112,124 128,178" fill="#256a32" />
        <polygon points="330,178 346,118 362,178" fill="#2e7d3a" />
      </>
    ),
  },
];

export function HeroInspiration({ onPick }: { onPick: (prompt: string) => void }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % SCENES.length), 5500);
    return () => clearInterval(t);
  }, [paused]);

  const active = SCENES[index];

  return (
    <div
      className="relative w-full overflow-hidden rounded-3xl border border-white/10 bg-neutral-900 shadow-2xl shadow-black/40"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative aspect-[10/7] w-full">
        {SCENES.map((scene, i) => (
          <svg
            key={scene.id}
            viewBox="0 0 400 260"
            preserveAspectRatio="xMidYMid slice"
            role="img"
            aria-label={scene.caption}
            aria-hidden={i !== index}
            className={`absolute inset-0 h-full w-full transition-opacity duration-1000 ${i === index ? "opacity-100" : "opacity-0"}`}
          >
            <defs>
              <linearGradient id={`sky-${scene.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={scene.sky[0]} />
                <stop offset="1" stopColor={scene.sky[1]} />
              </linearGradient>
            </defs>
            <rect width="400" height="260" fill={`url(#sky-${scene.id})`} />
            <circle cx="320" cy="60" r="22" fill="#fff6d6" opacity=".9" />
            <ellipse cx="90" cy="52" rx="34" ry="9" fill="#fff" opacity=".7" />
            <ellipse cx="128" cy="60" rx="24" ry="7" fill="#fff" opacity=".6" />
            <rect y="176" width="400" height="84" fill={scene.ground} />
            <ellipse cx="180" cy="184" rx="120" ry="7" fill="#000" opacity=".16" />
            {scene.art}
          </svg>
        ))}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-neutral-950/85 to-transparent" />
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-amber-400/90">Inspiration</p>
          <p className="mt-0.5 truncate text-base font-semibold text-neutral-50">{active.title}</p>
          <p className="truncate text-xs text-neutral-300">{active.caption}</p>
        </div>
        <button
          type="button"
          onClick={() => onPick(active.prompt)}
          className="flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-white backdrop-blur transition hover:bg-white/25"
        >
          Use this idea <ArrowUpRight size={12} />
        </button>
      </div>

      <div className="absolute right-4 top-4 flex gap-1.5">
        {SCENES.map((scene, i) => (
          <button
            key={scene.id}
            type="button"
            aria-label={`Show ${scene.title}`}
            onClick={() => setIndex(i)}
            className={`h-1.5 rounded-full transition-all ${i === index ? "w-6 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"}`}
          />
        ))}
      </div>
    </div>
  );
}
