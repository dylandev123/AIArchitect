"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useProjectStore } from "@/store/useProjectStore";
import { useArchitectureDebugStore } from "@/store/useArchitectureDebugStore";
import { ARCHITECTURE_DEBUG_MODES, ARCHITECTURE_DEBUG_MODE_LABEL, useSceneStore } from "@/store/useSceneStore";
import { generateHouseFromJson } from "@/lib/house/generateHouse";
import { compileArchitecture, describeCompiledDesign, type ArchitectureDiagnostics, type MassReportEntry } from "@/lib/architecture/compiler";
import { isArchitecturalDesignDocument } from "@/lib/architecture/document";
import { ARCHITECTURE_FIXTURES } from "@/lib/architecture/fixtures";
import { STAGE_DIAGNOSTICS_LABEL, type StageDiagnostics } from "@/lib/architecture/stages/diagnostics";
import { runDesignQualityGate, type QualityGateResult } from "@/lib/architecture/stages/qualityGate";
import { replayArchitectureStage } from "@/lib/ai/stagedClient";
import { DEFAULT_MATERIALS_CONFIG, BLANK_HOUSE_JSON } from "@/types/house";
import { useRenderFlightStore } from "@/store/useRenderFlightStore";
import { auditHash, documentAudit, primitiveBounds, primitiveSignature } from "@/lib/architecture/renderAudit";
import { applyV2OnlyMode } from "@/lib/architecture/v2OnlyMode";
import { geometricGraphErrors, sitePlanSchema } from "@/lib/architecture/sitePlanContract";
import { buildV3TerrainSurface, isV3ProjectRoot } from "@/lib/v3/scene";
import { auditV3SiteHierarchy, resolveSiteHierarchy, routeGrade } from "@/lib/v3/siteHierarchy";
import { upgradeLegacyV3SiteHierarchy, type V3SiteHierarchyMigrationReport } from "@/lib/v3/siteHierarchyMigration";
import { getObjectBaseY, getRootSupportId, getSupportSurfaceY } from "@/lib/v3/elevation";
import { supportEndpoints } from "@/lib/v3/supportGraph";
import { computeV3CameraFit, diagnoseV3Scene } from "@/lib/v3/presentation";
import { compileV3Scene } from "@/lib/v3/scene";
import { useV3FailedPreviewStore } from "@/store/useV3FailedPreviewStore";

type JsonRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is JsonRecord => typeof value === "object" && value !== null && !Array.isArray(value);
const rendered = (ids: readonly string[], prefix: string) => ids.some((id) => id.startsWith(prefix));

/** Read-only dev trace of the persisted plan and the same final primitive set HouseRenderer receives. */
function SitePlanDebugPanel({ json }: { json: string | undefined }) {
  const report = useMemo(() => {
    try {
      const raw = JSON.parse(json ?? BLANK_HOUSE_JSON) as JsonRecord;
      const candidate = raw.sitePlan;
      const legacy = generateHouseFromJson(json ?? BLANK_HOUSE_JSON);
      const document = raw.architecturalDesignDocument ?? raw.architectureDocument;
      const model = isArchitecturalDesignDocument(document)
        ? applyV2OnlyMode({ legacy, v2Model: compileArchitecture(document, { materials: legacy.site?.materials ?? DEFAULT_MATERIALS_CONFIG }).model, v2OnlyMode: false, cutawayActive: false }).model
        : legacy.model;
      const ids = model?.primitives.map((p) => p.id) ?? [];
      // Absence is the explicit fallback state, not a malformed authored object.
      // Do not surface Zod's expected-object error as a fake Site Plan stage failure.
      if (candidate === undefined) return { state: "no authored Site Plan — deterministic fallback was used", errors: [] as string[], plan: undefined, ids };
      const parsed = sitePlanSchema.safeParse(candidate);
      if (!parsed.success) return { state: candidate ? "invalid Site Plan — deterministic fallback was used" : "no authored Site Plan — deterministic fallback was used", errors: parsed.success ? [] : parsed.error.issues.map((issue) => issue.message), plan: undefined, ids };
      const rootHouse = isRecord(raw.house) ? raw.house : {};
      const graphErrors = geometricGraphErrors(parsed.data, { brief: "", house: { width: Number(rootHouse.width), depth: Number(rootHouse.depth), floors: Number(rootHouse.floors) }, viewDirection: "south", arrivalDirection: "north" });
      return { state: graphErrors.length ? "saved Site Plan has geometry errors" : "authored Site Plan accepted", errors: graphErrors, plan: parsed.data, ids };
    } catch (error) { return { state: "unreadable project JSON", errors: [error instanceof Error ? error.message : "Unknown parse error"], plan: undefined, ids: [] as string[] }; }
  }, [json]);
  const plan = report.plan;
  const rows: { label: string; authored: unknown; rendered: boolean }[] = plan ? [
    { label: "Entrance / arrival", authored: plan.entrance, rendered: report.ids.some((id) => id.includes("door")) },
    { label: "Driveway", authored: plan.driveway, rendered: rendered(report.ids, "driveway-0-") },
    ...plan.parking.map((item, index) => ({ label: `Parking ${index + 1}`, authored: item, rendered: rendered(report.ids, `parking-${index}-`) })),
    { label: "Terrace / patio", authored: plan.terrace, rendered: rendered(report.ids, "patio-0-") },
    { label: "Pool", authored: plan.pool, rendered: rendered(report.ids, "pool-0-") },
    { label: "Pool deck", authored: plan.poolDeck, rendered: rendered(report.ids, "deck-0-") },
    ...plan.paths.map((item, index) => ({ label: `Path ${index + 1}: ${item.from} → ${item.to}`, authored: item, rendered: rendered(report.ids, `path-${index}-`) })),
    ...plan.landscape.map((item, index) => ({ label: `Landscape ${index + 1}: ${item.purpose}`, authored: item, rendered: rendered(report.ids, `landscape-${index}-`) })),
  ] : [];
  return <section className="space-y-1.5">
    <h3 className="font-semibold uppercase tracking-widest text-neutral-600">Site Plan trace (dev only)</h3>
    <div className={`rounded-lg border px-2.5 py-1.5 ${plan && report.errors.length === 0 ? "border-emerald-500/25 text-emerald-300" : "border-amber-500/25 text-amber-300"}`}>{report.state}</div>
    {report.errors.map((error, index) => <div key={index} className="text-amber-400">⚠ {error}</div>)}
    {!plan && <p className="text-neutral-600">No authored site geometry is stored on this generation.</p>}
    {rows.map((row) => <div key={row.label} className="rounded-lg border border-white/[0.06] px-2.5 py-1.5">
      <div className="flex justify-between gap-2"><span className="font-medium text-neutral-200">{row.label}</span><span className={row.rendered ? "text-emerald-400" : "text-red-400"}>{row.rendered ? "rendered" : "not rendered"}</span></div>
      <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[10px] leading-4 text-neutral-500">{JSON.stringify(row.authored, null, 2)}</pre>
    </div>)}
    <p className="text-neutral-600">Coordinates are world metres: x=east, z=south. Wall features use wall + offset; paths use x1/z1 → x2/z2.</p>
  </section>;
}

