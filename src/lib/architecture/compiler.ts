import type { HouseModel, HousePrimitive } from "@/lib/house/types";
import { generateHouseModel } from "@/lib/house/generateHouse";
import { rotatePrimitiveY, translatePrimitive } from "@/lib/house/primitiveBuilders";
import { resolveMaterial } from "@/lib/house/materials";
import { buildFlatRoof } from "@/lib/house/roof/flatRoof";
import { buildShedRoof } from "@/lib/house/roof/shedRoof";
import { buildGableRoof } from "@/lib/house/roof/gableRoof";
import { buildHipRoof } from "@/lib/house/roof/hipRoof";
import { buildButterflyRoof } from "@/lib/house/roof/butterflyRoof";
import { buildRoofExpression } from "@/lib/house/roof/expression";
import { LEVEL_HEIGHT } from "@/lib/house/constants";
import type { RoofType } from "@/types/house";
import type { ArchitecturalDesignDocument, ArchitectureCompileOptions, MassRole, MassVolume, RoofRecipe, RoofRecipeKind } from "./document";
import { validateArchitecturalDesignDocument } from "./document";
import "@/lib/capabilities/plugins";
import { requestCapability } from "@/lib/capabilities/engine";
import type { CapabilityOutcome } from "@/lib/capabilities/types";

/** Additive, dev-diagnostics-only view of a compile: never required by rendering. */
export interface ArchitectureDiagnostics {
  massCount: number;
  masses: { id: string; name: string; role: MassRole; position: { x: number; z: number }; rotation: number; elevation: number }[];
  roofs: { massId: string; kind: RoofRecipeKind }[];
  capabilities: { id: string; massId: string; status: CapabilityOutcome["status"]; note?: string }[];
}

function resolveMasses(doc: ArchitecturalDesignDocument): MassVolume[] {
  const byId = new Map<string, MassVolume>();
  for (const source of doc.massing.masses) {
    const mass = { ...source, position: { ...source.position } };
    for (const rel of mass.relationships ?? []) {
      const target = byId.get(rel.target); if (!target) continue;
      const distance = rel.distance ?? 0;
      if (rel.kind === "stepped-above") mass.elevation = target.elevation + distance;
      if (rel.kind === "stepped-below") mass.elevation = target.elevation - distance;
      if (["adjacent-to", "connected-to", "offset-from", "separated-from", "bridge-between"].includes(rel.kind) && rel.side) {
        const gap = rel.kind === "connected-to" ? 0 : distance;
        if (rel.side === "east") mass.position.x = target.position.x + target.width / 2 + mass.width / 2 + gap;
        if (rel.side === "west") mass.position.x = target.position.x - target.width / 2 - mass.width / 2 - gap;
        if (rel.side === "north") mass.position.z = target.position.z - target.depth / 2 - mass.depth / 2 - gap;
        if (rel.side === "south") mass.position.z = target.position.z + target.depth / 2 + mass.depth / 2 + gap;
      }
      if (rel.rotationOffset !== undefined) mass.rotation = target.rotation + rel.rotationOffset;
    }
    byId.set(mass.id, mass);
  }
  return [...byId.values()];
}

function roofPrimitives(recipe: RoofRecipe, mass: MassVolume, options: ArchitectureCompileOptions): HousePrimitive[] {
  const exterior = resolveMaterial(options.materials.exterior); const roof = resolveMaterial(options.materials.roof);
  const base = mass.elevation + mass.floors * LEVEL_HEIGHT;
  const prefix = `architecture-${mass.id}-roof`;
  const kind = recipe.kind === "mono-pitch" ? "shed" : recipe.kind === "pavilion" ? "hip" : recipe.kind;
  let out: HousePrimitive[];
  // Flat recipes share a parameterized plane, fascia, soffit and closure assembly.
  if (kind === "flat" || kind === "floating-flat") out = buildRoofExpression({
    id: prefix, width: mass.width, depth: mass.depth, wallPlateY: base, roofMaterial: roof, exteriorMaterial: exterior,
    parameters: { ...recipe.expression, overhang: recipe.overhang ?? recipe.expression?.overhang, verticalGap: kind === "floating-flat" ? recipe.expression?.verticalGap ?? .18 : recipe.expression?.verticalGap },
  });
  else if (kind === "shed") out = buildShedRoof(mass.width, mass.depth, base, prefix, roof, exterior);
  else if (kind === "gable" || kind === "cross-gable") out = buildGableRoof(mass.width, mass.depth, base, prefix, roof, exterior);
  else if (kind === "hip") out = buildHipRoof(mass.width, mass.depth, base, prefix, roof, exterior);
  else if (kind === "butterfly") out = buildButterflyRoof(mass.width, mass.depth, base, prefix, roof, exterior);
  else out = buildFlatRoof(mass.width, mass.depth, base, prefix, roof, exterior);
  const yaw = mass.rotation + (recipe.orientation ?? 0);
  return out.map((p) => rotatePrimitiveY(translatePrimitive(p, mass.position.x, mass.position.z), mass.position.x, mass.position.z, yaw));
}

