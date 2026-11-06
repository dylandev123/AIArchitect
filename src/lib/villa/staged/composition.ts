/**
 * Architectural composition checks, informed by the accepted Stage 1 vision. Software measures; it never designs.
 * Three tiers, so subjective taste never becomes an endless correction loop:
 *  - `brief-vision-contradiction` (hard): the vision contradicts an explicit brief requirement.
 *  - `vision-*` (correctable): the geometry does not build a promise the vision made. They earn the one bounded
 *    correction; if still unresolved they are accepted and recorded as warnings, never a failed stage.
 *  - `composition-note` (observation): measured, subjective notes. Recorded only.
 * Houses without a structured vision (designed before it existed) are never checked.
 */
import {allRooms, blockRect, overlapArea, rectDiff, area, type R} from './layout';
import {outdoorKind} from './intentions';
import {promptRequirements, poolRequirement} from './requirements';
import {terraceBlocks} from './exterior';
import {wallHeight, wallTopOf, type Block, type HouseSpec, type ScalePlan, type Vision} from './spec';
import type {ArchitecturalScene} from '../scene/model';
import type {Finding} from './validate';

export const CORRECTABLE = /^vision-/;
export const isCorrectableOnly = (findings: Finding[]) => findings.length > 0 && findings.every(f => CORRECTABLE.test(f.code));
const MEASURED_LATER = new Set(['layered-roofs', 'glass-pavilion']);
const UNMEASURED = new Set(['pool-axis', 'framed-garden-view']);

// ---------------------------------------------------------------------------------------------- Stage 1
const MODEST_WORDS = /\b(modest|simple|small|compact|cottage|cabin|bungalow|starter|affordable|budget|tiny|humble)\b/i;
const LUXURY_WORDS = /\b(luxur\w*|mansion|estate|grand|spectacular|palatial|opulent|lavish|prestigious|magnificent)\b/i;

/** Objective contradictions between the vision and explicit brief words. Only clear, quotable evidence counts. */
export function visionBriefFindings(vision: Vision | undefined, brief: string): Finding[] {
  if (!vision) return [];
  const out: Finding[] = [], add = (subject: string, message: string) => out.push({stage: 1, code: 'brief-vision-contradiction', subject, message});
  let storeys: number | undefined;
  try { storeys = promptRequirements(brief).storeys; } catch { storeys = undefined; }
  const features = vision.signatureFeatures.map(f => f.feature);
  if (storeys === 1) {
    for (const f of features.filter(f => ['upper-storey-bar', 'roof-terrace', 'cantilevered-upper-volume'].includes(f))) add(f, `The brief asks for a single storey; signature feature ${f} needs an upper storey.`);
    if (vision.composition === 'stacked-volumes') add('composition', 'The brief asks for a single storey; a stacked-volumes composition needs an upper storey.');
  }
  if (poolRequirement(brief) === 'excluded' && features.includes('pool-axis')) add('pool-axis', 'The brief excludes a pool; pool-axis cannot be a signature feature.');
  // Brief noun phrases qualifying the house, not other items (e.g. "small swimming pool").
  const houseText = brief.replace(/\b(?:modest|simple|small|compact|tiny)\s+(?:swimming\s+)?(?:pool|plunge\s+pool|terrace|garden|patio|deck|veranda|study|office|kitchen|gym|courtyard)\b/gi, ' ');
  const modest = MODEST_WORDS.test(houseText), luxury = LUXURY_WORDS.test(brief);
  if (modest && !luxury && (vision.ambition === 'luxury' || vision.ambition === 'estate')) add('ambition', `The brief describes a ${houseText.match(MODEST_WORDS)![1].toLowerCase()} home; ambition ${vision.ambition} inflates it. Choose modest or comfortable.`);
  if (luxury && !modest && vision.ambition === 'modest') add('ambition', `The brief asks for ${brief.match(LUXURY_WORDS)![1].toLowerCase()} architecture; ambition modest understates it.`);
  const shape = /\bl[ -]?shap(?:e|ed)\b/i.test(brief) ? 'l-shape' : /\bu[ -]?shap(?:e|ed)\b/i.test(brief) ? 'u-courtyard' : undefined;
  if (shape && vision.composition !== shape) add('composition', `The brief asks for an ${shape === 'l-shape' ? 'L' : 'U'}-shaped plan; composition ${vision.composition} contradicts it.`);
  if (vision.scale) {
    const floor = briefScaleFloor(brief), sc = vision.scale;
    if (floor && sc.grossFloorAreaM2 < floor.minGfa) add('scale', `The brief asks for ${floor.reason}; a planned ${Math.round(sc.grossFloorAreaM2)} m² gross floor area is a modest residence. Plan at least ${floor.minGfa} m².`);
    if (storeys === 1 && sc.levels === 2) add('scale', 'The brief asks for a single storey; the scale plan has two levels.');
    if (storeys === 2 && sc.levels === 1) add('scale', 'The brief asks for two storeys; the scale plan has one level.');
  }
  return out;
}

