import {readFileSync} from 'node:fs';
const {loadTerraStage3, STAGE3_SCENE} = await import('@/lib/villa/staged/stage3Checkpoint');
const r = loadTerraStage3();
console.log('findings', r.findings, 'elements', r.scene.elements.length, 'cost', r.stage12Cost, r.stage3Cost);
console.log('byte-identical to saved Stage 3 scene:', JSON.stringify(r.scene) === readFileSync(STAGE3_SCENE, 'utf8'));
