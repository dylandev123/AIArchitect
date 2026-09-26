import { applyPatch, type PatchOp } from "@/lib/house/applyPatch";
import { BLANK_HOUSE_JSON } from "@/types/house";
import { generateHouseFromJson } from "@/lib/house/generateHouse";
import { FEATURE_JSON_KEY, FEATURE_LABEL, FEATURE_TYPES } from "@/lib/house/features/featureTypes";
import { normalizeRoomLayout, type LayoutRoom } from "@/lib/house/normalizeRooms";
import { inferSiteHints, resolveSiteSettings, type SiteHints } from "@/lib/house/siteSettings";
import type { SiteSettings } from "@/types/house";
import { applyArchitectureRules } from "@/lib/house/architecture/generationRules";
import { applySiteRules } from "@/lib/house/architecture/siteRules";
import { findSiteCollisions, resolveSiteCollisions } from "@/lib/house/architecture/siteCollisions";
import { finalizeScale, fitShellToScale, planScale } from "@/lib/house/architecture/scaleRules";
import { GEOMETRY_GUIDANCE, SCALE_GUIDANCE, TERRAIN_GUIDANCE, TIER_GUIDANCE } from "./designGuidance";
import { describeArchitectureStyles } from "@/lib/house/architecture/profiles";
import { partitionOpsForScope, WORLD_SCOPE } from "./targeting";
import { createTimings, type Timings } from "./timing";
import { describeCapabilities, EXTERIOR_ENUM_OPTIONS, EXTERIOR_ASSET_OPTIONS, type AssetRef } from "./capabilities";
import { describeRecipesForPrompt } from "@/lib/library/recipes";
import type { DesignRecipe } from "@/types/library";
import { describeOperationPayloads, validateGenerationOperations, type AiGenerationResponse } from "./siteSchema";

const CORE = `You are a world-class residential architect. Your job is not to create JSON: it is to design beautiful homes that people would actually build. Every home should feel intentional. Think like Frank Lloyd Wright, Olson Kundig, SAOTA, McClean Design, Zaha Hadid, Foster + Partners, Studio MK27 and luxury Caribbean architects. The JSON is simply the way you communicate the design. Never create a plain box when a more believable composition is possible.

You work inside a professional architectural platform. A new project has just been started and you are creating its initial design from the user's brief. You never write code, never describe geometry, never produce meshes: your output is one JSON object of structured design data that a procedural renderer turns into a 3D scene. Later, every change will be a small targeted edit, so make a clean, complete, well-formed starting point — not a finished interior.`;

const WORLD = `═══ WHAT TO DESIGN ═══

Read the brief and decide, in this order:
1. House shell ("house"): the principal volume's footprint width (east-west) and depth (north-south) in meters, number of floors, roof form. Size it from the project scale (see PROJECT SCALE) — that section, not any style guidance below, decides how big the house is. At luxury scales and above, think of it as the anchor of a composed massing (connected volumes, offsets, courtyards, terraces, a roof hierarchy), not a lone box; keep a plain single block for those scales only when the brief asks for minimalism.
2. Exterior character: "setExteriorOptions" (style plus wall finish, window/door/railing/column styles, patio/pool surfaces) and "setMaterials" (exterior, roof, trim, decking). Pick a coherent look that fits the style and setting.
3. Openings: windows and a front door on the walls that suit the design, plus balconies only where the brief or style calls for them.
4. Garage and driveway if the brief implies cars (attached to a wall; the driveway leaves from the same wall).
5. Outdoor areas: those the brief mentions or strongly implies, plus any that clearly improve the design for its style, scale and site (a terrace off the living side, a pool for a luxury home, planting that frames the entrance). The brief does not need to list every feature — use architectural judgment, but keep additions coherent and restrained, never random or decorative filler.
6. Site ("site"): pick environment (countryside | beach | cliff | hillside | farm | forest | suburban | urban), viewDirection, terrainSlope and approachSide from the brief. "Sunrise" means the view faces east, "sunset" west; a beach or cliff view faces the water. Without a stated orientation use viewDirection south and approachSide north; approachSide should not equal viewDirection. Land rises behind the house (opposite the view) when terrainSlope is gentle or steep, so hillside and cliff sites usually have a slope. Also choose "projectScale" (cottage | family | luxury | estate | mansion) from how big the brief says the project is — see PROJECT SCALE — "designTier" (starter | comfort | luxury | estate) from how elaborate it is — see DESIGN TIER — and "timeOfDay" only if the brief implies a mood.
   Orientation is expressed through wall choice: put the main outdoor spaces (patio, deck, pool, balcony, large windows) on the wall equal to viewDirection, and the entrance door, garage, driveway and parking on the wall equal to approachSide. Match the setting: a beach or cliff house wants a deck or pool facing the water; a farm wants open space and a driveway; an urban house is compact with little lawn.
7. Extra structures (guest house, gazebo, outdoor bar, restaurant, reception) as "addBuilding" when the brief asks for them or the scale and site make them appropriate (for example a guest house or pool house on an estate).
8. Silhouette and setting: use the curved, arched and layered parts and the terrain features described below to match the designTier and the brief — richer for luxury and estate, plain for starter — and only add terrain (river, rocks, clearing…) when the brief or setting calls for it.

Property as one composition: design the house, garage, driveway, pool, outdoor living, guest structures and landscape together. Each should relate to the others — the drive arrives at the entrance and garage, the pool and terrace sit off the main living side and the view, guest structures are positioned to frame or address the outdoor spaces, and planting ties it together.

Interiors: keep them basic for now — empty and minimal; put the effort into exterior architecture, massing, site planning and outdoor living. Add "addRoom" shells only for the main floor plan — at most a handful of rooms per floor, sized to tile the interior sensibly, with no attempt at furnishing detail. Skipping rooms entirely is fine.`;

