import type { BuildingKind, CompassSide, SiteSettings, StyleKey, WallSide } from "@/types/house";
import type { PatchOp } from "../applyPatch";
import { BUILDING_DEFAULT_SIZE, CHIMNEY_LIMITS, PORCH_LIMITS } from "../constants";
import { STYLE_PRESETS } from "../catalog/styles";
import { getArchitectureProfile, inferStyleFromBrief, SIDE_VECTORS, type ArchitectureProfile } from "./profiles";

/**
 * Applies a style's architectural rules to a freshly generated design, before it is validated and committed.
 *
 * The model is told what each style looks like, but a "cabin in the woods" must not depend on it remembering to
 * ask for a chimney. So: the brief's named style wins over the model's guess, the roof is kept to forms the style
 * can build, and any signature part the model left out (porch, chimney, outbuilding) is added as an ordinary
 * `add*` op — a normal feature with its own stable id that can be edited or removed like any other.
 */

type Shell = { width: number; depth: number; floors: number; roof: string };

export interface ArchitectureInput {
  brief: string;
  house: Shell;
  site: SiteSettings;
  ops: readonly PatchOp[];
  /** Site values the brief states outright; these are never overridden. */
  statedEnvironment?: boolean;
}

export interface ArchitectureResult {
  house: Shell;
  site: SiteSettings;
  ops: PatchOp[];
  style?: StyleKey;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const wallOf = (side: CompassSide): WallSide => side;
const wallLength = (house: Shell, wall: WallSide) => (wall === "north" || wall === "south" ? house.width : house.depth);
const opValue = (op: PatchOp) => (isRecord(op.value) ? op.value : {});

/** The style the design ends up in: what the brief names, else what the model chose. */
export function resolveStyle(brief: string, ops: readonly PatchOp[]): { style?: StyleKey; overridden: boolean } {
  const chosen = ops
    .filter((op) => op.op === "setExteriorOptions" && isRecord(op.fields) && typeof op.fields.style === "string")
    .map((op) => (op.fields as Record<string, unknown>).style as StyleKey)
    .pop();
  const named = inferStyleFromBrief(brief);
  return { style: named ?? chosen, overridden: named !== undefined && named !== chosen };
}

export function applyArchitectureRules(input: ArchitectureInput): ArchitectureResult {
  const { style, overridden } = resolveStyle(input.brief, input.ops);
  const profile = getArchitectureProfile(style);
  if (!style || !profile) return { house: input.house, site: input.site, ops: [...input.ops] };

  const house: Shell = { ...input.house };
  if (!profile.roof.allowed.includes(house.roof as never)) house.roof = profile.roof.form;

  const site: SiteSettings = { ...input.site };
  if (profile.environments && !input.statedEnvironment && !profile.environments.includes(site.environment)) {
    site.environment = profile.environments[0];
  }

  let ops = withStyle([...input.ops], style, overridden);
  ops = [...ops, ...missingSignatureParts(profile, house, site, ops)];
  return { house, site, ops, style };
}

/** Makes sure exactly one setExteriorOptions carries the style; a style forced by the brief also brings its materials. */
function withStyle(ops: PatchOp[], style: StyleKey, overridden: boolean): PatchOp[] {
  const at = ops.findIndex((op) => op.op === "setExteriorOptions");
  if (at === -1) ops.push({ op: "setExteriorOptions", fields: { style } });
  else ops[at] = { ...ops[at], fields: { ...(ops[at].fields ?? {}), style } };
  if (overridden) {
    // The model tailored its palette to a different style; give the named one its own.
    const zones = STYLE_PRESETS[style].materials;
    const existing = ops.findIndex((op) => op.op === "setMaterials");
    const fields = { exterior: { ...zones.exterior }, roof: { ...zones.roof }, trim: { ...zones.trim }, decking: { ...zones.decking } };
    if (existing === -1) ops.push({ op: "setMaterials", fields });
    else ops[existing] = { ...ops[existing], fields };
  }
  return ops;
}

function missingSignatureParts(profile: ArchitectureProfile, house: Shell, site: SiteSettings, ops: readonly PatchOp[]): PatchOp[] {
  const added: PatchOp[] = [];
  const has = (name: string) => ops.some((op) => op.op === name);
  const approach = wallOf(site.approachSide);
  const approachLen = wallLength(house, approach);

  // Porches sit on the entrance wall, centred on the front door when there is one.
  if (!has("addPorch")) {
    const door = ops.find((op) => op.op === "addDoor" && opValue(op).wall === approach && (opValue(op).level ?? 0) === 0);
    const doorCentre = door ? Number(opValue(door).offset) + Number(opValue(door).width) / 2 : approachLen / 2;
    const width = profile.porch.fullWidth ? Math.min(approachLen, PORCH_LIMITS.width.max) : Math.min(approachLen, profile.key === "cabin" ? 5 : 4.5);
    const offset = profile.porch.fullWidth ? (approachLen - width) / 2 : clamp(doorCentre - width / 2, 0, Math.max(0, approachLen - width));
    added.push({ op: "addPorch", value: { wall: approach, offset: round(offset), width: round(width), depth: profile.porch.depth } });
    // A veranda that wraps: a second one on the far side, where the view usually is.
    if (profile.porch.fullWidth) {
      const back = opposite(approach);
      const backLen = wallLength(house, back);
      const w = Math.min(backLen, PORCH_LIMITS.width.max);
      added.push({ op: "addPorch", value: { wall: back, offset: round((backLen - w) / 2), width: round(w), depth: profile.porch.depth } });
    }
  }

  if (profile.chimney && !has("addChimney")) {
    // Chimneys belong on a gable end: the walls the ridge runs toward.
    const ends: WallSide[] = house.width >= house.depth ? ["east", "west"] : ["north", "south"];
    const wall = ends.find((w) => w !== approach) ?? ends[0];
    const len = wallLength(house, wall);
    const width = Math.min(1.3, len, CHIMNEY_LIMITS.width.max);
    added.push({ op: "addChimney", value: { wall, offset: round((len - width) / 2), width, depth: 1.0 } });
  }

  if (profile.outbuilding && !ops.some((op) => op.op === "addBuilding" && opValue(op).kind === profile.outbuilding)) {
    added.push({ op: "addBuilding", value: outbuildingFor(profile.outbuilding, house, site) });
  }
  return added;
}

export function outbuildingFor(kind: BuildingKind, house: Shell, site: SiteSettings): Record<string, unknown> {
  const { width, depth } = BUILDING_DEFAULT_SIZE[kind];
  const [ax, az] = SIDE_VECTORS[site.approachSide];
  const [vx, vz] = SIDE_VECTORS[site.viewDirection];
  const lateral: [number, number] = [-az || 0, ax || 0];
  const halfAlong = (v: [number, number]) => (Math.abs(v[0]) > 0.5 ? house.width : house.depth) / 2;
  const halfLat = (Math.abs(lateral[0]) > 0.5 ? house.width : house.depth) / 2;
  const clearance = 8;
  let x: number;
  let z: number;
  if (kind === "gazebo") {
    // In the garden, out toward the view.
    const d = halfAlong([vx, vz]) + clearance + 2;
    x = vx * d;
    z = vz * d;
  } else if (kind === "detached_garage") {
    // Forward of the house on the entrance side, offset to one side so the approach stays clear.
    const d = halfAlong([ax, az]) + clearance;
    const l = halfLat + width / 2 + 2;
    x = ax * d + lateral[0] * l;
    z = az * d + lateral[1] * l;
  } else {
    // Tucked beside the house and slightly behind it, set back among the trees.
    const l = halfLat + clearance + width / 2;
    const d = -halfAlong([ax, az]) * 0.3;
    x = ax * d + lateral[0] * l;
    z = az * d + lateral[1] * l;
  }
  const roof = kind === "detached_garage" ? "flat" : kind === "gazebo" ? "hip" : "gable";
  return { kind, x: round(x), z: round(z), width, depth, floors: 1, roof };
}

function opposite(wall: WallSide): WallSide {
  return ({ north: "south", south: "north", east: "west", west: "east" } as const)[wall];
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const round = (v: number) => Math.round(v * 10) / 10;
