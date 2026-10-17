import type { V3Scene, V3SceneObject } from './scene';
import { resolveV3Fidelity } from './fidelity';
import { getObjectBaseY, getObjectTopY, scaledDimensionsOf } from './elevation';
import { footprint, localPlan, footprintOverlap, footprintOverrun } from './reviewGeometry';
import type { JunctionFacade } from './junctions';

/**
 * Deterministic architectural composition review. Purely diagnostic: it never mutates, moves or invents geometry and is
 * never a validation failure. `significant` findings may justify the single bounded design-repair request; `advisory`
 * findings are reported only. Subjective findings are informational regardless of their number.
 */
export type V3DesignReviewCode =
  | 'WEAK_MASS_HIERARCHY' | 'FLUSH_MASS_COMPOSITION' | 'SYMMETRICAL_COMPOSITION' | 'LIMITED_MASSING_DEPTH'
  | 'ENTRY_ARRIVAL_MISMATCH' | 'MISSING_MAIN_ENTRY' | 'BALCONY_ON_SHARED_WALL' | 'INCONSISTENT_MATERIAL_ZONING'
  | 'OUTDOOR_PLACEMENT_CONFLICT' | 'MISSING_REQUESTED_FEATURE' | 'UNSUPPORTED_ARCHITECTURAL_INTENT';
export interface V3DesignDiagnostic {
  code: V3DesignReviewCode;
  severity: 'significant' | 'advisory';
  targetIds: string[];
  message: string;
  /** Specific, actionable instruction for the bounded repair request. Never applied automatically. */
  guidance: string;
}
export interface V3DesignReview { diagnostics: V3DesignDiagnostic[]; significant: number; repairRecommended: boolean }

/** Only objective conflicts justify revision; composition observations never do. */
const CONFLICTS = new Set<V3DesignReviewCode>(['ENTRY_ARRIVAL_MISMATCH', 'BALCONY_ON_SHARED_WALL', 'OUTDOOR_PLACEMENT_CONFLICT', 'MISSING_REQUESTED_FEATURE']);
const TOUCH = .25, OVERLAP = .3, FULL_FACE = .8;
const r1 = (v: number) => Math.round(v * 10) / 10;

interface Box { o: V3SceneObject; x0: number; x1: number; z0: number; z1: number; base: number; top: number; w: number; d: number; h: number; area: number }
function box(o: V3SceneObject): Box {
  const [w, h, d] = scaledDimensionsOf(o), [cx, , cz] = o.transform.position, yaw = o.transform.rotation[1];
  const hx = Math.abs(w / 2 * Math.cos(yaw)) + Math.abs(d / 2 * Math.sin(yaw)), hz = Math.abs(w / 2 * Math.sin(yaw)) + Math.abs(d / 2 * Math.cos(yaw));
  return { o, x0: cx - hx, x1: cx + hx, z0: cz - hz, z1: cz + hz, base: getObjectBaseY(o), top: getObjectTopY(o), w: 2 * hx, d: 2 * hz, h, area: w * d };
}
const overlapX = (a: Box, b: Box) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
const overlapZ = (a: Box, b: Box) => Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0);
const orthogonal = (o: V3SceneObject) => Math.abs(Math.sin(2 * o.transform.rotation[1])) < 1e-3;
const text = (o: V3SceneObject) => `${o.id} ${o.semanticRole} ${o.label}`;
const host = (o: V3SceneObject) => o.hostId ?? o.support?.hostId ?? o.support?.objectId;

/** World +X east, +Z south; returns the facade of `from` (in its local yaw frame) that faces the point. */
function facadeToward(from: V3SceneObject, x: number, z: number): JunctionFacade | undefined {
  const dx = x - from.transform.position[0], dz = z - from.transform.position[2], yaw = from.transform.rotation[1];
  const lx = dx * Math.cos(yaw) - dz * Math.sin(yaw), lz = dx * Math.sin(yaw) + dz * Math.cos(yaw);
  const m = Math.max(Math.abs(lx), Math.abs(lz));
  if (m < .5 || Math.abs(Math.abs(lx) - Math.abs(lz)) < .2 * m) return;
  return Math.abs(lx) > Math.abs(lz) ? lx > 0 ? 'east' : 'west' : lz > 0 ? 'south' : 'north';
}

