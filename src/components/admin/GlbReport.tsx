"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import type { AssetValidationReport, CuratedAsset } from "@/types/assets";
import { revalidateStoredGlb } from "@/lib/assets/glbIngest";
import { useAssetStore } from "@/store/useAssetStore";

const m = (n: number | undefined) => (n === undefined ? "—" : `${Number(n.toFixed(2))}`);
const size = (bytes: number | undefined) => (bytes === undefined ? "—" : bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export function validationStatus(report: AssetValidationReport | undefined): { label: string; tone: "ok" | "warn" | "fail" | "none" } {
  if (!report) return { label: "Not validated", tone: "none" };
  if (!report.passed) return { label: "Failed", tone: "fail" };
  return report.warnings.length > 0 ? { label: `Passed with ${report.warnings.length} warning${report.warnings.length > 1 ? "s" : ""}`, tone: "warn" } : { label: "Passed", tone: "ok" };
}

const TONE = {
  ok: "bg-emerald-500/10 text-emerald-400",
  warn: "bg-amber-500/10 text-amber-400",
  fail: "bg-red-500/10 text-red-400",
  none: "bg-white/5 text-neutral-400",
} as const;

/** Validation status and measurements for a queued GLB: dimensions, weight, and every error/warning. */
export function GlbReport({ asset }: { asset: CuratedAsset }) {
  const updateMeta = useAssetStore((s) => s.updateAssetMeta);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const report = asset.validation;
  const status = validationStatus(report);
  const d = report?.dimensions;

  const validate = async () => {
    setBusy(true);
    setNote("");
    try {
      const next = await revalidateStoredGlb(asset, undefined);
      if (!next) setNote("No GLB file is stored for this asset, so there is nothing to validate.");
      else updateMeta(asset.id, { validation: next, ...(next.passed && next.dimensions ? { dimensions: next.dimensions } : {}) });
    } finally {
      setBusy(false);
    }
  };

  const Icon = status.tone === "ok" ? CheckCircle : status.tone === "fail" ? XCircle : AlertTriangle;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-white/5 bg-white/[0.03] p-2.5 text-[11px]">
      <div className="flex items-center gap-2">
        <span className={`flex items-center gap-1 rounded px-1.5 py-0.5 font-medium ${TONE[status.tone]}`}>
          <Icon size={11} /> {status.label}
        </span>
        <button onClick={validate} disabled={busy} className="ml-auto rounded border border-white/8 px-2 py-0.5 text-neutral-400 hover:text-neutral-200 disabled:opacity-40">
          {busy ? "Validating…" : report ? "Re-validate" : "Validate"}
        </button>
      </div>
      {report && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-neutral-400 sm:grid-cols-3">
          <Stat k="Dimensions" v={d ? `${m(d.width)} × ${m(d.depth)} × ${m(d.height)} m` : "—"} />
          <Stat k="Triangles" v={report.triangleCount?.toLocaleString("en-US") ?? "—"} />
          <Stat k="File size" v={size(report.fileSizeBytes)} />
          <Stat k="Materials" v={String(report.materialCount ?? "—")} />
          <Stat k="Textures" v={report.textureCount === undefined ? "—" : `${report.textureCount}${report.maxTextureSize ? ` (max ${report.maxTextureSize}px)` : ""}`} />
          <Stat k="Meshes" v={String(report.meshCount ?? "—")} />
          <Stat k="Footprint" v={report.footprint ? `${m(report.footprint.width)} × ${m(report.footprint.depth)} m` : "—"} />
          <Stat k="Grounded" v={report.groundAligned === undefined ? "—" : report.groundAligned ? "yes" : "no (re-grounded)"} />
        </dl>
      )}
      {report?.errors.map((e) => <p key={e} className="flex gap-1.5 text-red-400"><XCircle size={11} className="mt-0.5 shrink-0" />{e}</p>)}
      {report?.warnings.map((w) => <p key={w} className="flex gap-1.5 text-amber-400/90"><AlertTriangle size={11} className="mt-0.5 shrink-0" />{w}</p>)}
      {note && <p className="text-neutral-500">{note}</p>}
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-1.5">
      <dt className="text-neutral-600">{k}</dt>
      <dd className="text-neutral-300">{v}</dd>
    </div>
  );
}
