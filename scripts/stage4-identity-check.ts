import {readFileSync} from 'node:fs';
const {loadTerraStage3} = await import('@/lib/villa/staged/stage3Checkpoint');
const s3 = loadTerraStage3();
const cp = JSON.parse(readFileSync('docs/architecture/staged-villa/stage4-exterior/terra-stage4.checkpoint.json', 'utf8'));
const sc = JSON.parse(readFileSync('docs/architecture/staged-villa/stage4-exterior/terra-stage4.scene.json', 'utf8'));
const after = new Map<string, any>(sc.elements.map((e: any) => [e.id, e]));
let kept = 0, missing: string[] = [], changed: string[] = [];
for (const e of s3.scene.elements as any[]) { if (/^w-/.test(e.id) || e.id.startsWith('open-')) continue; const a = after.get(e.id); if (!a) missing.push(e.id); else if (JSON.stringify([a.at, a.size, a.rotation]) !== JSON.stringify([e.at, e.size, e.rotation])) changed.push(e.id); else kept++; }
console.log('accepted', cp.accepted, 'findings', cp.findings.length, '| elements', sc.elements.length, '| Stage3 non-exterior-wall elements identical:', kept, 'missing', missing, 'changed', changed);
console.log('rooms in spec identical:', JSON.stringify(cp.spec.blocks.map((b: any) => b.plan)) === JSON.stringify(s3.spec.blocks.map(b => b.plan)), '| links identical:', JSON.stringify(cp.spec.links) === JSON.stringify(s3.spec.links), '| stairs identical:', JSON.stringify(cp.spec.stairs) === JSON.stringify(s3.spec.stairs));
const doors = sc.elements.filter((e: any) => /-door$/.test(e.id) && !e.id.startsWith('p-')); console.log('exterior doors', doors.map((d: any) => `${d.id}:${d.material}`).join(', '));
