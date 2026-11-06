import { z } from 'zod';
import type { ArchitecturalScene } from './model';
import { programmeSchema, reviewProgramme } from './programme';
import { sceneSpatialGeometry } from './spatial';

const ids = z.array(z.string().min(1).max(120)).min(1).max(128);
export const evidenceRevisionSchema = z.array(z.object({
  spaceIndex: z.number().int().min(0).max(23),
  role: z.enum(['floorIds', 'enclosureIds', 'roofIds', 'accessIds']),
  previousIds: ids,
  replacementIds: ids,
  reason: z.string().min(1).max(500),
}).strict()).max(32);

export const evidenceRevisionHistorySchema = z.array(z.object({revisions:evidenceRevisionSchema}).strict()).max(64);

/** Reference changes are evidence proposals, never waivers or room construction.
 * Requirements, names, scope, limitations and all unrelated records are immutable.
 * The caller still runs the complete physical and evidence-difference gates. */
export function reviseProgrammeEvidence(before: ArchitecturalScene, after: ArchitecturalScene, raw: unknown, scope: string[]) {
  const revisions = evidenceRevisionSchema.parse(raw);
  if (!revisions.length) return after;
  const plan = before.architecturalPlan as Record<string, unknown> | undefined;
  const programme = programmeSchema.parse(plan?.programme);
  const next = structuredClone(programme);
  const a = sceneSpatialGeometry(before), b = sceneSpatialGeometry(after);
  const physical = (e: ArchitecturalScene['elements'][number], g: ReturnType<typeof sceneSpatialGeometry>) =>
    ({world:g.world(e),size:e.size,kind:e.kind,geometry:e.geometry,opening:e.opening,roofForm:e.roofForm,overhang:e.overhang,eaves:e.eaves});
  const changed = new Set(before.elements.filter(e => {
    const replacement = b.map.get(e.id);
    return !replacement || JSON.stringify(physical(e,a)) !== JSON.stringify(physical(replacement,b));
  }).map(e => e.id));
  const seen = new Set<string>();
  for (const revision of revisions) {
    const { spaceIndex, role, previousIds, replacementIds } = revision;
    const space = programme[spaceIndex];
    const key = `${spaceIndex}.${role}`;
    if (!space || seen.has(key)) throw Error('Evidence revision must identify one unique existing programme role.');
    seen.add(key);
    if (JSON.stringify(space[role]) !== JSON.stringify(previousIds)) throw Error('Stale evidence revision.');
    if (!previousIds.some(id => scope.includes(id) && changed.has(id))) throw Error('Evidence revision requires a changed scoped dependency.');
    if (new Set(replacementIds).size !== replacementIds.length || JSON.stringify(previousIds) === JSON.stringify(replacementIds)) throw Error('Evidence replacements must be distinct and changed.');
    if (replacementIds.some(id => !after.elements.some(e => e.id === id) || (!previousIds.includes(id) && !scope.includes(id)))) throw Error('Evidence replacement exceeds final scoped geometry.');
    next[spaceIndex][role] = replacementIds;
  }
  const history = evidenceRevisionHistorySchema.parse(plan?.evidenceRevisions ?? []);
  if (!Array.isArray(history) || history.length >= 64) throw Error('Evidence revision history requires review before further changes.');
  const candidate: ArchitecturalScene = { ...after, architecturalPlan: { ...plan, programme: programmeSchema.parse(next), evidenceRevisions: [...history, { revisions }] } };
  const prior = reviewProgramme(before), reviewed = reviewProgramme(candidate);
  // Existing disclosed limitations may remain. A remap may never create a new
  // unsupported role, remote access claim or overhead/enclosure failure.
  for (const index of new Set(revisions.map(r => r.spaceIndex))) {
    const oldIssues = new Set(prior.spaces[index]?.issues ?? []);
    const introduced = reviewed.spaces[index]?.issues.filter(issue => !oldIssues.has(issue)) ?? [];
    if (introduced.length) throw Error(`Revised programme evidence is unsupported by final geometry: ${programme[index].name}: ${introduced.join('; ')}`);
  }
  return candidate;
}
export const EVIDENCE_REVISION_GUIDANCE = `Optional evidenceRevisions may replace references in an existing programme floorIds, enclosureIds, roofIds or accessIds role only when scoped geometry changes that dependency. Supply spaceIndex, exact previousIds, nonempty replacementIds and reason. Replacements must be actual final scoped geometry, with valid kinds, walking access, enclosure and overhead evidence. No requirement, limitation, space identity, knowledge or spatial-relationship rewrites are authorized. Omit architecturalPlan. All physical and evidence gates still apply. Missing or obsolete evidence rejects the entire transaction; references do not construct rooms. If spatial or knowledge evidence also needs revision, disclose the unsupported dependency rather than inventing a mapping.`;
