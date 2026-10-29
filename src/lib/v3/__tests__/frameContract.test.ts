import { describe, expect, it } from 'vitest';
import { v3CompositionSchema, v3GenerationCompositionSchema, builderOpening } from '../composition';
import { readFileSync } from 'node:fs';
import { expandPlanAuthoring } from '../architecturalPlanAuthoring';

describe('provider/runtime opening frame contract', () => {
  const openings = [
    {id:'entry',type:'glazed-door',facade:'north',start:.2,end:.4,frame:true},
  ];
  it('accepts the frame field advertised by the provider and carries it to construction', () => {
    expect(v3GenerationCompositionSchema.parse({openings}).openings).toHaveLength(1);
    const parsed = v3CompositionSchema.parse({openings});
    const door = builderOpening(parsed.openings![0]);
    expect(door).toMatchObject({type:'door',frame:true});

  });
  it('replays the retained failing plan without the frame contract error',()=>{
    const artifact=JSON.parse(readFileSync('docs/consolidation/original-frame-failure.json','utf8'));
    const response=JSON.parse(artifact.rawResponse);
    const oldGlazedDoor=v3CompositionSchema.shape.openings.unwrap().element.options[3].omit({frame:true});
    const oldResult=oldGlazedDoor.safeParse(response.plan.buildings[0].accessOpenings[0]);
    expect(oldResult.success).toBe(false);
    if(!oldResult.success)expect(oldResult.error.issues.some(i=>i.code==='unrecognized_keys'&&i.keys.includes('frame'))).toBe(true);
    const result=expandPlanAuthoring(response.plan);
    expect(result.success).toBe(true);
    expect(v3CompositionSchema.parse({openings:response.plan.buildings[0].accessOpenings}).openings).toHaveLength(3);
  });
  it('still rejects unknown keys and non-boolean frames', () => {
    expect(()=>v3CompositionSchema.parse({openings:[{...openings[0],arbitrary:true}]})).toThrow();
    expect(()=>v3CompositionSchema.parse({openings:[{...openings[0],frame:'yes'}]})).toThrow();
  });
});
