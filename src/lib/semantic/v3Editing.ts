import type {V3Scene,V3SceneObject} from '@/lib/v3/scene';
import {normalizeV3EditPlan,type V3SceneEditPlan} from '@/lib/v3/operations';
import {OBJECT_REGISTRY,OBJECT_TYPES,SemanticEditError,changedFields,requestedCreationType,resolveSemanticTarget,stable,type ObjectType,type SemanticObject} from './vocabulary';

const nativeTypes: Record<string,ObjectType> = {'landscape-zone':'garden','planter':'planting-bed','glass-wall':'window','window-band':'window','surface':'floor','railing-run':'balcony','railing':'balcony','canopy':'roof','courtyard':'terrace','column':'mass','column-line':'mass','beam':'mass','light':'lighting','opening':'window','volume':'mass','slab':'floor','glass-panel':'window','water-surface':'pool','retaining-wall':'wall','building-mass':'building','roof-form':'roof','floor-slab':'floor','ceiling-slab':'ceiling','glazing':'window','door':'exterior-door','stairs':'stair','lift':'elevator','landscape':'garden','vegetation':'plant','furniture':'outdoor-furniture'};
export function v3SemanticObjects(scene:V3Scene):SemanticObject[]{
 return scene.objects.flatMap(o=>{
  const type=OBJECT_TYPES.find(t=>t===o.type)??nativeTypes[o.type]??'mass';
  return [{id:o.id,type:o.type==='door'&&/front|main entry|main entrance/i.test(`${o.label} ${o.semanticRole}`)?'front-door':type,label:o.label,aliases:[o.semanticRole],position:o.transform.position,hostId:o.hostId,memberIds:[o.id]}];
 });
}
export interface V3LocalScope {ids:string[]; operations:V3SceneEditPlan['operations'][number]['op'][]; fields:string[]; creationType?:ObjectType; widthOnly?:boolean;}
export function planV3LocalEdit(scene:V3Scene,prompt:string,selectedIds:readonly string[]=[]):V3LocalScope{
 const text=prompt.toLowerCase(), objects=v3SemanticObjects(scene);
 if(selectedIds.some(id=>!scene.objects.some(o=>o.id===id)))throw new SemanticEditError('unknown-target','Selected object no longer exists.');
 if(/^\s*(add|create|plant)\b/.test(text)){
  const type=requestedCreationType(prompt);
  if(type==='pool'&&objects.some(o=>o.type==='pool')&&!/another|second|additional/.test(text))throw new SemanticEditError('ambiguous-target','A pool already exists. Specify another pool or edit it.');
  return {ids:[],operations:['create'],fields:[],creationType:type};
 }
 if(selectedIds.length && !/\b(selected|selection|this|that)\b/.test(text)) {
  try {
   const named=resolveSemanticTarget(objects,prompt);
   if(!selectedIds.includes(named.id))throw new SemanticEditError('ambiguous-target','Selection conflicts with the named object.');
  }catch(error){
   if(!(error instanceof SemanticEditError)||error.code!=='unknown-target')throw error;
   // Generic property-only requests may use explicit UI selection. A named absent
   // object must never be substituted with the current selection.
   const noun=requestedCreationType(prompt);
   if(noun!=='material')throw error;
  }
 }
 const ids=selectedIds.length?[...selectedIds]:[resolveSemanticTarget(objects,prompt).id];
 if(/\b(material|finish|colou?r|blue|red|green|wood|stone|metal)\b/.test(text))return {ids,operations:['changeMaterial'],fields:['material']};
 if(/\b(widen|wider|resize|size|width|depth|height|bigger|smaller)\b/.test(text))return {ids,operations:['resize','editArchitecture','setConnectorEndpoints'],fields:['architecture','dimensions','transform'],widthOnly:/\b(widen|wider|width)\b/.test(text)};
 if(/\b(move|relocate)\b/.test(text))return {ids,operations:['move','editArchitecture'],fields:['architecture','transform']};
 if(/\b(rotate|turn)\b/.test(text))return {ids,operations:['rotate','editArchitecture'],fields:['architecture','transform']};
 if(/\b(delete|remove)\b/.test(text))return {ids,operations:['delete'],fields:[]};
 if(/\b(detach|attach)\b/.test(text))return {ids,operations:[/\bdetach\b/.test(text)?'detach':'attach'],fields:['hostId']};
 if(/\b(connect|endpoint)\b/.test(text))return {ids,operations:['setConnectorEndpoints'],fields:['fromSupportId','toSupportId']};
 throw new SemanticEditError('unsupported-edit','Specify an object and supported property to edit.');
}
const reject=(message:string):never=>{throw new SemanticEditError('preservation',message);};
export function validateV3LocalPlan(scene:V3Scene,input:unknown,scope:V3LocalScope):V3SceneEditPlan{
 const raw=input as {intent?:unknown;operations?:unknown[]};
 if(!raw||typeof raw!=='object'||Object.keys(raw).some(k=>!['intent','operations'].includes(k)))reject('Malformed local edit plan.');
 const fields:Record<string,string[]>={create:['op','object'],delete:['op','target'],move:['op','target','position'],rotate:['op','target','rotation'],resize:['op','target','dimensions'],changeMaterial:['op','target','material'],editArchitecture:['op','target','architecture'],attach:['op','target','hostId'],detach:['op','target'],setConnectorEndpoints:['op','target','fromSupportId','toSupportId']};
 if(Array.isArray(raw.operations))for(const operation of raw.operations){
  if(!operation||typeof operation!=='object')reject('Malformed local operation.');
  const op=operation as Record<string,unknown>,allowed=fields[String(op.op)];
  if(!allowed||Object.keys(op).some(k=>!allowed.includes(k)))reject('Unknown or protected operation fields.');
  if(op.op==='editArchitecture'&&op.architecture&&typeof op.architecture==='object'&&Object.keys(op.architecture).some(k=>!['x','z','baseElevation','width','depth','height','rotationY'].includes(k)))reject('Unknown or protected architecture fields.');
 }
 const normalized=normalizeV3EditPlan(input,scene);
 if(!normalized.plan)throw new SemanticEditError('unsupported-edit',normalized.errors.join(' '));
 for(const op of normalized.plan.operations){
  if(!scope.operations.includes(op.op))reject(`Operation ${op.op} exceeds the requested scope.`);
  if('target' in op&&!scope.ids.includes(op.target))reject(`Unrequested target: ${op.target}`);
  if(op.op==='create'){
   if(scene.objects.some(o=>o.id===op.object.id))reject('Creation cannot replace an existing ID.');
   const semantic=v3SemanticObjects({...scene,objects:[op.object]})[0];
   if(!semantic||semantic.type!==scope.creationType)reject('Created type differs from the request.');
   if(semantic.hostId){
    const host=v3SemanticObjects(scene).find(o=>o.id===semantic.hostId);
    if(!host||!OBJECT_REGISTRY[semantic.type].hosts.includes(host.type))reject('Created object has an invalid semantic host.');
   }
  }
  if(op.op==='editArchitecture'){
   const allowed=scope.operations.includes('resize')?['width','height','depth']:scope.operations.includes('move')?['x','z','baseElevation']:['rotationY'];
   if(Object.keys(op.architecture).some(k=>!allowed.includes(k)))reject('Architecture patch changes an unrequested field.');
  }
  if(op.op==='attach'){
   const objects=v3SemanticObjects(scene),target=objects.find(o=>o.id===op.target),host=objects.find(o=>o.id===op.hostId);
   if(!target||!host||!OBJECT_REGISTRY[target.type].hosts.includes(host.type))reject('Invalid semantic host.');
  }
  if(op.op==='setConnectorEndpoints'){
   const target=v3SemanticObjects(scene).find(o=>o.id===op.target);
   if(!target||!['stair','ramp','elevator'].includes(target.type))reject('Connector endpoints require a connector object.');
   for(const id of [op.fromSupportId,op.toSupportId])if(!scene.objects.some(o=>o.id===id)&&!scene.siteHierarchy?.levels.some(level=>level.id===id))reject('Unknown connector endpoint.');
  }
 }
 return normalized.plan;
}
export function assertV3LocalPreserved(before:V3Scene,after:V3Scene,scope:V3LocalScope):void{
 if(stable({...before,objects:undefined})!==stable({...after,objects:undefined}))reject('Local edits changed scene data outside objects.');
 const next=new Map(after.objects.map(o=>[o.id,o]));
 for(const old of before.objects){
  const n=next.get(old.id);
  if(!n){if(!scope.ids.includes(old.id)||!scope.operations.includes('delete'))reject(`Unrequested deletion: ${old.id}`);continue;}
  const fields=changedFields(old as unknown as Record<string,unknown>,n as unknown as Record<string,unknown>);
  if(fields.length&&(!scope.ids.includes(old.id)||fields.some(f=>!scope.fields.includes(f))))reject(`Unrequested changes to ${old.id}: ${fields.join(', ')}`);
  if(scope.widthOnly&&fields.length){
   const preserved=(o:V3SceneObject)=>({...o,dimensions:[0,...o.dimensions.slice(1)],architecture:o.architecture?{...o.architecture,width:0}:undefined});
   if(stable(preserved(old))!==stable(preserved(n)))reject('Widening must preserve endpoints, position, height and depth.');
  }
 }
 for(const n of after.objects)if(!before.objects.some(o=>o.id===n.id)&&!scope.creationType)reject(`Unrequested creation: ${n.id}`);
}
