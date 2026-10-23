"use client";

import { v3ArchitecturalMassingScene } from '@/lib/v3/architecturalPlanFirst';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useProjectStore } from "@/store/useProjectStore";
import { useSceneStore } from "@/store/useSceneStore";
import { generateHouseFromJson } from "@/lib/house/generateHouse";
import { PrimitiveMesh, type RenderedMeshAudit } from "./PrimitiveMesh";
import { GlbFeature } from "./GlbFeature";
import { useAssetStore } from "@/store/useAssetStore";
import { placementsFromBuildings, placementsFromOutdoor, placementsFromV2SitePlan, replacedFeatureIds, usablePlacements, type AssetPlacement } from "@/lib/assets/placement";
import { glbModels, loadPlacedAssets, useGlbCacheVersion } from "@/lib/assets/glbModels";
import type { MaterialsConfig } from "@/types/house";
import { SURFACE_PBR, usePbrReady, type PbrSetDef, type SurfaceKey } from "@/lib/pbrLibrary";
import type { HousePrimitive } from "@/lib/house/types";
import { applyEdgeDetail, RENDER_BASE_BEVEL } from "@/lib/house/architecture/edgeDetail";
import { cutawayHiddenIds } from "@/lib/house/roomView";
import { compileArchitecture } from "@/lib/architecture/compiler";
import { isArchitecturalDesignDocument } from "@/lib/architecture/document";
import { DEFAULT_MATERIALS_CONFIG } from "@/types/house";
import { auditHash, documentAudit, massIdOf, primitiveBounds, primitiveSignature } from "@/lib/architecture/renderAudit";
import { revisionOf } from "@/lib/house/revision";
import { useRenderFlightStore } from "@/store/useRenderFlightStore";
import { applyV2OnlyMode, logV2OnlyViolation, type V2OnlyViolation } from "@/lib/architecture/v2OnlyMode";
import { compileV2SiteFeatures, v2SitePlanOf } from "@/lib/architecture/v2SiteFeatures";
import { ProceduralOutdoorPlaceholder } from "./ProceduralOutdoorPlaceholder";
import { V3Vegetation } from "../scenery/V3Vegetation";
import type { OutdoorAssetPlacement } from "@/lib/outdoor/placements";
import { compileV3Scene, isV3ProjectRoot } from "@/lib/v3/scene";
import { validateV3Scene } from "@/lib/v3/validation";
import { revalidateArchitecturalScene } from "@/lib/v3/architecturalAcceptance";
import { applyV3RenderDiagnostics } from "@/lib/v3/presentation";
import { useV3FailedPreviewStore } from "@/store/useV3FailedPreviewStore";
import { buildV3RenderIdentity } from "@/lib/v3/renderIdentity";
import { resolveActiveV3RenderSource } from "@/lib/v3/activeRenderSource";
import * as THREE from "three";
import { DEFAULT_ARCHITECTURAL_VIEW, planningHostId, planningSectionY } from "@/lib/v3/architecturalPlanning";
import { useV3RenderIdentityStore } from "@/store/useV3RenderIdentityStore";

/**
 * Which material a primitive is made of, recovered from its category and colour: the builders tint walls,
 * gables, roofs and trim with their zone's colour. Anything else (floors, glass, garages…) keeps a plain finish.
 */
const MASONRY_CATEGORIES = new Set<HousePrimitive["category"]>(["bay", "curvedWall", "arch", "foundation", "stairs"]);

function surfaceOf(primitive: HousePrimitive, materials: MaterialsConfig | undefined): SurfaceKey | undefined {
  // A builder that owns its finish (V2 Roof Systems) says so outright. V3 primitives always take this path: the V3
  // compiler resolves each finish from the scene's own material data, so V2 site materials never apply to them.
  if (primitive.surface) return primitive.surface;
  if (!materials) return undefined;
  const color = primitive.color.toLowerCase();
  const is = (zone: keyof MaterialsConfig) => materials[zone].color.toLowerCase() === color;
  if (primitive.category === "roof") return is("roof") ? materials.roof.material : is("exterior") ? materials.exterior.material : undefined;
  // Masonry parts are shades of the exterior finish (or plain stone), so they take its pattern regardless of exact colour.
  if (MASONRY_CATEGORIES.has(primitive.category)) return materials.exterior.material;
  if (primitive.category === "retainingWall") return "stone";
  if (primitive.category === "rock") return "rock";
  if (primitive.category === "landscape") return "grass";
  if (primitive.category === "deck") return materials.decking.material;
  if (primitive.category === "patio" || primitive.category === "path" || primitive.category === "driveway" || primitive.category === "parking") return "paving";
  if (primitive.category === "wall") return is("exterior") ? materials.exterior.material : is("trim") ? materials.trim.material : undefined;
  return undefined;
}

