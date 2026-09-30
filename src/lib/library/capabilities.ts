import type { ArchitecturalCapability, CapabilityCategory, CapabilityNeed, CapabilityRequest, CapabilityStatus, DesignRecipe } from "@/types/library";
import "@/lib/capabilities/plugins";
import { capabilityPlugins } from "@/lib/capabilities/engine";

const now = "2026-01-01T00:00:00.000Z";
type Seed = Omit<ArchitecturalCapability, "usageCount" | "successCount" | "failureCount" | "created_at" | "updated_at">;
const cap = (id: string, name: string, category: CapabilityCategory, status: CapabilityStatus, implementationNotes: string, parameters: string[] = [], constraints: string[] = []): Seed => ({
  id, name, category, status, description: name, parameters: parameters.map((key) => ({ key })), constraints,
  compatibleMassTypes: ["house", "wing", "pavilion"], version: 1, implementationNotes,
});

/** Audited against the current operation schema and procedural renderers. Unsupported entries are intentionally explicit. */
const SEEDS: Seed[] = [
  cap("native-vegetation", "Vegetation / Tree", "asset-generation", "partial", "Deterministic primitives can make a simple stylized trunk-and-canopy approximation; organic fidelity remains external.", ["height", "canopyRadius"]),
  cap("native-seating", "Seating", "asset-generation", "supported", "Parameterized chairs, stools, benches and loungers."),
  cap("native-tables", "Tables", "asset-generation", "supported", "Parameterized dining and side tables."),
  cap("native-lighting", "Lighting", "asset-generation", "supported", "Parameterized lamps and pendant lights."),
  cap("native-planters", "Planters", "asset-generation", "supported", "Parameterized pots and planters."),
  cap("native-umbrellas", "Umbrellas", "asset-generation", "supported", "Parameterized umbrella and parasol primitives."),
  cap("native-railings", "Railings", "asset-generation", "partial", "Tube and slat approximations are supported; architectural railings remain architecture capabilities."),
  cap("split-mass", "Split Mass", "massing", "supported", "Uses independently placed wing buildings.", ["width", "depth", "offset"]),
  cap("rotate-mass", "Rotate Mass", "massing", "supported", "Detached wings accept a vertical rotation.", ["rotation"], ["Main house cannot rotate"]),
  cap("offset-mass", "Offset Mass", "massing", "supported", "Wings can be placed at site coordinates.", ["x", "z"]),
  cap("step-mass", "Step Mass", "massing", "partial", "Separate masses can step across a site; a single stepped shell cannot be carved.", ["rise", "offset"]),
  cap("bridge-masses", "Bridge Masses", "massing", "supported", "Plugin: a procedural deck+roof corridor between two resolved, separated masses.", ["massId", "secondaryMassId", "width", "height"]),
  cap("cantilever-volume", "Cantilever Volume", "massing", "supported", "A mass's upper floors can cantilever a declared distance along a declared side.", ["direction", "distance"]),
  cap("courtyard-composition", "Courtyard Composition", "massing", "partial", "Site planning can arrange wings around outdoor space but does not cut a courtyard from one shell."),
  cap("recess-wall", "Recess Wall", "walls", "missing", "Walls are rectangular shell faces."),
  cap("project-wall", "Project Wall", "walls", "missing", "No per-wall projection operation."),
  cap("feature-wall", "Feature Wall", "walls", "partial", "Facade materials and wall-mounted features provide a visual substitute."),
  cap("curved-wall", "Curved Wall", "walls", "partial", "Curved/round bay forms exist; arbitrary curved walls do not."),
  cap("floating-wall", "Floating Wall", "walls", "missing", "No detached wall geometry."),
  cap("courtyard-cut", "Courtyard Cut", "voids", "missing", "No boolean cut in the main shell."),
  cap("courtyard-edge-wall", "Courtyard Edge Wall", "voids", "supported", "Plugin: a low garden wall along a mass's courtyard-facing edge, without a boolean cut.", ["massId", "side", "height", "thickness"]),
  cap("atrium", "Atrium", "voids", "missing", "No interior void operation."), cap("light-well", "Light Well", "voids", "missing", "No shaft cut operation."),
  cap("double-height-void", "Double-height Void", "voids", "missing", "Floors cannot be removed selectively."), cap("breezeway", "Breezeway", "voids", "supported", "Bridge Masses connects separated wings with a real corridor; recess/projection with open:true adds a colonnade/veranda breezeway along one mass's own edge.", ["massId", "secondaryMassId"]),
  cap("deep-overhang", "Deep Overhang", "roofs", "supported", "Shared Roof Expression geometry parameterizes eave projection per mass.", ["overhang"]),
  cap("floating-roof", "Floating Roof", "roofs", "supported", "Shared Roof Expression builds elevated planes and a closed reveal assembly." , ["verticalGap", "overhang", "thickness", "fasciaDepth", "supportStyle", "soffitMaterial"]),
  cap("roof-offset", "Roof Offset", "roofs", "supported", "Shared Roof Expression offsets a roof plane from its mass datum.", ["horizontalOffset"]), cap("roof-extension", "Roof Extension", "roofs", "partial", "Porches provide covered extensions; roof planes cannot extend independently."),
  cap("split-roof", "Split Roof", "roofs", "supported", "Shared Roof Expression coordinates primary and secondary roof planes on one mass.", ["secondary"]), cap("clerestory-roof", "Clerestory Roof", "roofs", "supported", "Shared Roof Expression builds a raised roof with a recessed architectural glazing band.", ["verticalGap", "clerestoryHeight"]),
  cap("curved-roof", "Curved Roof", "roofs", "missing", "No curved roof form."), cap("barrel-roof", "Barrel Roof", "roofs", "missing", "No barrel roof form."),
  cap("corner-glazing", "Corner Glazing", "openings", "supported", "Plugin: procedural glazing panels and shared corner mullion.", ["massId", "corner", "width", "height", "sill"]),
  cap("ribbon-glazing", "Ribbon Glazing", "openings", "partial", "Multiple aligned windows approximate a ribbon; continuous structural opening is unavailable."),
  cap("recessed-entry", "Recessed Entry", "openings", "supported", "The entry-recess footprint operation carves a real recess into the shell at the arrival facade.", ["facade", "width", "depth"]),
  cap("entry-canopy", "Entry Canopy", "facade", "supported", "Plugin: a freestanding roof-only canopy with two posts, projecting from one facade.", ["massId", "facade", "width", "depth", "height"]),
  cap("projecting-portal", "Projecting Portal", "facade", "partial", "Porches and bays supply a constrained projecting frame."),
  cap("framed-opening", "Framed Opening", "openings", "supported", "glazing-zone's frame field adds a structural post/lintel surround around the glazing.", ["frame", "reveal"]),
  cap("screen-layer", "Screen Layer", "facade", "supported", "Plugin: a batten screen standing proud of one facade, turned with the mass.", ["massId", "facade", "start", "end", "depth", "height"]),
  cap("brise-soleil", "Brise Soleil", "facade", "supported", "Plugin: evenly spaced vertical sun-shading fins standing proud of one facade.", ["massId", "facade", "count", "depth", "height"]),
  cap("shadow-gap", "Shadow Gap", "facade", "supported", "Shared Roof Expression creates a reusable roof-to-wall reveal assembly.", ["verticalGap", "supportStyle"]),
  cap("pilotis", "Pilotis", "structure", "supported", "Plugin: exposed structural columns lifting an already-elevated mass clear of grade.", ["massId", "columnSize", "inset", "groundY"]),
  cap("carve-terrace", "Carve Terrace", "terraces", "supported", "recess/projection with open:true carves a real covered terrace/outdoor room into the mass's own footprint and roofline.", ["open", "postSpacing"]),
  cap("balcony", "Balcony", "terraces", "supported", "Wall-mounted balconies with railings are procedural.", ["wall", "level", "width", "depth"]),
  cap("roof-terrace", "Roof Terrace", "terraces", "missing", "No accessible flat-roof terrace assembly."), cap("sunken-lounge", "Sunken Lounge", "terraces", "missing", "No terrain or deck excavation operation."),
];

