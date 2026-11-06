/** Runs the five proof edits offline (mock planner) against the completed villa, with measured diffs. */
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {houseSpecSchema} from '@/lib/villa/staged/spec';
import {compileHouse} from '@/lib/villa/staged/compile';
import {runEdit} from '@/lib/villa/staged/edits';
import {MockEditPlanner} from '@/lib/villa/staged/mockEditPlanner';
const dir = 'docs/architecture/staged-villa';
mkdirSync(dir, {recursive: true});
const spec0 = houseSpecSchema.parse(JSON.parse(readFileSync(`${dir}/spec.json`, 'utf8')));
const c0 = compileHouse(spec0, 5);
const edits: [string, string, string[]][] = [
  ['enlarge-primary-bedroom', 'Enlarge the primary bedroom.', []],
  ['mediterranean-roof', 'Change the roof to Mediterranean architecture.', []],
  ['second-floor-east-wing', 'Add a second floor above the east wing.', []],
  ['move-pool', 'Move the swimming pool closer to the veranda.', []],
  ['redesign-entrance', 'Redesign the main entrance while preserving the bedrooms.', ['room:bedroom-guest', 'room:bedroom-2', 'room:bedroom-3', 'room:primary-bedroom']],
];
const planner = new MockEditPlanner();
for (const [name, instruction, preserve] of edits) {
  const out = await runEdit({planner, instruction, spec: spec0, scene: c0.scene, components: c0.components, preserve, requiredBedrooms: 4});
  console.log(`${name}: accepted=${out.accepted} findings=${out.findings.length} violations=${out.violations.length}`);
  if (out.diff) console.log('  +', out.diff.added.length, '-', out.diff.removed.length, '~', out.diff.changed.length, '=', out.diff.unchanged, JSON.stringify(out.diff.byComponent).slice(0, 400));
  for (const n of out.notes) console.log('  note:', n);
  for (const f of out.findings.slice(0, 6)) console.log('  FINDING', f.code, f.subject, f.message.slice(0, 160));
  for (const v of out.violations.slice(0, 4)) console.log('  VIOLATION', v);
  if (out.accepted) { writeFileSync(`${dir}/edit-${name}.scene.json`, JSON.stringify(out.scene)); writeFileSync(`${dir}/edit-${name}.spec.json`, JSON.stringify(out.spec, null, 1)); }
}
