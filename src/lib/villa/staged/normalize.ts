/* eslint-disable @typescript-eslint/no-explicit-any -- unknown model objects are schema-validated after this narrow adapter */
import type {StageNo} from './pipeline';
import type {HouseSpec} from './spec';
import {allRooms} from './layout';
export interface Normalization {path:string;from:unknown;to:unknown;reason:string}
export class NormalizationError extends Error {
 constructor(message:string,readonly code:string,readonly changes:Normalization[]){super(message);}
}
/** Only identifier underscores and Stage-1's documented optional-null color are canonicalized.
 * No generic string rewriting, coercion, truncation, enum guessing or geometry changes. */
export function normalizeStage(stage:StageNo,input:unknown,draft:HouseSpec){
 const value=structuredClone(input) as any,changes:Normalization[]=[];
 const fail=(message:string,code='identifier-collision'):never=>{throw new NormalizationError(message,code,changes);};
 const obj=(x:any):x is Record<string,any>=>!!x&&typeof x==='object'&&!Array.isArray(x);
 const list=(x:any):any[]=>Array.isArray(x)?x:[];
 const canon=(id:any,path:string)=>{
  if(typeof id!=='string')return id;
  const next=id.replaceAll('_','-');
  if(next!==id)changes.push({path,from:id,to:next,reason:'identifier underscore → hyphen'});
  return next;
 };
 const namespace=()=>new Map<string,string>();
 const blocks=new Map(draft.blocks.map(b=>[b.id,b.id])),rooms=namespace(),stairs=namespace(),doors=namespace(),verandas=namespace();
 if(stage>=4)for(const r of allRooms(draft))rooms.set(r.id,r.id);
 const declare=(object:any,key:string,path:string,ids:Map<string,string>)=>{
  if(!obj(object))return;
  const old=object[key],next=canon(old,path);if(typeof next!=='string')return;
  if(ids.has(next))fail(`Identifier ${JSON.stringify(old)} at ${path} duplicates or collides with ${JSON.stringify(ids.get(next))} after normalization to ${JSON.stringify(next)}.`);
  ids.set(next,old);object[key]=next;
 };
 const ref=(object:any,key:string,path:string,ids:Map<string,string>,code='unknown-reference')=>{
  if(!obj(object))return;
  const next=canon(object[key],path);if(typeof next!=='string')return;
  if(!ids.has(next))fail(`Unresolved reference ${JSON.stringify(object[key])} at ${path}.`,code);
  object[key]=next;
 };
 const record=(object:any,key:string,path:string,ids:Map<string,string>,facades=false)=>{
  if(!obj(object)||!obj(object[key]))return;
  const seen=namespace(),entries=Object.entries(object[key]).map(([old,v])=>{
   const parts=facades?old.split(':'):[old];const next=canon(parts[0],`${path}.${old}`);const full=facades?`${next}:${parts.slice(1).join(':')}`:next;
   if(seen.has(full))fail(`Record keys ${seen.get(full)} and ${old} collide at ${path}.`);
   seen.set(full,old);if(!ids.has(next))fail(`Unknown component ${old} at ${path}.`,'unknown-component');
   return [full,v];
  });object[key]=Object.fromEntries(entries);
 };
 if(stage===1&&obj(value)&&obj(value.palette)&&value.palette.roofColor===null){delete value.palette.roofColor;changes.push({path:'palette.roofColor',from:null,to:'(omitted)',reason:'documented unspecified optional color'});}
 if(stage===2){const ids=namespace();list(value?.blocks).forEach((b,i)=>declare(b,'id',`blocks.${i}.id`,ids));}
 if(stage===3){
  if(obj(value)&&'rooms' in value){
   list(value.rooms).forEach((r,i)=>declare(r,'id',`rooms.${i}.id`,rooms));
   list(value.rooms).forEach((r,i)=>ref(r,'block',`rooms.${i}.block`,blocks,'unknown-block'));
   const seen=new Set<string>();list(value.connections).forEach((c,i)=>{ref(c,'a',`connections.${i}.a`,rooms);ref(c,'b',`connections.${i}.b`,rooms);if(obj(c)){const pair=[c.a,c.b].sort().join(':');if(seen.has(pair))fail(`Duplicate or contradictory room connection ${pair}.`,'duplicate-reference');seen.add(pair);}});
  }else{
   record(value,'plans','plans',blocks);
   const visit=(node:any,path:string)=>{if(!obj(node))return;if('room' in node)declare(node.room,'id',`${path}.room.id`,rooms);else{visit(node.a,`${path}.a`);visit(node.b,`${path}.b`);}};
   if(obj(value?.plans))Object.entries(value.plans).forEach(([id,node])=>visit(node,`plans.${id}`));
   list(value?.links).forEach((c,i)=>{ref(c,'a',`links.${i}.a`,rooms);ref(c,'b',`links.${i}.b`,rooms);});
  }
  list(value?.stairs).forEach((s,i)=>{declare(s,'id',`stairs.${i}.id`,stairs);ref(s,'room',`stairs.${i}.room`,rooms);if(obj(s)&&'landing' in s)ref(s,'landing',`stairs.${i}.landing`,rooms);});
 }
 if(stage===4&&obj(value)&&'roofFinish' in value){
  const open=new Map(draft.openSpaces.map(o=>[o.id,o.id]));
  for(const key of ['blockFinishes','roofs','facades'])list(value[key]).forEach((x,i)=>ref(x,'block',`${key}.${i}.block`,blocks,'unknown-component'));
  ref(value.entrance,'room','entrance.room',rooms,'invalid-main-entrance');
  list(value.doors).forEach((d,i)=>ref(d,'room',`doors.${i}.room`,rooms));
  list(value.verandas).forEach((v,i)=>ref(v,'openSpace',`verandas.${i}.openSpace`,open));
 }else if(stage===4){
  record(value,'roofs','roofs',blocks);record(value?.exterior,'facades','exterior.facades',blocks,true);
  list(value?.exterior?.doors).forEach((d,i)=>{declare(d,'id',`exterior.doors.${i}.id`,doors);ref(d,'room',`exterior.doors.${i}.room`,rooms);});
  ref(value?.exterior?.entrance,'door','exterior.entrance.door',doors,'invalid-main-entrance');
  list(value?.exterior?.verandas).forEach((v,i)=>{declare(v,'id',`exterior.verandas.${i}.id`,verandas);ref(v,'block',`exterior.verandas.${i}.block`,blocks);});
 }
 if(stage===5&&!(obj(value)&&'planting' in value)){if(obj(value?.siteWork?.pool)&&'sourceIntent' in value.siteWork.pool)ref(value.siteWork.pool,'sourceIntent','siteWork.pool.sourceIntent',new Map(draft.openSpaces.map(o=>[o.id,o.id])));record(value,'finishes','finishes',blocks);for(const key of ['lawns','beds','trees','hedges','paths']){const ids=namespace();list(value?.siteWork?.[key]).forEach((c,i)=>declare(c,'id',`siteWork.${key}.${i}.id`,ids));}}
 return {value,changes};
}

/** JSON object keys can otherwise be silently overwritten by JSON.parse before ID checks.
 * This validates only; the response is never rewritten or reparsed into a different design. */
export function assertUniqueJsonKeys(raw:string){
 JSON.parse(raw);
 const stack:({kind:'object';keys:Set<string>}|{kind:'array'})[]=[];
 for(let i=0;i<raw.length;i++){
  const c=raw[i];
  if(c==='{')stack.push({kind:'object',keys:new Set()});
  else if(c==='[')stack.push({kind:'array'});
  else if(c==='}'||c===']')stack.pop();
  else if(c==='"'){
   const start=i;for(i++;i<raw.length;i++){if(raw[i]==='\\'){i++;continue;}if(raw[i]==='"')break;}
   let next=i+1;while(/\s/.test(raw[next]??'')&&next<raw.length)next++;
   const current=stack.at(-1);
   if(raw[next]===':'&&current?.kind==='object'){
    const key=JSON.parse(raw.slice(start,i+1)) as string;
    if(current.keys.has(key))throw new NormalizationError(`Duplicate JSON object key ${JSON.stringify(key)}; refusing to overwrite a design decision.`,'duplicate-json-key',[]);
    current.keys.add(key);
   }
  }
 }
}
