import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, it, expect, vi } from 'vitest';
import { generateV3FromArchitecturalBlueprint } from '@/lib/v3/architecturalBlueprintGeneration';
import { resolveSceneResult } from './terra';
import { applySceneOperations } from './model';
import { compileV3Scene } from '@/lib/v3/scene';
import { laderaScene } from './example';

describe('homepage construction authority', () => {
 it('adds shared natural terrain atomically without changing architecture; persists and removes it',()=>{
  const terrain = {width:120,depth:120,elevation:-.5,grade:.05,fall:'z' as const};
  const next=applySceneOperations(laderaScene,[{op:'set-terrain',terrain}]);
  expect(next.elements).toBe(laderaScene.elements);
  expect(JSON.parse(JSON.stringify(next)).terrain).toEqual(terrain);
  const {width,depth,...naturalGround}=terrain;
  const model=compileV3Scene({version:3,site:{width,depth,naturalGround},objects:[],relationships:[],metadata:{}});
  expect(model.primitives.find(p=>p.id==='v3-terrain-surface')).toBeDefined();
  expect(applySceneOperations(next,[{op:'set-terrain',terrain:null}])).toEqual(laderaScene);
  expect(()=>applySceneOperations(next,[{op:'set-terrain',terrain:{...terrain,grade:Infinity}}])).toThrow();
 });
 it('reproduces the retained arrival failure offline while a direct scene bypasses blueprint planning', async () => {
  const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(Error('Offline only'));
  try {
   const capture = JSON.parse(readFileSync('docs/consolidation/homepage/original-failure.json','utf8'));
   expect(createHash('sha256').update(capture.rawResponse).digest('hex')).toBe(capture.sha256);
   const replay = await generateV3FromArchitecturalBlueprint('Caribbean house', async () => ({output:JSON.parse(capture.rawResponse),finishReason:'stop'}),{allowRepair:false,requirePlanFirst:true});
   expect(replay.ok).toBe(false);
   expect(replay.findings.some(f=>f.message.includes('arrival-sequence: missing authored connects relationship'))).toBe(true);
   expect(replay.planningScene).toBeDefined();
   const direct = resolveSceneResult({prompt:'Caribbean house',mode:'generate'},{name:laderaScene.name,summary:'Retained direct fixture',unsupported:[],operations:laderaScene.elements.map(element=>({op:'add',element}))});
   expect(direct.scene).toEqual({...laderaScene,generationBrief:'Caribbean house'});
   expect(network).not.toHaveBeenCalled();
  } finally { network.mockRestore(); }
 });
});