const pluginMetadata = new Map(capabilityPlugins().map((plugin) => [plugin.metadata.id, plugin.metadata]));
export const INITIAL_CAPABILITIES: ArchitecturalCapability[] = SEEDS.map((x) => {
  const plugin = pluginMetadata.get(x.id);
  return { ...x, domain: x.category === "asset-generation" ? "native-asset" : "architecture", ...(plugin ? { name: plugin.name, category: plugin.category, status: plugin.status, description: plugin.description, parameters: plugin.parameters, constraints: plugin.constraints, version: plugin.version, implementationNotes: plugin.implementationNotes, visualImpact: plugin.visualImpact, implementationDifficulty: plugin.implementationDifficulty, performanceCost: plugin.performanceCost, architecturalImportance: plugin.architecturalImportance } : {}), usageCount: 0, successCount: 0, failureCount: 0, created_at: now, updated_at: now };
});
const aliases: Record<string, string> = { "raised floating roof plane": "floating-roof", "roof with shadow gap": "floating-roof", "floating roof plane": "floating-roof", "rotate wing": "rotate-mass", "rotate mass": "rotate-mass", "courtyard villa": "courtyard-composition", "corner glass": "corner-glazing", "deep eaves": "deep-overhang" };
export function normalizeCapability(text: string): string | undefined {
  const clean = text.toLowerCase().trim().replace(/[_.]/g, "-").replace(/\s+/g, " ");
  if (aliases[clean]) return aliases[clean];
  return INITIAL_CAPABILITIES.find((c) => c.id === clean || c.name.toLowerCase() === clean || c.name.toLowerCase().replace(/\s+/g, "-") === clean)?.id;
}
export function capabilityById(id: string, stored: readonly ArchitecturalCapability[] = []): ArchitecturalCapability | undefined { return stored.find((c) => c.id === id) ?? INITIAL_CAPABILITIES.find((c) => c.id === id); }
export function capabilityRequestsForRecipes(recipes: readonly DesignRecipe[]): CapabilityRequest[] {
  return recipes.flatMap((r) => [...(r.requiredCapabilities ?? []), ...(r.preferredCapabilities ?? [])].map((operation) => ({ operation, stage: "recipe", recipeId: r.id })));
}
export function fallbackFor(capability: ArchitecturalCapability): string {
  const fallbacks: Partial<Record<string, string>> = { "corner-glazing": "Use aligned view-side windows on each facade.", "floating-roof": "Use the closest flat or shed roof with its normal fascia.", "shadow-gap": "Use a flush fascia at the wall plate.", "roof-offset": "Center the roof plane on its mass.", "split-roof": "Use one roof plane for the mass.", "clerestory-roof": "Use a closed dark reveal below the roof plane.", "recessed-entry": "Use a sheltered porch at the entry wall.", "courtyard-composition": "Arrange separate wings around an outdoor patio.", "deep-overhang": "Use the renderer's standard roof eaves.", "ribbon-glazing": "Use aligned individual windows.", "carve-terrace": "Use a deck or patio beside the mass.", "brise-soleil": "Leave the facade as plain glazing/wall without shading fins.", "pilotis": "Leave the elevated volume reading as an unsupported cantilever." };
  return fallbacks[capability.id] ?? "Continue with the closest supported massing and facade composition.";
}
export function priorityForNeed(need: Pick<CapabilityNeed, "requestedCount" | "projectRefs" | "recipeIds" | "status">, capability?: ArchitecturalCapability): number {
  const projects = new Set(need.projectRefs.map((x) => x.projectId).filter(Boolean)).size;
  const fallbackPenalty = need.status === "missing" ? 8 : need.status === "partial" ? 4 : 0;
  const visual = capability?.visualImpact ?? 5;
  const importance = capability?.architecturalImportance ?? 5;
  return Math.round((need.requestedCount * 3 + projects * 4 + new Set(need.recipeIds).size * 5 + fallbackPenalty + visual + importance) * 10) / 10;
}