/** Library models the project's features reference (none unless generation attached one). */
function parsePlacements(json: string | undefined): AssetPlacement[] {
  if (!json || !json.includes('"assetId"')) return [];
  try {
    const root = JSON.parse(json);
    return [...placementsFromBuildings(root.buildings), ...placementsFromV2SitePlan(root.sitePlan), ...placementsFromOutdoor(root.outdoorAssetPlacements)];
  } catch {
    return [];
  }
}

function parseProceduralOutdoorPlacements(json: string | undefined): OutdoorAssetPlacement[] {
  try {
    const raw = JSON.parse(json ?? "{}") as { outdoorAssetPlacements?: unknown };
    return Array.isArray(raw.outdoorAssetPlacements) ? raw.outdoorAssetPlacements.filter((p): p is OutdoorAssetPlacement =>
      !!p && typeof p === "object" && typeof (p as OutdoorAssetPlacement).assetId === "string" && (p as OutdoorAssetPlacement).assetId.startsWith("procedural-v2-")
    ) : [];
  } catch { return []; }
}

export function HouseRenderer() {
  const params = useParams<{ projectId: string }>();
  const houseConfigJson = useProjectStore(
    (s) => s.getProject(params.projectId)?.houseConfigJson
  );
  const architecturalView = useProjectStore(s => s.getProject(params.projectId)?.architecturalView) ?? DEFAULT_ARCHITECTURAL_VIEW;
  const frozen = useRenderFlightStore((s) => s.frozen);
  const viewed = useRenderFlightStore((s) => s.viewed);
  const recordFlight = useRenderFlightStore((s) => s.record);
  const noteRenderWriter = useRenderFlightStore((s) => s.noteWrite);
  const lastWriter = useRenderFlightStore((s) => s.lastWriter);
  const showRoof = useSceneStore((s) => s.showRoof);
  const cutawayLevel = useSceneStore((s) => s.cutawayLevel);
  const architectureDebug = useSceneStore((s) => s.architectureDebug);
  const geometryXRay = useSceneStore((s) => s.geometryXRay);
  const isolateMassId = useSceneStore((s) => s.isolateArchitectureMassId);
  const v2OnlyMode = useSceneStore((s) => s.v2OnlyMode);
  const v3TerrainDebug = useSceneStore((s) => s.v3TerrainDebug);
  const v3Diagnostics = useSceneStore((s) => s.v3Diagnostics);
  const failedPreview = useV3FailedPreviewStore((s) => s.candidate);
  const previewActive = useV3FailedPreviewStore((s) => s.active);
  const cameraSource = useV3RenderIdentityStore(s => s.cameraSource);
  const setV3RenderIdentity = useV3RenderIdentityStore((s) => s.setIdentity);
  const clearV3RenderIdentity = useV3RenderIdentityStore((s) => s.clearIdentity);
  const priorBranch = useRef<"v2" | "v3" | "v3-preview" | "legacy" | null>(null);
  useEffect(() => { noteRenderWriter("HouseRenderer-mount-or-fast-refresh"); }, [noteRenderWriter]);

  const candidateJson = frozen?.configJson ?? viewed?.configJson ?? houseConfigJson;
  const activeV3Source = useMemo(() => resolveActiveV3RenderSource({
    projectId: params.projectId,
    persistedJson: houseConfigJson,
    rendererJson: candidateJson,
    historyActive: !!(frozen ?? viewed),
    historyProjectId: (frozen ?? viewed)?.projectId,
    failedPreviewCandidate: failedPreview,
    failedPreviewActive: previewActive,
  }), [failedPreview, houseConfigJson, params.projectId, previewActive, candidateJson, frozen, viewed]);
  const renderJson = activeV3Source.source === "persisted" ? houseConfigJson : activeV3Source.source === "failed-preview" ? JSON.stringify({ version: 3, generationMode: "v3-scene", v3Scene: activeV3Source.scene }) : candidateJson;
  const previewScene = activeV3Source.source === "failed-preview" ? activeV3Source.scene : undefined;
  const { model, site, document, violations, compilerInputHash } = useMemo(() => {
    try {
      // The recovery parser has already admitted only compiler-safe fields.
      // Do not re-run strict validation here: previewing is explicitly the
      // visual inspection path for a scene that failed that contract.
      if (activeV3Source.scene) {
        // Every V3 compile, including a non-persisted failed preview, receives
        // the one source selected above. Preview recovery already guarantees
        // compiler-safe fields; persisted/history scenes retain lenient checks.
        if (activeV3Source.source !== "failed-preview") {
          const valid = validateV3Scene(activeV3Source.scene, { lenient: true });
          // A supported architectural draft can carry a local fatal finding in
          // the strict scene audit. Recompute acceptance; metadata alone cannot
          // authorize rendering broken primary geometry or stale diagnostics.
          if (!valid.ok && !(activeV3Source.scene.metadata.architecturalValidation && revalidateArchitecturalScene(activeV3Source.scene).ok)) return { compilerInputHash: undefined, model: null, site: null, document: undefined, violations: [] as V2OnlyViolation[] };
        }
        return { compilerInputHash: auditHash(activeV3Source.scene), model: applyV3RenderDiagnostics(compileV3Scene(architecturalView.mode === "massing" ? v3ArchitecturalMassingScene(activeV3Source.scene) : activeV3Source.scene, { debug: v3TerrainDebug }), activeV3Source.scene, v3Diagnostics), site: null, document: undefined, violations: [] as V2OnlyViolation[] };
      }
      const raw = JSON.parse(renderJson ?? "{}");
      const document = raw.architecturalDesignDocument ?? raw.architectureDocument;
      if (isArchitecturalDesignDocument(document)) {
        const legacy = generateHouseFromJson(renderJson ?? "{}");
        const materials = legacy.site?.materials ?? DEFAULT_MATERIALS_CONFIG;
        const architecture = compileArchitecture(document, { materials, mode: architectureDebug }).model;
        const plan = v2SitePlanOf(raw);
        const v2Model = { ...architecture, primitives: [...architecture.primitives, ...(plan ? compileV2SiteFeatures(plan, materials) : [])] };
        const resolved = applyV2OnlyMode({ legacy, v2Model, v2OnlyMode, cutawayActive: cutawayLevel !== null });
        return { ...resolved, document, compilerInputHash: undefined };
      }
    } catch { /* legacy generator exposes JSON errors normally */ }
    return { compilerInputHash: undefined, ...generateHouseFromJson(renderJson ?? "{}"), document: undefined, violations: [] as V2OnlyViolation[] };
  }, [activeV3Source, architecturalView.mode, architectureDebug, renderJson, v2OnlyMode, cutawayLevel, v3TerrainDebug, v3Diagnostics]);
  const v3RenderIdentity = useMemo(() => {
    return buildV3RenderIdentity({
      projectId: params.projectId,
      observedCompilerInputHash: compilerInputHash ?? null,
      cameraSource,
      persistedJson: houseConfigJson,
      rendererJson: renderJson,
      failedPreviewScene: previewScene,
      failedPreviewActive: previewActive,
      renderHistoryOverrideActive: !!(frozen ?? viewed),
      renderHistorySource: frozen?.source ?? viewed?.source,
      historyProjectId: (frozen ?? viewed)?.projectId,
      fixtureDebugOverrideActive: geometryXRay || !!isolateMassId || v2OnlyMode || v3TerrainDebug || Object.values(v3Diagnostics).some(Boolean),
    });
  }, [cameraSource, previewActive, compilerInputHash, frozen, geometryXRay, houseConfigJson, isolateMassId, params.projectId, previewScene, renderJson, v2OnlyMode, v3Diagnostics, v3TerrainDebug, viewed]);
  useEffect(() => {
    if (!v3RenderIdentity) return;
    setV3RenderIdentity(v3RenderIdentity);
    return () => clearV3RenderIdentity(params.projectId);
  }, [clearV3RenderIdentity, params.projectId, setV3RenderIdentity, v3RenderIdentity]);
  useEffect(() => {
    violations.forEach(logV2OnlyViolation);
  }, [violations]);
  const branch = useMemo(() => {
    if (previewScene) return "v3-preview";
    try { return isV3ProjectRoot(JSON.parse(renderJson ?? "{}")) ? "v3" : document ? "v2" : "legacy"; } catch { return "legacy"; }
  }, [document, previewScene, renderJson]);
  const configRevision = revisionOf(renderJson ?? "{}");
  const audit = document ? documentAudit(document) : undefined;
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" && priorBranch.current && priorBranch.current !== branch) console.warn("[V2 RENDER] branch-switch", { from: priorBranch.current, to: branch, configRevision });
    priorBranch.current = branch;
  }, [branch, configRevision]);

  // Render-time finishing: a small bevel on trim-like boxes the design's tier left sharp (the model itself is unchanged).
  const finished = useMemo(() => (model ? applyEdgeDetail(model.primitives, RENDER_BASE_BEVEL) : []), [model]);
  const isolated = useMemo(() => isolateMassId ? finished.filter((p) => p.id.startsWith(`architecture-${isolateMassId}-`)) : finished, [finished, isolateMassId]);

  // Stepping into a room hides the roof and whatever would block the view of it; the model is untouched.
  const cutaway = useMemo(
    () => (site && cutawayLevel !== null ? cutawayHiddenIds(isolated, site.house, cutawayLevel) : null),
    [isolated, site, cutawayLevel]
  );

  // Library GLBs for features that reference one. A placement counts only while its asset is approved in the
  // catalog; the model swaps in once loaded, and until then (or if it never loads) the procedural feature draws.
  const catalog = useAssetStore((s) => s.catalog);
  const placements = useMemo(() => parsePlacements(renderJson), [renderJson]);
  const proceduralOutdoor = useMemo(() => parseProceduralOutdoorPlacements(renderJson), [renderJson]);
  const usable = useMemo(() => usablePlacements(placements, catalog), [placements, catalog]);
  const [checked, setChecked] = useState<{placements: readonly AssetPlacement[]; blocked: Set<string>} | null>(null);
  useEffect(() => {
    let active = true;
    void loadPlacedAssets(params.projectId, placements, usable).then(blocked => { if (active) setChecked({placements,blocked}); });
    return () => {active=false;};
  }, [usable, placements, params.projectId]);
  useGlbCacheVersion(); // re-render as any model finishes loading
  const replaced = replacedFeatureIds(usable, (id) => glbModels.status(id));
  const swapped = usable.filter((p) => replaced.has(p.featureId) && (p.kind || (checked?.placements === placements && !checked.blocked.has(p.featureId))) && (!p.supportId || replaced.has(p.supportId)));
  const replacedPrefixes = swapped.map((p) => `${p.featureId}-`);

  const surfaces = useMemo(
    () => isolated.map((p) => surfaceOf(p, site?.materials)),
    [isolated, site?.materials]
  );
  const pbrDefs = useMemo(() => {
    const defs = new Set<PbrSetDef>();
    for (const surface of surfaces) {
      const def = surface && SURFACE_PBR[surface];
      if (def) defs.add(def);
    }
    return [...defs];
  }, [surfaces]);
  const pbrReady = usePbrReady(pbrDefs);
  const mounted = useRef(new Map<string, RenderedMeshAudit>());
  const onAuditMesh = useCallback((entry: RenderedMeshAudit) => { mounted.current.set(entry.id, entry); }, []);
  useEffect(() => {
    if (process.env.NODE_ENV === "production" || !document) return;
    const byKind = Object.fromEntries(["box", "triMesh"].map((kind) => [kind, isolated.filter((p) => p.kind === kind).length]));
    const representedMassIds = [...new Set(isolated.map(massIdOf).filter(Boolean))];
    console.info("[V2 RENDER]", { configRevision, documentHash: audit!.hash, compiledPrimitiveCount: isolated.length, primitiveCountsByType: byKind, massIds: representedMassIds, bounds: primitiveBounds(isolated), signatures: isolated.map(primitiveSignature) });
    queueMicrotask(() => {
      const meshes = [...mounted.current.values()];
      const expected = new Set(isolated.map(primitiveSignature));
      const actual = new Set(meshes.map((m) => m.signature));
      console.info("[V2 R3F]", { configRevision, meshCount: meshes.length, missing: [...expected].filter((s) => !actual.has(s)), unexpected: [...actual].filter((s) => !expected.has(s)), meshes });
    });
  }, [audit, configRevision, document, isolated]);
  useEffect(() => {
    if (process.env.NODE_ENV === "production" || !document || !lastWriter.startsWith("ai-")) return;
    console.info("[EDIT RENDER]", { configRevision, documentHash: audit!.hash, writer: lastWriter, primitiveCount: isolated.length, primitiveHash: auditHash(isolated.map(primitiveSignature)), bounds: primitiveBounds(isolated) });
  }, [audit, configRevision, document, isolated, lastWriter]);
  useEffect(() => {
    if (process.env.NODE_ENV === "production" || !model) return;
    recordFlight({ projectId: params.projectId, configJson: renderJson ?? "{}", configHash: auditHash(renderJson ?? "{}"), documentHash: audit?.hash, v2: !!document, primitiveCount: isolated.length, primitiveHash: auditHash(isolated.map(primitiveSignature)), massIds: [...new Set(isolated.map(massIdOf).filter((id): id is string => !!id))], bounds: primitiveBounds(isolated) }, frozen ? "frozen" : viewed ? "viewed" : "live-render");
  }, [audit?.hash, document, frozen, isolated, model, params.projectId, recordFlight, renderJson, viewed]);

  const blueprint = !!activeV3Source.scene && (architecturalView.mode === "blueprint" || architecturalView.mode === "massing");
  const sectionPlanes = useMemo(() => {
    const scene = activeV3Source.scene;
    if (!scene || !blueprint || architecturalView.mode === "massing" || !architecturalView.cutaway) return new Map<string, THREE.Plane[]>();
    return new Map(scene.objects.filter(o => o.type === "building-mass").map(o => {
      const y = planningSectionY(scene, o.id, architecturalView.floor ?? 0);
      return [o.id, [new THREE.Plane(new THREE.Vector3(0, -1, 0), y ?? -10000)]];
    }));
  }, [activeV3Source.scene, blueprint, architecturalView.cutaway, architecturalView.floor, architecturalView.mode]);

  if (!model || (!blueprint && !pbrReady)) return null;

  const isVisible = (p: HousePrimitive) =>
    ((blueprint ? architecturalView.mode !== "massing" && !architecturalView.cutaway : showRoof) || p.category !== "roof") && (!geometryXRay || p.category !== "roof") && !cutaway?.has(p.id) && !replacedPrefixes.some((prefix) => p.id.startsWith(prefix));

  return (
    <group>
      {isolated.map((primitive, i) =>
        isVisible(primitive) ? <PrimitiveMesh key={primitive.id} primitive={primitive} surface={surfaces[i]} xRay={geometryXRay} onAuditMesh={onAuditMesh} readOnly={!!activeV3Source.scene && activeV3Source.source !== "persisted"} blueprint={blueprint ? { clippingPlanes: sectionPlanes.get(planningHostId(activeV3Source.scene!, primitive) ?? "") } : undefined} /> : null
      )}
      {swapped.map((p) => (
        <GlbFeature key={p.featureId} placement={p} projectId={params.projectId} footprint={catalog.find((a) => a.id === p.assetId)?.validation?.footprint} />
      ))}
      {proceduralOutdoor.map((placement) => <ProceduralOutdoorPlaceholder key={placement.id} placement={placement} />)}
      {activeV3Source.scene && !blueprint && !geometryXRay && !isolateMassId && !v3Diagnostics.hideTerrain && <V3Vegetation scene={activeV3Source.scene} />}
    </group>
  );
}
