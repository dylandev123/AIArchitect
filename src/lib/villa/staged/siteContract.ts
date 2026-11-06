import {z} from 'zod';

/** Flat, required-field wire contract, following the Stage 3/4 strict-schema pattern.
 * Terra chooses composition and character; software measures and places every component.
 */
export const siteDesignSchema = z.object({
  statement: z.string(),
  pool: z.object({scale: z.enum(['intimate', 'generous', 'lap']), alignment: z.enum(['veranda-centre', 'living-axis']), separation: z.enum(['close', 'promenade']), water: z.enum(['turquoise', 'deep-jade'])}).strict(),
  terrace: z.object({finish: z.enum(['limestone', 'warm-paving']), sunbeds: z.enum(['two', 'four']), social: z.enum(['dining', 'dining-and-lounge'])}).strict(),
  arrival: z.object({boundary: z.enum(['north', 'west']), finish: z.enum(['limestone', 'warm-paving']), character: z.enum(['palm-avenue', 'garden-court'])}).strict(),
  planting: z.object({palms: z.enum(['six', 'eight', 'ten']), stature: z.enum(['medium', 'varied-tall']), beds: z.enum(['layered-tropical', 'restrained-tropical']), lawn: z.enum(['garden-panels', 'open-lawn'])}).strict(),
  lighting: z.enum(['arrival-only', 'arrival-and-garden']),
  intentions: z.array(z.string()),
}).strict();
export type SiteDesign = z.infer<typeof siteDesignSchema>;

/**
 * Version 2, used by automatic generation for any supported orientation. Still coordinate-free and strict:
 * Terra chooses the outdoor composition; software measures the accepted house and places every component.
 * `pool.scale: none` is only valid when no pool intention exists and the brief does not ask for one.
 */
/** `resort` (Phase 2): a resort-scale pool for estates; the full deck is 23.2 x 11.4 m. */
export const POOL_SCALES = {plunge: [6, 3], intimate: [10, 4], generous: [12, 4.5], lap: [14, 4], resort: [20, 7]} as const;
export const siteDesignV2Schema = z.object({
  statement: z.string(),
  pool: z.object({scale: z.enum(['none', 'plunge', 'intimate', 'generous', 'lap', 'resort']), anchor: z.enum(['pool-intention', 'veranda', 'living-room']), separation: z.enum(['close', 'promenade']), water: z.enum(['turquoise', 'deep-jade'])}).strict(),
  terrace: z.object({finish: z.enum(['limestone', 'warm-paving']), sunbeds: z.enum(['none', 'two', 'four']), social: z.enum(['none', 'dining', 'dining-and-lounge'])}).strict(),
  arrival: z.object({finish: z.enum(['limestone', 'warm-paving']), character: z.enum(['tree-avenue', 'garden-court'])}).strict(),
  planting: z.object({trees: z.enum(['palm', 'canopy', 'mixed']), count: z.enum(['four', 'six', 'eight', 'ten']), stature: z.enum(['medium', 'varied-tall']), beds: z.enum(['layered', 'restrained']), lawn: z.enum(['garden-panels', 'open-lawn'])}).strict(),
  lighting: z.enum(['arrival-only', 'arrival-and-garden']),
  intentions: z.array(z.string()),
}).strict();
export type SiteDesignV2 = z.infer<typeof siteDesignV2Schema>;

export const SITE_ASSETS=['palm', 'canopy-tree', 'planting', 'hedge', 'lounger', 'table', 'chair', 'sofa', 'coffee-table', 'bollard', 'paving', 'lawn'] as const;
export type SiteAsset = typeof SITE_ASSETS[number];
// The same finite vocabulary as an anchored pattern avoids repeating eleven enum values
// across every element/operation union in the existing provider schema's 1,000-enum budget.
export const siteAssetSchema=z.string().regex(new RegExp(`^(${SITE_ASSETS.join('|')})$`)).refine(v=>SITE_ASSETS.some(asset=>asset===v),'Unsupported site asset').transform(v=>v as SiteAsset);
const rect = z.object({x: z.number(), z: z.number(), w: z.number().positive(), d: z.number().positive()}).strict();
export const sitePresentationSchema = z.object({
  version: z.enum(['staged-site-1', 'staged-site-2']),
  design: z.union([siteDesignSchema, siteDesignV2Schema]),
  fixtures: z.array(z.object({id: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/), asset: z.enum(['lounger', 'table', 'chair', 'sofa', 'coffee-table', 'bollard']), rect, height: z.number().positive(), rotation: z.number(), support: z.string()}).strict()).max(24),
  routes: z.array(z.object({id: z.string(), from: z.string(), to: z.string(), width: z.number().positive()}).strict()).max(12),
}).strict();
