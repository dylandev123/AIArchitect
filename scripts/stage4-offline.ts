import {writeFileSync} from 'node:fs';
const {loadTerraStage3} = await import('@/lib/villa/staged/stage3Checkpoint');
const {deriveStage4, measureExterior} = await import('@/lib/villa/staged/exterior');
const {mockExteriorDesign} = await import('@/lib/villa/staged/exterior.fixture');
const {measure} = await import('@/lib/villa/staged/pipeline');
const s3 = loadTerraStage3();
const r = deriveStage4(s3.spec, mockExteriorDesign());
console.log('derive findings', r.findings, r.derivation.adjustments);
const m = measure(r.spec, 4, 4, 3);
console.log('measure findings', m.findings.map(f => `${f.code} ${f.subject}: ${f.message}`.slice(0, 220)));
if (m.scene) { console.log('elements', m.scene.elements.length); writeFileSync('/private/tmp/claude-501/-Users-dylandevaux-Desktop-AIArchitect/e84bf3b5-50ce-45d9-a881-5a2620bcb068/scratchpad/mock4.scene.json', JSON.stringify(m.scene)); writeFileSync('docs/architecture/staged-villa/stage4-exterior/mock-offline.scene.json', JSON.stringify(m.scene)); }
if (m.scene) { const x = measureExterior(r.spec, m.scene); console.log(JSON.stringify({roofs: x.roofs, entrance: x.entrance, massing: x.massing}, null, 0)); console.log(x.warnings.map(w => `[${w.area}/${w.severity}] ${w.message}`).join('\n')); }