const STATUS_STYLES: Record<string, string> = {
  applied: "text-emerald-400",
  fallback: "text-amber-400",
  unavailable: "text-neutral-500",
};

const STAGE_STATUS_ICON: Record<StageDiagnostics["status"], string> = { ok: "✓", fallback: "○", error: "✗" };
const STAGE_STATUS_STYLE: Record<StageDiagnostics["status"], string> = { ok: "text-emerald-400", fallback: "text-amber-400", error: "text-red-400" };
const REPLAYABLE_STAGES: StageDiagnostics["stage"][] = ["foundation", "mass-expansion", "architectural-geometry", "roof-composition"];

/** Massing → Articulated Geometry → Roofs → Openings → Full — drives what `compileArchitecture` actually builds via `useSceneStore.architectureDebug`. */
function ModeSelector() {
  const mode = useSceneStore((s) => s.architectureDebug);
  const setMode = useSceneStore((s) => s.setArchitectureDebug);
  return (
    <div className="flex flex-wrap gap-1">
      {ARCHITECTURE_DEBUG_MODES.map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => setMode(m)}
          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition ${mode === m ? "border-amber-500/50 bg-amber-500/20 text-amber-300" : "border-white/[0.08] text-neutral-400 hover:bg-white/[0.06]"}`}
        >
          {ARCHITECTURE_DEBUG_MODE_LABEL[m]}
        </button>
      ))}
    </div>
  );
}

/** DEV-only diagnostic: forces the V2 compiled model to be the sole building source, merging back only genuine legacy site features. See src/lib/architecture/v2OnlyMode.ts. */
function V2OnlyModeToggle() {
  const enabled = useSceneStore((s) => s.v2OnlyMode);
  const setEnabled = useSceneStore((s) => s.setV2OnlyMode);
  return (
    <section className="space-y-1.5">
      <h3 className="font-semibold uppercase tracking-widest text-neutral-600">V2 Architecture Only (dev only)</h3>
      <button
        type="button"
        onClick={() => setEnabled(!enabled)}
        className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${enabled ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-200" : "border-white/[0.1] text-neutral-300"}`}
      >
        {enabled ? "V2-Only: ON" : "V2-Only: OFF"}
      </button>
      <p className="text-neutral-600">When on (and a document exists), legacy house/building geometry cannot affect the visible building — only genuine site features (pools, driveways, landscaping, terrain-adjacent walls) are merged back in. Remaining legacy dependencies are logged to the console as [V2-ONLY VIOLATION].</p>
    </section>
  );
}

/** Read-only contract evidence for an otherwise recoverable Terra response. */
function V3FailedPreviewPanel({ projectId }: { projectId: string }) {
  const candidate = useV3FailedPreviewStore((s) => s.candidate);
  const active = useV3FailedPreviewStore((s) => s.active);
  const render = useV3FailedPreviewStore((s) => s.render);
  const clear = useV3FailedPreviewStore((s) => s.clear);
  const selectKey = useSceneStore((s) => s.selectKey);
  const triggerCameraPreset = useSceneStore((s) => s.triggerCameraPreset);
  if (candidate?.projectId !== projectId) return null;
  const { diagnostics } = candidate;
  return <section className="space-y-1.5 rounded-lg border border-red-500/30 bg-red-500/[0.06] p-2.5">
    <h3 className="font-semibold uppercase tracking-widest text-red-200">V3 Preview — Invalid / Not Saved</h3>
    <p className="text-[10px] text-red-100/70">{candidate.scene.objects.length} compiler-safe objects. This scene exists only in memory and is read-only.</p>
    <div className="flex flex-wrap gap-1.5">
      {!active && <button type="button" onClick={() => { render(projectId); triggerCameraPreset("site"); }} className="rounded-full border border-red-300/40 px-2.5 py-1 text-[10px] font-semibold text-red-100 hover:bg-red-300/10">Render failed Terra preview</button>}
      <button type="button" onClick={clear} className="rounded-full border border-white/15 px-2.5 py-1 text-[10px] font-semibold text-neutral-200 hover:bg-white/10">Clear failed preview</button>
    </div>
    {diagnostics.strictValidationErrors.map((error, index) => <p key={`${error}-${index}`} className="text-[10px] text-red-300">strict: {error}</p>)}
    {diagnostics.unsupportedObjectIds.length > 0 && <div className="text-[10px] text-amber-200">unsupported geometry: {diagnostics.unsupportedObjectIds.map((objectId) => <button key={objectId} type="button" onClick={() => selectKey(objectId)} className="ml-1 underline decoration-amber-200/50 hover:text-amber-50">{objectId}</button>)}</div>}
    {diagnostics.skippedObjectIds.length > 0 && <p className="text-[10px] text-amber-200">skipped objects: {diagnostics.skippedObjectIds.join(", ")}</p>}
    {diagnostics.skippedRelationshipIds.length > 0 && <p className="text-[10px] text-amber-200">skipped relationships: {diagnostics.skippedRelationshipIds.join(", ")}</p>}
    {diagnostics.normalizedFields.length > 0 && <details className="text-[10px] text-neutral-300"><summary className="cursor-pointer text-neutral-400">normalized / omitted fields ({diagnostics.normalizedFields.length})</summary>{diagnostics.normalizedFields.map((field, index) => <p key={`${field}-${index}`} className="mt-0.5">{field}</p>)}</details>}
  </section>;
}

