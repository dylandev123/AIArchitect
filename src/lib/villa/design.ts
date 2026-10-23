import { z } from 'zod';

export const STYLES = ['modern', 'caribbean', 'spanish', 'tuscan'] as const;
export type VillaStyle = typeof STYLES[number];
export const STYLE_RULES = {
  modern: { label: 'Modern Contemporary', name: 'Villa Aurea', character: 'Floating planes. Open horizons.', compositions: ['stepped', 'garden-l'], roofs: ['flat'], exterior: 'ivory', roof: 'flat', glazing: 'panoramic', landscape: 'tropical' },
  caribbean: { label: 'Caribbean Tropical', name: 'Villa Alizé', character: 'Deep shade. Island breezes.', compositions: ['pavilions', 'courtyard'], roofs: ['hip', 'gable'], exterior: 'ivory', roof: 'hip', glazing: 'panoramic', landscape: 'tropical' },
  spanish: { label: 'Spanish Hacienda', name: 'Casa del Patio', character: 'Quiet courtyards. Sunlit arches.', compositions: ['courtyard', 'garden-l'], roofs: ['hip', 'gable'], exterior: 'sand', roof: 'hip', glazing: 'divided', landscape: 'mediterranean' },
  tuscan: { label: 'Tuscan Estate', name: 'Tenuta Oliva', character: 'Warm stone. A life outdoors.', compositions: ['garden-l', 'courtyard', 'stepped'], roofs: ['hip', 'gable'], exterior: 'warm-stone', roof: 'gable', glazing: 'divided', landscape: 'mediterranean' },
} as const;

export const villaSchema = z.object({
  style: z.enum(STYLES), composition: z.enum(['stepped', 'garden-l', 'courtyard', 'pavilions']),
  scale: z.number().min(.85).max(1.05), wingRatio: z.number().min(.85).max(1.1),
  levels: z.union([z.literal(1), z.literal(2)]), exterior: z.enum(['ivory', 'sand', 'limestone', 'warm-stone']),
  roof: z.enum(['flat', 'hip', 'gable']), glazing: z.enum(['panoramic', 'divided']),
  verandaDepth: z.number().min(1.6).max(2.8), terraceDepth: z.number().min(1.6).max(2.8),
  pool: z.object({ enabled: z.boolean(), width: z.number().min(10).max(18), depth: z.number().min(4).max(6.4) }).strict(),
  landscape: z.enum(['tropical', 'mediterranean']),
}).strict().superRefine((c, ctx) => {
  const rule = STYLE_RULES[c.style];
  if (!(rule.compositions as readonly string[]).includes(c.composition)) ctx.addIssue({ code: 'custom', path: ['composition'], message: `Unsupported composition for ${rule.label}` });
  if (!(rule.roofs as readonly string[]).includes(c.roof)) ctx.addIssue({ code: 'custom', path: ['roof'], message: `Unsupported roof for ${rule.label}` });
});
export type VillaConfig = z.infer<typeof villaSchema>;
export const villaPatchSchema = z.object({
  style: z.enum(STYLES).optional(), composition: z.enum(['stepped', 'garden-l', 'courtyard', 'pavilions']).optional(),
  scale: z.number().min(.85).max(1.05).optional(), wingRatio: z.number().min(.85).max(1.1).optional(),
  levels: z.union([z.literal(1), z.literal(2)]).optional(), exterior: z.enum(['ivory', 'sand', 'limestone', 'warm-stone']).optional(),
  roof: z.enum(['flat', 'hip', 'gable']).optional(), glazing: z.enum(['panoramic', 'divided']).optional(),
  verandaDepth: z.number().min(1.6).max(2.8).optional(), terraceDepth: z.number().min(1.6).max(2.8).optional(),
  pool: z.object({ enabled: z.boolean().optional(), width: z.number().min(10).max(18).optional(), depth: z.number().min(4).max(6.4).optional() }).strict().optional(),
  landscape: z.enum(['tropical', 'mediterranean']).optional(),
}).strict();
export type VillaPatch = z.infer<typeof villaPatchSchema>;
export function defaultVilla(style: VillaStyle): VillaConfig {
  const r = STYLE_RULES[style];
  return villaSchema.parse({ style, composition: r.compositions[0], scale: 1, wingRatio: 1, levels: 2,
    exterior: r.exterior, roof: r.roof, glazing: r.glazing, verandaDepth: style === 'caribbean' ? 2.8 : 2.2,
    terraceDepth: 2.3, pool: { enabled: true, width: 17, depth: 6.2 }, landscape: r.landscape });
}
/** The sole executor for manual and Terra updates. Partial edits deep-merge the pool and reject unsupported combinations. */
export function executeVillaPatch(current: VillaConfig, input: unknown): VillaConfig {
  const patch = villaPatchSchema.parse(input);
  const next = { ...current, ...patch, pool: { ...current.pool, ...patch.pool } };
  if (patch.style && patch.style !== current.style) {
    const rule = STYLE_RULES[patch.style];
    if (!patch.roof && !(rule.roofs as readonly string[]).includes(next.roof)) next.roof = rule.roof;
    if (!patch.composition && !(rule.compositions as readonly string[]).includes(next.composition)) next.composition = rule.compositions[0];
  }
  return villaSchema.parse(next);
}

export interface VillaBay { id: string; x: number; z: number; width: number; depth: number; floors: 1 | 2; upperSetback: number }
/** Four compatible arrangements of the same bays, never four independently authored house meshes. */
export function composeVilla(c: VillaConfig): VillaBay[] {
  const s = c.scale, wing = 7 * c.wingRatio;
  const bay = (id: string, x: number, z: number, width: number, depth: number, floors: 1 | 2, upperSetback = 0): VillaBay =>
    ({ id, x: x * s, z: z * s, width: width * s, depth: depth * s, floors, upperSetback });
  if (c.composition === 'courtyard') return [
    bay('hall', 0, -6, 11, 7, c.levels, .7),
    bay('west', -(5.5 + wing / 2), -2.25, wing, 14.5, 1),
    bay('east', 5.5 + wing / 2, -2.25, wing, 14.5, 1),
  ];
  if (c.composition === 'garden-l') return [
    bay('hall', -3, -4.5, 17, 7, c.levels, .8),
    bay('east', 5.5 + wing / 2, -1.5, wing, 13, 1),
  ];
  return [
    bay('hall', 0, -3.7, 5, 7.6, 1),
    bay('west', -(2.5 + (wing + 3) / 2), -2, wing + 3, 11, c.levels, c.composition === 'stepped' ? 1.2 : .5),
    bay('east', 2.5 + wing / 2, -1, wing, 11, 1),
  ];
}
export const FINISHES = {
  ivory: { color: '#e4dfd1', surface: 'render' }, sand: { color: '#dfcbb0', surface: 'render' },
  limestone: { color: '#c6bca3', surface: 'stone' }, 'warm-stone': { color: '#bba17a', surface: 'stone' },
} as const;
