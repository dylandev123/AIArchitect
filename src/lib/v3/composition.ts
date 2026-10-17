import { ENTRY_DOOR_FINISH, facadeBays, facadeDatums, fittedRhythmWidth } from './compositionPolicies';
import { z } from "zod";
import { buildMassOpenings, type OpeningIdScheme } from "@/lib/architecture/geometry/openings";
import { buildArchitecturalAssemblies } from "@/lib/architecture/geometry/assemblies";
import type { WallEdge } from "@/lib/architecture/geometry/footprint";
import type { HousePrimitive } from "@/lib/house/types";
import type { V3SceneObject } from "./scene";

const n = z.number().finite(), positive = n.positive(), unit = n.min(0).max(1);
const id = z.string().min(1).max(64), facade = z.enum(["north", "east", "south", "west"]);
const common = { id, facade, floors: z.enum(["all", "ground", "upper"]).optional() };
const opening = z.discriminatedUnion("type", [
  z.object({ ...common, type: z.literal("glazing-zone"), start: unit, end: unit, heightRatio: unit, frame: z.boolean().optional(), reveal: n.min(0).optional() }).strict(),
  z.object({ ...common, type: z.literal("door"), start: unit, end: unit, height: positive.optional(), frame: z.boolean().optional(), reveal: n.min(0).optional() }).strict(),
  z.object({ ...common, type: z.literal("opening-rhythm"), count: z.number().int().min(1).max(64), width: positive, height: positive, sill: n.min(0) }).strict(),
]);
// A deliberately small shared-construction subset. V3 hosts remain V3 objects;
// these local levels never reference a second document or generated primitives.
const placement = { id, facade, level: z.number().int().min(0).max(20).optional(), elevation: n.optional() };
const part = z.discriminatedUnion("type", [
  z.object({ ...placement, type: z.literal("slab"), start: unit, end: unit, depth: positive, thickness: positive.optional() }).strict(),
  z.object({ ...placement, type: z.literal("post"), at: unit, depth: n.min(0), height: positive, size: positive.optional() }).strict(),
  z.object({ ...placement, type: z.literal("beam"), start: unit, end: unit, depth: n.min(0), height: positive, thickness: positive.optional() }).strict(),
  z.object({ id, type: z.literal("railing"), slabId: id, edges: z.array(z.enum(["outer", "start", "end"])), height: positive, thickness: positive.optional() }).strict(),
]);
// Optional intent only: legacy compositions compile byte-for-byte as before.
const purpose = z.enum(['arrival', 'view', 'private', 'service']);
const designIntent = {
  spaceHeight: z.enum(["standard", "double-height"]).optional(),
  // Explicit opt-in: primary host anchors a bounded derived roof datum; authored mass heights never change.
  roofDatumGroup: z.string().min(1).max(64).optional(),
  massHierarchy: z.enum(['primary', 'secondary', 'connector']).optional(),
  facadeRoles: z.object({ north: purpose.optional(), east: purpose.optional(), south: purpose.optional(), west: purpose.optional() }).strict().optional(),
  // References a semantic ground-floor door, never a generated mesh.
  mainEntry: z.object({ openingId: id, canopyDepth: positive.max(6), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional() }).strict().optional(),
};
export const v3CompositionSchema = z.object({
  ...designIntent,
  openings: z.array(opening).max(128).optional(),
  assemblies: z.array(z.object({ id, intent: z.string().min(1).max(160), parts: z.array(part).max(128) }).strict()).max(32).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.mainEntry && !value.openings?.some(o => o.id === value.mainEntry!.openingId && o.type === 'door' && o.floors === 'ground' && o.end > o.start)) ctx.addIssue({ code: 'custom', message: 'mainEntry must reference an explicit ground-floor door.' });
  if (value.mainEntry && value.assemblies?.some(a => a.id === `entry-${value.mainEntry!.openingId}`)) ctx.addIssue({ code: 'custom', message: 'Entry canopy assembly id is reserved.' });
  const unique = (ids: string[]) => new Set(ids).size === ids.length;
  if (!unique((value.openings ?? []).map(o => o.id)) || !unique((value.assemblies ?? []).map(a => a.id))) ctx.addIssue({ code: "custom", message: "Composition ids must be unique." });
  for (const assembly of value.assemblies ?? []) {
    if (!unique(assembly.parts.map(p => p.id))) ctx.addIssue({ code: "custom", message: "Assembly part ids must be unique." });
    for (const p of assembly.parts) {
      if (p.type === "railing" && !assembly.parts.some(s => s.id === p.slabId && s.type === "slab")) ctx.addIssue({ code: "custom", message: `Missing assembly slab ${p.slabId}.` });
      if ((p.type === "beam" || p.type === "slab") && p.end <= p.start) ctx.addIssue({ code: "custom", message: "Assembly span must have end > start." });
    }
  }
});
export type V3Composition = z.infer<typeof v3CompositionSchema>;

