/** Disposable architectural input. Accepted geometry lives only in the existing V3 scene. */
import { z } from 'zod';
import { architecturalPlanEnvelope } from './architecturalBlueprint';
import { v3FootprintSchema, type V3Footprint } from './footprintSchema';
import { architecturalConceptSchema, prepareArchitecturalConcept, type ConceptFinding, type ConceptResult } from './architecturalConcept';

const n = z.number().finite();
const size = n.min(1).max(150);
const name = z.string().regex(/^[a-z][a-z0-9-]{0,47}$/);
const text = z.string().min(1).max(2000);
const side = z.enum(['north', 'east', 'south', 'west']);
const corner = z.enum(['nw', 'ne', 'se', 'sw']);
const notch = { corner, width: size, depth: size };
const recess = z.object({ side, width: size, depth: size, offset: n.default(0) }).strict();
const rectangle = { width: size, depth: size };
const plan = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('rectangle'), ...rectangle }).strict(),
  z.object({ kind: z.literal('l'), ...rectangle, cut: z.object(notch).strict() }).strict(),
  z.object({ kind: z.literal('u'), ...rectangle, court: recess }).strict(),
  z.object({ kind: z.literal('outline'), segments: z.array(v3FootprintSchema.shape.segments.unwrap().element.omit({ id: true }).extend({ id: name.optional() })).min(1).max(64) }).strict(),
]);
export const compactMassingSchema = z.object({
  format: z.literal('terra-massing-1'),
  title: text, concept: text,
  site: architecturalConceptSchema.shape.site,
  volumes: z.array(z.object({
    name, role: text.default('residence'), plan,
    // Exactly one placement form. Attach inherits host yaw; offset runs +X / +Z locally.
    at: z.tuple([n.min(-250).max(250), n.min(-250).max(250)]).optional(),
    rotation: n.min(-180).max(180).optional(),
    attach: z.object({ to: name, side, offset: n.default(0) }).strict().optional(),
    heights: z.array(n.min(2.4).max(8)).min(1).max(12),
    roof: architecturalConceptSchema.shape.buildings.element.shape.roof,
    recesses: z.array(recess).max(12).default([]),
    upperSetbacks: z.array(z.object(notch).strict()).max(4).default([]),
  }).strict()).min(1).max(12),
  assumptions: z.array(text).max(12).default([]),
}).strict();
export type CompactMassing = z.input<typeof compactMassingSchema>;
type Volume = z.output<typeof compactMassingSchema>['volumes'][number];
type Concept = z.input<typeof architecturalConceptSchema>;
type Building = Concept['buildings'][number];
export const compactMassingEnabled = () => process.env.NODE_ENV === 'development' && process.env.AI_V3_CONCEPT_EVALUATION === '1' && process.env.AI_V3_COMPACT_MASSING_EVALUATION === '1';

