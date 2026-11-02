import {expect,it} from 'vitest';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {z} from 'zod';
import {strictSceneResponseSchema} from './terra';
import {strictSchemaIssues, type SchemaNode} from './strictSchema';
import {canonicalProposalSchema,compileArchitecturalPlan} from '../canonical/plan';
import {compositionFixture} from '../canonical/compositions.fixture';
const require=createRequire(import.meta.url);
const Ajv=require('ajv');
const ajv=new Ajv({schemaId:'auto',unknownFormats:'ignore'});
function validator(schema:unknown){const s=structuredClone(schema) as SchemaNode;delete s.$schema;return ajv.compile(s);}
/** Fill omitted fields exactly as specified by the wire, never change supplied values. */
function encode(v:unknown,n:SchemaNode):unknown{
 if(n.anyOf){const branches=n.anyOf as SchemaNode[];const b=branches.find(b=>{const props=b.properties as Record<string,SchemaNode>|undefined;return props&&Object.entries(props).some(([k,p])=>'const'in p&&v&&typeof v==='object'&&(v as SchemaNode)[k]===p.const);})??branches.find(b=>b.type!=='null')!;return encode(v,b);}
 if(Array.isArray(v)&&n.items)return v.map(x=>encode(x,n.items as SchemaNode));
 if(v&&typeof v==='object'&&n.properties)return Object.fromEntries(Object.entries(n.properties as Record<string,SchemaNode>).map(([k,p])=>[k,k in v&&(v as SchemaNode)[k]!==undefined?encode((v as SchemaNode)[k],p):null]));
 return v;
}
it.each(['compact','waterfront','courtyard'] as const)('%s: real wire validation, normalization, compile and persistent editable geometry',async name=>{
 const schema=await strictSceneResponseSchema(canonicalProposalSchema),wire=await schema.jsonSchema;
 const plan=compositionFixture(name),proposal={status:'proposed',plan,limitations:['Offline developer fixture']};
 const encoded=encode({result:proposal},wire as SchemaNode);
 const check=validator(wire);expect(check(encoded),JSON.stringify(check.errors)).toBe(true);
 const parsed=await schema.validate!(encoded);expect(parsed).toMatchObject({success:true});
 if(typeof parsed==='boolean'||!parsed.success)throw Error('parse failed');
 expect(parsed.value).toEqual(JSON.parse(JSON.stringify(proposal)));
 const result=compileArchitecturalPlan((parsed.value as typeof proposal).plan);
 expect(JSON.parse(JSON.stringify(result.scene))).toEqual(result.scene);
 expect(new Set(result.scene.elements.map(e=>e.id)).size).toBe(result.scene.elements.length);
 const invalid=structuredClone(encoded) as {result:SchemaNode};invalid.result.decisions=['wrong variant'];
 expect(validator(wire)(invalid)).toBe(false);expect(await schema.validate!(invalid)).toMatchObject({success:false});
 for(const mutate of [(v:SchemaNode)=>{delete ((v.result as SchemaNode).plan as SchemaNode).screens;},(v:SchemaNode)=>{((((v.result as SchemaNode).plan as SchemaNode).spaces as SchemaNode[])[0]).width=-1;},(v:SchemaNode)=>{((v.result as SchemaNode).plan as SchemaNode).arrival=null;}]){
  const badWire=structuredClone(encoded) as SchemaNode;mutate(badWire);expect(check(badWire)).toBe(false);expect(await schema.validate!(badWire)).toMatchObject({success:false});
 }
 const bad=structuredClone(plan);bad.portals.find(p=>p.mode==='door')!.sill=.3;
 expect(()=>compileArchitecturalPlan(bad)).toThrow();
});
it('preserves the decision branch and rejects mixed discriminants and unknown operations',async()=>{
 const s=await strictSceneResponseSchema(canonicalProposalSchema),wire=await s.jsonSchema,check=validator(wire);
 for(const [v,valid]of [[{status:'decision-required',decisions:['Unsupported grading']},true],[{status:'decision-required',decisions:[]},false],[{status:'proposed',decisions:['No plan']},false],[{status:'operations',operations:[]},false]] as const){
  const value={result:v};expect(check(value)).toBe(valid);expect(await s.validate!(value)).toMatchObject({success:valid});
 }
});
it('converts nested discriminated unions without accepting invalid kind/type combinations',async()=>{
 const variant=z.discriminatedUnion('kind',[z.object({kind:z.literal('roof'),type:z.literal('gable'),rise:z.number()}).strict(),z.object({kind:z.literal('wall'),type:z.literal('solid'),height:z.number()}).strict()]);
 const s=await strictSceneResponseSchema(z.object({parts:z.array(variant)}).strict()),wire=await s.jsonSchema,check=validator(wire);
 for(const part of [{kind:'roof',type:'gable',rise:1},{kind:'wall',type:'solid',height:3},{kind:'roof',type:'solid',height:3},{kind:'wall',type:'gable',rise:1}]){
  const value={parts:[part]},expected=variant.safeParse(part).success;expect(check(value)).toBe(expected);expect(await s.validate!(value)).toMatchObject({success:expected});
 }
});
it('fails closed on overlapping oneOf and unsupported structures',async()=>{
 // Current Zod emits anyOf for ordinary unions; exercise the proof directly.
 const {assertDisjoint}=await import('./strictSchema');expect(()=>assertDisjoint([{type:'object'},{type:'object'}],{})).toThrow('overlapping');
 for(const key of ['oneOf','allOf','not','if','then','else','patternProperties','prefixItems','dependentRequired'])expect(strictSchemaIssues({type:'object',properties:{},required:[],additionalProperties:false,[key]:[]})).not.toEqual([]);
 expect(strictSchemaIssues({type:'object',properties:{x:{type:'string'}},required:[],additionalProperties:true})).toHaveLength(2);
});
it('traverses references and nested optional fields',async()=>{
 const item=z.object({name:z.string(),note:z.string().optional()}).strict();
 const s=await strictSceneResponseSchema(z.object({a:item,b:item}).strict()),wire=await s.jsonSchema;
 expect(strictSchemaIssues(wire as SchemaNode)).toEqual([]);
 expect(validator(wire)({a:{name:'A',note:null},b:{name:'B',note:'text'}})).toBe(true);
 expect(await s.validate!({a:{name:'A',note:null},b:{name:'B',note:'text'}})).toMatchObject({success:true,value:{a:{name:'A'},b:{name:'B',note:'text'}}});
 expect(strictSchemaIssues({type:'object',properties:{a:{$ref:'#/$defs/missing'}},required:['a'],additionalProperties:false})).not.toEqual([]);
});
it('identifies every frozen provider schema hazard including untouched branches',()=>{
 const p=JSON.parse(readFileSync('docs/architecture/canonical-live-mansion-2026-11-02/provider-request.exact.json','utf8'));
 const issues=strictSchemaIssues(p.text.format.schema);expect(issues.some(s=>s.includes('oneOf'))).toBe(true);expect(issues.filter(s=>s.includes('every property'))).toHaveLength(6);
});
it('retains legitimate nullable optional values and resolves recursive local references',async()=>{
 const child=z.object({note:z.string().nullable().optional(),count:z.number().optional()}).strict();
 const s=await strictSceneResponseSchema(z.object({child}).strict());
 expect(await s.validate!({child:{note:null,count:null}})).toMatchObject({success:true,value:{child:{note:null}}});
 type Tree={name:string;note?:string;children:Tree[]};
 const tree:z.ZodType<Tree>=z.lazy(()=>z.object({name:z.string(),note:z.string().optional(),children:z.array(tree)}).strict());
 const recursive=await strictSceneResponseSchema(tree),wire=await recursive.jsonSchema;
 expect(JSON.stringify(wire)).toContain('$ref');expect(strictSchemaIssues(wire as SchemaNode)).toEqual([]);
 const value={name:'root',note:null,children:[{name:'nested',note:null,children:[]}]};
 expect(validator(wire)(value)).toBe(true);expect(await recursive.validate!(value)).toMatchObject({success:true,value:{name:'root',children:[{name:'nested',children:[]}]}});
});
it('checks documented size limits, formats, and local definition references before submission',()=>{
 const object=(properties:Record<string,SchemaNode>):SchemaNode=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
 expect(strictSchemaIssues(object(Object.fromEntries(Array.from({length:5001},(_,i)=>['p'+i,{type:'string'}]))))).toContain('Property budget exceeded');
 expect(strictSchemaIssues(object({x:{type:'string',enum:Array.from({length:1001},(_,i)=>String(i))}}))).toContain('Enum budget exceeded');
 expect(strictSchemaIssues(object({['x'.repeat(120001)]:{type:'string'}}))).toContain('String budget exceeded');
 let deep:SchemaNode={type:'string'};for(let i=0;i<11;i++)deep=object({child:deep});expect(strictSchemaIssues(deep)).toContain('Maximum nesting depth exceeds 10');
 expect(strictSchemaIssues(object({x:{type:'string',format:'unrecognized'}}))).not.toEqual([]);
 const refs={...object({x:{$ref:'#/$defs/item'}}),$defs:{item:object({note:{type:['string','null']}})}};
 expect(strictSchemaIssues(refs)).toEqual([]);expect(validator(refs)({x:{note:null}})).toBe(true);expect(validator(refs)({x:{}})).toBe(false);
});
