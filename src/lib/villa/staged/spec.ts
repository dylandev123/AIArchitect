import {z} from 'zod';
import {sitePresentationSchema} from './siteContract';

/**
 * Staged generation spec. The spec is the source of truth; every stage compiles it
 * deterministically into the existing `ArchitecturalScene`. Models decide design
 * (this file's fields); software measures and derives everything else (wall runs,
 * opening positions, roof eaves, slab voids, door positions, containment).
 *
 * Flat land by contract: ground elevation 0, no terrain, no grade compensation.
 */
export const SLAB = 0.3;
export const STOREY = 3.4;
export const WALL_H = STOREY - SLAB;
/** Walking surface (slab top) of a level. */
export const levelTop = (level: number) => SLAB + level * STOREY;

/** Documented limits for model-authored descriptive text; the live prompts state these numbers. */
export const DESCRIPTION_LIMITS = {name: 120, concept: 1200, paragraph: 700, line: 300, role: 200} as const;
const id = z.string().regex(/^[a-z][a-z0-9-]{0,39}$/);
const num = z.number().finite();
export const materialSchema = z.enum(['ivory', 'limestone', 'timber', 'bronze', 'sage']);
export type Mat = z.infer<typeof materialSchema>;
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const sideSchema = z.enum(['n', 's', 'e', 'w']);
export type Side = z.infer<typeof sideSchema>;

// ---- Stage 1: architectural identity (design direction, no geometry) ----
export const directionSchema = z.object({
  name: z.string().max(DESCRIPTION_LIMITS.name),
  concept: z.string().max(DESCRIPTION_LIMITS.concept),
  hierarchy: z.array(z.string().max(DESCRIPTION_LIMITS.line)).min(2).max(8),
  roofLanguage: z.string().max(DESCRIPTION_LIMITS.paragraph),
  entrance: z.string().max(DESCRIPTION_LIMITS.paragraph),
  outdoorLiving: z.string().max(DESCRIPTION_LIMITS.paragraph),
  landscape: z.string().max(DESCRIPTION_LIMITS.paragraph),
  palette: z.object({walls: materialSchema, accent: materialSchema, roof: materialSchema, roofColor: hex.describe('Six-digit hexadecimal roof color, for example #B65A36. Not a material description or color name.').optional(), deck: materialSchema}).strict(),
}).strict();
export type Direction = z.infer<typeof directionSchema>;

// ---- Stage 2/3: massing blocks and guillotine room plans ----
export const roomTypeSchema = z.enum(['foyer', 'living', 'dining', 'kitchen', 'bedroom', 'bath', 'hall', 'stair', 'gallery', 'lounge', 'media']);
export type RoomType = z.infer<typeof roomTypeSchema>;
export type PlanNode = {room: {id: string; name: string; type: RoomType}} | {split: 'x' | 'z'; at: number; a: PlanNode; b: PlanNode};
/** `at` is the metres given to the first child (west for x, north for z); the second takes the remainder. */
export const planSchema: z.ZodType<PlanNode> = z.lazy(() => z.union([
  z.object({room: z.object({id, name: z.string().max(60), type: roomTypeSchema}).strict()}).strict(),
  z.object({split: z.enum(['x', 'z']), at: z.number().finite().positive().max(60), a: planSchema, b: planSchema}).strict(),
]));

export const roofSchema = z.object({
  form: z.enum(['flat', 'hip', 'gable']),
  /** Rise of a pitched roof, metres. */
  rise: z.number().min(0.6).max(5).optional(),
  overhang: z.number().min(0).max(3),
  material: materialSchema,
  color: hex.optional(),
}).strict();
export type RoofSpec = z.infer<typeof roofSchema>;

export const blockSchema = z.object({
  id, role: z.string().max(DESCRIPTION_LIMITS.role), cx: num, cz: num, w: z.number().min(3).max(40), d: z.number().min(3).max(40),
  level: z.union([z.literal(0), z.literal(1)]),
  plan: planSchema, roof: roofSchema,
  wall: materialSchema.default('ivory'),
  wallColor: hex.optional(),
}).strict();
export type Block = z.infer<typeof blockSchema>;

/** An open architectural space (veranda, terrace, loggia…): keeps position, size and identity but is never tiled into rooms. */
export const openSpaceSchema = z.object({id, role: z.string().max(DESCRIPTION_LIMITS.role), cx: num, cz: num, w: z.number().min(2).max(40), d: z.number().min(2).max(20), host: id, side: sideSchema}).strict();
export type OpenSpace = z.infer<typeof openSpaceSchema>;
export const linkSchema = z.object({a: id, b: id, kind: z.enum(['door', 'open']), t: z.number().min(0.1).max(0.9).default(0.5)}).strict();
export type Link = z.infer<typeof linkSchema>;

export const stairSchema = z.object({id, room: id, start: sideSchema, hug: sideSchema, width: z.number().min(0.9).max(2)}).strict();

