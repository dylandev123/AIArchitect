/**
 * Measured Stage 5 feasibility of an accepted house, computed by running the real site derivation (no model call).
 * Access problems that exist with no pool at all are reported as site blockers, never attributed to pool placement.
 */
import {POOL_SCALES, type SiteDesignV2} from './siteContract';
import {deriveSiteGeneral, gardenAnchor, siteContext} from './siteGeneral';
import {poolRequirement} from './requirements';
import type {HouseSpec} from './spec';
import type {Finding} from './validate';

type Scale = keyof typeof POOL_SCALES;
type Anchor = SiteDesignV2['pool']['anchor'];
/** Findings about reaching and walking around the house; none of them depends on the landscape choices probed here. */
const ACCESS = new Set(['site-entrance', 'arrival-space', 'garden-route', 'garden-side']);
const probe = (scale: SiteDesignV2['pool']['scale'], anchor: Anchor): SiteDesignV2 => ({statement: 'probe', pool: {scale, anchor, separation: 'close', water: 'turquoise'}, terrace: {finish: 'limestone', sunbeds: 'none', social: 'none'}, arrival: {finish: 'limestone', character: 'garden-court'}, planting: {trees: 'palm', count: 'four', stature: 'medium', beds: 'restrained', lawn: 'open-lawn'}, lighting: 'arrival-only', intentions: []});

export interface SiteFeasibility {
  /** Pool-independent access blockers: no Stage 5 answer, with or without a pool, can be constructed. */
  blockers: Finding[];
  requirement: ReturnType<typeof poolRequirement>;
  /** Pool placement measured per anchor and scale (only meaningful when there are no blockers). */
  options: Record<string, Record<Scale, string>>;
  /** At least one acceptable pool choice exists ("none" counts only when a pool is neither required nor reserved). */
  feasible: boolean;
}

/** Access blockers of the accepted geometry with no pool at all (pool reservations treated as open ground). */
export function siteAccessBlockers(spec: HouseSpec): Finding[] {
  const withoutPool: HouseSpec = {...spec, openSpaces: spec.openSpaces.filter(o => !siteContext(spec).pools.some(p => p.id === o.id))};
  return deriveSiteGeneral(withoutPool, probe('none', 'veranda'), '').findings.filter(f => ACCESS.has(f.code));
}

/** Pure function of (spec, brief): the preflight, the Stage 5 request and its size probe share one measurement. */
const cache = new Map<string, SiteFeasibility>();
export function siteFeasibility(spec: HouseSpec, brief: string): SiteFeasibility {
  const key = brief + '\u0000' + JSON.stringify(spec), hit = cache.get(key);
  if (hit) return structuredClone(hit);
  const value = measureFeasibility(spec, brief);
  if (cache.size >= 16) cache.delete(cache.keys().next().value!);
  cache.set(key, value);
  return structuredClone(value);
}

function measureFeasibility(spec: HouseSpec, brief: string): SiteFeasibility {
  const blockers = siteAccessBlockers(spec), requirement = poolRequirement(brief), ctx = siteContext(spec), options: SiteFeasibility['options'] = {};
  for (const anchor of ['pool-intention', 'veranda', 'living-room'] as const) {
    const a = gardenAnchor(spec, anchor);
    if (!a || (anchor === 'pool-intention' && !ctx.pools.length) || (anchor === 'veranda' && !a.source.startsWith('veranda')) || (anchor === 'living-room' && !a.source.startsWith('living'))) continue;
    options[`${anchor} (${a.source}, garden side ${a.side})`] = Object.fromEntries((Object.keys(POOL_SCALES) as Scale[]).map(scale => {
      if (blockers.length) return [scale, `not assessed: site access is blocked independently of any pool (${blockers[0].message})`];
      const f = deriveSiteGeneral(spec, probe(scale, anchor), brief).findings.find(x => x.code.startsWith('pool') || ACCESS.has(x.code));
      // With no blocker, an access failure here is caused by this pool (e.g. its envelope cuts the only drive).
      return [scale, f ? `does not fit: ${ACCESS.has(f.code) ? `this pool would obstruct site access: ${f.message}` : f.message}` : 'fits'];
    })) as Record<Scale, string>;
  }
  const reserved = ctx.pools.length > 0 && requirement !== 'excluded';
  const fits = Object.entries(options).some(([k, v]) => (!ctx.pools.length || k.startsWith('pool-intention')) && Object.values(v).some(x => x === 'fits'));
  const feasible = !blockers.length && (requirement === 'required' || reserved ? fits : true);
  return {blockers, requirement, options, feasible};
}

/** Findings that stop Stage 5 before any provider call when no acceptable site answer exists. */
export function stage5Preflight(spec: HouseSpec, brief: string): Finding[] {
  const f = siteFeasibility(spec, brief);
  if (f.feasible) return [];
  if (f.blockers.length) return f.blockers.map(b => ({...b, stage: 5 as const, code: 'site-infeasible', message: `Site access is blocked by accepted architecture: ${b.message}`}));
  return [{stage: 5, code: 'site-infeasible', subject: 'pool', message: `The brief or massing requires a pool, but no measured pool placement fits the accepted house: ${JSON.stringify(f.options).slice(0, 300)}`}];
}
