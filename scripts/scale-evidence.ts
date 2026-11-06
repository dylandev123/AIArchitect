/** OFFLINE Phase 2 scale study evidence: developer-authored stage answers through the real five-stage pipeline;
 * zero provider calls. Measures dimensions, layering, connectivity, upper access, validity, editing, save/reopen.
 * Usage: npx vite-node --config vitest.config.mts scripts/scale-evidence.ts */
import {mkdirSync, writeFileSync} from 'node:fs';
import {advancePromptRun, type PromptRun} from '@/lib/villa/staged/promptGeneration';
import {ScaleDesigner, SCALE_BRIEFS, SCALE_SITES, type ScaleKey} from '@/lib/villa/staged/scale.fixture';
import {loadHouse, saveHouse} from '@/lib/villa/staged/save';
import {compileHouse, ElementBudgetError} from '@/lib/villa/staged/compile';
import {measure} from '@/lib/villa/staged/pipeline';
import {featureAudit} from '@/lib/villa/staged/featureAudit';
import {compositionMetrics} from '@/lib/villa/staged/composition';
import {allRooms, area, blockRect, overlapArea, rectDiff} from '@/lib/villa/staged/layout';
import {runEdit, type EditOp} from '@/lib/villa/staged/edits';
import {wallTopOf} from '@/lib/villa/staged/spec';

const dir = 'docs/architecture/automatic-house/scale-2', summary: Record<string, unknown> = {};
mkdirSync(dir, {recursive: true});
const EDITS: Record<ScaleKey, {instruction: string; ops: EditOp[]; preserve: string[]}[]> = {
  modest: [{instruction: 'Open the living bar to the garden with floor-to-ceiling glass.', ops: [{op: 'set-facade', key: 'living-bar:s', style: 'glass-wall'}], preserve: ['block:bedroom-wing', 'room:bedroom-one']}],
  villa: [{instruction: 'Make the entrance hall a single tall storey instead of double height.', ops: [{op: 'set-block-height', block: 'entrance-hall', height: 'tall'}], preserve: ['block:west-bedrooms', 'block:master-floor', 'stair:west-stair-flight', 'pool']},
    {instruction: 'Clad the upper master suite in natural stone.', ops: [{op: 'set-finish', block: 'master-floor', wall: 'limestone'}], preserve: ['block:living-pavilion', 'stair:east-stair-flight']}],
  estate: [{instruction: 'Lower the great room to a tall single storey.', ops: [{op: 'set-block-height', block: 'great-room', height: 'tall'}], preserve: ['block:family-suites', 'block:master-floor', 'stair:family-stair-flight', 'pool']},
    {instruction: 'Open the south side of the pool pavilion with floor-to-ceiling glass.', ops: [{op: 'set-facade', key: 'pool-pavilion:s', style: 'glass-wall'}], preserve: ['block:great-room', 'veranda:great-veranda', 'stair:master-stair-flight']}],
};