// ---- Stage 4: exterior architecture ----
export const facadeStyleSchema = z.enum(['glass-wall', 'large-windows', 'punched', 'solid']);
export type FacadeStyle = z.infer<typeof facadeStyleSchema>;
export const exteriorDoorSchema = z.object({id, room: id, side: sideSchema, kind: z.enum(['main', 'garden']), width: z.number().min(0.9).max(3), t: z.number().min(0.15).max(0.85).default(0.5)}).strict();
export const entranceSchema = z.object({
  door: id, canopy: z.object({depth: z.number().min(0).max(5), width: z.number().min(2).max(14), material: materialSchema}).strict(),
  court: z.object({w: z.number().min(2).max(20), d: z.number().min(2).max(14)}).strict(),
}).strict();
export const verandaSchema = z.object({
  id, block: id, side: sideSchema, from: num, to: num, depth: z.number().min(2).max(8), columns: z.number().int().min(2).max(10),
  roofMaterial: materialSchema, deckMaterial: materialSchema,
  /** Optional refinements (Stage 4 exterior design); absent = original behaviour. */
  columnMaterial: materialSchema.optional(), beams: z.boolean().optional(),
}).strict();
export const exteriorSchema = z.object({
  facades: z.record(z.string(), facadeStyleSchema),
  doors: z.array(exteriorDoorSchema).max(8),
  entrance: entranceSchema,
  verandas: z.array(verandaSchema).max(4),
}).strict();

// ---- Stage 5: site on flat ground ----
export const rectSchema = z.object({x: num, z: num, w: z.number().positive(), d: z.number().positive()}).strict();
export type Rect = z.infer<typeof rectSchema>;
export const siteSchema = z.object({
  pool: z.object({sourceIntent:id.optional().describe('Retained open-space pool intention ID resolved by this one pool assembly.'),intentResolution:z.string().trim().min(1).max(500).optional().describe('Explicit Stage 5 explanation if pool/deck differs from its conceptual Stage 2 footprint.'),x: num, z: num, w: z.number().min(3).max(20), d: z.number().min(2).max(14), basinDepth: z.number().min(0.8).max(2.5), nearDeckDepth: z.number().min(0.1).max(1.5).optional()}).strict().optional().describe('Absent only when the house has no swimming pool.'),
  lawns: z.array(z.object({id, rect: rectSchema, material: materialSchema, patches:z.array(rectSchema).max(64).optional()}).strict()).max(16),
  beds: z.array(z.object({id, rect: rectSchema}).strict()).max(10),
  trees: z.array(z.object({id, x: num, z: num, height: z.number().min(2).max(14), kind: z.enum(['palm', 'canopy'])}).strict()).max(40),
  hedges: z.array(z.object({id, rect: rectSchema}).strict()).max(14),
  // A connected terrace around a pool needs several non-overlapping rectangular pieces.
  // Scene compilation still enforces the unchanged 400-element total.
  paths: z.array(z.object({id, rect: rectSchema}).strict()).max(16),
}).strict();

/** Stage 4 exterior character decisions that software turns into trim geometry. Absent = no trim (earlier stages unchanged). */
export const trimSchema = z.object({
  /** Explicit opt-in: older saved specs keep their original compiler presentation. */
  visualRevision: z.literal('stage4-v2').optional(),
  windowTrim: z.enum(['plain', 'stone-surrounds', 'stone-and-shutters']),
  railing: z.enum(['glass', 'parapet']),
  plinth: z.boolean(), cornice: z.boolean(), portal: z.boolean(),
  stoneColor: hex, timberColor: hex, plasterColor: hex,
  canopy: z.enum(['none', 'shallow', 'deep']),
}).strict();
export type Trim = z.infer<typeof trimSchema>;

export const houseSpecSchema = z.object({
  version: z.literal('staged-house-1'),
  site: z.object({width: z.number().min(30).max(120), depth: z.number().min(30).max(120)}).strict(),
  direction: directionSchema,
  blocks: z.array(blockSchema).min(1).max(12),
  openSpaces: z.array(openSpaceSchema).max(6).default([]),
  links: z.array(linkSchema).max(60),
  stairs: z.array(stairSchema).max(2),
  exterior: exteriorSchema,
  trim: trimSchema.optional(),
  siteWork: siteSchema,
  sitePresentation: sitePresentationSchema.optional(),
}).strict();
export type HouseSpec = z.infer<typeof houseSpecSchema>;

/** The per-stage slices a model is asked for. Each is a complete, inspectable result. */
export const stageSchemas = {
  1: directionSchema,
  2: z.object({blocks: z.array(blockSchema.pick({id: true, role: true, cx: true, cz: true, w: true, d: true, level: true}).extend({open: z.boolean().optional()})).min(1).max(12)}).strict(),
  3: z.object({plans: z.record(id, planSchema), links: z.array(linkSchema).max(60), stairs: z.array(stairSchema).max(2)}).strict(),
  // trim/walls and sitePresentation are present only when software derived the slice from a design-intent answer.
  4: z.object({roofs: z.record(id, roofSchema), exterior: exteriorSchema, trim: trimSchema.optional(), walls: z.record(id, z.object({wall: materialSchema, wallColor: hex.optional()}).strict()).optional()}).strict(),
  5: z.object({siteWork: siteSchema, finishes: z.record(id, z.object({wall: materialSchema, wallColor: hex.optional()}).strict()), sitePresentation: sitePresentationSchema.optional()}).strict(),
} as const;