export function compileArchitecture(doc: ArchitecturalDesignDocument, options: ArchitectureCompileOptions): { model: HouseModel; errors: string[]; diagnostics?: ArchitectureDiagnostics } {
  const errors = validateArchitecturalDesignDocument(doc); if (errors.length) return { model: { id: "architecture-invalid", primitives: [] }, errors };
  const masses = resolveMasses(doc); const primitives: HousePrimitive[] = [];
  const capabilityDiagnostics: ArchitectureDiagnostics["capabilities"] = [];
  for (const mass of masses) {
    if (options.mode !== "roofs-only") {
      const shell = generateHouseModel({ width: mass.width, depth: mass.depth, floors: mass.floors, roof: "flat" }, options.materials)
        .filter((p) => p.category !== "roof")
        .map((p) => ({ ...p, id: `architecture-${mass.id}-${p.id}`, label: `${mass.name}: ${p.label}` }));
      primitives.push(...shell.map((p) => {
        const lifted = p.kind === "box" ? { ...p, position: [p.position[0], p.position[1] + mass.elevation, p.position[2]] as [number, number, number] } : { ...p, vertices: p.vertices.map((v, i) => i % 3 === 1 ? v + mass.elevation : v) };
        return rotatePrimitiveY(translatePrimitive(lifted, mass.position.x, mass.position.z), mass.position.x, mass.position.z, mass.rotation);
      }));
      // A compact marker makes mass-only inspection readable without a special renderer.
      if (options.mode === "massing-only") primitives.push({ kind: "box", id: `architecture-${mass.id}-debug-footprint`, category: "floor", label: `${mass.name} · rot ${(mass.rotation * 180 / Math.PI).toFixed(0)}° · elev ${mass.elevation}m`, position: [mass.position.x, mass.elevation + 0.025, mass.position.z], rotation: [0, mass.rotation, 0], size: [mass.width, 0.05, mass.depth], color: "#ff9d2e", roughness: .65 });
    }
    if (options.mode !== "massing-only") for (const recipe of doc.roofs.recipes.filter((r) => r.massId === mass.id)) primitives.push(...roofPrimitives(recipe, mass, options));
    // Architectural stages declare intent. Only the capability engine chooses and invokes geometry plugins.
    for (const intent of doc.capabilities?.filter((request) => request.parameters?.massId === mass.id) ?? []) {
      const outcome = requestCapability(intent, { primitives, target: mass });
      primitives.push(...outcome.primitives);
      capabilityDiagnostics.push({ id: outcome.id, massId: mass.id, status: outcome.status, note: outcome.note });
    }
  }
  const diagnostics: ArchitectureDiagnostics = {
    massCount: masses.length,
    masses: masses.map((m) => ({ id: m.id, name: m.name, role: m.role, position: m.position, rotation: m.rotation, elevation: m.elevation })),
    roofs: doc.roofs.recipes.map((r) => ({ massId: r.massId, kind: r.kind })),
    capabilities: capabilityDiagnostics,
  };
  return { model: { id: "architectural-design-document", primitives }, errors: [], diagnostics };
}

/** Compatibility projection intentionally selects a primary mass; it does not flatten the new composition. */
export function projectArchitectureToLegacy(doc: ArchitecturalDesignDocument): Record<string, unknown> {
  const main = doc.massing.masses.find((m) => m.role === "main-living") ?? doc.massing.masses[0];
  const recipe = doc.roofs.recipes.find((r) => r.massId === main?.id);
  const map: Record<string, RoofType> = { flat: "flat", "floating-flat": "flat", shed: "shed", "mono-pitch": "shed", gable: "gable", hip: "hip", butterfly: "butterfly", pavilion: "hip", "cross-gable": "gable", mixed: "flat" };
  return { house: { width: main?.width ?? 10, depth: main?.depth ?? 8, floors: main?.floors ?? 1, roof: map[recipe?.kind ?? "flat"] }, architectureDocument: doc };
}
