/** Offline mock evidence only. No credentials, provider calls or baseline writes. */
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {structuralRefinementMock} from '../src/lib/villa/scene/structuralRefinement.fixture';
import {stageGenerationRefinement,REFINEMENT_LIMITS} from '../src/lib/villa/scene/generationReview';
const {scene,review,output}=structuralRefinementMock();
const staged=stageGenerationRefinement(scene,review,output);
const dir='docs/architecture/retained-visual-review/structural-offline';mkdirSync(dir,{recursive:true});
for(const [name,data] of Object.entries({'before.scene':scene,'after.scene':staged.scene,review,operations:output,evidence:{providerCalls:0,kind:'Developer-authored offline mock; not AI quality evidence',limits:REFINEMENT_LIMITS,diff:staged.diff,originalHash:createHash('sha256').update(readFileSync('docs/architecture/generation-quality/final-family/scene.json')).digest('hex')}})) writeFileSync(`${dir}/${name}.json`,JSON.stringify(data,null,2));
