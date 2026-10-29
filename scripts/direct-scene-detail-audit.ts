// Offline replay only: no provider/model imports and no modifications to saved scenes.
import {readFileSync} from 'node:fs';
import {resolveSceneResult,sceneProviderOutputSchema,sceneResultSchema} from '../src/lib/villa/scene/terra';
import {sceneRelationshipIssues} from '../src/lib/villa/scene/relationships';
import {architecturalIntentSchema} from '../src/lib/villa/scene/planning';
const read=(path:string)=>JSON.parse(readFileSync(path,'utf8'));
const inventory=(scene:ReturnType<typeof resolveSceneResult>['scene'])=>({elements:scene.elements.length,openings:scene.elements.filter(e=>e.opening).length,kinds:Object.fromEntries([...new Set(scene.elements.map(e=>e.kind))].map(kind=>[kind,scene.elements.filter(e=>e.kind===kind).length])),relationshipIssues:sceneRelationshipIssues(scene)});
for(const id of ['437d25b1-ff69-462c-ab34-a8deb7861c67','0bd8551e-ebcf-4685-8ee0-5aed50e7bea6','ed0d5d1e-a7f5-4e39-99b3-d203f5b63393']){
 const retained=read(`.data/scene-responses/${id}.json`);
 try {
  const result=resolveSceneResult(retained.input,retained.output);
  console.log(JSON.stringify({id,retainedStatus:retained.status,currentStatus:'accepted',...inventory(result.scene),operations:result.operations.length,warningCount:result.architecturalAudit.issues.length,rawOperationsMatch:retained.rawResponse?JSON.stringify(sceneResultSchema.parse(JSON.parse(retained.rawResponse)).operations)===JSON.stringify(sceneResultSchema.parse(retained.output).operations):null}));
 }catch(error){console.log(JSON.stringify({id,retainedStatus:retained.status,currentStatus:'rejected',error:String(error)}));}
}
const study=read('docs/villa-playground/terra-basic-diagnosis/study.scene.json');
const input={mode:'generate' as const,prompt:'Detailed courtyard mansion'};
const architecturalPlan=architecturalIntentSchema.parse({scaleRationale:'Stepped courtyard mansion',arrivalAndCirculation:'Sheltered arrival',volumeHierarchy:'Primary salon and subordinate wings',relationshipsAndViews:'Sea loggia',roofFacadeAndMaterials:'Stone bays and layered roofs',intendedSpaces:['Salon','Residential wings','Loggia']});
const output={name:study.name,summary:'Offline study replay',unsupported:[],architecturalPlan,operations:study.elements.map((element:unknown)=>({op:'add',element}))};
console.log(JSON.stringify({study:true,providerSchemaAccepts:sceneProviderOutputSchema(input).safeParse(output).success,...inventory(resolveSceneResult(input,output).scene),providerCalls:0}));
