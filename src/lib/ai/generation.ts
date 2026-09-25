import { applyPatch, type PatchOp } from "@/lib/house/applyPatch";
import { BLANK_HOUSE_JSON } from "@/types/house";
import { generateHouseFromJson } from "@/lib/house/generateHouse";
import { FEATURE_JSON_KEY, FEATURE_TYPES } from "@/lib/house/features/featureTypes";
import { normalizeRoomLayout, type LayoutRoom } from "@/lib/house/normalizeRooms";
import { inferSiteHints, resolveSiteSettings, type SiteHints } from "@/lib/house/siteSettings";
import type { SiteSettings } from "@/types/house";
import { applyArchitectureRules } from "@/lib/house/architecture/generationRules";
import { applySiteRules } from "@/lib/house/architecture/siteRules";
import { GEOMETRY_GUIDANCE, TERRAIN_GUIDANCE, TIER_GUIDANCE } from "./designGuidance";
import { describeArchitectureStyles } from "@/lib/house/architecture/profiles";
import { partitionOpsForScope, WORLD_SCOPE } from "./targeting";
import { describeCapabilities, EXTERIOR_ENUM_OPTIONS, EXTERIOR_ASSET_OPTIONS, type AssetRef } from "./capabilities";
import { describeOperationPayloads, validateGenerationOperations, type AiGenerationResponse } from "./siteSchema";

const CORE = `You are the design engine for a professional architectural platform. A new project has just been started and you are creating its initial design from the user's brief. You never write code, never describe geometry, never produce meshes: your output is one JSON object of structured design data that a procedural renderer turns into a 3D scene. Later, every change will be a small targeted edit, so make a clean, complete, well-formed starting point — not a finished interior.`;

const WORLD = `═══ WHAT TO DESIGN ═══

Read the brief and decide, in this order:
1. House shell ("house"): footprint width (east-west) and depth (north-south) in meters, number of floors, roof form. Match the brief's scale: a cottage is ~8–12 × 7–9 m, a family home ~12–18 × 9–12 m, a villa or multi-storey block larger.
2. Exterior character: "setExteriorOptions" (style plus wall finish, window/door/railing/column styles, patio/pool surfaces) and "setMaterials" (exterior, roof, trim, decking). Pick a coherent look that fits the style and setting.
3. Openings: windows and a front door on the walls that suit the design, plus balconies only where the brief or style calls for them.
4. Garage and driveway if the brief implies cars (attached to a wall; the driveway leaves from the same wall).
5. Outdoor areas the brief mentions or strongly implies: patio, deck, pool, landscaping zones (garden / lawn), parking, a road. Do not add extras nobody asked for.
6. Site ("site"): pick environment (countryside | beach | cliff | hillside | farm | forest | suburban | urban), viewDirection, terrainSlope and approachSide from the brief. "Sunrise" means the view faces east, "sunset" west; a beach or cliff view faces the water. Without a stated orientation use viewDirection south and approachSide north; approachSide should not equal viewDirection. Land rises behind the house (opposite the view) when terrainSlope is gentle or steep, so hillside and cliff sites usually have a slope. Also choose "designTier" (starter | comfort | luxury | estate) from how elaborate the brief is — see DESIGN TIER — and "timeOfDay" only if the brief implies a mood.
   Orientation is expressed through wall choice: put the main outdoor spaces (patio, deck, pool, balcony, large windows) on the wall equal to viewDirection, and the entrance door, garage, driveway and parking on the wall equal to approachSide. Match the setting: a beach or cliff house wants a deck or pool facing the water; a farm wants open space and a driveway; an urban house is compact with little lawn.
7. Extra structures (guest house, gazebo, outdoor bar, restaurant, reception) only as "addBuilding" when the brief asks for them.
8. Silhouette and setting: use the curved, arched and layered parts and the terrain features described below to match the designTier and the brief — richer for luxury and estate, plain for starter — and only add terrain (river, rocks, clearing…) when the brief or setting calls for it.

Interiors: keep them empty and minimal. Add "addRoom" shells only for the main floor plan — at most a handful of rooms per floor, sized to tile the interior sensibly, with no attempt at furnishing detail. Skipping rooms entirely is fine.`;

const ARCHITECTURE = `═══ ARCHITECTURAL STYLES ═══

Three exteriorOptions.style values change the building's actual construction, not just its colours. When the brief matches one, set exteriorOptions.style to it and design to that massing (roof form and pitch, walls, foundation, porches and the detached structure are then built by the renderer from the style):
${describeArchitectureStyles()}
Their signature parts are ordinary features you may add yourself, sized to the design: "addPorch" (a covered porch / veranda on a ground-floor wall — usually the entrance wall, centred on the door), "addChimney" (an exterior stack on a gable-end wall) and "addBuilding" with kind "shed", "detached_garage" or "gazebo". Any of these you leave out is added for you. Give these styles wide, consistent proportions — do not fall back to a generic box with a different colour.`;