/** DEV-only visual isolation controls. They only change scene visibility, never the document or compiler. */
function RenderAuditControls() {
  const xRay = useSceneStore((s) => s.geometryXRay);
  const setXRay = useSceneStore((s) => s.setGeometryXRay);
  const isolate = useSceneStore((s) => s.isolateArchitectureMassId);
  const setIsolate = useSceneStore((s) => s.setIsolateArchitectureMassId);
  const freeze = useRenderFlightStore((s) => s.freeze);
  const toggleFreeze = useRenderFlightStore((s) => s.toggleFreeze);
  const capture = useRenderFlightStore((s) => s.captureCurrent);
  const snapshots = useRenderFlightStore((s) => s.snapshots);
  const viewed = useRenderFlightStore((s) => s.viewed);
  const view = useRenderFlightStore((s) => s.view);
  const params = useParams<{ projectId: string }>();
  const viewA08 = () => {
    const document = ARCHITECTURE_FIXTURES.luxuryTropicalCourtyardVillaV2;
    const result = compileArchitecture(document, { materials: DEFAULT_MATERIALS_CONFIG });
    const json = JSON.stringify({ ...JSON.parse(BLANK_HOUSE_JSON), architecturalDesignDocument: document });
    view({ sequence: -1, timestamp: Date.now(), source: "historical-fixture:a08c22d9", projectId: params.projectId, configJson: json, configHash: auditHash(json), documentHash: documentAudit(document).hash, v2: true, primitiveCount: result.model.primitives.length, primitiveHash: auditHash(result.model.primitives.map(primitiveSignature)), massIds: document.massing.masses.map((mass) => mass.id), bounds: primitiveBounds(result.model.primitives) });
  };
  return <section className="space-y-1.5">
    <h3 className="font-semibold uppercase tracking-widest text-neutral-600">Render audit (dev only)</h3>
    <div className="flex flex-wrap gap-1.5">
      <button type="button" onClick={() => setXRay(!xRay)} className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${xRay ? "border-cyan-400/60 bg-cyan-400/15 text-cyan-200" : "border-white/[0.1] text-neutral-300"}`}>Geometry X-Ray</button>
      <button type="button" onClick={() => setIsolate(isolate === "main" ? null : "main")} className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${isolate === "main" ? "border-amber-400/60 bg-amber-400/15 text-amber-200" : "border-white/[0.1] text-neutral-300"}`}>Isolate Stress Main Mass</button>
      <button type="button" onClick={toggleFreeze} className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${freeze ? "border-red-400/60 bg-red-400/15 text-red-200" : "border-white/[0.1] text-neutral-300"}`}>{freeze ? "Unfreeze Render" : "Freeze Render"}</button>
      <button type="button" onClick={capture} className="rounded-full border border-white/[0.1] px-2.5 py-1 text-[10px] font-semibold text-neutral-300">Capture Render State</button>
      <button type="button" onClick={viewA08} className="rounded-full border border-white/[0.1] px-2.5 py-1 text-[10px] font-semibold text-neutral-300">View a08c22d9</button>
    </div>
    <p className="text-neutral-600">X-Ray hides roofs, ground, terrain and scenery; isolation filters only `architecture-main-*` primitives. Console emits [V2 CONFIG], [V2 RENDER], and [V2 R3F].</p>
    <div className="max-h-40 space-y-1 overflow-y-auto rounded border border-white/[0.06] p-1.5 text-[10px]">
      <div className="font-semibold uppercase tracking-widest text-neutral-600">Render History</div>
      {[...snapshots].reverse().map((snapshot) => <div key={snapshot.sequence} className="flex items-center gap-1 text-neutral-400"><span>#{snapshot.sequence} {new Date(snapshot.timestamp).toLocaleTimeString()} {snapshot.source} · {snapshot.v2 ? "V2" : "legacy"} · {snapshot.primitiveCount} · {snapshot.massIds.join(",") || "—"}</span><button type="button" onClick={() => view(snapshot)} className="text-amber-300">VIEW</button><button type="button" onClick={() => view({ ...snapshot })} className="text-amber-300">RESTORE COPY</button><button type="button" onClick={() => console.info("[RENDER DIFF]", { captured: snapshot, current: snapshots.at(-1) })} className="text-amber-300">DIFF WITH CURRENT</button>{viewed?.sequence === snapshot.sequence && <button type="button" onClick={() => view(undefined)} className="text-amber-300">LIVE</button>}</div>)}
    </div>
  </section>;
}

/** Dev-only: the live staged pipeline's last run, with a Replay action for any stage that didn't come back clean. Never rendered in production. */
function PipelineTrace() {
  const params = useParams<{ projectId: string }>();
  const diagnostics = useArchitectureDebugStore((s) => s.diagnostics);
  const diagnosticsProjectId = useArchitectureDebugStore((s) => s.projectId);
  const failedStage = useArchitectureDebugStore((s) => s.failedStage);
  const replaying = useArchitectureDebugStore((s) => s.replaying);
  const capabilityRequests = useArchitectureDebugStore((s) => s.capabilityRequests);
  const appendVersion = useProjectStore((s) => s.appendVersion);

  if (!diagnostics || diagnosticsProjectId !== params.projectId) return <p className="text-neutral-600">No staged-pipeline run recorded yet for this project.</p>;

  const replay = (stage: "foundation" | "mass-expansion" | "architectural-geometry" | "roof-composition" | "final-assembly") => {
    void replayArchitectureStage(params.projectId, stage, (summary, json) => appendVersion(params.projectId, summary, json));
  };

  return (
    <div className="space-y-1.5">
      {diagnostics.map((d) => (
        <div key={d.stage} className="rounded-lg border border-white/[0.06] px-2.5 py-1.5">
          <div className="flex items-center justify-between">
            <span className="font-medium text-neutral-200">
              <span className={`mr-1.5 ${STAGE_STATUS_STYLE[d.status]}`}>{STAGE_STATUS_ICON[d.status]}</span>
              {STAGE_DIAGNOSTICS_LABEL[d.stage]}
            </span>
            {REPLAYABLE_STAGES.includes(d.stage) && (
              <button
                type="button"
                onClick={() => replay(d.stage as "foundation" | "mass-expansion" | "architectural-geometry" | "roof-composition")}
                disabled={replaying !== null}
                className="rounded-full border border-white/[0.1] px-2 py-0.5 text-[10px] font-semibold text-neutral-300 hover:bg-white/[0.06] disabled:opacity-40"
              >
                {replaying === d.stage ? "Replaying…" : "Replay"}
              </button>
            )}
          </div>
          <div className="text-neutral-500">
            {Math.round(d.durationMs)}ms &middot; {d.modelCalls} model call{d.modelCalls === 1 ? "" : "s"} &middot; {d.retries} retr{d.retries === 1 ? "y" : "ies"}
          </div>
          {d.error && <div className="mt-0.5 text-red-400">{d.error}</div>}
          {d.warnings?.map((w) => <div key={w} className="mt-0.5 text-amber-400">{w}</div>)}
        </div>
      ))}
      {failedStage && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/[0.06] px-2.5 py-1.5 text-red-300">
          Request failed at: {failedStage}
          {failedStage === "final-assembly" && (
            <button
              type="button"
              onClick={() => replay("final-assembly")}
              disabled={replaying !== null}
              className="ml-2 rounded-full border border-white/[0.1] px-2 py-0.5 text-[10px] font-semibold text-neutral-300 hover:bg-white/[0.06] disabled:opacity-40"
            >
              {replaying === "final-assembly" ? "Replaying…" : "Replay"}
            </button>
          )}
        </div>
      )}
      {capabilityRequests.length > 0 && (
        <div className="rounded-lg border border-white/[0.06] px-2.5 py-1.5">
          <div className="font-semibold uppercase tracking-widest text-neutral-600">Capability gaps ({capabilityRequests.length})</div>
          {capabilityRequests.map((request, i) => (
            <div key={`${request.operation}-${i}`} className="mt-1 text-neutral-400">
              <span className="text-amber-400">{request.operation}</span> <span className="text-neutral-600">({request.stage})</span>
              {request.desiredBehaviour && <div className="text-neutral-600">{request.desiredBehaviour}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Dev-only: drops a fixture straight into the live project's `architecturalDesignDocument`, the same field a
 * real generation or Replay writes — so it renders through the exact same `compileArchitecture` →
 * `HouseRenderer` path, with no AI call and no API spend.
 */
function FixtureLoadButton({ fixtureKey, label }: { fixtureKey: keyof typeof ARCHITECTURE_FIXTURES; label: string }) {
  const params = useParams<{ projectId: string }>();
  const houseConfigJson = useProjectStore((s) => s.getProject(params.projectId)?.houseConfigJson);
  const updateHouseConfig = useProjectStore((s) => s.updateHouseConfig);

  const load = () => {
    let baseParsed: Record<string, unknown> = {};
    try {
      baseParsed = JSON.parse(houseConfigJson ?? BLANK_HOUSE_JSON) as Record<string, unknown>;
    } catch { /* a blank project's JSON is always valid; this only guards a corrupt project file */ }
    updateHouseConfig(params.projectId, JSON.stringify({ ...baseParsed, architecturalDesignDocument: ARCHITECTURE_FIXTURES[fixtureKey] }), `fixture:${fixtureKey}`);
  };

  return (
    <button
      type="button"
      onClick={load}
      className="rounded-full border border-white/[0.1] px-2.5 py-1 text-[10px] font-semibold text-neutral-300 hover:bg-white/[0.06]"
    >
      {label}
    </button>
  );
}

/** Read-only V3 compiler trace. The checkbox is deliberately dev-only and affects no persisted scene data. */
function V3TerrainDebugPanel({ json }: { json: string | undefined }) {
  const enabled = useSceneStore((s) => s.v3TerrainDebug);
  const setEnabled = useSceneStore((s) => s.setV3TerrainDebug);
  const report = useMemo(() => {
    try {
      const raw = JSON.parse(json ?? "{}");
      if (!isV3ProjectRoot(raw)) return null;
      const terrain = buildV3TerrainSurface(raw.v3Scene);
      const resolved = resolveSiteHierarchy(raw.v3Scene);
      const issues = auditV3SiteHierarchy(raw.v3Scene);
      return {
        terrain,
        derived: resolved.derived,
        levels: resolved.hierarchy.levels,
        connections: resolved.hierarchy.connections.map((connection) => ({ ...connection, grade: routeGrade(connection.route) })),
        issues,
        rows: raw.v3Scene.objects.map((object) => {
          const objectBaseY = getObjectBaseY(object), candidateSurfaceY = getSupportSurfaceY(object.support, object.transform.position[0], object.transform.position[2], raw.v3Scene);
          const terrainFollowing = object.support?.kind === "terrain" || object.metadata?.followsTerrain === true || object.type === "path" || object.type === "fence" || object.type === "retaining-wall";
          const terrainPoints = terrainFollowing ? [[object.transform.position[0], object.transform.position[2]] as [number, number], ...supportEndpoints(object)] : [];
          return {
          id: object.id, role: object.semanticRole, type: object.type,
          bounds: object.dimensions, elevation: terrain.heightAt(object.transform.position[0], object.transform.position[2]), objectBaseY, candidateSurfaceY,
          verticalGap: candidateSurfaceY === undefined ? undefined : Math.abs(objectBaseY - candidateSurfaceY), owningLevelId: object.support?.levelId, rootSupportId: getRootSupportId(object.support, raw.v3Scene),
          terrainSamples: terrainPoints.map(([x, z]) => terrain.heightAt(x, z)),
          support: object.support?.levelId ?? object.support?.objectId ?? (object.type === "path" || object.type === "fence" || object.type === "retaining-wall" ? "terrain sampled" : object.hostId ?? "missing"),
          };
        }),
      };
    } catch { return null; }
  }, [json]);
  if (!report) return null;
  return <section className="space-y-1.5">
    <div className="flex items-center justify-between gap-2">
      <h3 className="font-semibold uppercase tracking-widest text-neutral-600">V3 terrain compiler (dev only)</h3>
      <button type="button" onClick={() => setEnabled(!enabled)} className={"rounded-full border px-2 py-1 text-[10px] font-semibold " + (enabled ? "border-fuchsia-400/60 bg-fuchsia-500/15 text-fuchsia-200" : "border-white/[0.1] text-neutral-400")}>
        {enabled ? "Hide bounds" : "Show bounds"}
      </button>
    </div>
    <p className="text-neutral-500">{report.derived ? "Legacy-derived hierarchy" : "Persisted hierarchy"} · {report.levels.length} levels · {report.connections.length} connections · {report.terrain.vertices.length / 9} terrain triangles.</p>
    <div className="max-h-32 space-y-1 overflow-auto">
      {report.levels.map((level) => <div key={level.id} className="rounded border border-fuchsia-400/20 px-2 py-1 text-fuchsia-200">{level.id} · {level.elevation.toFixed(1)}m · {level.supportType}{level.access ? ` · ${level.access}` : ""}</div>)}
      {report.connections.map((connection) => <div key={connection.id} className="rounded border border-cyan-400/20 px-2 py-1 text-cyan-200">{connection.id} · {connection.fromLevelId} → {connection.toLevelId} · {(connection.grade * 100).toFixed(1)}%</div>)}
      {report.issues.map((issue) => <div key={issue.id} className={issue.severity === "error" ? "text-red-300" : "text-amber-300"}>{issue.code}: {issue.message}</div>)}
    </div>
    <div className="max-h-48 space-y-1 overflow-auto">
      {report.rows.map((row) => <div key={row.id} className="rounded border border-white/[0.06] px-2 py-1 text-[10px] text-neutral-400">
        <span className="font-medium text-neutral-200">{row.id}</span> · {row.role} · {row.type} · base {row.objectBaseY.toFixed(2)} · support {row.candidateSurfaceY?.toFixed(2) ?? "—"} · gap {row.verticalGap?.toFixed(2) ?? "—"} · level {row.owningLevelId ?? "—"} · root {row.rootSupportId} · terrain {row.terrainSamples.length ? row.terrainSamples.map((sample) => sample.toFixed(2)).join(" / ") : row.elevation.toFixed(2)} · {row.support}
      </div>)}
    </div>
  </section>;
}

const fmt3 = (v: readonly number[]) => v.map((n) => n.toFixed(1)).join(", ");
/** DEV-only: proves from the saved scene alone (no model call) whether objects compile, are framed, and sit above terrain. */
function V3RenderDiagnosticsPanel({ json }: { json: string | undefined }) {
  const flags = useSceneStore((s) => s.v3Diagnostics);
  const setFlags = useSceneStore((s) => s.setV3Diagnostics);
  const triggerCameraPreset = useSceneStore((s) => s.triggerCameraPreset);
  const report = useMemo(() => {
    try {
      const raw = JSON.parse(json ?? "{}");
      if (!isV3ProjectRoot(raw)) return null;
      const diagnosis = diagnoseV3Scene(raw.v3Scene, compileV3Scene(raw.v3Scene));
      return { diagnosis, fit: computeV3CameraFit(diagnosis.architectureBounds) };
    } catch { return null; }
  }, [json]);
  if (!report) return null;
  const { diagnosis: d, fit } = report;
  const toggle = (key: keyof typeof flags, label: string) => (
    <button type="button" onClick={() => setFlags({ [key]: !flags[key] })} className={"rounded-full border px-2 py-1 text-[10px] font-semibold " + (flags[key] ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-200" : "border-white/[0.1] text-neutral-400")}>{label}</button>
  );
  const hidden = [...d.notCompiled.map((id) => `${id}: not compiled`), ...d.nonFinite.map((id) => `${id}: non-finite`), ...d.zeroScale.map((id) => `${id}: ~zero scale`), ...d.transparent.map((id) => `${id}: opacity 0`), ...d.belowGroundPlane.map((id) => `${id}: below ground plane`)];
  return <section className="space-y-1.5">
    <h3 className="font-semibold uppercase tracking-widest text-neutral-600">V3 render diagnostics (dev only)</h3>
    <div className="flex flex-wrap gap-1.5">
      {toggle("hideTerrain", "Hide terrain")}
      {toggle("debugMaterial", "Debug material")}
      {toggle("architectureBounds", "Architecture bounds")}
      <button type="button" onClick={() => triggerCameraPreset("site")} className="rounded-full border border-white/[0.1] px-2 py-1 text-[10px] font-semibold text-neutral-300 hover:bg-white/[0.06]">Frame V3 architecture</button>
    </div>
    <p className="text-neutral-500">{d.objectCount} objects → {d.compiledPrimitiveCount} primitives · {d.buriedVolumes} buried volume(s)</p>
    <p className="text-neutral-500">site {fmt3(d.siteBounds.min)} → {fmt3(d.siteBounds.max)}</p>
    {d.terrainBounds && <p className="text-neutral-500">terrain {fmt3(d.terrainBounds.min)} → {fmt3(d.terrainBounds.max)}</p>}
    <p className="text-neutral-500">architecture ({d.architectureBounds.source}) {fmt3(d.architectureBounds.min)} → {fmt3(d.architectureBounds.max)}</p>
    {d.compiledBounds && <p className="text-neutral-500">compiled {fmt3(d.compiledBounds.min)} → {fmt3(d.compiledBounds.max)}</p>}
    <p className="text-neutral-500">camera target {fmt3(fit.target.toArray())} · position {fmt3(fit.position.toArray())}</p>
    {d.volumes.map((v) => <div key={v.id} className={"text-[10px] " + (v.buried ? "text-red-300" : "text-neutral-400")}>{v.id} · base {v.baseY.toFixed(2)} · top {v.topY.toFixed(2)} · terrain {v.terrainY.toFixed(2)} · visible {v.visibleHeight.toFixed(2)}</div>)}
    {hidden.length > 0 && <div className="max-h-24 overflow-auto text-[10px] text-amber-300">{hidden.map((line) => <div key={line}>{line}</div>)}</div>}
  </section>;
}

const stringList = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
const displayText = (value: unknown, fallback = "missing") => typeof value === "string" ? value : fallback;
const displayNumber = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : 0;

/** Defensive display adapter for reports that may predate the current migration diagnostics shape. */
export function V3SiteHierarchyMigrationReportDetails({ report }: { report: unknown }) {
  const data = isRecord(report) ? report : {};
  const groundingIssues = isRecord(data.groundingIssues) ? data.groundingIssues : {};
  const improvements = isRecord(data.improvements) ? data.improvements : {};
  const levels = Array.isArray(data.levels) ? data.levels.filter(isRecord) : [];
  const connections = Array.isArray(data.connections) ? data.connections.filter(isRecord) : [];
  const assignments = Array.isArray(data.supportAssignments) ? data.supportAssignments.filter(isRecord) : [];
  const supportGraph = Array.isArray(data.supportGraph) ? data.supportGraph.filter(isRecord) : [];
  const before = stringList(groundingIssues.before);
  const after = stringList(groundingIssues.after);
  const ambiguousObjectIds = stringList(data.ambiguousObjectIds);
  const warnings = stringList(data.warnings);
  const rendersCleanly = data.rendersCleanly === true;

  return <div className={rendersCleanly ? "text-emerald-300" : "text-red-300"}>
    {rendersCleanly ? "Committed a validated hierarchy version." : `Migration was not committed: ${after.join(", ") || "validation failed"}`}
    <div className="mt-1 text-neutral-400">{levels.map((level, index) => `${displayText(level.id, `level-${index + 1}`)} ${displayNumber(level.elevation).toFixed(1)}m`).join(" · ")}</div>
    <div className="mt-1 text-neutral-400">{connections.map((connection, index) => `${displayText(connection.id, `connection-${index + 1}`)} ${(displayNumber(connection.grade) * 100).toFixed(1)}%`).join(" · ")}</div>
    <div className="mt-1 space-y-1 text-neutral-400">Inferred relationships:
      {assignments.map((assignment, index) => {
        const oldSupport = isRecord(assignment.oldSupport) ? assignment.oldSupport : {};
        const support = isRecord(assignment.support) ? assignment.support : {};
        const oldTarget = displayText(oldSupport.levelId, displayText(oldSupport.objectId, displayText(oldSupport.kind, "none")));
        const newTarget = displayText(support.levelId, displayText(support.objectId, displayText(support.kind)));
        const evidence = stringList(assignment.evidence);
        return <div key={`${displayText(assignment.objectId, "assignment")}-${index}`} className="pl-1"><span className="text-neutral-200">{displayText(assignment.objectId, `assignment-${index + 1}`)}</span> · {oldTarget} → {newTarget} · {Math.round(displayNumber(assignment.confidence))}% · {evidence.join(", ")}</div>;
      })}
    </div>
    {supportGraph.length > 0 && <div className="mt-1 space-y-1 text-neutral-400">Support graph:
      {supportGraph.map((link, index) => <div key={`${displayText(link.objectId, "object")}-${index}`} className="pl-1"><span className="text-neutral-200">{displayText(link.objectId, `object-${index + 1}`)}</span> → {displayText(link.supportId)} · base {displayNumber(link.objectBaseY).toFixed(2)} · surface {displayNumber(link.directSupportSurfaceY).toFixed(2)} · gap {displayNumber(link.verticalGap).toFixed(2)} · level {displayText(link.owningLevelId, displayText(link.levelId, "—"))} · root {displayText(link.rootSupportId)} · {Math.round(displayNumber(link.confidence))}% · {stringList(link.evidence).join(", ")}</div>)}
    </div>}
    <div className="mt-1 text-neutral-400">Grounding issues: {before.length} before → {after.length} after · driveway {improvements.driveway === true ? "connected" : "unchanged"} · pool {improvements.pool === true ? "supported" : "unchanged"} · retaining {improvements.retainingWalls === true ? "mapped" : "ambiguous"} · fence {improvements.fences === true ? "terrain-following" : "unchanged"} · render {rendersCleanly ? "clean" : "not committed"}</div>
    {ambiguousObjectIds.length > 0 && <div className="mt-1 text-amber-300">Ambiguous: {ambiguousObjectIds.join(", ")}</div>}
    {warnings.map((warning, index) => <div key={`${warning}-${index}`} className="mt-1 text-amber-300">Warning: {warning}</div>)}
  </div>;
}

/** Local-only one-time migration for V3 saves written before siteHierarchy was persisted. */
function V3SiteHierarchyUpgrade({ json }: { json: string | undefined }) {
  const params = useParams<{ projectId: string }>();
  const appendVersion = useProjectStore((s) => s.appendVersion);
  const [report, setReport] = useState<V3SiteHierarchyMigrationReport | null>(null);
  const legacy = useMemo(() => {
    try {
      const raw = JSON.parse(json ?? "{}");
      return isV3ProjectRoot(raw) && !raw.v3Scene.siteHierarchy ? raw.v3Scene : null;
    } catch { return null; }
  }, [json]);
  if (!legacy && !report) return null;
  const upgrade = () => {
    if (!legacy) return;
    // Keep this explicit clone at the UI boundary: a failed audit never mutates the viewed persisted scene.
    const result = upgradeLegacyV3SiteHierarchy(structuredClone(legacy));
    setReport(result.report);
    if (result.ok) appendVersion(params.projectId, "Upgrade V3 Site Hierarchy", JSON.stringify({ version: 3, generationMode: "v3-scene", v3Scene: result.scene }), "v3-site-hierarchy-upgrade");
  };
  return <section className="space-y-1.5 rounded-lg border border-cyan-400/20 bg-cyan-400/[0.04] p-2.5">
    <div className="flex items-center justify-between gap-2">
      <div>
        <h3 className="font-semibold uppercase tracking-widest text-cyan-200">Legacy V3 site hierarchy</h3>
        <p className="text-[10px] text-neutral-500">Deterministic local migration · no AI or network call.</p>
      </div>
      {legacy && <button type="button" onClick={upgrade} className="rounded-full border border-cyan-300/40 px-2.5 py-1 text-[10px] font-semibold text-cyan-100 hover:bg-cyan-300/10">Upgrade V3 Site Hierarchy</button>}
    </div>
    {report && <V3SiteHierarchyMigrationReportDetails report={report} />}
  </section>;
}

/** Temporary, dev-only view into what the live compile path actually produced — not part of the render pipeline itself. */
export function ArchitectureDebugPanel() {
  const params = useParams<{ projectId: string }>();
  const houseConfigJson = useProjectStore((s) => s.getProject(params.projectId)?.houseConfigJson);

  const { source, diagnostics, qualityGate, massReport } = useMemo((): { source: "new" | "legacy"; diagnostics?: ArchitectureDiagnostics; qualityGate?: QualityGateResult; massReport?: MassReportEntry[] } => {
    try {
      const raw = JSON.parse(houseConfigJson ?? BLANK_HOUSE_JSON);
      const document = raw.architecturalDesignDocument ?? raw.architectureDocument;
      if (isArchitecturalDesignDocument(document)) {
        const legacy = generateHouseFromJson(houseConfigJson ?? BLANK_HOUSE_JSON);
        const { model, diagnostics } = compileArchitecture(document, { materials: legacy.site?.materials ?? DEFAULT_MATERIALS_CONFIG, mode: "full" });
        return {
          source: "new", diagnostics,
          qualityGate: diagnostics ? runDesignQualityGate(document, diagnostics) : undefined,
          massReport: diagnostics ? describeCompiledDesign(document, model, diagnostics) : undefined,
        };
      }
    } catch { /* falls through to legacy */ }
    return { source: "legacy" };
  }, [houseConfigJson]);

  return (
    <div className="space-y-4 p-4 text-xs">
      {process.env.NODE_ENV !== "production" && (
        <section className="space-y-1.5">
          <h3 className="font-semibold uppercase tracking-widest text-neutral-600">Fixtures (dev only)</h3>
          <div className="flex flex-wrap gap-1.5">
            <FixtureLoadButton fixtureKey="luxuryTropicalCourtyardVillaV2" label="Load V2 Fixture" />
            <FixtureLoadButton fixtureKey="architectureCompilerStressFixture" label="Load Geometry Stress Test" />
            <FixtureLoadButton fixtureKey="architectureCapabilityHouse" label="Load Architecture Capability House" />
          </div>
        </section>
      )}
      {process.env.NODE_ENV !== "production" && <V2OnlyModeToggle />}
      {process.env.NODE_ENV !== "production" && <RenderAuditControls />}

      {process.env.NODE_ENV !== "production" && <V3FailedPreviewPanel projectId={params.projectId} />}

      {process.env.NODE_ENV !== "production" && <SitePlanDebugPanel json={houseConfigJson} />}
      {process.env.NODE_ENV !== "production" && <V3SiteHierarchyUpgrade json={houseConfigJson} />}
      {process.env.NODE_ENV !== "production" && <V3RenderDiagnosticsPanel json={houseConfigJson} />}
      {process.env.NODE_ENV !== "production" && <V3TerrainDebugPanel json={houseConfigJson} />}

      {process.env.NODE_ENV !== "production" && (
        <section className="space-y-1.5">
          <h3 className="font-semibold uppercase tracking-widest text-neutral-600">Staged pipeline (dev only)</h3>
          <PipelineTrace />
        </section>
      )}

      <div className="flex items-center gap-2">
        <span className="text-neutral-500">Architecture source</span>
        <span className={`rounded-full px-2 py-0.5 font-semibold ${source === "new" ? "bg-emerald-500/15 text-emerald-400" : "bg-white/[0.06] text-neutral-400"}`}>
          {source === "new" ? "NEW · ArchitecturalDesignDocument" : "LEGACY · single-box shell"}
        </span>
      </div>

      {source === "new" && (
        <section className="space-y-1.5">
          <h3 className="font-semibold uppercase tracking-widest text-neutral-600">Viewport mode</h3>
          <ModeSelector />
        </section>
      )}

      {!diagnostics && (
        <p className="text-neutral-600">No architectural document on this project — rendering the legacy shell.</p>
      )}

      {diagnostics && (
        <>
          <section className="space-y-1.5">
            <h3 className="font-semibold uppercase tracking-widest text-neutral-600">Masses ({diagnostics.massCount})</h3>
            {(massReport ?? []).map((mass) => (
              <div key={mass.id} className="rounded-lg border border-white/[0.06] px-2.5 py-1.5">
                <div className="font-medium text-neutral-200">
                  {mass.name} <span className="text-neutral-600">· {mass.role}</span>
                  {mass.id === diagnostics.dominantMassId && <span className="ml-1.5 text-amber-400">★ dominant</span>}
                </div>
                <div className="text-neutral-500">
                  pos ({mass.position.x.toFixed(1)}, {mass.position.z.toFixed(1)}) · rot {(mass.rotation * 180 / Math.PI).toFixed(0)}° · elev {mass.elevation.toFixed(1)}m
                </div>
                <div className="text-neutral-500">
                  {mass.width.toFixed(1)}x{mass.depth.toFixed(1)}m · {mass.floors} floor{mass.floors === 1 ? "" : "s"} · {mass.relationships.length} relationship{mass.relationships.length === 1 ? "" : "s"} · {mass.operations.length} op{mass.operations.length === 1 ? "" : "s"} · {mass.openings.length} opening{mass.openings.length === 1 ? "" : "s"} · {mass.primitiveCount} primitive{mass.primitiveCount === 1 ? "" : "s"}
                </div>
              </div>
            ))}
          </section>

          {diagnostics.courtyards.length > 0 && (
            <section className="space-y-1.5">
              <h3 className="font-semibold uppercase tracking-widest text-neutral-600">Courtyards</h3>
              {diagnostics.courtyards.map((c) => (
                <div key={c.anchorMassId} className="rounded-lg border border-white/[0.06] px-2.5 py-1.5 text-neutral-400">
                  <span className="text-neutral-200">{c.anchorMassId}</span> · {(c.bounds.x1 - c.bounds.x0).toFixed(1)}x{(c.bounds.z1 - c.bounds.z0).toFixed(1)}m · enclosed by {c.enclosingMassIds.join(", ")} · open: {c.openSides.join(", ") || "none"}
                </div>
              ))}
            </section>
          )}

          {qualityGate && (
            <section className="space-y-1.5">
              <h3 className="font-semibold uppercase tracking-widest text-neutral-600">
                Design quality {qualityGate.passed ? <span className="text-emerald-400">✓</span> : <span className="text-amber-400">{qualityGate.checks.filter((c) => !c.passed).length} issue(s)</span>}
              </h3>
              {qualityGate.checks.filter((c) => !c.passed).map((c) => (
                <div key={c.id} className="text-amber-400">⚠ {c.id}: {c.detail}</div>
              ))}
            </section>
          )}

          <section className="space-y-1.5">
            <h3 className="font-semibold uppercase tracking-widest text-neutral-600">Roof recipes</h3>
            {diagnostics.roofs.map((roof) => (
              <div key={roof.massId} className="flex justify-between text-neutral-400">
                <span>{roof.massId}</span>
                <span className="text-neutral-200">{roof.kind}</span>
              </div>
            ))}
          </section>

          <section className="space-y-1.5">
            <h3 className="font-semibold uppercase tracking-widest text-neutral-600">Capabilities</h3>
            {diagnostics.capabilities.length === 0 && <p className="text-neutral-600">None requested.</p>}
            {diagnostics.capabilities.map((capability, i) => (
              <div key={`${capability.id}-${capability.massId}-${i}`} className="flex items-center justify-between">
                <span className="text-neutral-400">
                  {capability.id} <span className="text-neutral-600">→ {capability.massId}</span>
                </span>
                <span className={STATUS_STYLES[capability.status] ?? "text-neutral-500"}>{capability.status}</span>
              </div>
            ))}
          </section>

          <section className="space-y-1.5">
            <h3 className="font-semibold uppercase tracking-widest text-neutral-600">Articulated geometry</h3>
            {diagnostics.geometry.map((g) => (
              <div key={g.massId} className="rounded-lg border border-white/[0.06] px-2.5 py-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-neutral-200">{g.massId}</span>
                  <span className="text-neutral-500">{g.topFloorRectCount} roof rect{g.topFloorRectCount === 1 ? "" : "s"}</span>
                </div>
                <div className="text-neutral-500">
                  {g.operationsRequested} footprint op{g.operationsRequested === 1 ? "" : "s"} · {g.openingsRequested} opening op{g.openingsRequested === 1 ? "" : "s"}
                </div>
                {g.warnings.map((w, i) => (
                  <div key={i} className="mt-0.5 text-amber-400">⚠ {w}</div>
                ))}
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
