"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RecoveredMansion() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const open = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/recovery/second-live", { cache: "no-store" });
      const draft = await response.json();
      if (!response.ok) throw new Error(draft.error);
      router.push(draft.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to open the saved mansion.");
      setBusy(false);
    }
  };
  return (
    <section className="mb-8 w-full max-w-6xl rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-amber-200">Your recovered four-level mansion</p>
          <p className="mt-1 text-xs text-neutral-400">Open Cascade Skyline Residence in the Villa Playground with editable controls. No AI generation is needed.</p>
        </div>
        <button onClick={() => void open()} disabled={busy} className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-medium text-neutral-950 disabled:opacity-50">
          {busy ? "Opening saved mansion…" : "Open recovered mansion"}
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}
    </section>
  );
}