const RULES = `═══ RULES ═══

- All distances are meters. Wall-mounted objects use "wall" (north/south/east/west) and "offset" (distance along the wall from its start corner); an object must fit inside the wall's length. "level" is the 0-indexed floor and must be < house.floors.
- Rooms use x/z from the interior northwest corner and must fit inside the footprint minus 0.4 m of wall.
- Site-absolute objects (buildings, roads, parking, landscaping, decks, pools with siteX/siteZ) use world x/z: x positive = east, z positive = south, the main house centered at (0,0). Keep at least 4 m clearance between structures and the house's footprint.
- Use ONLY the catalog values listed below. Every "add" op needs every field.
- Do not include update or remove operations.
- Write "summary" as one or two warm, plain sentences describing what you designed.`;

export function buildGenerationSystemPrompt(assets: readonly AssetRef[]): string {
  const capabilities = describeCapabilities({ roofs: true, materials: true, exterior: true, featureTypes: true, site: true, assets });
  const payloads = `═══ OPERATION PAYLOADS ═══\n\nEach operation is { "op", "value"?, "fields"? }. "value" is the full item for add* ops (every required field); "fields" holds the changed fields for set* ops. Payloads are validated strictly — a wrong field name, missing required field or out-of-range number is rejected. Shapes ("?" = optional):\n${describeOperationPayloads(WORLD_SCOPE, assets.map((a) => a.id), true)}`;
  return [CORE, WORLD, TIER_GUIDANCE, GEOMETRY_GUIDANCE, TERRAIN_GUIDANCE, ARCHITECTURE, RULES, `═══ RENDERER CAPABILITIES ═══\n\n${capabilities}`, payloads].join("\n\n");
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
  brief = "",
  /** Final attempt: drop ops with invalid payloads (reported in `skipped`) instead of failing the design. */
  skipInvalidOps = false
): GenerationOutcome {
  // The site block comes from `output.site` resolved against the brief below, never from a free-form op.
  // Payloads are validated locally; an invalid one fails the attempt so the repair pass can fix it.
  const { valid, invalid } = validateGenerationOperations(output.operations, WORLD_SCOPE, assets.map((a) => a.id));
  if (invalid.length > 0 && !skipInvalidOps) return { ok: false, errors: invalid };
  const { allowed: scoped, rejected } = partitionOpsForScope(valid, WORLD_SCOPE, {});
  rejected.unshift(...invalid);
  const allowed = scoped.filter((op) => op.op !== "setSite");
  // What the brief explicitly says ("facing sunrise", "cliff") overrides the model's guess.
  const hints: SiteHints = inferSiteHints(brief);
  const site = resolveSiteSettings(output.site as Partial<SiteSettings>, hints);
  const layout = normalizeGeneratedRooms(allowed, output.house);
  if (layout.errors.length > 0) return { ok: false, errors: layout.errors };
  // A named style (cabin, modern luxury, Caribbean villa) fixes the roof form, the setting and its signature parts.
  const styled = applyArchitectureRules({ brief, house: output.house, site, ops: layout.ops, statedEnvironment: hints.environment !== undefined });
  // The tier and the brief decide what richness and terrain the design still lacks (a river for "beside a river").
  const designed = applySiteRules({ brief, house: styled.house, site: styled.site, ops: styled.ops, style: styled.style });
  const ops: PatchOp[] = [{ op: "setHouse", fields: { ...styled.house } }, { op: "setSite", fields: { ...styled.site } }, ...designed.ops];

  const { json, errors: patchErrors } = applyPatch(BLANK_HOUSE_JSON, ops);
  if (patchErrors.length > 0) return { ok: false, errors: patchErrors };

  const errors = validateGeneratedProject(json, assets);
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, json, timeOfDay: output.timeOfDay ?? hints.timeOfDay, site: styled.site, skipped: rejected };
}

/**
 * Resolves overlapping / out-of-bounds rooms before the renderer sees them (see normalizeRoomLayout).
 * Only the `addRoom` payloads' geometry changes: op order, ids, types and levels are untouched.
 */
function normalizeGeneratedRooms(
  ops: readonly PatchOp[],
  house: AiGenerationResponse["house"]
): { ops: PatchOp[]; errors: string[] } {
  const roomOps = ops.filter((op) => op.op === "addRoom" && isRecord(op.value));
  if (roomOps.length === 0) return { ops: [...ops], errors: [] };
  const { rooms, errors } = normalizeRoomLayout(roomOps.map((op) => op.value as unknown as LayoutRoom), house);
  if (errors.length > 0) return { ops: [...ops], errors };
  let next = 0;
  return {
    ops: ops.map((op) => (roomOps.includes(op) ? { ...op, value: { ...op.value, ...rooms[next++] } } : op)),
    errors: [],
  };
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
