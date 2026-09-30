"use client";

import { useMemo } from "react";
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

      {process.env.NODE_ENV !== "production" && <SitePlanDebugPanel json={houseConfigJson} />}

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