/** Union-free provider description; runtime ingestion applies the canonical tagged contract. */
export const v3GenerationCompositionSchema = z.object({
  ...designIntent,
  openings: z.array(z.object({
    ...common, type: z.enum(["glazing-zone", "door", "opening-rhythm"]),
    start: unit.optional(), end: unit.optional(), heightRatio: unit.optional(),
    frame: z.boolean().optional(), reveal: n.min(0).optional(),
    count: z.number().int().min(1).max(64).optional(), width: positive.optional(),
    height: positive.optional(), sill: n.min(0).optional(),
  }).strict()).max(128).optional(),
  assemblies: z.array(z.object({ id, intent: z.string().min(1).max(160), parts: z.array(z.object({
    id, type: z.enum(["slab", "post", "beam", "railing"]), facade: facade.optional(),
    level: z.number().int().min(0).max(20).optional(), elevation: n.optional(),
    start: unit.optional(), end: unit.optional(), at: unit.optional(), depth: n.min(0).optional(),
    height: positive.optional(), size: positive.optional(), thickness: positive.optional(),
    slabId: id.optional(), edges: z.array(z.enum(["outer", "start", "end"])).optional(),
  }).strict()).max(128) }).strict()).max(32).optional(),
}).strict();


/**
 * V3 child identity is semantic: `<massId>:<openingId>:level-<n>:<componentRole>` for opening parts and
 * `<massId>:<facade>:level-<n>:wall[-after-<openingId>]` for the solid spans between them. Array position never
 * participates, so inserting, removing, moving or resizing one opening cannot rename any sibling's parts.
 * V2 keeps its positional ids; only this adapter passes the semantic scheme to the shared builder.
 */
const OPENING_PART_ROLES: ReadonlyArray<[string, string]> = [
  ["-frame-jamb-0", "frame-left"], ["-frame-jamb-1", "frame-right"], ["-frame-head", "frame-head"], ["-frame-sill", "frame-sill"],
  ["-glass", "glass"], ["-frame", "door-frame"], ["-panel", "door-panel"], ["-surround-0", "surround-left"], ["-surround-1", "surround-right"],
  ["-sill-wall", "sill-wall"], ["-head-wall", "head-wall"],
];
function semanticOpeningIds(massId: string, facade: string, floor: number): OpeningIdScheme {
  const openingBase = (key: string | undefined, fallback: string) => `${massId}:${key ?? fallback}:level-${floor}`;
  return {
    wall: ({ previousKey }) => `${massId}:${facade}:level-${floor}:wall${previousKey ? `-after-${previousKey}` : ""}`,
    openingBand: ({ opening, bandIndex }) => openingBase(opening.key, `${facade}-band-${bandIndex}`),
    opening: ({ opening, windowIndex }) => openingBase(opening.key, `${facade}-opening-${windowIndex}`),
  };
}
/** Folds the shared builder's `-suffix` onto the semantic base as `:componentRole`. */
export function semanticCompositionChildId(id: string): string {
  if (!id.includes(":")) return id;
  for (const [suffix, role] of OPENING_PART_ROLES) if (id.endsWith(suffix) && /:level-\d+$/.test(id.slice(0, -suffix.length))) return `${id.slice(0, -suffix.length)}:${role}`;
  return id;
}

type V3Opening = NonNullable<V3Composition["openings"]>[number];
/**
 * Openings for local storey `floor` of a mass whose lowest storey is building storey `storeyBase`. The shared
 * builder filters on the building storey, so a stacked mass's "upper" openings apply to its own storeys. A stacked
 * mass has no ground storey: an authored "ground" opening falls to its lowest storey unless upper openings already
 * define that facade (both cases are reported by `v3StoreyTargetingDiagnostics`). Ground masses are unchanged.
 */