/** A face-to-face contact between two plan boxes, measured on each participant. */
interface Contact { a: Box; b: Box; faceA: JunctionFacade; length: number; penetration: number }
function contact(a: Box, b: Box): Contact | undefined {
  const ox = overlapX(a, b), oz = overlapZ(a, b);
  if (ox < -TOUCH || oz < -TOUCH || Math.min(a.top, b.top) - Math.max(a.base, b.base) <= .1) return;
  // The thinner overlap is the joint; the longer one is the shared face length.
  if (ox <= oz) return { a, b, faceA: b.x0 + b.x1 > a.x0 + a.x1 ? 'east' : 'west', length: Math.max(0, oz), penetration: Math.max(0, ox) };
  return { a, b, faceA: b.z0 + b.z1 > a.z0 + a.z1 ? 'south' : 'north', length: Math.max(0, ox), penetration: Math.max(0, oz) };
}
const faceLength = (b: Box, f: JunctionFacade) => f === 'east' || f === 'west' ? b.d : b.w;
const flip: Record<JunctionFacade, JunctionFacade> = { north: 'south', south: 'north', east: 'west', west: 'east' };

/** Requested features are read from the brief; satisfaction requires explicit authored objects or semantic fields. */
const FEATURES: Array<{ name: string; asked: RegExp; present: (s: V3Scene, ground: Box[]) => boolean; guidance: string }> = [
  { name: 'swimming pool', asked: /\b(swimming[- ]pool|pool)\b/, present: s => s.objects.some(o => o.type === 'pool' && !/reflect|rill|pond/i.test(text(o))), guidance: 'author a pool object on the garden/view side, hosted by or contained within its terrace' },
  { name: 'courtyard', asked: /\bcourt ?yards?\b/, present: s => s.objects.some(o => o.type === 'courtyard' || /courtyard/i.test(text(o))), guidance: 'author the requested courtyard as an intentional outdoor space' },
  { name: 'double-height space', asked: /\bdouble[- ]height\b/, present: s => s.objects.some(o => o.type === 'building-mass' && (o.composition?.spaceHeight === 'double-height' || ((o.levels ?? 1) === 1 && scaledDimensionsOf(o)[1] >= 5.5))), guidance: 'give the double-height mass composition.spaceHeight:"double-height" (or levels:1 with height of at least 5.5 m); a label alone does not create one' },
  { name: 'balcony', asked: /\bbalcon(y|ies)\b/, present: s => s.objects.some(o => o.type === 'balcony' || o.composition?.assemblies?.some(a => a.parts.some(p => p.type === 'slab' && (p.level ?? 0) > 0))), guidance: 'author an upper-level slab+railing assembly on an exterior, unshared private or view facade' },
  { name: 'driveway', asked: /\b(driveway|arrival drive|motor ?court)\b/, present: s => s.objects.some(o => o.type === 'driveway' || /drive/i.test(o.id)) || !!s.siteHierarchy?.connections.some(c => c.type === 'driveway'), guidance: 'author a driveway leading to the arrival court in front of the main entry' },
  { name: 'garage', asked: /\b(garage|carport)\b/, present: s => s.objects.some(o => /garage|carport/i.test(text(o))), guidance: 'author a garage building-mass on the arrival/service side' },
  { name: 'multiple wings', asked: /\bwings\b/, present: (_, g) => g.length >= 2, guidance: 'author the requested wings without imposing hierarchy or relative size' },
  { name: 'covered loggia/portico', asked: /\b(loggia|portico|colonnade|veranda|covered (outdoor )?(lounge|terrace))s?\b/, present: s => s.objects.some(o => ['veranda', 'canopy'].includes(o.type)) || s.objects.some(o => o.composition?.assemblies?.some(a => a.parts.some(p => p.type === 'post'))), guidance: 'author a canopy/veranda object or a post+beam+slab assembly on the relevant facade' },
  { name: 'roof terrace', asked: /\b(roof ?top|roof) terrace\b/, present: s => s.objects.some(o => o.type === 'terrace' && getObjectBaseY(o) > 2.5), guidance: 'author a terrace object hosted on top of a building mass' },
];
const negated = (brief: string, asked: RegExp) => new RegExp(`\\b(no|without|exclude|excluding)\\s+(\\w+\\s+){0,2}${asked.source.replace(/^\\b/, '')}`, 'i').test(brief);