type Expansion = { ok: true; concept: Concept } | { ok: false; findings: ConceptFinding[] };
/** Arithmetic only: references, centred bounds, ids and facade fractions; never an AI translation. */
export function expandCompactMassing(input: unknown): Expansion {
  const parsed = compactMassingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, findings: parsed.error.issues.map(i => ({ code: 'MASSING_INPUT', targetId: i.path.join('.'), message: i.message })) };
  const c = parsed.data, findings: ConceptFinding[] = [];
  const add = (code: string, targetId: string, message: string) => findings.push({ code, targetId, message });
  const byName = new Map<string, Volume>();
  for (const v of c.volumes) {
    if (byName.has(v.name)) add('MASSING_DUPLICATE_NAME', v.name, 'Volume names must be unique so references have one meaning.');
    byName.set(v.name, v);
  }
  if (findings.length) return { ok: false, findings };
  const buildings = new Map<string, Building>(), visiting = new Set<string>(), failed = new Set<string>();
  function resolve(v: Volume): Building | undefined {
    if (buildings.has(v.name)) return buildings.get(v.name)!;
    if (failed.has(v.name)) return;
    if (visiting.has(v.name)) { add('MASSING_REFERENCE_CYCLE', v.name, 'Attachment cycle: provide one absolute placement for each connected group.'); return; }
    visiting.add(v.name);
    try {
      const target = `volumes.${v.name}`;
      if (!!v.at === !!v.attach || (v.attach && v.rotation !== undefined)) {
        add('MASSING_AMBIGUOUS_PLACEMENT', target, 'Choose at (+ optional rotation) OR attach (inherits host rotation), exclusively.'); return;
      }
      const p = v.plan;
      if (p.kind === 'outline' && (v.recesses.length || v.upperSetbacks.length)) {
        add('MASSING_OUTLINE_EDITS_UNSUPPORTED', target, 'Exact outlines cannot also receive recesses or per-storey edits. Author the exact boundary or use a rectangular envelope.'); return;
      }
      const ops: V3Footprint['operations'] = [];
      const width = p.kind === 'outline' ? 0 : p.width, depth = p.kind === 'outline' ? 0 : p.depth;
      if (p.kind === 'l') ops.push({ type: 'notch', ...p.cut, floors: 'all' });
      function cut(r: z.output<typeof recess>, floors: 'all' | 'upper') {
        const span = ['north', 'south'].includes(r.side) ? width : depth;
        const across = ['north', 'south'].includes(r.side) ? depth : width;
        if (r.width + 2 * Math.abs(r.offset) >= span || r.depth >= across) {
          add('MASSING_RECESS_RANGE', target, 'Recess must retain both side wings and a back wall inside the envelope; no clipping is allowed.'); return;
        }
        ops.push({ type: 'recess', facade: r.side, start: .5 + (r.offset - r.width / 2) / span, end: .5 + (r.offset + r.width / 2) / span, depth: r.depth, floors });
      }
      if (p.kind === 'u') cut(p.court, 'all');
      v.recesses.forEach(r => cut(r, 'all'));
      if (v.upperSetbacks.length && v.heights.length < 2) add('MASSING_SETBACK_WITHOUT_UPPER', target, 'An upper setback requires at least two storeys.');
      ops.push(...v.upperSetbacks.map(s => ({ type: 'notch' as const, ...s, floors: 'upper' as const })));
      for (const op of ops) if (op.type === 'notch' && (op.width >= width || op.depth >= depth)) add('MASSING_NOTCH_RANGE', target, 'A corner cut must be smaller than both envelope spans.');
      // V3's legacy articulated builder can trim recess intervals against corner cuts.
      // Refuse those combinations before lowering, so no requested span is ever clipped.
      for (const floor of [0, 1]) {
        const active = ops.filter(o => o.floors !== 'upper' || floor > 0);
        for (const op of active) if (op.type === 'recess') {
          const span = ['north', 'south'].includes(op.facade) ? width : depth;
          for (const other of active) if (other.type === 'notch') {
            const ends = { north: ['nw', 'ne'], south: ['sw', 'se'], east: ['ne', 'se'], west: ['nw', 'sw'] }[op.facade];
            const end = ends.indexOf(other.corner), reserve = ['north', 'south'].includes(op.facade) ? other.width : other.depth;
            if ((end === 0 && op.start * span < reserve - 1e-8) || (end === 1 && op.end * span > span - reserve + 1e-8)) add('MASSING_CLIPPED_RECESS', target, `A ${op.facade} recess intersects a ${other.corner} cut on floor ${floor}. Choose nonoverlapping spans.`);
          }
        }
      }
      let bounds: ReturnType<typeof architecturalPlanEnvelope>;
      if (p.kind === 'outline') {
        const footprint = { kind: 'outline' as const, operations: [], segments: p.segments.map((s, i) => ({ ...s, id: s.id ?? `edge-${i + 1}` })) };
        const exact = v3FootprintSchema.safeParse(footprint);
        if (!exact.success) { add('MASSING_OUTLINE_INPUT', target, exact.error.issues.map(i => i.message).join('; ')); return; }
        bounds = architecturalPlanEnvelope({ kind: 'outline', segments: exact.data.segments! });
      } else {
        bounds = architecturalPlanEnvelope(ops.length ? { kind: 'articulated', width, depth, operations: ops.map((o, i) => ({ ...o, id: `cut-${i + 1}` })) } : { kind: 'rectangle', width, depth });
      }
      let x = v.at?.[0] ?? 0, z = v.at?.[1] ?? 0, rotationDegrees = v.rotation ?? 0;
      if (v.attach) {
        const host = byName.get(v.attach.to);
        if (!host) { add('MASSING_UNKNOWN_REFERENCE', target, `Attachment host "${v.attach.to}" does not exist.`); return; }
        const b = resolve(host);
        if (!b) return;
        if (b.footprint || bounds.footprint) { add('MASSING_ATTACHMENT_UNSUPPORTED', target, 'Attachments require two rectangular volumes. Articulated or curved Boolean junctions are unsupported.'); return; }
        rotationDegrees = b.rotationDegrees ?? 0;
        const alongX = ['north', 'south'].includes(v.attach.side);
        if (Math.abs(v.attach.offset) >= ((alongX ? b.width + bounds.width : b.depth + bounds.depth) / 2) - 1e-6) { add('MASSING_ATTACHMENT_NO_FACE', target, 'The attachment offset leaves no shared wall span. Corner-only contact is unsupported.'); return; }
        const dx = alongX ? v.attach.offset : (v.attach.side === 'east' ? 1 : -1) * (b.width + bounds.width) / 2;
        const dz = alongX ? (v.attach.side === 'south' ? 1 : -1) * (b.depth + bounds.depth) / 2 : v.attach.offset;
        const a = rotationDegrees * Math.PI / 180;
        x = b.x + dx * Math.cos(a) + dz * Math.sin(a);
        z = b.z - dx * Math.sin(a) + dz * Math.cos(a);
      }
      const b: Building = { id: `mass-${v.name}`, label: v.name, role: v.role, x, z, rotationDegrees, ...bounds, storeyHeights: v.heights, roof: v.roof };
      buildings.set(v.name, b); return b;
    } finally {
      visiting.delete(v.name);
      if (!buildings.has(v.name)) failed.add(v.name);
    }
  }
  c.volumes.forEach(resolve);
  if (findings.length) return { ok: false, findings };
  return { ok: true, concept: {
    format: 'v3-architectural-concept-1', title: c.title, concept: c.concept, character: 'Compact massing evaluation',
    decisions: ['Massing is specified by the executable volume composition.'], assumptions: c.assumptions,
    site: c.site, buildings: c.volumes.map(v => buildings.get(v.name)!),
    connections: c.volumes.flatMap(v => v.attach ? [{ from: `mass-${v.attach.to}`, to: `mass-${v.name}` }] : []), outdoorSpaces: [],
  } };
}

