import { z } from 'zod';
import { v3GenerationFootprintSchema } from './footprintSchema';
import { architectureFromRuntimeGeometry, materializeV3ArchitecturalObject } from './architecture';
import { authoredOverlap, authoredPlan, authoredSeparation } from './authoredPlan';
import { footprintDiagnostics } from './footprintDiagnostics';
import { curvedMassConflicts } from './architectureSafety';
import { deriveV3MassJunctions } from './junctions';
import { compileV3Scene, validateV3CompiledGeometry, type V3Scene, type V3SceneObject } from './scene';
import { primitivesBounds } from './presentation';
import { conceptFootprintTrace } from './conceptFootprintTrace';

const id = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);
const text = z.string().min(1).max(2000);
const size = z.number().finite().min(1).max(150);
const placement = {
  x: z.number().finite().min(-250).max(250),
  z: z.number().finite().min(-250).max(250),
  width: size, depth: size,
  rotationDegrees: z.number().finite().min(-180).max(180).default(0),
};

/** A disposable authoring response, lowered immediately into the existing V3 authority. */
export const architecturalConceptSchema = z.object({
  format: z.literal('v3-architectural-concept-1'),
  title: text, concept: text, character: text,
  decisions: z.array(text).min(1).max(12),
  assumptions: z.array(text).max(12).default([]),
  site: z.object({ width: z.number().finite().min(4).max(300), depth: z.number().finite().min(4).max(300) }).strict(),
  buildings: z.array(z.object({
    id, label: text, role: text, ...placement,
    baseElevation: z.number().finite().min(0).max(.6).default(0),
    storeyHeights: z.array(z.number().finite().min(2.4).max(8)).min(1).max(12),
    footprint: v3GenerationFootprintSchema.optional(),
    roof: z.object({
      form: z.enum(['flat', 'floating-flat', 'mono-pitch', 'hip', 'gable', 'butterfly', 'terrace']),
      pitchDegrees: z.number().finite().min(1).max(60).default(12),
      overhang: z.number().finite().min(0).max(3).default(.4),
    }).strict(),
  }).strict()).min(1).max(12),
  connections: z.array(z.object({ from: id, to: id }).strict()).max(20).default([]),
  outdoorSpaces: z.array(z.object({
    id, label: text, purpose: text,
    kind: z.enum(['courtyard', 'terrace', 'arrival', 'garden']), ...placement,
  }).strict()).max(16).default([]),
}).strict();

export const conceptEvaluationEnabled = () => process.env.NODE_ENV === 'development' && process.env.AI_V3_CONCEPT_EVALUATION === '1';
export interface ConceptFinding { code: string; targetId: string; message: string }
type FootprintEvidence = { footprintTrace?: ReturnType<typeof conceptFootprintTrace>[] };
export type ConceptResult = ({ ok: true; scene: V3Scene; findings: ConceptFinding[] } | { ok: false; findings: ConceptFinding[] }) & FootprintEvidence;

