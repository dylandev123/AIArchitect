"use client";

import { useState, type ReactNode } from "react";
import { AlertTriangle, ArrowUpCircle, CheckCircle, LoaderCircle, RefreshCw, Sparkles, Trash2, X } from "lucide-react";
import { useAdminStore } from "@/store/useAdminStore";
import { useAssetStore, validationBlocker } from "@/store/useAssetStore";
import { useLibraryStore } from "@/store/useLibraryStore";
import { discardStaged, stageNativeAsset, upgradeStagingInputs } from "@/lib/assets/native/stage";
import { describeAsset, findPendingUpgrade, nextVersion, upgradeBlocker, type AssetFacts } from "@/lib/assets/versions";
import type { CuratedAsset, UpgradeRollout } from "@/types/assets";
import { GlbPreview } from "./GlbPreview";

const inputCls = "w-full rounded-lg border border-white/8 bg-neutral-800/60 px-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-600 outline-none focus:border-amber-500/40";
const btn = "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50";

const ROWS: [string, keyof AssetFacts][] = [
  ["Version", "version"], ["Family", "family"], ["Size", "dimensions"], ["Triangles", "triangles"], ["Detail", "detail"], ["Parts", "parts"],
  ["Materials", "materials"], ["Scene light", "light"], ["Validation", "validation"], ["Generator", "generator"], ["Created", "created"],
];

function Facts({ facts, against }: { facts: AssetFacts; against?: AssetFacts }) {
  return (
    <dl className="grid grid-cols-[5.5rem_1fr] gap-x-2 gap-y-1 text-[11px]">
      {ROWS.map(([label, key]) => {
        // On the candidate's side, a value that differs from the current version is marked, so what changed is visible at a glance.
        const changed = against !== undefined && key !== "created" && key !== "version" && facts[key] !== against[key];
        return (
          <div key={key} className="contents">
            <dt className="text-neutral-600">{label}</dt>
            <dd className={`break-words ${changed ? "text-amber-300" : "text-neutral-300"} ${key === "validation" && facts.validation === "failed" ? "text-red-400" : ""}`}>{facts[key]}</dd>
          </div>
        );
      })}
    </dl>
  );
}

function Column({ title, tone, asset, facts, against }: { title: string; tone: "current" | "candidate"; asset: CuratedAsset; facts: AssetFacts; against?: AssetFacts }) {
  return (
    <div className={`flex min-w-0 flex-col gap-2 rounded-xl border p-3 ${tone === "candidate" ? "border-violet-500/25 bg-violet-500/[0.04]" : "border-white/8 bg-white/[0.02]"}`}>
      <p className={`text-[11px] font-semibold uppercase tracking-wide ${tone === "candidate" ? "text-violet-300" : "text-neutral-400"}`}>{title}</p>
      <GlbPreview asset={asset} />
      <Facts facts={facts} against={against} />
    </div>
  );
}

/**
 * Upgrade review for one approved native asset. An upgrade is generated as a pending candidate under the same stableAssetId
 * and shown side by side with the current version; the approved version is not touched until the admin chooses how to roll it
 * out. Only then does the candidate get its version number and the old version become "superseded" (kept, never deleted).
 */