/**
 * The smallest gross floor area that is not plainly a modest residence for a brief that explicitly asks for luxury or
 * an estate with a stated number of bedrooms (a modest six-bedroom house is about 250-330 m²). It is a floor, not a
 * target: the vision's own planned floor area is the target. Only explicit brief words count; a modest brief has none.
 */
export function briefScaleFloor(brief: string): {minGfa: number; reason: string; ambition: 'luxury' | 'estate'} | undefined {
  let bedrooms: number | undefined;
  try { bedrooms = promptRequirements(brief).bedrooms; } catch { bedrooms = undefined; }
  const houseText = brief.replace(/\b(?:modest|simple|small|compact|tiny)\s+(?:swimming\s+)?(?:pool|plunge\s+pool|terrace|garden|patio|deck|veranda|study|office|kitchen|gym|courtyard)\b/gi, ' ');
  if (MODEST_WORDS.test(houseText) || !bedrooms) return undefined;
  const estate = brief.match(/\b(estate|mansion|palatial|resort[- ]scale|extraordinary)\b/i), luxury = brief.match(LUXURY_WORDS) ?? brief.match(/\b(substantial)\b/i);
  if (estate) return {ambition: 'estate', minGfa: 200 + 50 * bedrooms, reason: `an ${estate[1].toLowerCase()} with ${bedrooms} bedrooms`};
  if (luxury) return {ambition: 'luxury', minGfa: 100 + 35 * bedrooms, reason: `${luxury[1].toLowerCase()} architecture with ${bedrooms} bedrooms`};
  return undefined;
}

/** Stage 1: the scale plan must be internally consistent and fit the property (one correction, then a failed stage). */
export function scalePlanConsistency(vision: Vision | undefined, site: HouseSpec['site']): Finding[] {
  const sc = vision?.scale; if (!sc) return [];
  const out: Finding[] = [], add = (subject: string, message: string) => out.push({stage: 1, code: 'scale-plan-inconsistent', subject, message});
  const siteArea = site.width * site.depth;
  if (sc.footprintM2 > 0.45 * siteArea) add('footprint', `A ${Math.round(sc.footprintM2)} m² footprint covers ${Math.round(100 * sc.footprintM2 / siteArea)}% of the ${site.width}×${site.depth} m property; leave room for arrival, garden and pool (at most 45%).`);
  if (sc.grossFloorAreaM2 < 0.95 * sc.footprintM2) add('gross-floor-area', 'Gross floor area cannot be smaller than the ground footprint.');
  if (sc.levels === 1 && sc.grossFloorAreaM2 > 1.1 * sc.footprintM2) add('levels', 'A single-level plan cannot hold more floor area than its footprint; plan two levels or a larger footprint.');
  if (sc.levels === 2 && sc.grossFloorAreaM2 > 2 * sc.footprintM2) add('levels', 'Two levels hold at most twice the footprint.');
  return out;
}

/** Stage 2+: the built massing must not be a modest residence when the brief explicitly asks for luxury or an estate. Hard. */
export function briefScaleFindings(spec: HouseSpec, brief: string, stage: 2 | 3 = 2): Finding[] {
  const floor = briefScaleFloor(brief), m = compositionMetrics(spec);
  return floor && m.grossFloorAreaM2 < floor.minGfa ? [{stage, code: 'brief-scale', subject: 'massing', message: `The brief asks for ${floor.reason}; the massing holds only ${m.grossFloorAreaM2} m² of occupied floor (${m.footprintM2} m² footprint, ${m.levels} level${m.levels > 1 ? 's' : ''}). Bedroom labels alone do not make it one: give the programme at least ${floor.minGfa} m² of real floor area.`}] : [];
}

