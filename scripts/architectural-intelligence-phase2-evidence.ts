/** Offline only. Production contract, Planning Studio SVG, disk round trip and V3 builders.
 * No credentials, database, provider transport or existing saved-project writes. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ArchitecturalFloorPlan } from '../src/components/workspace/viewport/ArchitecturalFloorPlan';
import { architecturalIntelligenceExamples, compactAuthoringInput, intelligenceExampleExterior } from '../src/lib/v3/parity/architecturalIntelligence';
import { v3PlanAuthoringSchema } from '../src/lib/v3/architecturalPlanAuthoring';
import { planEvaluationPrompt, preparePlanEvaluation, checkoutPlanEvaluation } from '../src/lib/v3/architecturalPlanEvaluation';
import { elaborateV3ArchitecturalPlan, planConstructionBlockers, sameArchitecturalPlan } from '../src/lib/v3/architecturalPlanFirst';
import { planV3ArchitecturalBlueprint, constructV3ArchitecturalBlueprint } from '../src/lib/v3/architecturalBlueprint';
import { auditArchitecturalConstructionFidelity } from '../src/lib/v3/architecturalConstructionFidelity';
import { reviewArchitecturalPlan } from '../src/lib/v3/architecturalPlanReview';
import type { V3Scene } from '../src/lib/v3/scene';
import { deriveArchitecturalPlan } from '../src/lib/v3/architecturalPlanning';
import { DEFAULT_PRICING } from '../src/lib/ai/pricing';

globalThis.fetch = async () => {throw Error('All network transport forbidden during Phase 2 evidence capture');};
const out = 'docs/architecture/architectural-blueprint-pipeline/phase-2';
mkdirSync(out, {recursive: true});
const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const write = (name: string, value: unknown) => {
  const text = JSON.stringify(value, null, 2) + '\n';
  writeFileSync(`${out}/${name}.json`, text); return sha(text);
};
function draw(scene: V3Scene, name: string, floor: number | null) {
  const markup = renderToStaticMarkup(createElement(ArchitecturalFloorPlan, {scene, model: null, floor, buildingId: floor === null ? null : scene.objects.find(o => o.type === 'building-mass')!.id, readOnly: true}));
  const svg = markup.match(/<svg[\s\S]*?<\/svg>/)?.[0]; assert(svg);
  const box = svg.match(/viewBox="([^"]+)"/)![1].split(' ');
  const artifact = svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="1200" style="background:#f6f3eb;font-family:Arial,sans-serif" ')
    .replace(/(<svg[^>]*>)/, `$1<rect x="${box[0]}" y="${box[1]}" width="${box[2]}" height="${box[3]}" fill="#f6f3eb"/>`);
  const path = `${name}-${floor === null ? 'master' : `floor-${floor}`}.svg`;
  writeFileSync(`${out}/${path}`, artifact + '\n'); return path;
}
const examples = architecturalIntelligenceExamples().map(({name, brief, make}) => {
  const authored = make(), author = compactAuthoringInput(authored), source = JSON.stringify(author);
  assert(v3PlanAuthoringSchema.safeParse(author).success);
  const stage = preparePlanEvaluation(JSON.parse(source));
  assert(stage.ok && stage.scene && stage.plan, JSON.stringify(stage.findings));
  assert.deepEqual(stage.unresolved, []); assert.deepEqual(planConstructionBlockers(stage), []);
  const defects = stage.findings.filter(f => ['BLUEPRINT_SPACE_OUTSIDE_HOST', 'BLUEPRINT_SPACE_OVERLAP', 'ROOM_ADJACENCY_NO_SHARED_BOUNDARY'].includes(f.code));
  assert.deepEqual(defects, []);
  stage.scene.metadata.brief = brief;
  const savedHash = write(`${name}.saved`, {version: 3, generationMode: 'v3-scene', v3Scene: stage.scene});
  // Read the same persisted root shape the real route returns, from disk rather than an in-memory alias.
  const saved: V3Scene = JSON.parse(readFileSync(`${out}/${name}.saved.json`, 'utf8')).v3Scene;
  const reopened = checkoutPlanEvaluation(saved);
  assert(reopened.ok && reopened.plan && reopened.scene, JSON.stringify(reopened.findings));
  assert(sameArchitecturalPlan(stage.scene, reopened.scene));
  const exterior = intelligenceExampleExterior(reopened.plan, name);
  const developed = elaborateV3ArchitecturalPlan(reopened, exterior);
  assert(developed.blueprint, JSON.stringify(developed.findings));
  const approved = planV3ArchitecturalBlueprint(developed.blueprint, {buildFirst: true});
  assert(approved.approval, JSON.stringify(approved.findings));
  const built = constructV3ArchitecturalBlueprint(approved.approval);
  assert(built.ok && built.scene && built.model, JSON.stringify(built.findings));
  assert.equal(built.outcome, 'complete');
  assert(sameArchitecturalPlan(saved, built.scene));
  assert.deepEqual(auditArchitecturalConstructionFidelity(built.scene, built.model), []);
  assert.equal(JSON.stringify(author), source);
  const review = reviewArchitecturalPlan(saved, stage.findings.filter(f => !f.code.startsWith('PLAN_ROOM_') && !f.code.startsWith('PLAN_ENTRY_') && !f.code.startsWith('PLAN_STAIR_') && !f.code.startsWith('PLAN_ADJACENCY_') && !f.code.startsWith('PLAN_NARROW_')));
  const floors = Array.from({length: Math.max(...stage.plan.buildings.map(b => b.storeys.length))}, (_, i) => i);
  const drawings = [draw(saved, name, null), ...floors.map(floor => draw(saved, name, floor))];
  const hashes = {author: write(`${name}.author`, author), plan: write(`${name}.plan`, reopened.plan), exterior: write(`${name}.exterior`, exterior),
    saved: savedHash, constructed: write(`${name}.constructed`, {version: 3, generationMode: 'v3-scene', v3Scene: built.scene})};
  return {name, brief, provenance: 'Independent hand-authored mock; not a natural Terra response or a runtime template',
    hashes, drawings, buildings: stage.plan.buildings.map(b => ({id: b.id, kind: b.plan.kind, storeys: b.storeys.length})),
    roomCount: saved.interior!.rooms.length, roomAdjacencies: stage.plan.roomAdjacencies.length,
    completeConstruction: true, exactApprovedGeometryPreserved: true, diskReloadLossless: true, fidelityFindings: [],
    unresolved: stage.unresolved, constructionBlockers: planConstructionBlockers(stage), review,
    drawingCounts: floors.map(floor => ({floor, rooms: deriveArchitecturalPlan(saved, null, floor).rooms.length})), primitives: built.model.primitives.length};
});
const prompt = planEvaluationPrompt();
writeFileSync(`${out}/active-2d-prompt.txt`, prompt);
const price = DEFAULT_PRICING['gpt-5.6-terra'];
const checks = {result: 'PASS', externalProviderCalls: 0, savedUserProjectWrites: 0, date: '2026-10-21', timezone: 'America/St_Lucia',
  examples, prompt: {sha256: sha(prompt), bytes: Buffer.byteLength(prompt), roughInputTokensAtFourCharacters: Math.ceil(prompt.length / 4)},
  configuredPricingPerMillion: price, caveat: 'Repository estimates only; no current provider price verification or live creativity evaluation.',
  evidenceBoundary: 'SVG artifacts use the actual Planning Studio React component. Production route/SDK transport is exercised separately in route.architecturalIntelligence.test.ts. These disk roots are isolated evidence, not existing projects. Construction checks compare exact approved plan semantics and emitted geometry, not visual or professional architectural excellence.'};
write('checks', checks);
console.log(JSON.stringify({result: checks.result, examples: examples.map(e => ({name: e.name, rooms: e.roomCount, primitives: e.primitives,
  reviewCodes: [...new Set(e.review.findings.map(f => f.code))], preserved: e.exactApprovedGeometryPreserved})), externalProviderCalls: 0}, null, 2));