export function stackedStoreyOpenings(openings: readonly V3Opening[], storeyBase: number, floor: number): V3Opening[] {
  if (storeyBase === 0 || floor > 0) return [...openings];
  return openings.map((op) => op.floors === "ground" && !op.id.startsWith("intent-") && !openings.some((other) => other.facade === op.facade && other.floors !== "ground") ? { ...op, floors: "all" as const } : op);
}

/** Reuse pure V2 construction functions; no V2 document, pipeline, persistence or bake. */
export function compileV3Composition(o: V3SceneObject, width: number, depth: number, height: number, levels: number, storeyBase = 0): HousePrimitive[] {
  const parsed = v3CompositionSchema.safeParse(o.composition);
  if (!parsed.success) return [];
  const composition = {...parsed.data, openings: parsed.data.openings?.map(op => op.type === 'opening-rhythm'
    ? {...op, width: fittedRhythmWidth(op.facade === 'north' || op.facade === 'south' ? width : depth, op.count, op.width)}
    : {...op, reveal: op.reveal ?? .04})}, levelHeight = height / levels;
  const exterior = { color: o.material.color, roughness: o.material.roughness ?? .72, metalness: o.material.metalness ?? 0 };
  const trim = { color: "#263036", roughness: .38, metalness: .7 };
  const glass = { color: "#8fbdc9", roughness: .1, metalness: .08, transparent: true, opacity: .42 };
  const edges: WallEdge[] = [
    { facade: "north", a: [-width/2,-depth/2], b: [width/2,-depth/2] },
    { facade: "south", a: [-width/2,depth/2], b: [width/2,depth/2] },
    { facade: "east", a: [width/2,-depth/2], b: [width/2,depth/2] },
    { facade: "west", a: [-width/2,-depth/2], b: [-width/2,depth/2] },
  ];
  const local: HousePrimitive[] = [];
  if (composition.openings !== undefined) for (let floor = 0; floor < levels; floor++) for (const edge of edges) {
    local.push(...buildMassOpenings([edge], width, depth, stackedStoreyOpenings(composition.openings, storeyBase, floor), storeyBase + floor, floor * levelHeight, levelHeight, `wall-${floor}`, { exterior, trim, glass }, semanticOpeningIds(o.id, edge.facade!, floor)).primitives);
  }
  const entry = composition.mainEntry && composition.openings?.find(op => op.id === composition.mainEntry!.openingId && op.type === 'door');
  const entryAssembly: NonNullable<V3Composition['assemblies']> = entry && entry.type === 'door' ? [{
    id: `entry-${entry.id}`, intent: 'Main entry canopy', parts: [{ id: 'canopy', type: 'slab', facade: entry.facade,
      start: Math.max(0, entry.start - .04), end: Math.min(1, entry.end + .04), depth: composition.mainEntry!.canopyDepth,
      elevation: Math.min(entry.height ?? 2.4, levelHeight - .4) + .15, thickness: .18, level: 0 }],
  }] : [];
  local.push(...buildArchitecturalAssemblies({ width, depth, height, floors: levels, assemblies: [...(composition.assemblies ?? []), ...entryAssembly] }, levelHeight, exterior, trim, glass));
  const yaw = o.transform.rotation[1], c = Math.cos(yaw), s = Math.sin(yaw), base = o.transform.position[1] - height / 2;
  return local.flatMap(p => {
    if (p.kind !== "box" || !p.size.every(v => Number.isFinite(v) && v > 0)) return [];
    const [x,y,z] = p.position;
    const surface = p.category === 'wall' && !p.label.includes('Surround') && !p.label.startsWith('Assembly')
      ? o.material.surface : undefined;
    const isMainEntry = entry && p.id.includes(`:${entry.id}:`);
    const door = p.label === 'Door Frame' ? { ...ENTRY_DOOR_FINISH, ...(isMainEntry && composition.mainEntry?.color ? { color: composition.mainEntry.color } : {}) } : undefined;
    return [{ ...p, ...(surface && !['water','grass','paving'].includes(surface) ? {surface: surface as 'stone'|'wood'|'metal'|'concrete'|'stucco'|'glass'} : {}), ...door, id: p.id.includes(':') ? semanticCompositionChildId(p.id) : `${o.id}-composition-${p.id}`, sourceObjectId: o.id, semanticRole: o.semanticRole,
      componentRole: p.category === "window" ? (p.transparent ? "facade glazing" : "glazing frame") : p.label.startsWith("Assembly") ? p.label.toLowerCase() : "facade wall",
      position: [o.transform.position[0] + x*c + z*s, base+y, o.transform.position[2] - x*s + z*c] as [number,number,number],
      rotation: [p.rotation[0], p.rotation[1]+yaw, p.rotation[2]] as [number,number,number] }];
  });
}

