/** Explicit human/agent-authored comparison copies. No production module imports this file. */
import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { v3ArchitecturalBlueprintSchema, planV3ArchitecturalBlueprint, constructV3ArchitecturalBlueprint } from '../src/lib/v3/architecturalBlueprint';
import { splitV3ArchitecturalBlueprint, prepareV3ArchitecturalPlan, constructV3PlanMassing, sameArchitecturalPlan, inspectV3ArchitecturalPlan } from '../src/lib/v3/architecturalPlanFirst';
import { generateV3FromArchitecturalBlueprint, v3ArchitecturalBlueprintPrompt } from '../src/lib/v3/architecturalBlueprintGeneration';
import { auditArchitecturalConstructionFidelity } from '../src/lib/v3/architecturalConstructionFidelity';
import { compileV3Scene, type V3Scene } from '../src/lib/v3/scene';

globalThis.fetch=async()=>{throw Error('Network forbidden in architectural design comparison');};
const out='docs/architecture/architectural-blueprint-pipeline/design-restrictions';mkdirSync(out,{recursive:true});
const save=(name:string,data:unknown)=>writeFileSync(`${out}/${name}.json`,JSON.stringify(data,null,2)+'\n');
const root=(scene:V3Scene)=>({version:3,generationMode:'v3-scene',v3Scene:scene});
const hash=(text:string|Buffer)=>createHash('sha256').update(text).digest('hex');
const evidence=[];
for(const date of ['2026-10-20','2026-10-21']){
 const path=`src/lib/v3/__tests__/fixtures/architectural-blueprint-live-${date}.json`,raw=readFileSync(path),original=v3ArchitecturalBlueprintSchema.parse(JSON.parse(raw.toString()));
 const approved=planV3ArchitecturalBlueprint(original,{buildFirst:true});assert(approved.approval,JSON.stringify(approved.findings));
 const before=constructV3ArchitecturalBlueprint(approved.approval);assert(before.ok,JSON.stringify(before.findings));save(`${date}-before`,root(before.scene!));
 const b=structuredClone(original),home=b.buildings[0],guest=b.buildings[1],first=date.endsWith('20');
 // This is a new design decision, never a validation repair or modification of recovery evidence.
 b.concept=first?'Two inhabited wings frame a north-facing ocean court; south arrival is compressed before the water garden.':'An L-shaped residence shelters a west garden court; eastern arrival and a low guest garden have separate approaches.';
 b.character='Tropical mineral walls, recessed glazing and real shaded outdoor rooms. Conceptual interiors; no infinity edge, planted species or flush-threshold certification is claimed.';
 b.forms=[];b.zones=[];b.considerations=[];b.relationships=[];b.roomAdjacencies=[];b.partitions=[];b.doors=[];
 home.location={x:first?-5:-10,z:first?-3:0,baseElevation:0,rotationY:0};
 home.plan=first?{kind:'articulated',width:32,depth:24,operations:[{id:'ocean-court',type:'recess',facade:'north',start:.3125,end:.6875,depth:8}]}:{kind:'articulated',width:32,depth:24,operations:[{id:'garden-court',type:'notch',corner:'nw',width:10,depth:8}]};
 const layouts=first?[
  [[-11,-6,10,12],[11,-6,10,12],[11,6,10,12],[0,7,12,10],[-11,6,10,12],[-3,-1,6,6],[3,-1,6,6]],
  [[-11,-6,10,12],[-3,8,6,8],[3,8,6,8],[11,-6,10,12],[11,6,10,12],[-11,6,10,12]],
 ]:[
  [[-11,4,10,16],[-1,7,6,8],[9,7,12,8],[8,-8,8,6],[14,-9,3,4],[14,-5.5,3,2],[4.5,-1,21,6],[-1,-8,8,6]],
  [[-11,4,10,16],[9,7,12,8],[14,-8,3,6],[-1,7,6,8],[-1,-8,8,6],[8,-8,8,6],[4.5,-1,21,6]],
 ];
 home.storeys.forEach((s,l)=>s.spaces.forEach((r,i)=>{const [x,z,width,depth]=layouts[l][i];r.footprint={x,z,width,depth};}));
 if(first)home.storeys[1].spaces.push({id:'upper-court-gallery',label:'Court gallery',role:'Private circulation',program:'Hall linking the two wings',footprint:{x:0,z:0,width:12,depth:8}});
 guest.location={x:first?27:-38,z:first?-9:-16,baseElevation:0,rotationY:0};guest.plan={kind:'rectangle',width:16,depth:12};
 const guestRooms=first?[[-4,0,8,12],[4,-2,8,8],[2,4,4,4],[6,4,4,4]]:[[-4,-1,6,8],[3,-1,8,8],[-4,4,6,2],[0,4,2,2],[4,4,6,2]];
 guest.storeys[0].spaces.forEach((r,i)=>{const [x,z,width,depth]=guestRooms[i];r.footprint={x,z,width,depth};});
 // Keep floor area close enough to make composition review useful: this is
 // not an equal-area experiment, and the exact areas are reported below.
 const scale=first?.85:.8;
 if(home.plan.kind==='articulated'){
  home.plan.width*=scale;home.plan.depth*=scale;
  for(const op of home.plan.operations){if('width' in op)op.width*=scale;if('depth' in op)op.depth*=scale;}
 }
 for(const s of home.storeys)for(const r of s.spaces)for(const key of ['x','z','width','depth'] as const)r.footprint[key]*=scale;
 const stair=b.verticalCirculation[0];stair.footprint=first?{x:-11*scale,z:6*scale,width:2,depth:8}:{x:6*scale,z:-1*scale,width:5,depth:4};stair.stairType=first?'straight':'u-shaped';stair.direction=first?'south':'north';if(first)delete stair.turn;
 const entry=b.entrances.find(e=>e.objectId===home.id)!,guestEntry=b.entrances.find(e=>e.objectId===guest.id)!;
 home.facade={massHierarchy:'primary',openings:[{id:entry.openingId,type:'glazed-door',facade:first?'south':'east',start:.43,end:.57,height:3,floors:'ground',operation:'hinged',reveal:.18},
  {id:'garden-living-door',type:'glazed-door',facade:first?'north':'south',start:.05,end:.27,height:3,floors:'ground',operation:'sliding',reveal:.2},
  {id:'garden-wing-glass',type:'glazing-zone',facade:first?'north':'west',start:first?.73:.04,end:.96,heightRatio:.72,reveal:.2},
  {id:'upper-view-glass',type:'glazing-zone',facade:first?'east':'south',start:.15,end:.85,heightRatio:.64,floors:'upper',reveal:.2}],mainEntry:{openingId:entry.openingId,canopyDepth:2,color:'#292b29'},assemblies:[]};
 // Real facade depth complements the plan; these are optional example decisions.
 if(first){
  home.facade.openings!.push(
   {id:'arrival-west-glass',type:'glazing-zone',facade:'south',start:.05,end:.34,heightRatio:.68,floors:'ground',reveal:.18},
   {id:'arrival-east-glass',type:'glazing-zone',facade:'south',start:.66,end:.95,heightRatio:.68,floors:'ground',reveal:.18},
   {id:'arrival-upper-windows',type:'opening-rhythm',facade:'south',count:4,width:1.5,height:1.6,sill:.8,floors:'upper'});
 }else{
  home.facade.openings!.push(
   {id:'south-dining-glass',type:'glazing-zone',facade:'south',start:.36,end:.94,heightRatio:.74,floors:'ground',reveal:.18},
   {id:'entry-upper-glass',type:'glazing-zone',facade:'east',start:.36,end:.64,heightRatio:.65,floors:'upper',reveal:.18});
 }
 const porticoFacade=first?'south' as const:'east' as const;
 home.facade.assemblies=[{id:'arrival-gallery-shade',intent:'A real shaded arrival gallery gives the main entrance depth',parts:[
  {id:'gallery-cover',type:'slab',facade:porticoFacade,start:first?.04:.28,end:first?.96:.72,depth:2.4,elevation:3.8,thickness:.2},
  ...((first?[.06,.34,.66,.94]:[.28,.72]).map((at,i)=>({id:`gallery-post-${i}`,type:'post' as const,facade:porticoFacade,at,depth:2.2,height:3.8,size:.24}))),
 ]}];
 guest.facade={massHierarchy:'secondary',openings:[{id:guestEntry.openingId,type:'glazed-door',facade:'south',start:.4,end:.6,height:2.7,floors:'ground',operation:'hinged'},
  {id:'guest-garden-glass',type:'glazing-zone',facade:first?'north':'west',start:.08,end:.92,heightRatio:.7,reveal:.18}],mainEntry:{openingId:guestEntry.openingId,canopyDepth:1.6}};
 home.roof={...home.roof,form:'floating-flat',pitchDegrees:0,overhang:.6};
 guest.roof={...guest.roof,form:first?'hip':'mono-pitch',pitchDegrees:first?18:10,overhang:.6};
 const paving=b.features.find(f=>f.type==='terrace')!.materialId,water=b.features.find(f=>f.type==='pool')!.materialId,grass=b.features.find(f=>f.type==='landscape-zone')!.materialId;
 const feat=(id:string,label:string,type:string,x:number,z:number,width:number,depth:number,height=.18)=>({id,label,role:label,type,materialId:type==='pool'?water:type==='landscape-zone'?grass:paving,location:{x,z,baseElevation:type==='pool'?.18-1.4:0,rotationY:0},width,depth,height:type==='pool'?1.4:height,...(type==='terrace'?{railing:'none' as const}: {})});
 const deck=first?'view-terrace':'sunset-terrace';
 b.features=first?[
  feat('arrival-court','Sheltered south arrival court','terrace',-5,22,24,14),feat(deck,'North water garden deck','terrace',-5,-29,36,20),
  feat('infinity-pool','Ordinary swimming basin, no infinity system','pool',-5,-32,22,6),feat('guest-terrace','Quiet guest garden room','terrace',27,-21,16,12),
  feat('ocean-court-floor','Dry court between inhabited wings','terrace',-5,-12.7,10.2,12.6),feat('west-wing-porch','West wing dry porch','terrace',-14.35,-16.1,8.5,5.8),feat('east-wing-porch','East wing dry porch','terrace',4.35,-16.1,8.5,5.8),feat('tropical-garden','Guest privacy lawn','landscape-zone',29,-38,20,16,.12),
 ]:[feat(deck,'South living and pool deck','terrace',-10,19.8,38,20.4),feat('infinity-pool','Ordinary swimming basin, no infinity system','pool',-17,23,16,6),
  feat('guest-garden-floor','Private guest garden terrace','terrace',-38,-3,16,14),feat('north-garden-lawn','Sheltered northwest lawn court','landscape-zone',-21,-8,10,8,.14),
  feat('east-arrival-lawn','Quiet east landscape reserve','landscape-zone',29,-17,28,38,.14)];
 const shade=feat('garden-shade','Shaded dining pavilion','canopy',first?9:3,first?-24:21,8,8,3.2);shade.location.baseElevation=.18;Object.assign(shade,{canopyStyle:'slatted'});b.features.push(shade);
 const route=(id:string,from:typeof b.connections[number]['from'],to:typeof b.connections[number]['to'],width:number,waypoints:number[][]=[],use:'vehicle'|'pedestrian'='pedestrian')=>({id,surfaceId:`${id}-owner`,purpose:id,from,to,width,waypoints:waypoints as [number,number,number][],use,materialId:paving});
 b.connections=first?[
  route('arrival-drive',{kind:'site-access',accessId:b.site.access[0].id},{kind:'entrance',entranceId:entry.id,approachDistance:3},4.8,[[-5,0,34]],'vehicle'),
  route('guest-walk',{kind:'surface',objectId:'arrival-court',local:[10,0]},{kind:'entrance',entranceId:guestEntry.id,approachDistance:2},1.8,[[27,0,22],[27,0,4]]),
  route('west-garden-walk',{kind:'surface',objectId:'arrival-court',local:[-10,0]},{kind:'surface',objectId:deck,local:[-16,8]},1.8,[[-25,0,22],[-25,0,-21]]),
  route('court-to-water',{kind:'surface',objectId:'ocean-court-floor',local:[0,0]},{kind:'surface',objectId:deck,local:[0,10]},2),
 ]:[
  route('arrival-drive',{kind:'site-access',accessId:b.site.access[0].id},{kind:'entrance',entranceId:entry.id,approachDistance:3},5.8,[[35,0,5],[15,0,5]],'vehicle'),
  route('terrace-walk',{kind:'entrance',entranceId:entry.id,approachDistance:2},{kind:'surface',objectId:deck,local:[17,-7]},1.8,[[11,0,3],[11,0,14]]),
  route('guest-garden-walk',{kind:'surface',objectId:deck,local:[-17,-6]},{kind:'entrance',entranceId:guestEntry.id,approachDistance:2},1.5,[[-29,0,15],[-29,0,-5]]),
 ];
 // Preserve every user requirement. Revise design claims to match this separately authored scheme.
 b.requirements=b.requirements.filter(r=>r.source==='user');
 b.program=b.program.filter(p=>p.kind==='residence'||p.kind==='building').map(p=>({...p,objectIds:p.objectIds.filter(id=>b.buildings.some(b=>b.id===id))}));
 b.program.push({id:'outdoor-program',role:'Dry garden rooms and ordinary swimming basin',kind:'amenity',objectIds:[deck,'infinity-pool'],source:'design',access:'required'});
 b.entrances=b.entrances.filter(e=>e.id===entry.id||e.id===guestEntry.id);
 b.entrances.push({id:'garden-living-exit',objectId:home.id,openingId:'garden-living-door',level:0});
 // Shading is expressed as actual pavilion geometry; no promise of planted species or infinity edge.
 const design=splitV3ArchitecturalBlueprint(v3ArchitecturalBlueprintSchema.parse(b));save(`${date}-alternative.plan`,design.plan);save(`${date}-alternative.exterior`,design.exterior);
 const stage=prepareV3ArchitecturalPlan(JSON.parse(readFileSync(`${out}/${date}-alternative.plan.json`,'utf8')));assert(stage.ok,JSON.stringify(stage.findings));save(`${date}-plan`,root(stage.scene!));
 const massing=constructV3PlanMassing(stage)!;save(`${date}-massing`,root(massing.scene));
 const stages:string[]=[];let mockCalls=0;
 const result=await generateV3FromArchitecturalBlueprint('A tropical residence and independent guest accommodation',async()=>{mockCalls++;return {output:design,finishReason:'stop'};},{requirePlanFirst:true,onStage:s=>{stages.push(s.stage);}});
 assert(result.ok,JSON.stringify(result.findings));assert.equal(mockCalls,1);assert.deepEqual(stages,['plan','massing','exterior']);assert(sameArchitecturalPlan(stage.scene!,result.scene!));
 assert.deepEqual(auditArchitecturalConstructionFidelity(result.scene!,compileV3Scene(result.scene!)),[]);save(`${date}-after`,root(result.scene!));
 assert.equal(hash(readFileSync(path)),hash(raw));
 evidence.push({date,originalSha256:hash(raw),originalOutcome:before.outcome,alternativeOutcome:result.outcome,providerCalls:0,mockedAuthorResponses:mockCalls,stages,planPreserved:true,originalUnchanged:true,originalRooms:original.buildings.flatMap(b=>b.storeys.flatMap(s=>s.spaces.map(r=>r.id))),alternativeRooms:design.plan.buildings.flatMap(b=>b.storeys.flatMap(s=>s.spaces.map(r=>r.id))),
  alternativeJSONCharacters:JSON.stringify(design).length,findings:result.findings,trace:inspectV3ArchitecturalPlan(stage.scene!),massingParts:massing.model.primitives.map(p=>({id:p.id,sourceObjectId:p.sourceObjectId})),
  originalPlan:original.buildings.map(b=>({id:b.id,location:b.location,plan:b.plan})),alternativePlan:design.plan.buildings.map(b=>({id:b.id,location:b.location,plan:b.plan})),
  floorAreas:{original:original.buildings.reduce((sum,b)=>sum+(b.plan.kind==='rectangle'?b.plan.width*b.plan.depth*b.storeys.length:0),0),alternative:(first?672:688)*scale*scale*2+192},poolRim:.18,deckTop:.18,provenance:'Separately authored offline design copy retaining the original site, user requirements, building/storey/room identities and accommodation program. Additional court/shade decisions are examples, never a production template or evidence of natural Terra quality.'});
}
const prompt=v3ArchitecturalBlueprintPrompt(),old=readFileSync(`${out}/authoring-before.txt`,'utf8');
writeFileSync(`${out}/authoring-after.txt`,prompt);
save('proof',{providerCalls:0,evidence,prompt:{beforeCharacters:old.length,afterCharacters:prompt.length,beforeInstructionCharacters:old.indexOf('{'),afterInstructionCharacters:prompt.indexOf('{'),beforeSha256:hash(old),afterSha256:hash(prompt),tokenCounts:'Character counts only; no tokenizer estimate or historical usage is asserted.'}});
console.log(JSON.stringify(evidence.map(e=>({date:e.date,before:e.originalOutcome,after:e.alternativeOutcome,findings:e.findings.map(f=>f.code)}))));
