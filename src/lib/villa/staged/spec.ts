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

// ---- Stage 1: structured architectural vision (validated design decisions, no geometry) ----
/** How much architecture the brief asks for. Read from the brief; never inflated. */
export const AMBITIONS = ['modest', 'comfortable', 'refined', 'luxury', 'estate'] as const;
export const COMPOSITIONS = ['compact-volume', 'linear-bar', 'l-shape', 'u-courtyard', 'enclosed-courtyard', 'pavilion-cluster', 'central-hall-with-wings', 'stacked-volumes', 'pinwheel'] as const;
export const HEIGHT_STRATEGIES = ['uniform', 'gentle-hierarchy', 'pronounced-hierarchy', 'vertical-accent'] as const;
export const ROOF_STRATEGIES = ['single-roof-family', 'primary-crown-with-lower-wings', 'layered-pitched', 'flat-planes', 'mixed-pitched-and-flat'] as const;
export const ENTRANCE_CONCEPTS = ['discreet', 'sheltered-porch', 'recessed-portal', 'prominent-entry-volume', 'tall-entry-hall', 'entrance-court'] as const;
export const SIGNATURE_FEATURES = ['double-height-living', 'tall-principal-volume', 'entry-tower', 'entrance-volume', 'courtyard', 'covered-veranda', 'loggia', 'roof-terrace', 'upper-storey-bar', 'cantilevered-upper-volume', 'layered-roofs', 'glass-pavilion', 'pool-axis', 'framed-garden-view'] as const;
/** Principal spaces Stage 1 commits to; Stage 2 must give them real volumes. */
export const PRINCIPAL_KINDS = ['entrance-hall', 'living', 'dining', 'kitchen', 'family-room', 'master-suite', 'bedroom-suite', 'media-or-games', 'gallery', 'covered-terrace', 'upper-terrace', 'arrival-court', 'courtyard', 'pool-terrace'] as const;
export const SPACE_HEIGHTS = ['standard', 'tall', 'double'] as const;
export const scalePlanSchema = z.object({
  /** Approximate ground coverage of enclosed volumes, m². */
  footprintM2: z.number().min(20).max(12000),
  /** Approximate gross floor area of occupied floors (a double-height room counts once), m². */
  grossFloorAreaM2: z.number().min(20).max(16000),
  levels: z.union([z.literal(1), z.literal(2)]),
  /** Distinct major building parts (wings, pavilions, halls), counting the main body. */
  wings: z.number().int().min(1).max(12),
  principalSpaces: z.array(z.object({name: z.string().max(80), kind: z.enum(PRINCIPAL_KINDS), approxAreaM2: z.number().min(4).max(1200), height: z.enum(SPACE_HEIGHTS)}).strict()).min(1).max(10),
  scaleEvidence: z.string().max(DESCRIPTION_LIMITS.line),
}).strict();
export type ScalePlan = z.infer<typeof scalePlanSchema>;
export const visionSchema = z.object({
  style: z.string().max(200), character: z.string().max(DESCRIPTION_LIMITS.line),
  ambition: z.enum(AMBITIONS), ambitionEvidence: z.string().max(DESCRIPTION_LIMITS.line),
  composition: z.enum(COMPOSITIONS), compositionIntent: z.string().max(400),
  primaryVolume: z.string().max(DESCRIPTION_LIMITS.role),
  focalPoints: z.array(z.string().max(DESCRIPTION_LIMITS.role)).min(1).max(4),
  heightStrategy: z.enum(HEIGHT_STRATEGIES), roofStrategy: z.enum(ROOF_STRATEGIES), entranceConcept: z.enum(ENTRANCE_CONCEPTS),
  signatureFeatures: z.array(z.object({feature: z.enum(SIGNATURE_FEATURES), intent: z.string().max(240)}).strict()).max(4),
  /** Explicit brief requirements the vision must respect (e.g. "single storey"). */
  briefConstraints: z.array(z.string().max(DESCRIPTION_LIMITS.role)).max(8),
  /** Planned architectural scale (Phase 2). Absent on visions written before it existed; required from the provider. */
  scale: scalePlanSchema.optional(),
}).strict();
export type Vision = z.infer<typeof visionSchema>;

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
  /** Absent on houses designed before the structured vision existed (prose-only direction). */
  vision: visionSchema.optional(),
}).strict();
export type Direction = z.infer<typeof directionSchema>;