const ARCHITECTURE = `═══ ARCHITECTURAL STYLES ═══

Three exteriorOptions.style values change the building's actual construction, not just its colours. When the brief matches one, set exteriorOptions.style to it and design to that massing (roof form and pitch, walls, foundation, porches and the detached structure are then built by the renderer from the style):
${describeArchitectureStyles()}
Their signature parts are ordinary features you may add yourself, sized to the design: "addPorch" (a covered porch / veranda on a ground-floor wall — usually the entrance wall, centred on the door), "addChimney" (an exterior stack on a gable-end wall) and "addBuilding" with kind "shed", "detached_garage" or "gazebo". Any of these you leave out is added for you. Give these styles wide, consistent proportions — do not fall back to a generic box with a different colour. Footprint sizes quoted for a style are its typical proportions; the project scale decides the actual size.`;

const RULES = `═══ RULES ═══

- All distances are meters. Wall-mounted objects use "wall" (north/south/east/west) and "offset" (distance along the wall from its start corner); an object must fit inside the wall's length. "level" is the 0-indexed floor and must be < house.floors.
- Rooms use x/z from the interior northwest corner and must fit inside the footprint minus 0.4 m of wall.
- Site-absolute objects (buildings, roads, parking, landscaping, decks, pools with siteX/siteZ) use world x/z: x positive = east, z positive = south, the main house centered at (0,0). Keep at least 4 m clearance between structures and the house's footprint.
- Use ONLY the catalog values listed below. Every "add" op needs every field.
- Do not include update or remove operations.
- Write "summary" as one or two warm, plain sentences describing what you designed.`;

