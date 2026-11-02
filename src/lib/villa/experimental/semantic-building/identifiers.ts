/** Identity-only input adaptation. Never changes dimensions, topology or architecture. */
export type IdentifierMapping = {path:string;original:string;canonical:string};
/** Supplying diagnosticReferenceErrors continues past broken references for review only.
 * Construction always omits this collector and rejects every broken reference. */
export function normalizeSemanticIdentifiers(response:unknown, diagnosticReferenceErrors?:string[]):{response:unknown;mappings:IdentifierMapping[]} {
 const copy=structuredClone(response),mappings:IdentifierMapping[]=[];
 if(!copy||typeof copy!=='object'||!('status' in copy)||copy.status!=='proposed')return {response:copy,mappings};
 const intent=(copy as {intent?:unknown}).intent;
 if(!intent||typeof intent!=='object')return {response:copy,mappings};
 const data=intent as Record<string,unknown>;
 // ASCII case, whitespace and underscore separators only. No transliteration,
 // truncation or invented prefixes; unsupported spellings still fail the schema.
 const canonical=(s:string)=>s.trim().toLowerCase().replace(/[ _]+/g,'-');
 const groups=['levels','masses','spaces','portals','stairs'] as const;
 const tables=new Map<string,Map<string,string>>(),seen=new Map<string,string>();
 const set=(obj:Record<string,unknown>,key:string,path:string)=>{
  if(typeof obj[key]!=='string')return;
  const original=obj[key] as string,value=canonical(original);obj[key]=value;
  if(original!==value)mappings.push({path,original,canonical:value});
 };
 for(const group of groups){
  const table=new Map<string,string>();tables.set(group,table);
  if(!Array.isArray(data[group]))continue;
  for(const [index,entity] of (data[group] as unknown[]).entries()){
   if(!entity||typeof entity!=='object')continue;
   const obj=entity as Record<string,unknown>;if(typeof obj.id!=='string')continue;
   const value=canonical(obj.id),path=`intent.${group}.${index}.id`;
   if(seen.has(value))throw Error(`Identifier collision: ${seen.get(value)} and ${path} normalize to ${value}.`);
   seen.set(value,path);table.set(obj.id,value);set(obj,'id',path);
  }
 }
 set(data,'id','intent.id');
 const ref=(obj:Record<string,unknown>,key:string,group:string,path:string)=>{
  if(typeof obj[key]!=='string')return;
  const original=obj[key] as string,table=tables.get(group)!;
  // Accept an exact spelling or a unique canonical spelling in the correct namespace.
  const value=table.get(original)??[...table.values()].find(v=>v===canonical(original));
  if(!value){
   const message=`${path}: broken ${group} reference ${original}.`;
   if(!diagnosticReferenceErrors)throw Error(message);
   diagnosticReferenceErrors.push(message);set(obj,key,path);return;
  }
  obj[key]=value;if(original!==value)mappings.push({path,original,canonical:value});
 };
 for(const group of groups){
  if(!Array.isArray(data[group]))continue;
  for(const [i,entity] of (data[group] as unknown[]).entries()){
   if(!entity||typeof entity!=='object')continue;
   const obj=entity as Record<string,unknown>,path=`intent.${group}.${i}`;
   if(group==='masses'&&obj.relatesTo!==undefined)ref(obj,'relatesTo','masses',`${path}.relatesTo`);
   if(group==='spaces'){ref(obj,'mass','masses',`${path}.mass`);ref(obj,'level','levels',`${path}.level`);}
   if(group==='portals'){
    if(obj.host&&typeof obj.host==='object')ref(obj.host as Record<string,unknown>,'space','spaces',`${path}.host.space`);
    ref(obj,'to','spaces',`${path}.to`);
   }
   if(group==='stairs'){ref(obj,'lower','spaces',`${path}.lower`);ref(obj,'upper','spaces',`${path}.upper`);}
  }
 }
 ref(data,'arrival','spaces','intent.arrival');
 if(Array.isArray(data.requiredAccess))data.requiredAccess=data.requiredAccess.map((v,i)=>{const obj={value:v};ref(obj,'value','spaces',`intent.requiredAccess.${i}`);return obj.value;});
 return {response:copy,mappings};
}
