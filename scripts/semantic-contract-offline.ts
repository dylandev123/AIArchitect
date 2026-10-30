/** Offline diagnostics only. Never rewrites retained provider evidence. */
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {structuralRefinementMock} from '../src/lib/villa/scene/structuralRefinement.fixture';
import {stageGenerationRefinement} from '../src/lib/villa/scene/generationReview';
import {stageSceneOperations,validateScene} from '../src/lib/villa/scene/model';
const root='docs/architecture/retained-visual-review/';
const read=(name:string)=>JSON.parse(readFileSync(root+name,'utf8'));
const scene=validateScene(read('original.scene.json'));
const raw=read('raw-candidate.operations.json');
const review=read('refine.input.json').review;
const dir='docs/architecture/semantic-contract';mkdirSync(dir,{recursive:true});
const evidence:Record<string,unknown>={providerCalls:0,rawReplay:'',fixture:'Deterministic developer fixture: only canopy-edge semanticType changed to mass; not recovered Terra output.'};
try{stageGenerationRefinement(scene,review,raw);evidence.rawReplay='accepted';}catch(e){evidence.rawReplay=String(e);}
const fixture=structuredClone(raw);
fixture.operations.find((o:{element?:{id:string}})=>o.element?.id==='rear-loggia-canopy-edge').element.semanticType='mass';
writeFileSync(`${dir}/fixture.operations.json`,JSON.stringify(fixture,null,2));
try{const staged=stageGenerationRefinement(scene,review,fixture);evidence.fixtureReplay='accepted';writeFileSync(`${dir}/fixture.scene.json`,JSON.stringify(staged.scene,null,2));}catch(e){evidence.fixtureReplay=String(e);}
try{const staged=stageSceneOperations(scene,fixture.operations);evidence.fixtureConstruction='constructed';writeFileSync(`${dir}/construction.scene.json`,JSON.stringify(staged,null,2));}catch(e){evidence.fixtureConstruction=String(e);}
writeFileSync(`${dir}/evidence.json`,JSON.stringify(evidence,null,2));console.log({providerCalls:0,fixtureReplay:evidence.fixtureReplay,fixtureConstruction:evidence.fixtureConstruction});

const valid=structuralRefinementMock();
for(const op of valid.output.operations)if(op.op==='add' && op.element)Object.assign(op.element,{semanticType:op.element.kind==='roof'?'roof':op.element.kind==='screen'?'wall':'mass'});
const accepted=stageGenerationRefinement(valid.scene,valid.review,valid.output);
writeFileSync(`${dir}/supported-fixture.scene.json`,JSON.stringify(accepted.scene,null,2));
writeFileSync(`${dir}/supported-fixture.json`,JSON.stringify({label:'Developer-authored supported semantic transaction; not Terra output',review:valid.review,output:valid.output,diff:accepted.diff},null,2));
