"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";

interface Scene {
  id: string;
  title: string;
  caption: string;
  prompt: string;
  /** Rendered preview of the app's own viewport (public/inspiration) — illustration only; it never becomes a project. */
  image: string;
}

const SCENES: Scene[] = [
  {
    id: "modern",
    title: "Glass & concrete",
    caption: "A modern two-storey house with a lap pool",
    prompt:
      "A modern minimalist two-storey house with a flat roof, concrete and white render walls, floor-to-ceiling glass, a cantilevered balcony, a lap pool and a garage, on a quiet suburban lot.",
    image: "/inspiration/modern.jpg",
  },
  {
    id: "villa",
    title: "Mediterranean warmth",
    caption: "Terracotta roofs around a courtyard garden",
    prompt:
      "A Mediterranean villa with warm stucco walls, a terracotta hip roof, a courtyard garden, a pool with a stone terrace, a garage and a gravel driveway, set in the countryside.",
    image: "/inspiration/villa.jpg",
  },
  {
    id: "beach",
    title: "Coastal escape",
    caption: "A butterfly-roof cottage steps from the sea",
    prompt:
      "A single-storey beach villa with white stucco walls and a butterfly roof, a wide timber deck and a swimming pool facing the ocean at sunset, with palm-style trees and a short driveway.",
    image: "/inspiration/beach.jpg",
  },
  {
    id: "cabin",
    title: "Forest retreat",
    caption: "A cedar cabin on the hillside at sunrise",
    prompt:
      "A cozy hillside cabin in a pine forest with a steep shed roof, cedar walls, a large deck overlooking the valley at sunrise, and a gravel driveway winding up the slope.",
    image: "/inspiration/cabin.jpg",
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
          <Image
            key={scene.id}
            src={scene.image}
            alt={i === index ? scene.caption : ""}
            aria-hidden={i !== index}
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            priority={i === 0}
            className={`object-cover transition-opacity duration-1000 ${i === index ? "opacity-100" : "opacity-0"}`}
          />
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
