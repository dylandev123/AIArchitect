"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle, LoaderCircle, RefreshCw, Sparkles, XCircle } from "lucide-react";
import { useAdminStore } from "@/store/useAdminStore";
import { approvalBlocker, useAssetStore } from "@/store/useAssetStore";
import { useLibraryStore } from "@/store/useLibraryStore";
import { discardStaged, stageNativeAsset, type StagedNative } from "@/lib/assets/native/stage";
import type { AssetPlan, PlannedAsset } from "@/types/library";
import { GlbPreview } from "./GlbPreview";

interface Props {
  plan: Pick<AssetPlan, "id" | "needId" | "knowledgeId">;
  asset: PlannedAsset;
  /** Saves the plan first when it only exists as an unsaved draft; resolves to the saved plan id, or null on failure. */
  ensureSaved: () => Promise<string | null>;
}

const inputCls = "w-full rounded-lg border border-white/8 bg-neutral-800/60 px-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-600 outline-none focus:border-amber-500/40";
const btn = "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Native generation for one planned asset: generate an AssetSpec with the AI, build it deterministically, preview the
 * exported GLB in the standard orbit viewer, then approve into the shared library, reject, regenerate or refine.
 */
export function NativeAssetPanel({ plan, asset, ensureSaved }: Props) {
  const adminEmail = useAdminStore((s) => s.adminEmail);
  const { generateNative, act } = useLibraryStore();
  const addToQueue = useAssetStore((s) => s.addToQueue);
  const approve = useAssetStore((s) => s.approve);
  const [busy, setBusy] = useState<"" | "generate" | "refine" | "approve" | "reject">("");
  const [error, setError] = useState("");
  const [instruction, setInstruction] = useState("");
  const [staged, setStaged] = useState<StagedNative | null>(null);
  const [stageError, setStageError] = useState("");
  const keep = useRef(false);

  // Stage (build → GLB → validate → store) whenever the spec changes. Replaced or abandoned stagings are deleted.
  const specKey = asset.spec ? JSON.stringify(asset.spec) : "";
  useEffect(() => {
    if (!asset.spec) return;
    keep.current = false;
    let cancelled = false;
    let id: string | null = null;
    void stageNativeAsset(asset.spec, asset, plan).then((r) => {
      if (cancelled) {
        if (r.ok) discardStaged(r.staged.asset.id);
        return;
      }
      if (!r.ok) return setStageError(r.error), setStaged(null);
      id = r.staged.asset.id;
      setStageError("");
      setStaged(r.staged);
    });
    return () => {
      cancelled = true;
      if (id && !keep.current) discardStaged(id);
    };
    // The spec content, not its identity, decides when to rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specKey]);

  const generate = async (text?: string) => {
    setError("");
    setBusy(text ? "refine" : "generate");
    const planId = await ensureSaved();
    if (!planId) {
      setBusy("");
      return setError("Could not save the plan first.");
    }
    const result = await generateNative(adminEmail, planId, asset.id, text);
    setBusy("");
    if ("error" in result) return setError(result.error);
    if (result.kind === "external") return setError(`Not buildable natively — external generation recommended: ${result.reason}`);
    setInstruction("");
  };

  const approveStaged = async () => {
    if (!staged) return;
    setBusy("approve");
    setError("");
    // Same gate as any generated GLB: it must pass validation before it can join the global library.
    const blocker = approvalBlocker(staged.asset);
    if (blocker) {
      setBusy("");
      return setError(blocker);
    }
    keep.current = true;
    addToQueue(staged.asset);
    approve(staged.asset.id);
    const inLibrary = useAssetStore.getState().catalog.some((a) => a.id === staged.asset.id);
    if (!inLibrary) {
      // Left in the Queue tab (e.g. a duplicate); its bytes must stay with it.
      setBusy("");
      return setError("Added to the Queue, but not approved automatically. Review it in the Queue tab.");
    }
    const err = await act(adminEmail, { action: "completePlannedAsset", planId: plan.id, plannedAssetId: asset.id, assetId: staged.asset.id });
    setBusy("");
    if (err) setError(err);
  };

  const reject = async () => {
    setBusy("reject");
    const err = await act(adminEmail, { action: "discardNativeSpec", planId: plan.id, plannedAssetId: asset.id });
    setBusy("");
    if (err) setError(err);
  };

  if (asset.generated) {
    return (
      <p className="flex items-center gap-1.5 text-[11px] text-emerald-400">
        <CheckCircle size={12} /> In the library.
      </p>
    );
  }

  const generating = busy === "generate" || busy === "refine";
  if (!asset.spec) {
    return (
      <div className="flex flex-col gap-1.5">
        <button onClick={() => void generate()} disabled={generating} className={`${btn} w-fit border-violet-500/25 bg-violet-500/15 text-violet-300 hover:bg-violet-500/25`}>
          {generating ? <LoaderCircle size={12} className="animate-spin" /> : <Sparkles size={12} />} {generating ? "Generating native asset…" : "Generate Native"}
        </button>
        {error && <p className="text-[11px] text-red-400">{error}</p>}
      </div>
    );
  }

  const v = staged?.validation;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-violet-500/20 bg-violet-500/[0.04] p-2.5">
      <p className="flex items-center gap-1.5 text-[11px] font-medium text-violet-300">
        <Sparkles size={12} /> Native draft — {asset.spec.family} · {asset.spec.parts.length} part specs · {asset.spec.materials.map((m) => m.key).join(", ")}
      </p>
      {stageError && <p className="text-[11px] text-red-400">Could not build a preview: {stageError}</p>}
      {!staged && !stageError && <div className="rounded-lg bg-white/[0.03] px-3 py-6 text-center text-[11px] text-neutral-500">Building preview…</div>}
      {staged && (
        <>
          <GlbPreview asset={staged.asset} />
          <p className="text-[11px] text-neutral-500">
            {v?.dimensions ? `${v.dimensions.width}×${v.dimensions.depth}×${v.dimensions.height} m` : ""} · {staged.triangles.toLocaleString()} triangles · validation{" "}
            <span className={v?.passed ? "text-emerald-400" : "text-red-400"}>{v?.passed ? "passed" : "failed"}</span>
            {staged.notes.map((n) => <span key={n} className="block text-neutral-600">{n}</span>)}
          </p>
          {v && !v.passed && <p className="flex items-center gap-1 text-[11px] text-red-400"><AlertTriangle size={11} /> {v.errors[0]}</p>}
          {v && v.warnings.length > 0 && <p className="text-[11px] text-amber-400/80">{v.warnings[0]}</p>}
        </>
      )}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => void approveStaged()} disabled={!staged || !!busy} className={`${btn} border-emerald-500/20 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25`}>
          {busy === "approve" ? <LoaderCircle size={12} className="animate-spin" /> : <CheckCircle size={12} />} Approve
        </button>
        <button onClick={() => void reject()} disabled={!!busy} className={`${btn} border-red-500/15 bg-red-500/10 text-red-400 hover:bg-red-500/20`}>
          <XCircle size={12} /> Reject
        </button>
        <button onClick={() => void generate()} disabled={!!busy} className={`${btn} border-white/8 text-neutral-400 hover:text-neutral-200`}>
          {busy === "generate" ? <LoaderCircle size={12} className="animate-spin" /> : <RefreshCw size={12} />} Regenerate
        </button>
      </div>
      <div className="flex gap-2">
        <input className={inputCls} value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Refine — e.g. make the legs thicker and use darker teak" onKeyDown={(e) => { if (e.key === "Enter" && instruction.trim().length >= 3 && !busy) void generate(instruction.trim()); }} />
        <button onClick={() => void generate(instruction.trim())} disabled={!!busy || instruction.trim().length < 3} className={`${btn} shrink-0 border-violet-500/25 bg-violet-500/15 text-violet-300 hover:bg-violet-500/25`}>
          {busy === "refine" ? <LoaderCircle size={12} className="animate-spin" /> : <Sparkles size={12} />} Refine
        </button>
      </div>
      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </div>
  );
}