// ---------------------------------------------------------------------------------------------- measures
export interface CompositionMetrics {
  enclosedBlocks: number; footprintM2: number; heights: Record<string, string>;
  distinctTops: number[]; topRange: number; primary?: string; dominant: string; primaryVolumeShare: number;
  outlineCorners: number; court?: {w: number; d: number; area: number; enclosedSides: number};
  /** Scale and layering (occupied floors; a double-height room counts once). */
  grossFloorAreaM2: number; upperFloorAreaM2: number; levels: number; wings: number; doubleHeightM2: number; tallM2: number;
  /** Upper-floor layering: exposed roof terraces over lower wings, and upper floor projecting past its support. */
  upperTerraceM2: number; cantileverM2: number;
  outdoorEnclosure: Record<string, number>; signatureStatus: Record<string, 'built' | 'missing' | 'checked-at-stage-4' | 'not-measured'>;
}
const round1 = (v: number) => Math.round(v * 10) / 10;
const enclosed = (spec: HouseSpec) => spec.blocks;
/** Highest wall top over a footprint: a ground block carrying an upper block reads as that taller mass. */
function effectiveTop(spec: HouseSpec, b: Block) {
  return Math.max(wallTopOf(b), ...spec.blocks.filter(u => u.level === 1 && b.level === 0 && overlapArea(blockRect(u), blockRect(b)) > 0.5).map(wallTopOf));
}
function effectiveVolume(spec: HouseSpec, b: Block) {
  const own = b.w * b.d * wallHeight(b);
  return b.level === 1 ? own : own + spec.blocks.filter(u => u.level === 1).reduce((s, u) => s + overlapArea(blockRect(u), blockRect(b)) * wallHeight(u), 0);
}

/** Ground footprint on a 0.5 m grid: outline articulation and the largest outdoor room the volumes enclose. */
function footprintGrid(spec: HouseSpec) {
  const ground = spec.blocks.filter(b => b.level === 0).map(blockRect);
  const x0 = Math.min(...ground.map(r => r.x0)), x1 = Math.max(...ground.map(r => r.x1)), z0 = Math.min(...ground.map(r => r.z0)), z1 = Math.max(...ground.map(r => r.z1));
  const step = 0.5, nx = Math.round((x1 - x0) / step), nz = Math.round((z1 - z0) / step);
  const occ: boolean[][] = Array.from({length: nz}, (_, j) => Array.from({length: nx}, (_, i) => { const cx = x0 + (i + 0.5) * step, cz = z0 + (j + 0.5) * step; return ground.some(r => cx > r.x0 && cx < r.x1 && cz > r.z0 && cz < r.z1); }));
  const at = (i: number, j: number) => i >= 0 && j >= 0 && i < nx && j < nz && occ[j][i];
  let corners = 0;
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
    const n = [at(i - 1, j - 1), at(i, j - 1), at(i - 1, j), at(i, j)], k = n.filter(Boolean).length;
    if (k === 1 || k === 3 || (k === 2 && n[0] === n[3])) corners++;
  }
  // Largest empty rectangle inside the bounding box (histogram method).
  let best = {area: 0, i0: 0, i1: 0, j0: 0, j1: 0};
  const h = new Array(nx).fill(0);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) h[i] = occ[j][i] ? 0 : h[i] + 1;
    for (let i = 0; i < nx; i++) {
      let minH = Infinity;
      for (let k = i; k < nx && h[k] > 0; k++) { minH = Math.min(minH, h[k]); const a = minH * (k - i + 1); if (a > best.area) best = {area: a, i0: i, i1: k + 1, j0: j - minH + 1, j1: j + 1}; }
    }
  }
  let court: CompositionMetrics['court'];
  const w = (best.i1 - best.i0) * step, d = (best.j1 - best.j0) * step;
  if (best.area && Math.min(w, d) >= 4 && w * d >= 25) {
    // A side is enclosed where building volumes embrace it: looking outward from the court, a volume is met
    // before the footprint ends (an entry link between court and wing still encloses that side).
    const embraced = (i: number, j: number, di: number, dj: number) => { for (let x = i, y = j; x >= 0 && y >= 0 && x < nx && y < nz; x += di, y += dj) if (occ[y][x]) return true; return false; };
    const range = (a: number, b: number) => Array.from({length: b - a}, (_, k) => a + k);
    const frac = (hits: boolean[]) => hits.length ? hits.filter(Boolean).length / hits.length : 0;
    const sides = [frac(range(best.i0, best.i1).map(i => embraced(i, best.j0 - 1, 0, -1))), frac(range(best.i0, best.i1).map(i => embraced(i, best.j1, 0, 1))), frac(range(best.j0, best.j1).map(j => embraced(best.i0 - 1, j, -1, 0))), frac(range(best.j0, best.j1).map(j => embraced(best.i1, j, 1, 0)))];
    court = {w, d, area: w * d, enclosedSides: sides.filter(s => s >= 0.5).length};
  }
  return {corners, court};
}