// ---- Stage 2/3: massing blocks and guillotine room plans ----
export const roomTypeSchema = z.enum(['foyer', 'living', 'dining', 'kitchen', 'bedroom', 'bath', 'hall', 'stair', 'gallery', 'lounge', 'media']);
export type RoomType = z.infer<typeof roomTypeSchema>;
export type PlanNode = {room: {id: string; name: string; type: RoomType}} | {split: 'x' | 'z'; at: number; a: PlanNode; b: PlanNode};
/** `at` is the metres given to the first child (west for x, north for z); the second takes the remainder. */
export const planSchema: z.ZodType<PlanNode> = z.lazy(() => z.union([
  z.object({room: z.object({id, name: z.string().max(60), type: roomTypeSchema}).strict()}).strict(),
  z.object({split: z.enum(['x', 'z']), at: z.number().finite().positive().max(80), a: planSchema, b: planSchema}).strict(),
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

/**
 * Clear wall height of one building volume above its floor slab. Absent = standard (the original fixed storey).
 * `double` is ONE occupied level with a two-storey void (wall top level with an upper storey's eave); it is not an
 * extra floor. Upper floors are separate level-1 blocks; a block carrying an upper floor stays standard.
 */
export const BLOCK_HEIGHTS = ['low', 'standard', 'tall', 'double'] as const;
export type BlockHeight = (typeof BLOCK_HEIGHTS)[number];
export const WALL_HEIGHTS: Record<BlockHeight, number> = {low: 2.7, standard: STOREY - SLAB, tall: 4.3, double: 2 * STOREY - SLAB};
/** Declared place of a volume in the composition; checked against the measured geometry. */
/**
 * Scale envelopes. Earlier values (site 120 m, block 40 m, 12 blocks, 2 stairs, 60 links, 8 doors, 4 verandas) were
 * arbitrary prompt-era bounds; geometry, solver and scene costs were measured at the new values (automatic-house/scale-2).
 */
export const SITE_MAX = 200, BLOCK_MAX = 60, MAX_BLOCKS = 20, MAX_OPEN_SPACES = 10, MAX_STAIRS = 4, MAX_LINKS = 160, MAX_DOORS = 16, MAX_VERANDAS = 8;
export const BLOCK_RANKS = ['primary', 'secondary', 'service', 'entrance', 'feature'] as const;
export const blockSchema = z.object({
  id, role: z.string().max(DESCRIPTION_LIMITS.role), cx: num, cz: num, w: z.number().min(3).max(BLOCK_MAX), d: z.number().min(3).max(BLOCK_MAX),
  level: z.union([z.literal(0), z.literal(1)]),
  height: z.enum(BLOCK_HEIGHTS).optional(), rank: z.enum(BLOCK_RANKS).optional(),
  plan: planSchema, roof: roofSchema,
  wall: materialSchema.default('ivory'),
  wallColor: hex.optional(),
}).strict();
export type Block = z.infer<typeof blockSchema>;
export const wallHeight = (b: Pick<Block, 'height'>) => WALL_HEIGHTS[b.height ?? 'standard'];
/** Top of a block's walls (eave line). Equals levelTop(level) + WALL_H for standard blocks. */
export const wallTopOf = (b: Pick<Block, 'height' | 'level'>) => levelTop(b.level) + wallHeight(b);

/** An open architectural space (veranda, terrace, loggia…): keeps position, size and identity but is never tiled into rooms. */
export const openSpaceSchema = z.object({id, role: z.string().max(DESCRIPTION_LIMITS.role), cx: num, cz: num, w: z.number().min(2).max(BLOCK_MAX), d: z.number().min(2).max(BLOCK_MAX), host: id, side: sideSchema}).strict();
export type OpenSpace = z.infer<typeof openSpaceSchema>;
export const linkSchema = z.object({a: id, b: id, kind: z.enum(['door', 'open']), t: z.number().min(0.1).max(0.9).default(0.5)}).strict();
export type Link = z.infer<typeof linkSchema>;

export const stairSchema = z.object({id, room: id, start: sideSchema, hug: sideSchema, width: z.number().min(0.9).max(2)}).strict();

// ---- Stage 4: exterior architecture ----
export const facadeStyleSchema = z.enum(['glass-wall', 'large-windows', 'punched', 'solid']);
export type FacadeStyle = z.infer<typeof facadeStyleSchema>;
export const exteriorDoorSchema = z.object({id, room: id, side: sideSchema, kind: z.enum(['main', 'garden']), width: z.number().min(0.9).max(3), t: z.number().min(0.15).max(0.85).default(0.5)}).strict();
export const entranceSchema = z.object({
  door: id, canopy: z.object({depth: z.number().min(0).max(6), width: z.number().min(2).max(20), material: materialSchema}).strict(),
  court: z.object({w: z.number().min(2).max(40), d: z.number().min(2).max(30)}).strict(),
}).strict();
export const verandaSchema = z.object({
  id, block: id, side: sideSchema, from: num, to: num, depth: z.number().min(2).max(10), columns: z.number().int().min(2).max(16),
  roofMaterial: materialSchema, deckMaterial: materialSchema,
  /** Optional refinements (Stage 4 exterior design); absent = original behaviour. */
  columnMaterial: materialSchema.optional(), beams: z.boolean().optional(),
}).strict();
export const exteriorSchema = z.object({
  facades: z.record(z.string(), facadeStyleSchema),
  doors: z.array(exteriorDoorSchema).max(MAX_DOORS),
  entrance: entranceSchema,
  verandas: z.array(verandaSchema).max(MAX_VERANDAS),
}).strict();

// ---- Stage 5: site on flat ground ----
export const rectSchema = z.object({x: num, z: num, w: z.number().positive(), d: z.number().positive()}).strict();
export type Rect = z.infer<typeof rectSchema>;
export const siteSchema = z.object({
  pool: z.object({sourceIntent:id.optional().describe('Retained open-space pool intention ID resolved by this one pool assembly.'),intentResolution:z.string().trim().min(1).max(500).optional().describe('Explicit Stage 5 explanation if pool/deck differs from its conceptual Stage 2 footprint.'),x: num, z: num, w: z.number().min(3).max(30), d: z.number().min(2).max(14), basinDepth: z.number().min(0.8).max(2.5), nearDeckDepth: z.number().min(0.1).max(1.5).optional()}).strict().optional().describe('Absent only when the house has no swimming pool.'),
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
  canopy: z.enum(['none', 'shallow', 'deep', 'grand']),
}).strict();
export type Trim = z.infer<typeof trimSchema>;

/**
 * Construction revision. Absent = the original compiler, byte-identical for every saved house (including the first
 * real-Terra house). `scale-1` (new generations): grouped repetitive geometry under one component element, the
 * larger scene budget, and entrance doors sized to their hall.
 */
export const CONSTRUCTIONS = ['scale-1'] as const;
export const houseSpecSchema = z.object({
  version: z.literal('staged-house-1'),
  construction: z.enum(CONSTRUCTIONS).optional(),
  site: z.object({width: z.number().min(30).max(SITE_MAX), depth: z.number().min(30).max(SITE_MAX)}).strict(),
  direction: directionSchema,
  blocks: z.array(blockSchema).min(1).max(MAX_BLOCKS),
  openSpaces: z.array(openSpaceSchema).max(MAX_OPEN_SPACES).default([]),
  links: z.array(linkSchema).max(MAX_LINKS),
  stairs: z.array(stairSchema).max(MAX_STAIRS),
  exterior: exteriorSchema,
  trim: trimSchema.optional(),
  siteWork: siteSchema,
  sitePresentation: sitePresentationSchema.optional(),
}).strict();
export type HouseSpec = z.infer<typeof houseSpecSchema>;

/** The per-stage slices a model is asked for. Each is a complete, inspectable result. */
export const stageSchemas = {
  1: directionSchema,
  2: z.object({blocks: z.array(blockSchema.pick({id: true, role: true, cx: true, cz: true, w: true, d: true, level: true, height: true, rank: true}).extend({open: z.boolean().optional()})).min(1).max(MAX_BLOCKS + MAX_OPEN_SPACES)}).strict(),
  3: z.object({plans: z.record(id, planSchema), links: z.array(linkSchema).max(MAX_LINKS), stairs: z.array(stairSchema).max(MAX_STAIRS)}).strict(),
  // trim/walls and sitePresentation are present only when software derived the slice from a design-intent answer.
  4: z.object({roofs: z.record(id, roofSchema), exterior: exteriorSchema, trim: trimSchema.optional(), walls: z.record(id, z.object({wall: materialSchema, wallColor: hex.optional()}).strict()).optional()}).strict(),
  5: z.object({siteWork: siteSchema, finishes: z.record(id, z.object({wall: materialSchema, wallColor: hex.optional()}).strict()), sitePresentation: sitePresentationSchema.optional()}).strict(),
} as const;