export function buildGenerationSystemPrompt(assets: readonly AssetRef[], recipes: readonly DesignRecipe[] = []): string {
  const capabilities = describeCapabilities({ roofs: true, materials: true, exterior: true, featureTypes: true, site: true, assets });
  const payloads = `═══ OPERATION PAYLOADS ═══\n\nEach operation is { "op", "value"?, "fields"? }. "value" is the full item for add* ops (every required field); "fields" holds the changed fields for set* ops. Payloads are validated strictly — a wrong field name, missing required field or out-of-range number is rejected. Shapes ("?" = optional):\n${describeOperationPayloads(WORLD_SCOPE, assets.map((a) => a.id), true)}`;
  return [CORE, WORLD, SCALE_GUIDANCE, TIER_GUIDANCE, GEOMETRY_GUIDANCE, TERRAIN_GUIDANCE, ARCHITECTURE, RULES, `═══ RENDERER CAPABILITIES ═══\n\n${capabilities}`, payloads, describeRecipesForPrompt(recipes)]
    .filter(Boolean)
    .join("\n\n");
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
  | { ok: true; json: string; timeOfDay?: AiGenerationResponse["timeOfDay"]; site: SiteSettings; skipped: string[]; adjusted: string[] }
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
  /**
   * Repair what can be repaired locally instead of failing the attempt (each failure costs a whole model call):
   * ops with invalid payloads, rooms that cannot be packed and features with no clear position are dropped and
   * reported in `skipped`. Everything still passes the same validation gates afterwards.
   */
  repairLocally = false,
  timings: Timings = createTimings()
): GenerationOutcome {
  // The site block comes from `output.site` resolved against the brief below, never from a free-form op.
  // Payloads are validated locally; an invalid one fails the attempt so the repair pass can fix it.
  const { valid, invalid } = timings.time("validateOps", () => validateGenerationOperations(output.operations, WORLD_SCOPE, assets.map((a) => a.id)));
  if (invalid.length > 0 && !repairLocally) return { ok: false, errors: invalid };
  const { allowed: scoped, rejected } = partitionOpsForScope(valid, WORLD_SCOPE, {});
  rejected.unshift(...invalid);
  const allowed = scoped.filter((op) => op.op !== "setSite");
  // What the brief explicitly says ("facing sunrise", "cliff") overrides the model's guess.
  const hints: SiteHints = inferSiteHints(brief);
  const site = resolveSiteSettings(output.site as Partial<SiteSettings>, hints);
  // The scale brings the shell into its size envelope (a mansion is never a suburban box) and carries the ops with it.
  const fitted = timings.time("scaleRules", () => fitShellToScale({ brief, house: output.house, site, ops: allowed }));
  const layout = timings.time("roomNormalization", () => normalizeGeneratedRooms(fitted.ops, fitted.house, repairLocally));
  if (layout.errors.length > 0) return { ok: false, errors: layout.errors };
  rejected.push(...layout.dropped);
  // A named style (cabin, modern luxury, Caribbean villa) fixes the roof form, the setting and its signature parts.
  const styled = timings.time("styleRules", () => applyArchitectureRules({ brief, house: fitted.house, site, ops: layout.ops, statedEnvironment: hints.environment !== undefined }));
  // The scale adds what its size calls for: connected wings, a garage row, outdoor living, grounds and outbuildings.
  const scaled = timings.time("scaleRules", () => planScale({ brief, house: styled.house, site: styled.site, ops: styled.ops, placeholders: new Set(styled.placeholders) }));
  // The tier and the brief decide what richness and terrain the design still lacks (a river for "beside a river").
  const designed = timings.time("siteRules", () => applySiteRules({ brief, house: styled.house, site: styled.site, ops: scaled.ops, style: styled.style, plan: scaled.plan }));
  // With every rule run, clear the walls the wings cover and give the larger facades their window rhythm.
  const finished = timings.time("scaleRules", () => finalizeScale({ brief, house: styled.house, site: styled.site, ops: designed.ops }));
  // Nothing is committed on top of anything else: features that collide move to the nearest clear place, or fail the attempt.
  const spatial = timings.time("collisionResolution", () => resolveSiteCollisionsOrDrop(styled.house, finished, repairLocally));
  if (spatial.errors.length > 0) return { ok: false, errors: spatial.errors };
  rejected.push(...spatial.dropped);
  const ops: PatchOp[] = [{ op: "setHouse", fields: { ...styled.house } }, { op: "setSite", fields: { ...styled.site } }, ...spatial.ops];

  const patched = timings.time("applyPatch", () => applyPatch(BLANK_HOUSE_JSON, ops));
  if (patched.errors.length > 0) return { ok: false, errors: patched.errors };

  let json = patched.json;
  let errors = timings.time("validateProject", () => validateGeneratedProject(json, assets));
  if (errors.length > 0 && repairLocally) {
    // A wall feature that overhangs its wall is pulled back to where the renderer would clamp it anyway; the result is re-validated in full.
    const repaired = timings.time("repairOffsets", () => clampOffsetsInJson(json, errors));
    if (repaired) {
      json = repaired;
      errors = timings.time("validateProject", () => validateGeneratedProject(json, assets));
    }
  }
  if (errors.length > 0) return { ok: false, errors };
  // The last gate looks at the committed JSON itself, independent of how the ops got there.
  const overlaps = timings.time("collisionGate", () => findSiteCollisions(JSON.parse(json) as Record<string, unknown>));
  if (overlaps.length > 0) return { ok: false, errors: overlaps };
  return { ok: true, json, timeOfDay: output.timeOfDay ?? hints.timeOfDay, site: styled.site, skipped: rejected, adjusted: spatial.relocated };
}