export const V3_COMPOSITION_PROMPT = `Architectural composition: explicit roof-form objects may use roofDatumGroup to request a common roof datum anchored by the primary host. Alignment never changes authored mass heights and unsafe adjustments are diagnosed. Optional massHierarchy (primary/secondary/connector), facadeRoles (north/east/south/west: arrival/view/private/service), and mainEntry {openingId,canopyDepth,color?} express intent. mainEntry references an explicit door with floors:ground; V3 derives its canopy. Facade roles derive openings only on sides without explicit openings. Use separate V3 objects for independently editable wings, roofs, terraces, pools and landscape.
ARCHITECTURAL DESIGN FREEDOM:
Explicit user requirements are constraints. Everything unspecified is a creative design opportunity. Develop an original design from the brief, not a random choice from fixed templates. Compact, sprawling, symmetrical, asymmetrical, courtyard, linear, clustered and unconventional compositions are all legitimate.
Use coherent proportions, intentional composition, believable construction, functional relationships and design consistency. No dominant central pavilion, relative wing size/height, setback, connector width, opposite arrival/garden sides, roof hierarchy, courtyard enclosure, glazing proportion or material-count limit is required. Choose roof families, facade rhythms and coordinated materials to serve this design. Optional hierarchy and facade roles describe intent rather than prescribe it.
Keep access usable and outdoor amenities clear of genuine building conflicts; intentional joints, covered spaces, embedded pools and stacked architecture are legitimate. Balconies need an exterior usable space rather than an interior shared wall.
For edits preserve explicit requirements and all unrelated architecture. Change only what the user requests or a specific objective conflict requires; never impose a house style or redesign because of symmetry, equal heights, aligned facades or a recessed entry.
Named unsupported features must retain their semantic intent and an explicit capability diagnostic; never silently substitute a generic roof for a named unsupported roof. Supported roofForm values are flat, floating-flat, mono-pitch, hip, gable, butterfly and terrace; preserve other named forms in unsupportedIntent.roofForm for a clearly diagnosed preview.
FEATURE INTENT: Use canopyStyle:"slatted" for an open pergola and "solid" for a weatherproof canopy. Floating-flat roofs have an open structural separation. Host rooftop terraces explicitly on their building at its roof datum; partial coverage is supported. Guards are derived by default; terraceOpenEdges lists intentional access edges and railing:"none" preserves an explicitly unguarded design. Roof family and these feature fields take precedence over legacy name compatibility.
EXPLICIT SEMANTIC INTENT: roof pitch is in degrees unless pitchUnit:"ratio" (rise/run) is authored. A double-height space needs composition.spaceHeight:"double-height" or a levels:1 mass of the full height; this removes intermediate slabs and spans facades continuously, and partial floor voids are unsupported. A balcony is an assembly with an upper-level slab and railing on a named facade of the mass that hosts it. The main entrance is mainEntry plus its door's facade. Arrival versus garden relationships come from facadeRoles and the actual positions of arrival and garden objects.
For detailed building-mass facades author composition:{openings:[...],assemblies:[...]}. These are persistent semantic parameters, compiled deterministically using the shared architectural construction library. When openings is present it fully specifies all four facades; unmentioned facades are solid. Omit openings to retain facade presets. Each opening has id, type, facade (north/east/south/west), optional floors (all/ground/upper). glazing-zone uses start,end (0..1 along facade), heightRatio (0..1), optional frame (boolean) and reveal (metres). opening-rhythm uses count,width,height,sill (metres). door uses start,end, optional height,frame,reveal. Keep spans non-overlapping and inside the facade; include a ground-floor entrance where appropriate.
Assemblies have id,intent,parts. Parts use unique id and type: slab {facade,start,end,depth,level?,elevation?,thickness?}, post {facade,at,depth,height,level?,elevation?,size?}, beam {facade,start,end,depth,height,level?,elevation?,thickness?}, railing {slabId,edges:[outer/start/end],height,thickness?}. Facade fractions are 0..1; dimensions are metres; level is zero-based; elevation offsets that floor. Use these for intentional porticos, shading, balconies and structural rhythm, not arbitrary decoration. Assembly slabId references a slab in that same assembly. Do not emit construction primitives or a V2 document.`;