export function prepareCompactMassing(input: unknown): ConceptResult {
  const unsupported = z.object({ unsupportedFeatures: z.array(text).min(1).max(12) }).strict().safeParse(input);
  if (unsupported.success) return { ok: false, findings: unsupported.data.unsupportedFeatures.map(message => ({ code: 'MASSING_UNSUPPORTED_INTENT', targetId: 'brief', message })) };
  const expanded = expandCompactMassing(input);
  if (!expanded.ok) return expanded;
  return prepareArchitecturalConcept(expanded.concept);
}

export function compactMassingPrompt(): string {
  return `You are Terra. Compose architectural MASSING from the brief in one response using terra-massing-1.
Choose the spatial idea, proportions, volume hierarchy, orientation, heights and roofs. No fixed template.
Only executable fields construct geometry; prose is explanatory. Do not claim unbuilt features.
Metres; site centre [0,0], east +X, south +Z. Rotation is degrees, +yaw turns +Z toward +X.
Each volume has a unique semantic name, heights bottom-up and a roof. No runtime transforms or ids.
Place using at:[x,z] (+ optional rotation) OR attach:{to:volumeName,side,offset}, exclusively.
Attach inherits host yaw, touches that LOCAL face and offsets east for north/south or south for east/west.
Attachments require rectangles, compatible roof datums (equal or >=0.6m apart) and no three mutually meeting masses.
An l plan cuts the named corner by cut.width/depth. A u plan carves court from the named local side;
court.width/depth and optional offset from facade centre define its opening, leaving side wings/back wall.
Courts are open voids, not invented holes or paving. recesses use the same side/width/depth/offset rule.
A recessed entrance here is only envelope indentation, with no door or circulation claim.
upperSetbacks cut named corners on EVERY storey above ground; not arbitrary per-floor outlines.
No overlaps, clamped cuts or clipped recesses. Each subtraction must remain fully inside its facade.
Optional exact outline: clockwise contiguous line/arc segments in local metres; omit ids unless referenced.
Bounds derive around the unchanged local origin, without recentering/scaling. Exact outlines cannot receive edits.
Nonrectangles require flat/floating-flat/mono-pitch/terrace roofs; rectangular connections exclude terrace/butterfly.
Pitch 1–60 degrees (ignored by flat families); eaves 0–3m. All geometry and roofs must fit the site.
No rooms, doors, stairs, assemblies, terrain, outline holes, splines, domes or skew Boolean junctions.
If a required architectural instruction is ambiguous or unsupported, return ONLY
{"unsupportedFeatures":["precise missing decision or capability"]}; never simplify it or add a translation call.
Return final JSON only, conforming to this schema:
${JSON.stringify(z.toJSONSchema(compactMassingSchema, { io: 'input' }))}`;
}
