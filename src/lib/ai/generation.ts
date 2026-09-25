import { applyPatch, type PatchOp } from "@/lib/house/applyPatch";
import { BLANK_HOUSE_JSON } from "@/types/house";
import { generateHouseFromJson } from "@/lib/house/generateHouse";
import { FEATURE_JSON_KEY, FEATURE_TYPES } from "@/lib/house/features/featureTypes";
import { inferSiteHints, resolveSiteSettings, type SiteHints } from "@/lib/house/siteSettings";
import type { SiteSettings } from "@/types/house";
import { partitionOpsForScope, WORLD_SCOPE } from "./targeting";
import { describeCapabilities, EXTERIOR_ENUM_OPTIONS, EXTERIOR_ASSET_OPTIONS, type AssetRef } from "./capabilities";
import type { AiGenerationResponse } from "./siteSchema";

const CORE = `You are the design engine for a professional architectural platform. A new project has just been started and you are creating its initial design from the user's brief. You never write code, never describe geometry, never produce meshes: your output is one JSON object of structured design data that a procedural renderer turns into a 3D scene. Later, every change will be a small targeted edit, so make a clean, complete, well-formed starting point — not a finished interior.`;

const WORLD = `═══ WHAT TO DESIGN ═══

Read the brief and decide, in this order:
1. House shell ("house"): footprint width (east-west) and depth (north-south) in meters, number of floors, roof form. Match the brief's scale: a cottage is ~8–12 × 7–9 m, a family home ~12–18 × 9–12 m, a villa or multi-storey block larger.
2. Exterior character: "setExteriorOptions" (style plus wall finish, window/door/railing/column styles, patio/pool surfaces) and "setMaterials" (exterior, roof, trim, decking). Pick a coherent look that fits the style and setting.
3. Openings: windows and a front door on the walls that suit the design, plus balconies only where the brief or style calls for them.
4. Garage and driveway if the brief implies cars (attached to a wall; the driveway leaves from the same wall).
5. Outdoor areas the brief mentions or strongly implies: patio, deck, pool, landscaping zones (garden / lawn), parking, a road. Do not add extras nobody asked for.
6. Site ("site"): pick environment (countryside | beach | cliff | hillside | farm | forest | suburban | urban), viewDirection, terrainSlope and approachSide from the brief. "Sunrise" means the view faces east, "sunset" west; a beach or cliff view faces the water. Without a stated orientation use viewDirection south and approachSide north; approachSide should not equal viewDirection. Land rises behind the house (opposite the view) when terrainSlope is gentle or steep, so hillside and cliff sites usually have a slope. Also choose "timeOfDay" only if the brief implies a mood.
   Orientation is expressed through wall choice: put the main outdoor spaces (patio, deck, pool, balcony, large windows) on the wall equal to viewDirection, and the entrance door, garage, driveway and parking on the wall equal to approachSide. Match the setting: a beach or cliff house wants a deck or pool facing the water; a farm wants open space and a driveway; an urban house is compact with little lawn.
7. Extra structures (guest house, gazebo, outdoor bar, restaurant, reception) only as "addBuilding" when the brief asks for them.

Interiors: keep them empty and minimal. Add "addRoom" shells only for the main floor plan — at most a handful of rooms per floor, sized to tile the interior sensibly, with no attempt at furnishing detail. Skipping rooms entirely is fine.`;

const RULES = `═══ RULES ═══

- All distances are meters. Wall-mounted objects use "wall" (north/south/east/west) and "offset" (distance along the wall from its start corner); an object must fit inside the wall's length. "level" is the 0-indexed floor and must be < house.floors.
- Rooms use x/z from the interior northwest corner and must fit inside the footprint minus 0.4 m of wall.
- Site-absolute objects (buildings, roads, parking, landscaping, decks, pools with siteX/siteZ) use world x/z: x positive = east, z positive = south, the main house centered at (0,0). Keep at least 4 m clearance between structures and the house's footprint.
- Use ONLY the catalog values listed below. Every "add" op needs every field.
- Do not include update or remove operations.
- Write "summary" as one or two warm, plain sentences describing what you designed.`;

export function buildGenerationSystemPrompt(assets: readonly AssetRef[]): string {
  const capabilities = describeCapabilities({ roofs: true, materials: true, exterior: true, featureTypes: true, site: true, assets });
  return [CORE, WORLD, RULES, `═══ RENDERER CAPABILITIES ═══\n\n${capabilities}`].join("\n\n");
}