/** No plan acceptance, room review, completeness repair or production normalization runs here. */
export function prepareArchitecturalConcept(input: unknown): ConceptResult {
  const unsupported = z.object({ unsupportedFeatures: z.array(text).min(1).max(12) }).strict().safeParse(input);
  if (unsupported.success) return { ok: false, findings: unsupported.data.unsupportedFeatures.map(message => ({ code: 'CONCEPT_UNSUPPORTED_INTENT', targetId: 'brief', message })) };
  const parsed = architecturalConceptSchema.safeParse(input);
  if (!parsed.success) return { ok: false, findings: parsed.error.issues.map(i => ({ code: 'CONCEPT_INPUT', targetId: i.path.join('.'), message: i.message })) };
  const c = parsed.data;
  const objects: V3SceneObject[] = c.buildings.map(b => materializeV3ArchitecturalObject({
    id: b.id, label: b.label, semanticRole: b.role, type: 'building-mass',
    architecture: { x: b.x, z: b.z, width: b.width, depth: b.depth, height: b.storeyHeights.reduce((a, h) => a + h, 0), baseElevation: b.baseElevation, rotationY: b.rotationDegrees * Math.PI / 180 },
    dimensions: [1, 1, 1], transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    material: { id: 'concept-plaster', color: '#dedbd3', roughness: .85 },
    levels: b.storeyHeights.length, roofForm: b.roof.form, pitch: b.roof.pitchDegrees, pitchUnit: 'degrees', overhang: b.roof.overhang,
    // Runtime footprint validation is stricter than the union-free provider schema.
    composition: { openings: [], ...(b.footprint ? { footprint: b.footprint as NonNullable<V3SceneObject['composition']>['footprint'] } : {}) },
  }));
  const scene: V3Scene = {
    version: 3, site: { ...c.site, baseElevation: 0, groundMaterial: { id: 'concept-ground', color: '#b6b9ad', roughness: 1 } }, objects,
    relationships: c.connections.map(r => ({ ...r, kind: 'connects' })),
    interior: { rooms: [], storeys: c.buildings.flatMap(b => b.storeyHeights.map((height, index) => ({
      id: `${b.id}-storey-${index}`, hostMassId: b.id, index,
      elevation: .26 + b.storeyHeights.slice(0, index).reduce((a, h) => a + h, 0), height,
      label: `${b.label} · level ${index + 1}`, semanticRole: 'concept-storey',
    }))) },
    metadata: { conceptEvaluation: true, conceptFormat: c.format, title: c.title, concept: c.concept, character: c.character,
      decisions: c.decisions, assumptions: c.assumptions, terrainMode: 'flat',
      designPipeline: { stage: 'concept', authority: 'v3-semantic-scene', roomDevelopment: 'deferred', preserve: 'envelopes-roofs-storeys' } },
  };
  for (const s of c.outdoorSpaces) objects.push(materializeV3ArchitecturalObject({
    id: s.id, label: s.label, semanticRole: s.kind, type: s.kind === 'garden' ? 'landscape-zone' : s.kind === 'terrace' ? 'terrace' : 'courtyard',
    architecture: { x: s.x, z: s.z, width: s.width, depth: s.depth, height: .08, baseElevation: 0, rotationY: s.rotationDegrees * Math.PI / 180 },
    dimensions: [1, 1, 1], transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    material: { id: 'concept-outdoor', color: s.kind === 'garden' ? '#929c86' : '#b9b3a5', roughness: 1 },
    metadata: { purpose: s.purpose },
  }));
  const findings: ConceptFinding[] = [];
  const add = (code: string, targetId: string, message: string) => findings.push({ code, targetId, message });
  const ids = objects.map(o => o.id);
  if (new Set(ids).size !== ids.length) add('CONCEPT_DUPLICATE_ID', 'scene', 'Building and outdoor-space IDs must be unique.');
  for (const r of c.connections) if (r.from === r.to || !c.buildings.some(b => b.id === r.from) || !c.buildings.some(b => b.id === r.to)) add('CONCEPT_CONNECTION', `${r.from}->${r.to}`, 'Connections must reference two distinct building masses.');
  // Preflight before any compiler can use its legacy rectangular fallback.
  const footprintTrace = objects.filter(o => o.type === 'building-mass').map(conceptFootprintTrace);
  findings.push(...footprintDiagnostics(scene).map(f => {
    const failed = footprintTrace.find(t => t.targetId === f.targetId)?.floors.find(p => p.failure);
    return f.code === 'FOOTPRINT_INVALID' && failed ? { ...f, message: `Floor ${failed.floor}: ${failed.failure} No substitute preview was accepted.` } : f;
  }));
  if (findings.length) return { ok: false, findings, footprintTrace };
  for (const o of objects) {
    for (let floor = 0; floor < (o.levels ?? 1); floor++) {
      if (authoredPlan(o, floor).some(([x, z]) => Math.abs(x) > c.site.width / 2 + 1e-6 || Math.abs(z) > c.site.depth / 2 + 1e-6)) {
        add('CONCEPT_OUTSIDE_SITE', o.id, 'The rotated footprint extends beyond the site.'); break;
      }
    }
    if (o.type !== 'building-mass') for (const b of objects.filter(b => b.type === 'building-mass')) {
      if (authoredOverlap(o, b) > .02) add('CONCEPT_OUTDOOR_OVERLAP', o.id, `Outdoor space overlaps the occupied footprint of ${b.id}.`);
    }
  }
  findings.push(...curvedMassConflicts(scene));
  const junctions = deriveV3MassJunctions(scene);
  for (const d of junctions.diagnostics) {
    const j = junctions.junctions.find(j => j.id === d.junctionId);
    // V3 junction discovery uses placement envelopes. A pavilion in a concave void
    // is actually separate; do not treat empty bounding-box overlap as a junction.
    if (j && !c.connections.some(r => [r.from, r.to].includes(j.massA) && [r.from, r.to].includes(j.massB))
      && authoredSeparation(objects.find(o => o.id === j.massA)!, objects.find(o => o.id === j.massB)!) > 1e-5) continue;
    add(d.code, d.junctionId, d.message);
  }
  // All junction diagnostics here concern geometry (there are no openings to assess).
  if (findings.length) return { ok: false, findings, footprintTrace };
  try {
    const model = compileV3Scene(scene);
    const audit = validateV3CompiledGeometry(scene, model);
    audit.errors.forEach(message => add('CONCEPT_COMPILED_GEOMETRY', 'scene', message));
    const bounds = primitivesBounds(model.primitives.filter(p => p.id !== 'v3-terrain-surface'));
    if (bounds && (bounds.min[0] < -c.site.width / 2 - 1e-6 || bounds.max[0] > c.site.width / 2 + 1e-6 || bounds.min[2] < -c.site.depth / 2 - 1e-6 || bounds.max[2] > c.site.depth / 2 + 1e-6)) add('CONCEPT_ROOF_OUTSIDE_SITE', 'scene', 'Compiled architecture, including eaves, extends beyond the site.');
    for (const o of objects.filter(o => o.type === 'building-mass')) {
      if (!model.primitives.some(p => p.sourceObjectId === o.id && p.category === 'roof')) add('CONCEPT_ROOF_MISSING', o.id, 'V3 did not construct the authored roof.');
    }
  } catch {
    add('CONCEPT_COMPILATION', 'scene', 'V3 could not compile this geometry. No substitute preview was accepted.');
  }
  return findings.length ? { ok: false, findings, footprintTrace } : { ok: true, scene, findings, footprintTrace };
}

