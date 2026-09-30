import type { CompassSide } from "@/types/house";
import type { MassRole, MassVolume, RoofRecipe, SiteStrategy, VolumePlan } from "../document";
import { mandatoryBaseline } from "../planBaseline";
import { localFacadeToward } from "../volumePlan";
import type { GeometryOperationOutput } from "../stages/schemas";

/**
 * Test-only authored inputs. Production has no role-based plan defaults any more (a missing plan field is a
 * repair request to the architect), so a test that needs "what an architect would plan for this kind of volume"
 * authors it explicitly from here — exactly as a stage response would.
 */

/** A complete authored plan that asks for no geometry at all: a plain, closed volume. */
export const QUIET_PLAN: VolumePlan = {
  form: "bar", height: "standard", hierarchy: "supporting", viewFacade: "solid", arrivalFacade: "solid", flankFacades: "solid",
  entry: "none", outdoor: "none", outdoorSide: "view", roofEdge: "thin-eave", structure: "bearing-walls",
};

/** One complete, characteristic authored plan per role. */
export const ROLE_PLAN_FIXTURES: Record<MassRole, VolumePlan> = {
  "main-living": { form: "bar", height: "standard", hierarchy: "dominant", viewFacade: "framed-glass", arrivalFacade: "solid", flankFacades: "shaded-glass", courtyardFacade: "glass-wall", entry: "canopied", outdoor: "covered-terrace", outdoorSide: "view", roofEdge: "deep-eave", structure: "post-and-beam" },
  "bedroom-wing": { form: "bar", height: "standard", hierarchy: "supporting", viewFacade: "shaded-glass", arrivalFacade: "slot", flankFacades: "solid", courtyardFacade: "glass-wall", entry: "none", outdoor: "none", outdoorSide: "view", roofEdge: "thin-eave", structure: "bearing-walls" },
  "guest-pavilion": { form: "bar", height: "standard", hierarchy: "supporting", viewFacade: "glass-wall", arrivalFacade: "punched", flankFacades: "solid", courtyardFacade: "glass-wall", entry: "flush", outdoor: "veranda", outdoorSide: "view", roofEdge: "deep-eave", structure: "post-and-beam" },
  garage: { form: "bar", height: "low", hierarchy: "recessive", viewFacade: "solid", arrivalFacade: "solid", flankFacades: "solid", entry: "flush", outdoor: "none", outdoorSide: "view", roofEdge: "parapet", structure: "bearing-walls" },
  service: { form: "bar", height: "low", hierarchy: "recessive", viewFacade: "punched", arrivalFacade: "punched", flankFacades: "solid", entry: "flush", outdoor: "none", outdoorSide: "view", roofEdge: "parapet", structure: "bearing-walls" },
  connector: { form: "bar", height: "low", hierarchy: "recessive", viewFacade: "glass-wall", arrivalFacade: "glass-wall", flankFacades: "solid", entry: "none", outdoor: "colonnade", outdoorSide: "view", roofEdge: "thin-eave", structure: "post-and-beam" },
  terrace: { form: "bar", height: "low", hierarchy: "recessive", viewFacade: "glass-wall", arrivalFacade: "solid", flankFacades: "solid", entry: "none", outdoor: "colonnade", outdoorSide: "view", roofEdge: "deep-eave", structure: "post-and-beam" },
  veranda: { form: "bar", height: "low", hierarchy: "recessive", viewFacade: "glass-wall", arrivalFacade: "solid", flankFacades: "solid", entry: "none", outdoor: "colonnade", outdoorSide: "view", roofEdge: "deep-eave", structure: "post-and-beam" },
  entry: { form: "bar", height: "lofty", hierarchy: "supporting", viewFacade: "glass-wall", arrivalFacade: "solid", flankFacades: "solid", entry: "canopied", outdoor: "none", outdoorSide: "view", roofEdge: "thin-eave", structure: "post-and-beam" },
};

export const authoredPlan = (role: MassRole, overrides: Partial<VolumePlan> = {}): VolumePlan => ({ ...ROLE_PLAN_FIXTURES[role], ...overrides });

/** A complete authored roof recipe. */
export const authoredRoof = (massId: string, overrides: Partial<RoofRecipe> = {}): RoofRecipe => ({ id: `${massId}-roof`, massId, kind: "flat", overhang: 0.3, pitch: 2, ...overrides });

/**
 * What a well-behaved architect returns from the Geometry Pass when it takes the plan's reference placement for
 * everything the Geometry Pass owns — the form move and the outdoor room — in that stage's own vocabulary. The
 * mandatory baseline (glazing, windows, the entry and its door, the plan's canopy/screens/fins/pilotis) is already
 * built and is deliberately NOT repeated here.
 */
export function referenceGeometry(mass: MassVolume, masses: readonly MassVolume[], site: SiteStrategy): GeometryOperationOutput[] {
  return mandatoryBaseline(mass, masses, site).reference.map((op): GeometryOperationOutput => (op.type === "chamfer" ? { type: "chamfer", corner: op.corner, width: op.size, ...(op.glazed ? { glazed: true } : {}) } : { ...op } as GeometryOperationOutput));
}

/** A copy of one mandatory baseline element in the Geometry Pass vocabulary — what a model that re-authors the baseline would return. */
export function baselineAsOperations(mass: MassVolume, masses: readonly MassVolume[], site: SiteStrategy): GeometryOperationOutput[] {
  const local = (side: unknown) => localFacadeToward(side as CompassSide, mass.rotation);
  return mandatoryBaseline(mass, masses, site).elements.flatMap((e): GeometryOperationOutput[] => {
    if (e.kind !== "capability") {
      const value = { ...e.value } as { id?: string } & GeometryOperationOutput;
      delete value.id;
      return [value];
    }
    const p = (e.value.parameters ?? {}) as Record<string, number>;
    if (e.value.id === "entry-canopy") return [{ type: "canopy", facade: local(p.facade), width: p.width, depth: p.depth, height: p.height }];
    if (e.value.id === "screen-layer") return [{ type: "screen", facade: local(p.facade), start: p.start, end: p.end, depth: p.depth }];
    if (e.value.id === "brise-soleil") return [{ type: "sun-fins", facade: local(p.facade), count: p.count, depth: p.depth, sill: p.sill }];
    return [];
  });
}
