/** OpenAI Structured Outputs subset (base models), checked before submission.
 * https://developers.openai.com/api/docs/guides/structured-outputs
 * Unknown constructs fail closed; constraints are never silently discarded. */
export type SchemaNode = Record<string, unknown>;
const keywords = new Set(['$schema','$defs','$ref','type','properties','required','additionalProperties','items','anyOf','enum','const','description','title','pattern','format','minimum','maximum','exclusiveMinimum','exclusiveMaximum','multipleOf','minLength','maxLength','minItems','maxItems']);
const formats = new Set(['date-time','time','date','duration','email','hostname','ipv4','ipv6','uuid']);
export function resolveSchema(node:SchemaNode,root:SchemaNode):SchemaNode {
 if(!node.$ref)return node;
 if(node.$ref==='#')return root;
 if(typeof node.$ref!=='string'||!node.$ref.startsWith('#/'))throw Error('Only local JSON pointer references are supported');
 const target=node.$ref.slice(2).split('/').reduce<unknown>((v,k)=>(v as SchemaNode)?.[k.replace(/~1/g,'/').replace(/~0/g,'~')],root);
 if(!target||typeof target!=='object')throw Error(`Unresolved reference ${node.$ref}`);
 return target as SchemaNode;
}
export function strictSchemaIssues(root:SchemaNode):string[]{
 const issues:string[]=[];let properties=0,enums=0,strings=0;
 if(root.type!=='object'||root.anyOf)issues.push('$: root must be an object without anyOf');
 function walk(n:SchemaNode,path:string){
  for(const key of Object.keys(n))if(!keywords.has(key))issues.push(`${path}: unsupported ${key}`);
  if(n.$ref){try{resolveSchema(n,root);}catch(e){issues.push(`${path}: ${String(e)}`);}}
  if(n.format&&!formats.has(String(n.format)))issues.push(`${path}: unsupported format`);
  if(n.type==='object'||n.properties){
   const props=(n.properties??{}) as Record<string,SchemaNode>,keys=Object.keys(props),required=n.required as string[]|undefined;
   properties+=keys.length;strings+=keys.join('').length;
   if(n.additionalProperties!==false)issues.push(`${path}: additionalProperties must be false`);
   if(!Array.isArray(required)||required.length!==keys.length||new Set(required).size!==keys.length||keys.some(k=>!required.includes(k)))issues.push(`${path}: every property must be required`);
   for(const [k,v]of Object.entries(props))walk(v,`${path}.properties.${k}`);
  }
  if(n.enum){const values=n.enum as unknown[];enums+=values.length;const size=values.reduce<number>((a,v)=>a+(typeof v==='string'?v.length:0),0);strings+=size;if(values.length>250&&size>15000)issues.push(`${path}: enum string budget exceeded`);}
  if(typeof n.const==='string')strings+=n.const.length;
  if(n.$defs)for(const [k,v]of Object.entries(n.$defs as Record<string,SchemaNode>)){strings+=k.length;walk(v,`${path}.$defs.${k}`);}
  if(n.items)walk(n.items as SchemaNode,`${path}.items`);
  for(const key of ['anyOf','oneOf','allOf'])if(n[key])(n[key] as SchemaNode[]).forEach((v,i)=>walk(v,`${path}.${key}[${i}]`));
 }
 walk(root,'$');
 function depth(n:SchemaNode,d:number,active=new Set<SchemaNode>()){
  if(active.has(n))return;const next=new Set(active).add(n);
  if(n.$ref){try{depth(resolveSchema(n,root),d,next);}catch{}return;}
  const level=d+(n.type==='object'||n.type==='array'?1:0);if(level>10)issues.push('Maximum nesting depth exceeds 10');
  Object.values(n.properties as Record<string,SchemaNode>??{}).forEach(v=>depth(v,level,next));
  if(n.items)depth(n.items as SchemaNode,level,next);
  (n.anyOf as SchemaNode[]??[]).forEach(v=>depth(v,level,next));
 }
 depth(root,0);
 if(properties>5000)issues.push('Property budget exceeded');if(enums>1000)issues.push('Enum budget exceeded');if(strings>120000)issues.push('String budget exceeded');
 return [...new Set(issues)];
}
/** oneOf -> anyOf is equivalent only when every pair is provably disjoint. */
export function assertDisjoint(branches:SchemaNode[],root:SchemaNode){
 const values=(n:SchemaNode)=>'const'in n?[n.const]:n.enum as unknown[]|undefined;
 for(let i=0;i<branches.length;i++)for(let j=i+1;j<branches.length;j++){
  const a=resolveSchema(branches[i],root),b=resolveSchema(branches[j],root);
  const ap=a.properties as Record<string,SchemaNode>??{},bp=b.properties as Record<string,SchemaNode>??{};
  const disjoint=Object.keys(ap).some(k=>{
   if(!(a.required as string[]??[]).includes(k)||!(b.required as string[]??[]).includes(k)||!bp[k])return false;
   const av=values(resolveSchema(ap[k],root)),bv=values(resolveSchema(bp[k],root));
   return av&&bv&&[...av,...bv].every(v=>v===null||['string','number','boolean'].includes(typeof v))&&av.every(v=>!bv.includes(v));
  });
  if(!disjoint)throw Error('Cannot translate overlapping or unproven oneOf alternatives to strict anyOf');
 }
}
/** Check the transport shape before unwrapping a root union. Original Zod still
 * owns all value constraints and refinements after transport normalization. */
export function strictWireShape(value:unknown,node:SchemaNode,root:SchemaNode):boolean{
 if(node.$ref)return strictWireShape(value,resolveSchema(node,root),root);
 if(node.anyOf&&!(node.anyOf as SchemaNode[]).some(n=>strictWireShape(value,n,root)))return false;
 if('const'in node&&value!==node.const)return false;
 if(node.enum&&!(node.enum as unknown[]).includes(value))return false;
 const types=Array.isArray(node.type)?node.type:[node.type];
 if(node.type&&!types.some(t=>t==='null'?value===null:t==='array'?Array.isArray(value):t==='object'?!!value&&typeof value==='object'&&!Array.isArray(value):t==='integer'?Number.isInteger(value):typeof value===t))return false;
 if(node.properties){
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const props=node.properties as Record<string,SchemaNode>,v=value as SchemaNode;
  if((node.required as string[]??[]).some(k=>!Object.hasOwn(v,k)))return false;
  if(node.additionalProperties===false&&Object.keys(v).some(k=>!(k in props)))return false;
  if(Object.entries(props).some(([k,p])=>Object.hasOwn(v,k)&&!strictWireShape(v[k],p,root)))return false;
 }
 if(Array.isArray(value)&&node.items)return value.every(v=>strictWireShape(v,node.items as SchemaNode,root));
 return true;
}
