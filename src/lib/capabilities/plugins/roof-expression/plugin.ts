import { capabilityRegistry } from "../../registry";
import type { CapabilityImplementation, CapabilityMetadata } from "../../types";
import { buildRoofExpression, type RoofExpressionParameters } from "@/lib/house/roof/expression";
import { resolveMaterial } from "@/lib/house/materials";
import { DEFAULT_MATERIALS_CONFIG } from "@/types/house";
import { rotatePrimitiveY, translatePrimitive } from "@/lib/house/primitiveBuilders";
import { LEVEL_HEIGHT } from "@/lib/house/constants";

type Mass = { id: string; width: number; depth: number; floors: number; elevation: number; position: { x: number; z: number }; rotation: number };
const isMass = (x: unknown): x is Mass => typeof x === "object" && x !== null && "width" in x && "depth" in x && "position" in x;
const params = [{ key: "massId", required: true }, { key: "overhang" }, { key: "verticalGap" }, { key: "thickness" }, { key: "fasciaDepth" }, { key: "supportStyle" }, { key: "soffitMaterial" }, { key: "horizontalOffset" }, { key: "secondary" }, { key: "clerestoryHeight" }];
const definition = (id: string, name: string, description: string, fallback: string): CapabilityMetadata => ({ id, name, category: id === "shadow-gap" ? "facade" : "roofs", version: 1, status: "supported", description, parameters: params, constraints: ["Requires a rectangular architectural mass", "Uses a flat roof expression plane; pitched roof recipes retain their base form"], visualImpact: 8, implementationDifficulty: 4, performanceCost: 2, architecturalImportance: 8, fallback, implementationNotes: "Shared roof-expression assembly with plane, fascia, soffit, reveal/support closure and optional secondary plane." });
function implementation(id: string): CapabilityImplementation { return { apply({ target }, raw) {
  if (!isMass(target) || target.id !== raw.massId) throw new Error("Roof expression requires its target mass.");
  const p: RoofExpressionParameters = { ...(raw as RoofExpressionParameters) };
  if (id === "floating-roof") { p.verticalGap ??= .32; p.supportStyle ??= "reveal"; }
  if (id === "deep-overhang") p.overhang ??= 1.2;
  if (id === "shadow-gap") { p.verticalGap ??= .12; p.supportStyle ??= "reveal"; }
  if (id === "roof-offset") p.horizontalOffset ??= { x: .35, z: 0 };
  if (id === "split-roof") p.secondary ??= { width: target.width * .42, depth: target.depth, elevation: -.5, offsetX: target.width * .26 };
  if (id === "clerestory-roof") { p.verticalGap ??= .72; p.clerestoryHeight ??= .62; p.supportStyle = "clerestory"; }
  const roof = resolveMaterial(DEFAULT_MATERIALS_CONFIG.roof); const exterior = resolveMaterial(DEFAULT_MATERIALS_CONFIG.exterior);
  const local = buildRoofExpression({ id: `capability-${id}-${target.id}`, width: target.width, depth: target.depth, wallPlateY: target.elevation + target.floors * LEVEL_HEIGHT, roofMaterial: roof, exteriorMaterial: exterior, parameters: p });
  return { primitives: local.map(x => rotatePrimitiveY(translatePrimitive(x, target.position.x, target.position.z), target.position.x, target.position.z, target.rotation)), note: `Applied ${id} through the shared roof-expression assembly.` };
} }; }
for (const [id, name, description, fallback] of [
  ["floating-roof", "Floating Roof", "Elevated roof plane with a closed reveal, glazing band, or recessed support band.", "Use the base roof recipe at the wall plate."],
  ["deep-overhang", "Deep Overhang", "Parameterized eave projection with visible soffit and fascia.", "Use the recipe roof's standard eave."],
  ["shadow-gap", "Shadow Gap", "Reusable roof-to-wall reveal assembly, designed for future slab and portal joints.", "Use a flush fascia at the wall plate."],
  ["roof-offset", "Roof Offset", "Horizontally offset roof plane while retaining the mass datum.", "Center the roof plane on its mass."],
  ["split-roof", "Split Roof", "Primary and coordinated secondary roof planes on a single mass.", "Use one roof plane for the mass."],
  ["clerestory-roof", "Clerestory Roof", "Elevated roof plane with architectural glazing below it.", "Use a closed dark reveal below the roof plane."],
] as const) capabilityRegistry.register({ metadata: definition(id, name, description, fallback), implementation: implementation(id) });