/** A preservation boundary for a future room-development step, not another editable scene.
 * Derive from the accepted V3 scene at approval; compare after development. Rooms are deliberately excluded.
 */
export function conceptEnvelopeSignature(scene: V3Scene): string {
  return JSON.stringify({ site: scene.site, buildings: scene.objects.filter(o => o.type === 'building-mass' || o.type === 'roof-form').map(o => ({
    id: o.id, type: o.type, architecture: o.architecture ?? architectureFromRuntimeGeometry(o), footprint: o.composition?.footprint,
    massHierarchy: o.composition?.massHierarchy, roofDatumGroup: o.composition?.roofDatumGroup, support: o.support,
    roofForm: o.roofForm, pitch: o.pitch, pitchUnit: o.pitchUnit, overhang: o.overhang, levels: o.levels, hostId: o.hostId,
  })).sort((a, b) => a.id.localeCompare(b.id)), storeys: scene.interior?.storeys, relationships: scene.relationships });
}

export function architecturalConceptPrompt(): string {
  return `You are Terra, designing an architectural MASSING CONCEPT from the user's brief.
Within this single generation, work through these design priorities before finalizing geometry:
1. Interpret the project's scale, setting, architectural ambition and functional purpose. Use the brief's
views and orientation; where unspecified, state consistent assumptions that guide placement and arrival.
2. Establish a distinctive architectural concept and intentional spatial hierarchy: primary and secondary
volumes, solid and void, and the relationship between occupied envelopes and outdoor space.
3. Compose convincing proportions, massing, roof silhouette, courtyards, terraces, arrival experience and
view orientation as one spatial idea. Consider the experience from approach through exterior spaces to outlook.
4. Use V3-supported geometry creatively where it serves that idea: articulated footprints, varied building
heights, upper-floor setbacks via floors:upper footprint operations, connected wings and distinct volumes.
These are options, not a checklist; no particular number of buildings, wings, roof types or features is required.
5. Make every spatial claim physically true in the authored geometry. Trace claimed view corridors from
their intended viewing positions toward the stated outlook; solid buildings and roofs must not obstruct them.
A low pavilion on a view axis can still be a barrier. A claimed passage or arrival sequence must have a real
geometric opening or clear exterior gap; do not imply traversal through a solid envelope or rely on future doors.
Derive stated dimensions and clearances from the actual footprints, placements, rotations and storey heights.
6. Judge the design as a neutral 3D massing model: proportions, depth, height hierarchy and silhouette must
carry the architectural interest without windows, textures, furniture or landscaping.
7. Favor architectural coherence over unnecessary complexity. For ambitious luxury briefs, pursue expressive,
sophisticated architecture with purposeful spatial and volumetric development rather than minimal safe geometry.
For modest residential briefs, favor appropriately restrained, compact designs. A simple rectangle is legitimate
when it serves the brief. No automatic luxury estate, pool, guest house or amenity checklist.
Explain concrete decisions visible in the geometry, using the existing concept, character, decisions and
assumptions fields. Keep deliberation and review internal; return only the final JSON, without extra fields.
Return one JSON concept in this schema. Do not author rooms, adjacencies, openings, partitions, stairs,
construction routes, materials, meshes or technical floor plans. Assumptions must be explicit.
Coordinates: metres, site centred at origin, +X east, +Z south; positive yaw turns +Z toward +X.
Each building is one envelope; storeyHeights are floor-to-floor metres, bottom-up. All share flat ground;
baseElevation is only a low plinth (0–0.6m), not hillside terrain or a floating/stacked pavilion.
Omit footprint for a real rectangular envelope. For L/U/courtyard shapes use V3 articulated notch/recess/
projection/chamfer operations, or an outline made of closed clockwise local line/arc segments. Local points
must fit inside width/depth. Outline: operations:[], segments required; articulated: operations only.
Line: id,type:line,start:[x,z],end:[x,z]. Arc: id,type:arc,center:[x,z],radius,startAngle,sweep (degrees,
positive clockwise in X/Z). Contiguous closed paths, no self intersections or holes, >=0.2m wall clearance.
Recess start/end are fractions along the local facade, 0<=start<end<=1; depth in metres. Notch uses corner,
width,depth; chamfer uses corner,size. Projections reserve space INSIDE the width/depth placement envelope.
Use floors:all unless a deliberate upper/ground articulation is needed. Roof follows the TOP footprint.
Nonrectangular and curved roofs support flat, floating-flat, mono-pitch, terrace only. Rectangles also support
hip, gable, butterfly. Pitch is degrees 1–60, eaves 0–3m; small overhangs help tight concave corners.
Separate pavilions may rotate freely. Connected masses must be rectangular and meet orthogonally at shared
faces/overlaps, with flat/floating-flat/mono-pitch/hip/gable roofs. Use connections ONLY for physically touching
masses. No skew/curved/articulated Boolean junctions, no three mutually meeting roofs, no nearly equal roof
datums differing by less than 0.6m. Use one articulated footprint for a continuous shaped building instead.
Outdoor spaces are rectangular ground-level spatial surfaces (court, terrace, arrival, garden), not routes.
Frame courts with building geometry; never fill a building hole with an invented proxy. Keep surfaces outside
occupied building footprints. Keep every rotated footprint and roof within the site. Return no unsupported
geometry and do not describe unbuilt architectural features as if constructed.
If an explicit user requirement needs unsupported geometry (such as a dome or a skew Boolean junction),
return only {"unsupportedFeatures":["explain each capability gap"]} instead of substituting a supported form.
Before submitting, internally review the completed geometry and its description:
- Does the geometry express the architectural concept?
- Are the proportions and building relationships convincing?
- Does the composition respond to the site's views and orientation, with claimed view corridors unobstructed?
- Do the described passages, courtyards and spatial sequences actually exist, with dimensions matching geometry?
- Are all footprints and roof choices compatible with the V3 rules above and the schema below?
- Would the 3D silhouette be architecturally interesting without materials?
Correct inconsistencies in the geometry and description within this same response before returning it.
Do not claim unsupported or unbuilt features to justify the design; retain the unsupportedFeatures response
for explicit requirements that V3 cannot represent. Submit only the final concept or that unsupported response.
${JSON.stringify(z.toJSONSchema(architecturalConceptSchema, { io: 'input' }))}`;
}