for (const key of ['modest', 'villa', 'estate'] as ScaleKey[]) {
  const run: PromptRun = {input: {brief: SCALE_BRIEFS[key], site: SCALE_SITES[key]}}, designer = new ScaleDesigner(key), stageMs: number[] = [];
  let out;
  for (let stage = 1; stage <= 5; stage++) {
    const t = performance.now(); out = await advancePromptRun(run, designer); stageMs.push(Math.round(performance.now() - t));
    if (out.status === 'failed') throw Error(`${key}: stage ${stage} failed ${JSON.stringify(out.findings)}`);
  }
  const saveText = out!.save!;
  let t = performance.now(); const h = loadHouse(saveText); const reopenMs = Math.round(performance.now() - t);
  t = performance.now(); compileHouse(h.spec, 5); const compileMs = Math.round(performance.now() - t);
  const spec = h.spec, scene = h.scene, rooms = allRooms(spec), m = compositionMetrics(spec);
  writeFileSync(`${dir}/${key}.save.json`, saveText);
  writeFileSync(`${dir}/${key}.scene.json`, JSON.stringify(scene));
  // Dimensions measured from the built geometry, never from the authored answers.
  const ground = spec.blocks.filter(b => b.level === 0).map(blockRect), all = spec.blocks.map(blockRect);
  const bbox = {x0: Math.min(...all.map(r => r.x0)), x1: Math.max(...all.map(r => r.x1)), z0: Math.min(...all.map(r => r.z0)), z1: Math.max(...all.map(r => r.z1))};
  const roofTop = Math.max(...scene.elements.filter(e => e.kind === 'roof').map(e => e.at[1] + e.size[1] / 2));
  // Upper-level access: every upper room reachable, and which stair lands on each upper block.
  const upperAccess = spec.blocks.filter(b => b.level === 1).map(u => ({block: u.id, area: u.w * u.d, rooms: rooms.filter(r => r.block === u.id).map(r => r.id),
    stairs: spec.stairs.filter(s => { const r = rooms.find(x => x.id === s.room)!; return overlapArea(r, blockRect(u)) > 0.5; }).map(s => s.id),
    supportedShare: +(1 - rectDiff(blockRect(u), ground).reduce((t, p) => t + area(p), 0) / (u.w * u.d)).toFixed(2), wallTop: wallTopOf(u)}));
  const findings = measure(spec, 5, rooms.filter(r => r.type === 'bedroom').length).findings, audit = featureAudit(spec, scene, h.components, 5, SCALE_BRIEFS[key]).findings;
  // Grouped components: one selectable element each, several parts.
  const grouped = scene.elements.filter(e => e.parts).map(e => ({id: e.id, component: h.components[e.id], parts: e.parts!.length}));
  // The same design under the original construction (400 cap, single pieces): what grouping saved.
  let legacy: unknown;
  try { const b = compileHouse({...spec, construction: undefined}, 5).budget!; legacy = {cap: b.cap, total: b.total, wouldNeed: b.architecture + b.site + b.trimRequested, trimDropped: b.trimDropped}; }
  catch (e) { legacy = e instanceof ElementBudgetError ? {cap: 400, failed: true, required: e.budget.architecture + e.budget.site, message: e.message} : {error: String(e)}; }
  // Semantic edits through the real atomic edit path (offline planner returning fixed ops), then save/reopen.
  const edits = [];
  for (const ed of EDITS[key]) {
    t = performance.now();
    const r = await runEdit({planner: {label: 'offline fixed-op planner', plan: async () => ({plan: {summary: ed.instruction, ops: ed.ops}})}, instruction: ed.instruction, spec, scene, components: h.components, preserve: ed.preserve, requiredBedrooms: rooms.filter(x => x.type === 'bedroom').length});
    const editMs = Math.round(performance.now() - t);
    const reopened = r.accepted ? loadHouse(saveHouse(r.spec, r.scene, [{instruction: ed.instruction}])).scene.elements.length === r.scene.elements.length : false;
    edits.push({instruction: ed.instruction, accepted: r.accepted, ms: editMs, changedComponents: Object.keys(r.diff?.byComponent ?? {}).length, unchanged: r.diff?.unchanged, violations: r.violations, findings: r.findings.map(f => `${f.code}: ${f.message}`).slice(0, 5), reopenedIdentically: reopened});
  }
  const cps = run.result!.checkpoints;
  summary[key] = {
    provenance: designer.label, brief: SCALE_BRIEFS[key], site: spec.site, construction: spec.construction,
    dimensions: {buildingExtentM: [+(bbox.x1 - bbox.x0).toFixed(1), +(bbox.z1 - bbox.z0).toFixed(1)], footprintM2: m.footprintM2, grossFloorAreaM2: m.grossFloorAreaM2, upperFloorAreaM2: m.upperFloorAreaM2, levels: m.levels, wings: m.wings,
      doubleHeightM2: m.doubleHeightM2, tallM2: m.tallM2, upperTerraceM2: m.upperTerraceM2, cantileverM2: m.cantileverM2, highestRoofM: +roofTop.toFixed(2), siteCoverage: +(ground.reduce((s, r) => s + area(r), 0) / (spec.site.width * spec.site.depth)).toFixed(3)},
    plannedScale: spec.direction.vision?.scale,
    blocks: Object.fromEntries(spec.blocks.map(b => [b.id, `${b.w}×${b.d} m, level ${b.level}, ${b.height ?? 'standard'} (wall top ${wallTopOf(b).toFixed(1)} m), ${b.rank ?? '-'}`])),
    rooms: {count: rooms.length, bedrooms: rooms.filter(r => r.type === 'bedroom').length, baths: rooms.filter(r => r.type === 'bath').length, upper: rooms.filter(r => r.level === 1).length,
      largest: [...rooms].sort((a, b) => area(b) - area(a)).slice(0, 5).map(r => `${r.id} ${(r.x1 - r.x0).toFixed(1)}×${(r.z1 - r.z0).toFixed(1)} m = ${area(r).toFixed(0)} m²`)},
    entrance: {door: spec.exterior.doors.find(d => d.kind === 'main'), canopy: spec.exterior.entrance.canopy, court: spec.exterior.entrance.court, frontDoorElement: scene.elements.find(e => e.semanticType === 'front-door')?.size},
    stairs: spec.stairs.map(s => s.id), upperAccess,
    pool: spec.siteWork.pool && {w: spec.siteWork.pool.w, d: spec.siteWork.pool.d}, verandas: spec.exterior.verandas.map(v => `${v.id} ${(v.to - v.from).toFixed(1)}×${v.depth} m, ${v.columns} columns`),
    validity: {stage5Findings: findings, featureAudit: audit, saveReopenIdentical: true},
    elements: {total: scene.elements.length, budget: cps.find(c => c.stage === 5)?.budget, grouped: grouped.length, groupedParts: grouped.reduce((s, g) => s + g.parts, 0), sampleGroups: grouped.slice(0, 6), legacyConstruction: legacy},
    performance: {stageMs, reopenMs, compileMs, saveBytes: Buffer.byteLength(saveText), sceneBytes: Buffer.byteLength(JSON.stringify(scene))},
    edits,
    warnings: cps.flatMap(c => (c.warnings ?? []).filter(w => /^vision-|composition-note|element-budget|brief-scale/.test(w.code)).map(w => `stage ${c.stage} ${w.code}: ${w.message}`)),
  };
  console.log(key, scene.elements.length, 'elements', JSON.stringify((summary[key] as {dimensions: unknown}).dimensions), 'edits', edits.map(e => e.accepted).join(','));
}
writeFileSync(`${dir}/summary.json`, JSON.stringify(summary, null, 1));