export function buildGenerationUserMessage(brief: string, previousErrors: readonly string[] = []): string {
  const parts = [`PROJECT BRIEF:\n${brief}`];
  const hints = inferSiteHints(brief);
  const stated = Object.entries(hints).filter(([key]) => key !== "timeOfDay").map(([key, v]) => `${key}=${v}`);
  if (stated.length > 0) parts.push(`The brief states these site values — use them exactly: ${stated.join(", ")}.`);
  if (previousErrors.length > 0) {
    parts.push(
      `Your previous attempt was rejected by validation. Fix every problem below and return a complete, corrected design:\n${previousErrors
        .slice(0, 12)
        .map((e) => `- ${e}`)
        .join("\n")}`
    );
  }
  return parts.join("\n\n");
}

/** Style-compatibility notes are advisory; every other renderer warning means a value was out of range or unknown. */
const ADVISORY_WARNING = /will render fine/;

export type GenerationOutcome =
  | { ok: true; json: string; timeOfDay?: AiGenerationResponse["timeOfDay"]; site: SiteSettings; skipped: string[] }
  | { ok: false; errors: string[] };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Turns the model's structured output into a project JSON and validates it before anything is
 * committed. The renderer clamps and defaults quietly, so a clamp/unknown-value warning is treated
 * as a failure here: a generated design must be right, not silently repaired.
 */
export function assembleGeneratedProject(
  output: AiGenerationResponse,
  assets: readonly AssetRef[],
  brief = ""
): GenerationOutcome {
  // The site block comes from `output.site` resolved against the brief below, never from a free-form op.
  const { allowed: scoped, rejected } = partitionOpsForScope(output.operations, WORLD_SCOPE, {});
  const allowed = scoped.filter((op) => op.op !== "setSite");
  // What the brief explicitly says ("facing sunrise", "cliff") overrides the model's guess.
  const hints: SiteHints = inferSiteHints(brief);
  const site = resolveSiteSettings(output.site as Partial<SiteSettings>, hints);
  const ops: PatchOp[] = [{ op: "setHouse", fields: { ...output.house } }, { op: "setSite", fields: { ...site } }, ...allowed];

  const { json, errors: patchErrors } = applyPatch(BLANK_HOUSE_JSON, ops);
  if (patchErrors.length > 0) return { ok: false, errors: patchErrors };

  const errors = validateGeneratedProject(json, assets);
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, json, timeOfDay: output.timeOfDay ?? hints.timeOfDay, site, skipped: rejected };
}

export function validateGeneratedProject(json: string, assets: readonly AssetRef[]): string[] {
  const errors: string[] = [];
  const root = JSON.parse(json) as Record<string, unknown>;

  // Required house data.
  const house = root.house;
  if (!isRecord(house)) return ['Missing required "house" object.'];
  for (const field of ["width", "depth", "floors"] as const) {
    if (typeof house[field] !== "number" || !Number.isFinite(house[field])) errors.push(`house.${field} must be a number.`);
  }
  if (typeof house.roof !== "string") errors.push("house.roof is required.");
  if (errors.length > 0) return errors;

  // Feature references: every level must exist, every imported asset must be one the user has.
  const floors = house.floors as number;
  for (const type of FEATURE_TYPES) {
    const items = root[FEATURE_JSON_KEY[type]];
    if (!Array.isArray(items)) continue;
    items.forEach((item, i) => {
      if (isRecord(item) && typeof item.level === "number" && type !== "deck" && (item.level < 0 || item.level >= floors)) {
        errors.push(`${type} ${i + 1}: level ${item.level} does not exist (house has ${floors} floor(s)).`);
      }
    });
  }
  const assetIds = new Set(assets.map((a) => a.id));
  const materials = isRecord(root.materials) ? root.materials : {};
  for (const [zone, assignment] of Object.entries(materials)) {
    const id = isRecord(assignment) ? assignment.assetId : undefined;
    if (typeof id === "string" && !assetIds.has(id)) errors.push(`materials.${zone}: unknown assetId "${id}".`);
  }
  const ext = isRecord(root.exteriorOptions) ? root.exteriorOptions : {};
  for (const [key, values] of Object.entries(EXTERIOR_ENUM_OPTIONS)) {
    const v = ext[key];
    if (v !== undefined && !(values as readonly string[]).includes(v as string)) errors.push(`exteriorOptions.${key}: unknown value ${JSON.stringify(v)}.`);
  }
  for (const [assetKey] of EXTERIOR_ASSET_OPTIONS) {
    const v = ext[assetKey];
    if (typeof v === "string" && !assetIds.has(v)) errors.push(`exteriorOptions.${assetKey}: unknown assetId "${v}".`);
  }

  // Dimensions and renderer generation: the same code path the viewport uses.
  try {
    const result = generateHouseFromJson(json);
    errors.push(...result.errors);
    errors.push(...result.warnings.filter((w) => !ADVISORY_WARNING.test(w)));
    if (!result.model || result.model.primitives.length === 0) errors.push("The renderer produced no geometry.");
  } catch (e) {
    errors.push(`Renderer generation failed: ${(e as Error).message}`);
  }
  return errors;
}
