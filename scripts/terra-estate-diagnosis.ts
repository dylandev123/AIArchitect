/** Offline retained-evidence replay and separately labelled developer examples. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validateScene,stageSceneOperations,applySceneOperations,type SceneOperation} from '../src/lib/villa/scene/model';
import {sceneRelationshipIssues} from '../src/lib/villa/scene/relationships';
import {sceneResponseFormatSchema} from '../src/lib/villa/scene/terra';
import {sceneSpatialGeometry} from '../src/lib/villa/scene/spatial';
const source='docs/architecture/terra-controlled-estate-2026-10-29',out='docs/architecture/terra-estate-diagnosis';
const read=(n:string)=>JSON.parse(readFileSync(`${source}/${n}`,'utf8'));
const save=(n:string,v:unknown)=>writeFileSync(`${out}/${n}`,JSON.stringify(v,null,2));
globalThis.fetch=async()=>{throw Error('Offline diagnosis: no network permitted');};
for(const [file,hash] of Object.entries(read('sha256.json')))assert.equal(createHash('sha256').update(readFileSync(`${source}/${file}`)).digest('hex'),hash);
const provider=read('provider-response.exact.json'),text=provider.output.flatMap((o:any)=>o.content??[]).filter((c:any)=>c.type==='output_text').map((c:any)=>c.text).join('');
const parsed:any=await (await sceneResponseFormatSchema(read('request.json'))).validate!(JSON.parse(text));assert(parsed.success);assert.deepEqual(parsed.value,read('normalized-output.json'));
const original=validateScene(read('draft.REJECTED.json')),ops=read('authored-operations.json') as SceneOperation[];
const staged=stageSceneOperations({version:'architectural-scene-1',name:original.name,elements:[]},ops);assert.deepEqual(staged.elements,original.elements);
const provenance=read('expanded-indexed.json');
const current=sceneRelationshipIssues(original);save('current-findings.json',current.map(f=>({...f,provenance:[f.id,...(f.relatedIds??[])].map(id=>{const p=provenance.find((p:any)=>p.operation.element?.id===id);return {id,authoredIndex:p.authoredIndex,expandedIndex:p.expandedIndex};})})));
const examples:{name:string;operations:SceneOperation[]}[]=[
 {name:'railing',operations:[{op:'place-on',id:'belvedere-rail-front',support:'belvedere-deck',offset:[0,-2.18],rotation:0}]},
 {name:'pool-link',operations:[{op:'move',id:'ocean-link',at:[0,.1,25.95]}]},
 {name:'suite-eaves',operations:original.elements.filter(e=>/^suite-.*-roof$/.test(e.id)).map(e=>({op:'replace',id:e.id,element:{...e,overhang:.2}}))},
];
const results=examples.map(example=>{const scene=applySceneOperations(original,example.operations);scene.name=`DEVELOPER diagnostic: ${example.name}; incomplete rejected estate`;save(`${example.name}.DEVELOPER.json`,scene);save(`${example.name}.operations.json`,example.operations);return {name:example.name,remainingFindings:sceneRelationshipIssues(scene)};});
// Isolated stair feasibility example, not a repair or recovered mansion. Retain the
// destination deck/supports; develop a new supported route outside the salon wall.
const g=sceneSpatialGeometry(original),lower=.2,upper=g.top(g.map.get('belvedere-deck')!),risers=19,rise=(upper-lower)/risers;
const elements=original.elements.filter(e=>['arrival-court','belvedere-deck','belvedere-post-west','belvedere-post-east'].includes(e.id));
const stairOps:SceneOperation[]=Array.from({length:18},(_,i)=>{const top=lower+(i+1)*rise;return {op:'add',element:{id:`example-stair-${i+1}`,label:`Developer stair tread ${i+1}`,kind:'volume',at:[-5.2,top/2,-16+i*.3],size:[2.2,top,.3],material:'limestone',rotation:0,panels:4}};});
stairOps.push(
 {op:'add',element:{id:'example-lower-floor',label:'Developer lower walking datum',kind:'plate',at:[-5.2,.1,-16.3],size:[2.2,.2,.3],material:'limestone',rotation:0,panels:4}},
 {op:'add',element:{id:'example-landing-support',label:'Developer landing support',kind:'volume',at:[-3.8,(upper-.25)/2,-10.45],size:[5,upper-.25,.6],material:'limestone',rotation:0,panels:4}},
 {op:'add',element:{id:'example-landing',label:'Developer destination landing',kind:'plate',at:[-3.8,upper-.125,-10.45],size:[5,.25,.6],material:'limestone',rotation:0,panels:4}}
);
const stairScene=applySceneOperations({version:'architectural-scene-1',name:'DEVELOPER isolated stair feasibility; not the mansion',elements},stairOps);assert.deepEqual(sceneRelationshipIssues(stairScene),[]);save('stair-example.DEVELOPER.json',stairScene);
// No claim of a complete arrival route, guards, engineering or code certification.
save('verification.json',{providerCallsThisInvestigation:0,originalHashesVerified:true,exactProviderOutputReparsed:true,replayMatches128OriginalElements:true,wholeOriginalStillRejected:current.length>0,originalIssueCount:read('relationship-findings.json').length,currentIssueCount:current.length,originalRoofDirectionalFindings:20,currentRoofDirectionalFindings:current.filter(f=>f.rule==='assembly-roof-junction').length,examples:results,stairExample:{risers,rise,lowerDatum:lower,upperDatum:upper,relationshipFindings:0,scope:'Isolated supported stair/landing feasibility, not full house repair; no guards or approach certification.'},sourceHashes:read('sha256.json')});
console.log('Original hashes and exact response verified; 128 elements replayed; diagnostic examples saved. Zero provider calls.');