export function compositionMetrics(spec: HouseSpec): CompositionMetrics {
  const bs = enclosed(spec), upperRects = bs.filter(b => b.level === 1).map(blockRect);
  // A ground wing only partly under an upper floor has two tops: the upper eave and its own exposed roof terrace.
  const terraceTops = bs.filter(b => b.level === 0 && upperRects.some(u => overlapArea(u, blockRect(b)) > 0.5) && rectDiff(blockRect(b), upperRects).reduce((s, p) => s + area(p), 0) >= 10).map(b => round1(wallTopOf(b)));
  const tops = [...new Set([...bs.filter(b => b.level === 0 || !bs.some(g => g.level === 0 && overlapArea(blockRect(g), blockRect(b)) > 0.5)).map(b => round1(effectiveTop(spec, b))), ...terraceTops])].sort((a, b) => a - b);
  const vol = new Map(bs.map(b => [b.id, effectiveVolume(spec, b)])), total = [...vol.values()].reduce((a, b) => a + b, 0);
  const primary = bs.find(b => b.rank === 'primary'), dominant = [...bs].sort((a, b) => vol.get(b.id)! - vol.get(a.id)!)[0];
  const grid = bs.some(b => b.level === 0) ? footprintGrid(spec) : {corners: 0, court: undefined};
  const outdoorEnclosure: Record<string, number> = {};
  for (const o of spec.openSpaces) {
    const r: R = {x0: o.cx - o.w / 2, x1: o.cx + o.w / 2, z0: o.cz - o.d / 2, z1: o.cz + o.d / 2};
    outdoorEnclosure[o.id] = (['n', 's', 'e', 'w'] as const).filter(s => spec.blocks.some(b => {
      if (b.level !== 0) return false; const q = blockRect(b);
      const along = s === 'n' || s === 's' ? Math.min(q.x1, r.x1) - Math.max(q.x0, r.x0) : Math.min(q.z1, r.z1) - Math.max(q.z0, r.z0);
      const gap = s === 'n' ? r.z0 - q.z1 : s === 's' ? q.z0 - r.z1 : s === 'w' ? r.x0 - q.x1 : q.x0 - r.x1;
      return Math.abs(gap) < 0.05 && along > 0.5 * (s === 'n' || s === 's' ? o.w : o.d);
    })).length;
  }
  return {
    enclosedBlocks: bs.length, footprintM2: Math.round(bs.filter(b => b.level === 0).reduce((s, b) => s + b.w * b.d, 0)),
    heights: Object.fromEntries(bs.map(b => [b.id, `${b.height ?? 'standard'} (level ${b.level}, wall top ${wallTopOf(b).toFixed(1)} m)`])),
    distinctTops: tops, topRange: round1((tops.at(-1) ?? 0) - (tops[0] ?? 0)), primary: primary?.id, dominant: dominant?.id ?? '',
    primaryVolumeShare: primary && total ? +(vol.get(primary.id)! / total).toFixed(2) : 0,
    outlineCorners: grid.corners, court: grid.court, outdoorEnclosure, signatureStatus: {},
    ...scaleMetrics(spec),
  };
}