export function AssetUpgradeDialog({ baseId, onClose }: { baseId: string; onClose: () => void }) {
  const adminEmail = useAdminStore((s) => s.adminEmail);
  const base = useAssetStore((s) => s.catalog.find((a) => a.id === baseId));
  const catalog = useAssetStore((s) => s.catalog);
  const candidate = useAssetStore((s) => (base?.stableAssetId ? findPendingUpgrade(s.queue, base.stableAssetId) : undefined));
  const addToQueue = useAssetStore((s) => s.addToQueue);
  const reject = useAssetStore((s) => s.reject);
  const approveUpgrade = useAssetStore((s) => s.approveUpgrade);
  const upgradeNative = useLibraryStore((s) => s.upgradeNative);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<"" | "generate" | "approve">("");
  const [error, setError] = useState("");
  const [retried, setRetried] = useState("");

  const shell = (children: ReactNode) => (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="flex max-h-full w-full max-w-5xl flex-col rounded-xl border border-white/10 bg-neutral-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-100">
            <ArrowUpCircle size={15} className="text-violet-300" /> Upgrade {base?.name ?? "asset"}
          </h2>
          <button onClick={onClose} className="rounded-md p-1 text-neutral-500 hover:bg-white/5 hover:text-neutral-200" aria-label="Close"><X size={16} /></button>
        </div>
        <div className="overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );

  if (!base) return shell(<p className="text-xs text-neutral-400">The approved version this upgrade was made from is no longer in the library. Discard the pending candidate from the Queue tab.</p>);

  const version = base.version ?? 1;
  const next = nextVersion(catalog, base.stableAssetId ?? "");
  const currentFacts = describeAsset(base);
  const candidateFacts = candidate ? describeAsset(candidate, next) : undefined;
  const blocker = candidate ? validationBlocker(candidate) ?? upgradeBlocker(candidate, catalog) : null;

  const generate = async () => {
    const inputs = upgradeStagingInputs(base);
    if (!inputs) return setError("This asset has no native lineage to upgrade.");
    setError("");
    setRetried("");
    setBusy("generate");
    const result = await upgradeNative(adminEmail, base, notes.trim() || undefined);
    if ("error" in result) return setBusy(""), setError(result.error);
    if (result.kind === "external") return setBusy(""), setError(`Not buildable natively — external generation recommended: ${result.reason}`);
    const staged = await stageNativeAsset(result.spec, inputs.planned, inputs.plan, undefined, { upgradeOf: base });
    if (!staged.ok) return setBusy(""), setError(`Could not build the candidate: ${staged.error}`);
    const made = staged.staged.asset;
    // Same geometry as the approved version (or as the candidate already waiting) is not an upgrade: keep nothing.
    if (made.sourceSlug === base.sourceSlug || (candidate && made.sourceSlug === candidate.sourceSlug)) {
      discardStaged(made.id);
      return setBusy(""), setError("The upgrade came out identical. Try again with notes on what to improve.");
    }
    // One review at a time: a newer candidate replaces the one that was waiting (its file goes with it).
    if (candidate) reject(candidate.id);
    addToQueue(made);
    setBusy("");
    if (result.stats.retry) setRetried(result.stats.retry.firstError);
    setNotes("");
  };

  const approve = (rollout: UpgradeRollout) => {
    if (!candidate) return;
    setBusy("approve");
    const refused = approveUpgrade(candidate.id, rollout);
    setBusy("");
    if (refused) return setError(refused);
    onClose();
  };

  const discard = () => {
    if (candidate) reject(candidate.id);
    onClose();
  };

  return shell(
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Column title={`Current · v${version}`} tone="current" asset={base} facts={currentFacts} />
        {candidate && candidateFacts ? (
          <Column title={`Candidate · v${next} on approval`} tone="candidate" asset={candidate} facts={candidateFacts} against={currentFacts} />
        ) : (
          <div className="flex flex-col justify-center gap-2 rounded-xl border border-dashed border-white/10 p-4">
            <p className="text-xs text-neutral-300">Generate an upgrade candidate. The approved version stays exactly as it is until you review and approve the candidate.</p>
            <input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What should improve? (optional) — e.g. a more graceful shade, slimmer legs" />
            <button onClick={() => void generate()} disabled={!!busy} className={`${btn} w-fit border-violet-500/25 bg-violet-500/15 text-violet-300 hover:bg-violet-500/25`}>
              {busy === "generate" ? <LoaderCircle size={12} className="animate-spin" /> : <Sparkles size={12} />} {busy === "generate" ? "Generating candidate…" : "Generate upgrade candidate"}
            </button>
          </div>
        )}
      </div>

      {candidate && (
        <>
          {retried && <p className="text-[11px] text-neutral-500">The first attempt failed validation (“{retried}”), so it was retried once automatically and that fixed it.</p>}
          {blocker && <p className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-2.5 py-1.5 text-[11px] text-red-400"><AlertTriangle size={12} /> {blocker}</p>}
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <button onClick={() => approve("new-projects")} disabled={!!busy || !!blocker} className={`${btn} border-emerald-500/25 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20`}>
                <CheckCircle size={12} /> New Projects Only
              </button>
              <p className="text-[10px] text-neutral-600">v{version} stays as it is in projects that already use it. New projects get v{next}.</p>
            </div>
            <div className="flex flex-col gap-1">
              <button onClick={() => approve("all-projects")} disabled={!!busy || !!blocker} className={`${btn} border-emerald-500/25 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30`}>
                <CheckCircle size={12} /> Make Current
              </button>
              <p className="text-[10px] text-neutral-600">Every project, existing and new, draws v{next}. v{version} is kept in the library and can be restored by removing v{next}.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-white/8 pt-3">
            <input className={`${inputCls} min-w-56 flex-1`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Regenerate with notes — what should be different?" onKeyDown={(e) => { if (e.key === "Enter" && !busy) void generate(); }} />
            <button onClick={() => void generate()} disabled={!!busy} className={`${btn} border-white/8 text-neutral-400 hover:text-neutral-200`}>
              {busy === "generate" ? <LoaderCircle size={12} className="animate-spin" /> : <RefreshCw size={12} />} Regenerate
            </button>
            <button onClick={discard} disabled={!!busy} className={`${btn} border-red-500/15 bg-red-500/10 text-red-400 hover:bg-red-500/20`}>
              <Trash2 size={12} /> Discard candidate
            </button>
          </div>
        </>
      )}
      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </div>
  );
}