/**
 * Resolves overlapping / out-of-bounds rooms before the renderer sees them (see normalizeRoomLayout).
 * Only the `addRoom` payloads' geometry changes: op order, ids, types and levels are untouched.
 * With `dropUnfit`, a level that cannot be packed loses its smallest rooms until it can (interiors are
 * optional in a first design) instead of failing; every dropped room is reported.
 */
function normalizeGeneratedRooms(
  ops: readonly PatchOp[],
  house: AiGenerationResponse["house"],
  dropUnfit: boolean
): { ops: PatchOp[]; errors: string[]; dropped: string[] } {
  const dropped: string[] = [];
  let current = [...ops];
  for (;;) {
    const roomOps = current.filter((op) => op.op === "addRoom" && isRecord(op.value));
    if (roomOps.length === 0) return { ops: current, errors: [], dropped };
    const { rooms, errors, failedLevels } = normalizeRoomLayout(roomOps.map((op) => op.value as unknown as LayoutRoom), house);
    if (errors.length > 0) {
      if (!dropUnfit) return { ops: current, errors, dropped };
      // Drop the smallest room on each level that would not pack, then try again.
      const areaOf = (op: PatchOp) => Number(op.value?.width) * Number(op.value?.depth) || 0;
      const drop = new Set<PatchOp>();
      for (const level of failedLevels) {
        const onLevel = roomOps.filter((op) => Math.round(Number(op.value?.level)) === level);
        const smallest = onLevel.reduce((a, b) => (areaOf(b) < areaOf(a) ? b : a));
        drop.add(smallest);
        dropped.push(`Room "${String(smallest.value?.name ?? smallest.value?.type ?? "room")}" on level ${level} did not fit the floor plan and was left out.`);
      }
      current = current.filter((op) => !drop.has(op));
      continue;
    }
    let next = 0;
    return {
      ops: current.map((op) => (roomOps.includes(op) ? { ...op, value: { ...op.value, ...rooms[next++] } } : op)),
      errors: [],
      dropped,
    };
  }
}

/**
 * Settles feature collisions (see resolveSiteCollisions). With `dropUnplaced`, a feature that has no clear
 * position anywhere is left out and reported instead of failing the attempt, and the rest is settled again
 * without it; a blocked house or existing feature cannot be dropped and still fails.
 */
function resolveSiteCollisionsOrDrop(
  house: AiGenerationResponse["house"],
  ops: readonly PatchOp[],
  dropUnplaced: boolean
): ReturnType<typeof resolveSiteCollisions> & { dropped: string[] } {
  const dropped: string[] = [];
  let current = [...ops];
  for (;;) {
    const result = resolveSiteCollisions({ house, ops: current });
    if (result.errors.length === 0 || !dropUnplaced || result.unplaced.some((g) => g.length === 0)) return { ...result, dropped };
    const drop = new Set(result.unplaced.flat());
    result.errors.forEach((e) => dropped.push(`${e.split(", and there is no clear position")[0]}, so it was left out.`));
    current = current.filter((_, i) => !drop.has(i));
  }
}

/**
 * Applies the renderer's own `"offset" clamped to N` corrections to the project JSON, so a feature the model placed
 * slightly off the end of its wall is stored where it renders. Returns null when there was nothing to apply.
 */
export function clampOffsetsInJson(json: string, messages: readonly string[]): string | null {
  const root = JSON.parse(json) as Record<string, unknown>;
  let changed = false;
  for (const message of messages) {
    const m = /^(.+) (\d+): "offset" clamped to (-?[\d.]+)\.$/.exec(message);
    if (!m) continue;
    const type = FEATURE_TYPES.find((t) => FEATURE_LABEL[t] === m[1]);
    const items = type ? root[FEATURE_JSON_KEY[type]] : undefined;
    const item = Array.isArray(items) ? items[Number(m[2]) - 1] : undefined;
    if (isRecord(item) && typeof item.offset === "number") {
      item.offset = Number(m[3]);
      changed = true;
    }
  }
  return changed ? JSON.stringify(root) : null;
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