function scaleMetrics(spec: HouseSpec) {
  const ground = spec.blocks.filter(b => b.level === 0), upper = spec.blocks.filter(b => b.level === 1), sum = (bs: Block[]) => bs.reduce((s, b) => s + b.w * b.d, 0);
  const upperRects = upper.map(blockRect), groundRects = ground.map(blockRect);
  const covered = ground.filter(b => upperRects.some(u => overlapArea(u, blockRect(b)) > 0.01));
  return {
    grossFloorAreaM2: Math.round(sum(spec.blocks)), upperFloorAreaM2: Math.round(sum(upper)), levels: upper.length ? 2 : 1, wings: ground.length,
    doubleHeightM2: Math.round(sum(ground.filter(b => b.height === 'double'))), tallM2: Math.round(sum(ground.filter(b => b.height === 'tall'))),
    upperTerraceM2: Math.round(covered.reduce((s, b) => s + rectDiff(blockRect(b), upperRects).reduce((t, p) => t + area(p), 0), 0)),
    cantileverM2: Math.round(upper.reduce((s, u) => s + rectDiff(blockRect(u), groundRects).reduce((t, p) => t + area(p), 0), 0)),
  };
}

/** Stage 2: the massing builds the scale the vision planned (correctable; accepted with a warning after one correction). */
function scalePlanFindings(spec: HouseSpec, sc: ScalePlan, m: CompositionMetrics, need: (code: string, subject: string, message: string) => void, note: (subject: string, message: string) => void) {
  if (m.grossFloorAreaM2 < 0.8 * sc.grossFloorAreaM2) need('vision-scale', 'gross-floor-area', `The vision plans about ${Math.round(sc.grossFloorAreaM2)} m² of floor area; the massing holds ${m.grossFloorAreaM2} m² (${Math.round(100 * m.grossFloorAreaM2 / sc.grossFloorAreaM2)}%). Enlarge the volumes (blocks may be up to 60 m long) or add the planned wings/upper floor.`);
  else if (m.grossFloorAreaM2 > 1.6 * sc.grossFloorAreaM2) note('gross-floor-area', `The massing holds ${m.grossFloorAreaM2} m², well above the ${Math.round(sc.grossFloorAreaM2)} m² the vision planned.`);
  if (m.footprintM2 < 0.75 * sc.footprintM2) need('vision-scale', 'footprint', `The vision plans about ${Math.round(sc.footprintM2)} m² of ground coverage; the massing covers ${m.footprintM2} m².`);
  if (sc.levels === 2 && m.levels < 2) need('vision-scale', 'levels', 'The vision plans two occupied levels, but no level-1 volume exists. A double-height room is not an upper floor.');
  if (sc.levels === 1 && m.levels > 1) need('vision-scale', 'levels', 'The vision plans one level, but the massing adds an upper floor.');
  if (m.wings < sc.wings) need('vision-scale', 'wings', `The vision plans ${sc.wings} major building parts; the massing has ${m.wings} ground-level volume${m.wings === 1 ? '' : 's'}.`);
  const ground = spec.blocks.filter(b => b.level === 0);
  for (const p of sc.principalSpaces) {
    if (p.height === 'standard' || !['entrance-hall', 'living', 'dining', 'family-room', 'gallery', 'master-suite', 'media-or-games', 'kitchen', 'bedroom-suite'].includes(p.kind)) continue;
    const ok = ground.some(b => (p.height === 'double' ? b.height === 'double' : b.height === 'tall' || b.height === 'double') && b.w * b.d >= 0.6 * p.approxAreaM2);
    if (!ok) need('vision-scale', p.kind, `Principal space "${p.name}" is planned ${p.height === 'double' ? 'double-height' : 'tall'} at about ${Math.round(p.approxAreaM2)} m², but no ${p.height === 'double' ? 'double' : 'tall or double'} ground volume of at least ${Math.round(0.6 * p.approxAreaM2)} m² exists.`);
  }
}