export function reviewV3ArchitecturalComposition(input: V3Scene, options: { brief?: string } = {}): V3DesignReview {
  const { scene } = resolveV3Fidelity(input);
  const out: V3DesignDiagnostic[] = [];
  const add = (code: V3DesignReviewCode, severity: V3DesignDiagnostic['severity'], targetIds: string[], message: string, guidance: string) => out.push({ code, severity: CONFLICTS.has(code) ? severity : 'advisory', targetIds, message, guidance });
  const observe = (code: V3DesignReviewCode, targetIds: string[], message: string) => add(code, 'advisory', targetIds, message, 'Informational only. Preserve this design choice unless the user requests a change.');
  const byId = new Map(scene.objects.map(o => [o.id, o]));
  const masses = scene.objects.filter(o => o.type === 'building-mass');
  const massBoxes = masses.map(box);
  // Ground masses define plan composition; stacked upper masses are architecture on a host, not wings.
  const ground = masses.filter(m => !host(m) || byId.get(host(m)!)?.type !== 'building-mass').map(box).filter(b => b.base < 1.5);
  const volume = (b: Box) => b.area * b.h;
  const declared = ground.filter(b => b.o.composition?.massHierarchy === 'primary');
  const primary = declared.length === 1 ? declared[0] : [...ground].sort((a, b) => volume(b) - volume(a))[0];
  const secondaries = ground.filter(b => b !== primary && b.o.composition?.massHierarchy !== 'connector');

  // Optional scale observation; comparable or multiple primary masses are legitimate.
  if (primary && secondaries.length) {
    const rival = [...secondaries].sort((a, b) => volume(b) - volume(a))[0];
    const heightRatio = primary.h / rival.h, areaRatio = primary.area / rival.area;
    if (declared.length > 1 || (heightRatio < 1.2 && areaRatio < 1.6)) observe('WEAK_MASS_HIERARCHY', [primary.o.id, rival.o.id], 'Massing has similar scales or multiple primary volumes.');
  }

  // Optional observation of aligned joints; interlocking architecture is legitimate.
  const contacts: Contact[] = [];
  for (let i = 0; i < ground.length; i++) for (let j = i + 1; j < ground.length; j++) {
    if (!orthogonal(ground[i].o) || !orthogonal(ground[j].o)) continue;
    const c = contact(ground[i], ground[j]);
    if (c) contacts.push(c, { a: c.b, b: c.a, faceA: flip[c.faceA], length: c.length, penetration: c.penetration });
  }
  // Connectors are meant to be buried by what they link; they never clamp a primary.
  const buried = (b: Box) => [...new Set(contacts.filter(c => c.a === b && c.b.o.composition?.massHierarchy !== 'connector' && c.length / faceLength(b, c.faceA) >= FULL_FACE).map(c => c.faceA))];
  const pairs = contacts.filter((_, i) => i % 2 === 0);
  // Flush = the shared face covers both participants' faces: no setback at either end of the joint.
  const fullJoints = pairs.filter(c => Math.min(c.length / faceLength(c.a, c.faceA), c.length / faceLength(c.b, flip[c.faceA])) >= FULL_FACE);
  const sandwiched = primary ? buried(primary) : [];
  const opposed = sandwiched.some(f => sandwiched.includes(flip[f]));
  if (primary && (opposed || (ground.length >= 3 && pairs.length >= 2 && fullJoints.length === pairs.length))) {
    observe('FLUSH_MASS_COMPOSITION', [...new Set(pairs.flatMap(c => [c.a.o.id, c.b.o.id]))], 'Massing includes aligned or full-face joints.');
  }

  // Optional mirror symmetry observation.
  if (primary && secondaries.length >= 2) {
    const [px, pz] = [(primary.x0 + primary.x1) / 2, (primary.z0 + primary.z1) / 2];
    const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= Math.max(tol, .1 * Math.max(Math.abs(a), Math.abs(b)));
    const total = secondaries.reduce((s, b) => s + b.area, 0);
    for (const axis of ['x', 'z'] as const) {
      const mirrored = secondaries.filter(b => {
        const [bx, bz] = [(b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2];
        const along = axis === 'x' ? bx - px : bz - pz, across = axis === 'x' ? bz : bx;
        if (Math.abs(along) < .5) return true;
        return secondaries.some(m => m !== b && near(m.w, b.w, 1) && near(m.d, b.d, 1) && Math.abs(m.h - b.h) < .5
          && Math.abs((axis === 'x' ? (m.x0 + m.x1) / 2 - px : (m.z0 + m.z1) / 2 - pz) + along) < 1 && Math.abs((axis === 'x' ? (m.z0 + m.z1) / 2 : (m.x0 + m.x1) / 2) - across) < 2);
      });
      const score = mirrored.reduce((s, b) => s + b.area, 0) / total;
      if (score >= .7) {
        observe('SYMMETRICAL_COMPOSITION', mirrored.map(b => b.o.id), `${Math.round(score * 100)}% of the compared floor plate mirrors across the ${axis === 'x' ? 'north–south' : 'east–west'} axis.`);
        break;
      }
    }
  }

  // Optional observation of recessed/aligned volumes; neither requires revision.
  if (primary && orthogonal(primary.o)) {
    const joined = contacts.filter(c => c.a === primary).map(c => c.b);
    const open = (['north', 'south', 'east', 'west'] as const).filter(f => !sandwiched.includes(f));
    const advance = (f: JunctionFacade, b: Box) => f === 'north' ? b.z0 - primary.z0 : f === 'south' ? primary.z1 - b.z1 : f === 'west' ? b.x0 - primary.x0 : primary.x1 - b.x1;
    const flanking = (f: JunctionFacade) => joined.filter(b => f === 'north' || f === 'south' ? overlapZ(primary, b) > 0 : overlapX(primary, b) > 0);
    if (joined.length && open.every(f => flanking(f).some(b => advance(f, b) < 1))) {
      observe('LIMITED_MASSING_DEPTH', [primary.o.id, ...joined.map(b => b.o.id)], 'Main volume is aligned or recessed relative to its neighbors.');
    }
  }

  // 5. Entry orientation against actual arrival geometry (after the deterministic fidelity reconciliation).
  const arrival = scene.objects.filter(o => o.type === 'driveway' || (['courtyard', 'path', 'stair', 'terrace'].includes(o.type) && /arrival|entry|entrance|forecourt|motor/i.test(text(o))));
  if (arrival.length) {
    const cx = arrival.reduce((s, o) => s + o.transform.position[0], 0) / arrival.length, cz = arrival.reduce((s, o) => s + o.transform.position[2], 0) / arrival.length;
    const entries = masses.filter(m => m.composition?.mainEntry);
    for (const m of entries) {
      const door = m.composition!.openings?.find(o => o.id === m.composition!.mainEntry!.openingId), toward = facadeToward(m, cx, cz);
      // A long/wrapping approach may reach the entry despite its centroid lying elsewhere.
      // Require all authored approach geometry to lie behind the door's outward plane.
      const [w,,depth] = scaledDimensionsOf(m);
      const approach = [...arrival.flatMap(o => footprint(o)), ...(scene.siteHierarchy?.connections ?? []).flatMap(c => c.route.map(p => [p[0],p[2]] as [number,number]))].map(p => localPlan(m,p));
      const behind = door && approach.length > 0 && approach.every(([x,z]) => door.facade === 'north' ? z > depth/2 : door.facade === 'south' ? z < -depth/2 : door.facade === 'east' ? x < -w/2 : x > w/2);
      if (door && toward && door.facade !== toward && behind) add('ENTRY_ARRIVAL_MISMATCH', 'significant', [m.id, ...arrival.map(o => o.id)],
        `Main entry ${door.id} is on the ${door.facade} facade of ${m.id}, but the arrival objects lie to its ${toward}.`,
        `Move the mainEntry door (and the arrival facadeRole) of ${m.id} to its ${toward} facade, or relocate the arrival court/driveway in front of the door.`);
    }
    if (!entries.length && primary) add('MISSING_MAIN_ENTRY', 'advisory', [primary.o.id], 'Arrival objects exist but no mass declares composition.mainEntry; the front door is unidentified.',
      `Author a ground-floor door on the ${facadeToward(primary.o, cx, cz) ?? 'arrival'} facade of ${primary.o.id} and reference it from composition.mainEntry.`);
  }

  // 6. Balconies on shared (interior) walls.
  for (const m of masses) for (const assembly of m.composition?.assemblies ?? []) {
    const [w,h,d] = scaledDimensionsOf(m), base = getObjectBaseY(m), yaw = m.transform.rotation[1];
    for (const slab of assembly.parts) {
      if (slab.type !== 'slab' || ((slab.level ?? 0) === 0 && (slab.elevation ?? 0) < 2)) continue;
      const alongX = slab.facade === 'north' || slab.facade === 'south', span = alongX ? w : d;
      const along = ((slab.start+slab.end)/2-.5)*span;
      const across = (alongX ? d : w)/2+slab.depth/2;
      const x = alongX ? along : slab.facade === 'east' ? across : -across;
      const z = alongX ? slab.facade === 'south' ? across : -across : along;
      const y = base+(slab.level ?? 0)*h/(m.levels ?? 1)+(slab.elevation ?? 0);
      const probe: V3SceneObject = { ...m, architecture: undefined, dimensions: alongX ? [(slab.end-slab.start)*span,1,slab.depth] : [slab.depth,1,(slab.end-slab.start)*span], transform: { position: [m.transform.position[0]+x*Math.cos(yaw)+z*Math.sin(yaw),y+.5,m.transform.position[2]-x*Math.sin(yaw)+z*Math.cos(yaw)], rotation: [0,yaw,0], scale:[1,1,1] } };
      const hit = masses.find(other => other.id !== m.id && y < getObjectTopY(other)-.1 && y+1 > getObjectBaseY(other) && footprintOverlap(probe,other) > .3);
      if (hit) { add('BALCONY_ON_SHARED_WALL','significant',[m.id,hit.id], `Balcony assembly ${assembly.id} overlaps occupied mass ${hit.id}.`, `Move only assembly ${assembly.id} of ${m.id} to a clear exterior facade; preserve other assemblies and openings.`); break; }
    }
  }
  for (const b of scene.objects.filter(o => o.type === 'balcony').map(box)) {
    const inside = massBoxes.find(g => g.o.id !== host(b.o) && footprintOverlap(b.o, g.o) > OVERLAP && b.base < g.top && b.top > g.base);
    if (inside) add('BALCONY_ON_SHARED_WALL', 'significant', [b.o.id, inside.o.id], `Balcony ${b.o.id} overlaps building mass ${inside.o.id}.`, `Place ${b.o.id} against an exterior facade of its host, clear of ${inside.o.id}.`);
  }

  // Palette size is descriptive, never a material-count limit or quality judgment.
  const wallFinishes = new Set(masses.map(m => m.material.id));
  if (wallFinishes.size > 1) observe('INCONSISTENT_MATERIAL_ZONING', masses.map(m => m.id), `The design uses ${wallFinishes.size} wall finishes; coordination is a design judgment.`);

  // 8. Outdoor placement conflicts: ground-level outdoor objects inside buildings, and pools overrunning their terrace.
  const outdoor = scene.objects.filter(o => ['terrace', 'deck', 'pool', 'courtyard'].includes(o.type));
  // A terrace tucked a little under an eave or wall line is tolerated; a material share of the object inside a building is not.
  for (const o of outdoor.map(box)) {
    // A roof terrace/deck can share its bearing slab with an upper mass on the same host.
    const commonSlab = (g: Box) => ['terrace','deck'].includes(o.o.type) && host(o.o) && host(o.o) === host(g.o) && Math.abs(o.base-g.base) < .25;
    const hits = massBoxes.filter(g => g.o.id !== host(o.o) && !commonSlab(g)).map(g => ({ g, ox: overlapX(o, g), oz: overlapZ(o, g) }))
      .filter(({ g }) => o.base < g.top - .5 && (o.o.type === 'pool' ? o.top >= g.base - .25 : o.top > g.base + .05) && footprintOverlap(o.o,g.o) > Math.max(.3,.15*o.area));
    if (hits.length) add('OUTDOOR_PLACEMENT_CONFLICT', 'significant', [o.o.id, ...hits.map(h => h.g.o.id)],
      `${o.o.type} ${o.o.id} overlaps ${hits.map(h => `${h.g.o.id} by ${r1(h.ox)} × ${r1(h.oz)} m`).join(' and ')}.`,
      `Move or resize ${o.o.id} so it sits outside the building against an open facade (keep its programme), preserve the building masses.`);
  }
  for (const pool of scene.objects.filter(o => o.type === 'pool')) {
    const terrace = byId.get(host(pool) ?? '');
    if (!terrace || !['terrace', 'deck'].includes(terrace.type)) continue;
    const overrun = footprintOverrun(pool, terrace);
    if (overrun > OVERLAP) add('OUTDOOR_PLACEMENT_CONFLICT', 'significant', [pool.id, terrace.id], `Pool ${pool.id} extends ${r1(overrun)} m beyond its host terrace ${terrace.id}.`,
      `Enlarge ${terrace.id} or move ${pool.id} so the pool lies within its terrace with a coping margin.`);
  }

  // 9. Requested major features named in the brief but absent as authored intent.
  const brief = options.brief?.toLowerCase() ?? '';
  for (const f of FEATURES) if (f.asked.test(brief) && !negated(brief, f.asked) && !f.present(scene, ground))
    add('MISSING_REQUESTED_FEATURE', 'significant', ['scene'], `The brief asks for a ${f.name}, but the scene has no authored ${f.name}.`, `Add the requested ${f.name}: ${f.guidance}.`);

  // A capability gap is explicit information, not an invitation to invent a substitute roof.
  for (const o of scene.objects) {
    const intent = o.unsupportedIntent?.roofForm ?? (['roof-form','building-mass'].includes(o.type) ? /\b(butterfly|mansard|gambrel|sawtooth|barrel[- ]vault|dome|hyperbolic)\b/i.exec(`${o.label} ${o.semanticRole}`)?.[0] : undefined);
    if (intent) out.push({ code: 'UNSUPPORTED_ARCHITECTURAL_INTENT', severity: 'advisory', targetIds: [o.id], message: `Named roof intent "${intent}" is unsupported; displayed geometry is a preview, not that roof system.`, guidance: 'Preserve the named intent. Do not substitute another roof family or automatically revise it.' });
  }

  const significant = out.filter(d => d.severity === 'significant');
  const repairRecommended = significant.some(d => CONFLICTS.has(d.code));
  return { diagnostics: out, significant: significant.length, repairRecommended };
}

/** Bounded, specific feedback for the one design-repair request. */
export function v3DesignRepairInstructions(review: V3DesignReview): string[] {
  return review.diagnostics.filter(d => d.severity === 'significant').slice(0, 12).map(d => `${d.code} [${d.targetIds.join(', ')}]: ${d.message} Fix: ${d.guidance}`);
}