/** Roles fill only facades without explicit authored openings; explicit openings win per side.
 * A common bay grid aligns upper/lower privacy openings. Ground view glazing is deliberately broader.
 * No room data is inferred: room/exterior coupling needs an explicit future relationship.
 */
export function resolvedFacadeComposition(o: V3SceneObject, width: number, depth: number, levelHeight: number): V3Composition {
  const c = o.composition;
  if (!c?.facadeRoles) return c?.openings !== undefined ? c : facadePresetComposition(o, width, depth, levelHeight);
  const fallback = facadePresetComposition(o, width, depth, levelHeight);
  const openings: NonNullable<V3Composition['openings']> = [];
  for (const facade of ['north', 'east', 'south', 'west'] as const) {
    const explicit = c.openings?.filter(op => op.facade === facade) ?? [];
    if (explicit.length) { openings.push(...explicit); continue; }
    const role = c.facadeRoles[facade], span = facade === 'north' || facade === 'south' ? width : depth;
    if (!role) { openings.push(...(c.openings !== undefined ? [] : fallback.openings!.filter(op => op.facade === facade))); continue; }
    if (role === 'arrival') continue; // Entry is explicitly identified; do not guess which door is primary.
    if (role === 'view') {
      openings.push({ id: `intent-${facade}-view`, type: 'glazing-zone', facade, floors: 'ground', start: .06, end: .94, heightRatio: .88 });
      facadeBays(span, 3.2, 2).forEach((bay,i) => openings.push({ id: `intent-${facade}-upper-${i}`, type: 'glazing-zone', facade, floors: 'upper', ...bay, heightRatio: .72 }));
    } else {
      const datum = facadeDatums(levelHeight, true);
      openings.push({ id: `intent-${facade}-privacy`, type: 'opening-rhythm', facade, count: Math.max(1, Math.floor(span / (role === 'service' ? 4.8 : 3.2))), width: role === 'service' ? .8 : 1.2, sill: datum.sill, height: datum.height });
    }
  }
  return { ...c, openings };
}

/** Presets are semantic shorthand for the same shared opening builder as explicit composition. */
export function facadePresetComposition(o: V3SceneObject, width: number, depth: number, levelHeight: number): V3Composition {
  const openings: NonNullable<V3Composition['openings']> = [];
  for (const side of ['North','East','South','West'] as const) {
    const treatment=o[`facade${side}`]??o.facadePreset??'glass-heavy';
    const facade=side.toLowerCase() as 'north'|'east'|'south'|'west';
    const span=side==='North'||side==='South'?width:depth;
    if(treatment==='solid') continue;
    if(treatment==='glass-heavy') openings.push({id:facade,type:'glazing-zone',facade,start:.09,end:.91,heightRatio:.86});
    else if(treatment==='privacy') openings.push({id:facade,type:'opening-rhythm',facade,count:Math.max(1,Math.min(12,Math.floor(span/2.4))),width:Math.min(1.2,span*.54),height:levelHeight*.18,sill:facadeDatums(levelHeight,true).sill});
    // Punched presets: one window centred per equal bay, all sharing the mass's sill/head datums.
    else facadeBays(span).slice(0,12).forEach((bay,i)=>openings.push({id:`${facade}-bay-${i}`,type:'glazing-zone',facade,...bay,heightRatio:Math.min(.5,1-2*facadeDatums(levelHeight).sill/levelHeight)}));
  }
  return {...o.composition,openings};
}