// ---------------------------------------------------------------------------------------------- Stages 2-4
export interface CompositionReport {metrics: CompositionMetrics; findings: Finding[]; observations: Finding[]}

export function compositionReport(spec: HouseSpec, stage: 2 | 3 | 4 | 5, scene?: ArchitecturalScene): CompositionReport {
  const vision = spec.direction.vision, metrics = compositionMetrics(spec), findings: Finding[] = [], observations: Finding[] = [];
  if (!vision || stage === 5) return {metrics, findings, observations};
  const st = stage as Finding['stage'];
  const need = (code: string, subject: string, message: string) => findings.push({stage: st, code, subject, message});
  const note = (subject: string, message: string) => observations.push({stage: st, code: 'composition-note', subject, message});
  const bs = spec.blocks, top = (b: Block) => effectiveTop(spec, b), maxTop = Math.max(...bs.map(top));
  const primaries = bs.filter(b => b.rank === 'primary'), primary = primaries[0];
  const entranceBlocks = bs.filter(b => b.rank === 'entrance' || b.rank === 'feature');
  const features = vision.signatureFeatures.map(f => f.feature);

  if (stage === 2) {
    if (primaries.length !== 1 && bs.some(b => b.rank)) need('vision-primary', 'rank', `Exactly one volume must be ranked primary (the vision's primary volume: ${vision.primaryVolume}); found ${primaries.length}.`);
    if (primary) {
      const bigger = bs.filter(b => b.id !== primary.id && effectiveVolume(spec, b) > effectiveVolume(spec, primary) * 1.05 && top(b) > top(primary) + 0.3);
      for (const b of bigger) need('vision-primary-not-dominant', primary.id, `${primary.id} is ranked primary, but ${b.id} is both larger (${Math.round(effectiveVolume(spec, b))} vs ${Math.round(effectiveVolume(spec, primary))} m³) and taller (${top(b).toFixed(1)} vs ${top(primary).toFixed(1)} m). Make the primary volume dominate by size or height, or rank the dominant volume primary.`);
      if (['refined', 'luxury', 'estate'].includes(vision.ambition) && metrics.primaryVolumeShare < 0.3 && bs.length > 2) note(primary.id, `Primary volume holds only ${Math.round(metrics.primaryVolumeShare * 100)}% of the built volume; its dominance relies on height or position.`);
    }
    const tops = metrics.distinctTops, range = metrics.topRange;
    const hs = vision.heightStrategy;
    if (hs === 'uniform' && tops.length > 1) note('heights', `Height strategy is uniform but volumes reach ${tops.join(' / ')} m.`);
    if (hs === 'gentle-hierarchy' && tops.length < 2) need('vision-height-strategy', 'heights', `The vision's height strategy is gentle-hierarchy, but every volume reaches the same ${tops[0]} m wall top. Give a secondary volume a different height (e.g. low or tall) where the design calls for it.`);
    if (hs === 'pronounced-hierarchy' && (tops.length < 2 || range < 1.5)) need('vision-height-strategy', 'heights', `The vision's height strategy is pronounced-hierarchy, but wall tops span only ${range} m (${tops.join(' / ')} m). Use clearly different heights (tall/double volumes or an upper storey against lower wings).`);
    if (hs === 'vertical-accent') {
      const accent = bs.find(b => top(b) >= maxTop - 1e-6 && bs.every(o => o === b || top(o) <= top(b) - 1.0) && b.w * b.d <= 0.4 * metrics.footprintM2);
      if (!accent) need('vision-height-strategy', 'heights', 'The vision\'s height strategy is vertical-accent, but no compact volume rises at least 1 m above all others.');
    }
    const status = metrics.signatureStatus;
    for (const f of features) {
      if (MEASURED_LATER.has(f)) { status[f] = 'checked-at-stage-4'; continue; }
      if (UNMEASURED.has(f)) { status[f] = 'not-measured'; continue; }
      const built = f === 'double-height-living' ? bs.some(b => b.level === 0 && b.height === 'double')
        : f === 'tall-principal-volume' ? !!primary && (primary.height === 'tall' || primary.height === 'double' || top(primary) > wallTopOf(primary) + 0.1) && top(primary) >= maxTop - 1e-6
        : f === 'entry-tower' ? entranceBlocks.some(b => top(b) >= maxTop - 1e-6 && b.w * b.d <= 64 && (b.height === 'tall' || b.height === 'double' || top(b) > wallTopOf(b) + 0.1))
        : f === 'entrance-volume' ? entranceBlocks.length > 0
        : f === 'courtyard' ? (metrics.court?.enclosedSides ?? 0) >= 3 || Object.values(metrics.outdoorEnclosure).some(n => n >= 3)
        : f === 'covered-veranda' || f === 'loggia' ? spec.openSpaces.some(o => outdoorKind(o) === 'veranda')
        : f === 'roof-terrace' ? terraceBlocks(spec).length > 0
        : f === 'upper-storey-bar' ? bs.some(b => b.level === 1)
        : f === 'cantilevered-upper-volume' ? bs.some(b => b.level === 1 && rectDiff(blockRect(b), bs.filter(g => g.level === 0).map(blockRect)).some(p => Math.min(p.x1 - p.x0, p.z1 - p.z0) >= 1 && area(p) >= 3)) : true;
      status[f] = built ? 'built' : 'missing';
      if (!built) need('vision-signature-missing', f, `Signature feature ${f} (${vision.signatureFeatures.find(x => x.feature === f)!.intent}) is not built by the massing: ${SIGNATURE_HINT[f] ?? ''}`.trim());
    }
    if ((vision.entranceConcept === 'prominent-entry-volume' || vision.entranceConcept === 'tall-entry-hall') && !entranceBlocks.length) need('vision-entrance', 'entrance', `Entrance concept ${vision.entranceConcept} needs a distinct volume ranked entrance.`);
    if (vision.entranceConcept === 'tall-entry-hall' && entranceBlocks.length && !entranceBlocks.some(b => b.height === 'tall' || b.height === 'double')) need('vision-entrance', 'entrance', 'Entrance concept tall-entry-hall needs the entrance volume to be tall or double height.');
    const c = vision.composition, court = metrics.court?.enclosedSides ?? 0, ground = bs.filter(b => b.level === 0).length;
    if (c === 'stacked-volumes' && !bs.some(b => b.level === 1)) need('vision-composition', 'composition', 'Composition stacked-volumes needs at least one level-1 volume.');
    if (c === 'l-shape' && court < 2) need('vision-composition', 'composition', 'Composition l-shape needs volumes forming two sides of an outdoor room.');
    if (c === 'u-courtyard' && court < 3) need('vision-composition', 'composition', `Composition u-courtyard needs a court enclosed on three sides; the largest outdoor room is enclosed on ${court}.`);
    if (c === 'enclosed-courtyard' && court < 4) need('vision-composition', 'composition', `Composition enclosed-courtyard needs a court enclosed on four sides; the largest outdoor room is enclosed on ${court}.`);
    if ((c === 'pavilion-cluster' || c === 'central-hall-with-wings') && ground < 3) need('vision-composition', 'composition', `Composition ${c} needs at least three ground-level volumes.`);
    if (['refined', 'luxury', 'estate'].includes(vision.ambition) && metrics.outlineCorners <= 4) note('outline', 'The ground footprint is a single rectangle: no offsets or setbacks articulate the composition.');
    if (vision.ambition === 'modest' && (bs.length > 4 || metrics.footprintM2 > 260)) note('scale', `A modest vision with ${bs.length} volumes and ${metrics.footprintM2} m² of footprint; check it stays proportional to the brief.`);
    if (vision.scale) scalePlanFindings(spec, vision.scale, metrics, need, note);
  }
  if (stage === 3) {
    const rooms = allRooms(spec);
    if (features.includes('double-height-living')) {
      const doubles = bs.filter(b => b.height === 'double').map(b => b.id);
      if (doubles.length && !rooms.some(r => doubles.includes(r.block) && ['living', 'lounge', 'dining'].includes(r.type))) need('vision-signature-missing', 'double-height-living', `The double-height volume (${doubles.join(', ')}) holds no living, lounge or dining room; put the principal living space in it.`);
    }
    if ((features.includes('entrance-volume') || features.includes('entry-tower') || vision.entranceConcept === 'prominent-entry-volume' || vision.entranceConcept === 'tall-entry-hall') && entranceBlocks.length) {
      const foyer = rooms.find(r => r.type === 'foyer');
      if (foyer && !entranceBlocks.some(b => b.id === foyer.block)) need('vision-entrance', 'foyer', `The foyer is in ${foyer.block}, not in the entrance volume (${entranceBlocks.map(b => b.id).join(', ')}) the vision built for arrival.`);
    }
  }
  if (stage === 4 && scene) {
    const roofTop = (id: string) => { const e = scene.elements.find(x => x.id === `roof-${id}`); return e ? e.at[1] + e.size[1] / 2 : undefined; };
    const peaks = bs.map(b => ({b, t: roofTop(b.id)})).filter((x): x is {b: Block; t: number} => x.t !== undefined);
    const rs = vision.roofStrategy, distinct = [...new Set(peaks.map(p => Math.round(p.t * 4) / 4))];
    const span = peaks.length ? Math.max(...peaks.map(p => p.t)) - Math.min(...peaks.map(p => p.t)) : 0;
    if (rs === 'primary-crown-with-lower-wings' && primary) {
      const own = peaks.find(p => p.b.id === primary.id)?.t ?? Math.max(...peaks.filter(p => overlapArea(blockRect(p.b), blockRect(primary)) > 0.5).map(p => p.t), -Infinity);
      const higher = peaks.filter(p => p.t > own + 0.05 && p.b.id !== primary.id);
      if (higher.length) need('vision-roof-strategy', primary.id, `Roof strategy primary-crown-with-lower-wings, but ${higher.map(p => `${p.b.id} (${p.t.toFixed(1)} m)`).join(', ')} rise above the primary roof (${own.toFixed(1)} m). Lower their pitch or raise the primary pitch.`);
    }
    if ((rs === 'layered-pitched' || features.includes('layered-roofs')) && (distinct.length < 2 || span < 0.8)) need('vision-roof-strategy', 'roofs', `The vision asks for layered roofs, but roof tops span only ${span.toFixed(1)} m. Vary pitch and form so roofs step clearly.`);
    if (rs === 'flat-planes' && peaks.some(p => p.b.roof.form !== 'flat')) need('vision-roof-strategy', 'roofs', 'Roof strategy flat-planes, but some roofs are pitched.');
    if (features.includes('glass-pavilion')) {
      const glassy = bs.some(b => Object.entries(spec.exterior.facades).filter(([k, v]) => k.startsWith(`${b.id}:`) && v === 'glass-wall').length >= 2);
      if (!glassy) need('vision-signature-missing', 'glass-pavilion', 'Signature feature glass-pavilion needs one volume with glass-wall facades on at least two sides.');
    }
    const entryRoom = allRooms(spec).find(r => r.id === spec.exterior.doors.find(d => d.id === spec.exterior.entrance.door)?.room);
    const entryBlock = bs.find(b => b.id === entryRoom?.block);
    if (entryBlock && vision.entranceConcept !== 'discreet' && spec.exterior.entrance.canopy.depth === 0 && !entranceBlocks.includes(entryBlock)) note('entrance', 'The entrance has neither a canopy nor its own volume; arrival may read as discreet.');
  }
  return {metrics, findings, observations};
}

const SIGNATURE_HINT: Record<string, string> = {
  'double-height-living': 'give the living volume height double (one occupied level).',
  'tall-principal-volume': 'make the primary volume tall or double, or crown it with an upper storey, so it is the tallest mass.',
  'entry-tower': 'add a compact entrance/feature volume (≤ 64 m²) that is the tallest mass.',
  'entrance-volume': 'rank a distinct arrival volume entrance.',
  courtyard: 'arrange volumes around an outdoor room enclosed on at least three sides.',
  'covered-veranda': 'add an open veranda/loggia space against its host.', loggia: 'add an open loggia space against its host.',
  'roof-terrace': 'stack a level-1 volume so part of a lower roof becomes a terrace.', 'upper-storey-bar': 'add a level-1 volume.',
  'cantilevered-upper-volume': 'let a level-1 volume project at least 1 m beyond its support (max 3 m).',
};
