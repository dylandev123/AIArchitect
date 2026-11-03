/** Actual SDK serialization with an in-memory HTTP transport. No external access, no provider call.
 *
 * Two frozen artifacts are compared with the schema the application now serializes:
 *  - the historical prepared request (before spatial authority): preserved unmodified;
 *  - the prepared request for the next controlled experiment (NOT SUBMITTED): the same brief and
 *    retrieved knowledge with the current instructions and schema. */
import {expect,it,vi} from 'vitest';
import {existsSync,readFileSync} from 'node:fs';
import {createOpenAI} from '@ai-sdk/openai';
import {generateText,Output} from 'ai';
import {strictSceneResponseSchema} from '../scene/terra';
import {canonicalProposalSchema,architecturalPlanSchema,CANONICAL_INSTRUCTIONS,CANONICAL_CONTEXT_PRECEDENCE} from './plan';
import {strictSchemaIssues} from '../scene/strictSchema';
type Json=Record<string,unknown>;
const live=JSON.parse(readFileSync('docs/architecture/canonical-live-mansion-2026-11-02/provider-request.exact.json','utf8'));
const historical=JSON.parse(readFileSync('docs/architecture/canonical-schema-compatibility/provider-request.prepared.NOT-SUBMITTED.json','utf8'));
const NEXT_FILE='docs/architecture/canonical-spatial-authority-2026-11-02/provider-request.prepared.NOT-SUBMITTED.json';
const END='Disclose limitations.';
/** Frozen brief and retrieved knowledge, with today's instruction block and precedence clause. */
const nextSystem=():string=>{const frozen:string=live.input[0].content;return CANONICAL_INSTRUCTIONS+frozen.slice(frozen.indexOf(END)+END.length)+CANONICAL_CONTEXT_PRECEDENCE;};
const userParts=()=>live.input[1].content.map((p:{text:string})=>({type:'text' as const,text:p.text}));
/** Serialize through the real SDK + OpenAI provider, capturing the exact HTTP body. */
async function serialize(system:string){
 let captured:Json|undefined;
 const fetch=vi.fn(async(_url:unknown,init:RequestInit|undefined)=>{
  captured=JSON.parse(String(init?.body));
  return new Response(JSON.stringify({id:'resp_mock',object:'response',created_at:0,model:live.model,status:'completed',output:[{type:'message',id:'msg_mock',role:'assistant',content:[{type:'output_text',text:JSON.stringify({result:{status:'decision-required',decisions:['Offline transport rehearsal']}}),annotations:[]}]}],usage:{input_tokens:0,output_tokens:0,total_tokens:0}}),{status:200,headers:{'content-type':'application/json'}});
 });
 const result=await generateText({model:createOpenAI({apiKey:'offline-placeholder',fetch})(live.model),system,messages:[{role:'user',content:userParts()}],maxOutputTokens:live.max_output_tokens,maxRetries:0,providerOptions:{openai:{strictJsonSchema:true}},output:Output.object({schema:await strictSceneResponseSchema(canonicalProposalSchema)})});
 expect(fetch).toHaveBeenCalledTimes(1);expect(result.output).toEqual({status:'decision-required',decisions:['Offline transport rehearsal']});
 return captured as Json&{text:{format:{schema:Json}};input:{content:unknown}[]};
}
/** Undo the intended wire changes: an optional `height` serialized as anyOf[number, null], and the two derived
 * opening sides ("shared", "exposed") appended to the portal host side enum. */
function revertOptionalHeight(node:unknown):unknown{
 if(Array.isArray(node))return node.map(revertOptionalHeight);
 if(!node||typeof node!=='object')return node;
 const out:Json={};
 for(const [k,v] of Object.entries(node as Json))out[k]=revertOptionalHeight(v);
 if(Array.isArray(out.enum)&&out.enum.join()==='south,east,north,west,shared,exposed')out.enum=['south','east','north','west'];
 const props=out.properties as Record<string,Json>|undefined;
 // Additive optional fields of the whole-building coordination layer: a wing's own placement, and declared constraints.
 if(props?.id&&props.role&&props.relatesTo&&props.placement){delete props.placement;out.required=(out.required as string[]).filter(k=>k!=='placement');}
 if(props?.cameraViews&&props.constraints){delete props.constraints;out.required=(out.required as string[]).filter(k=>k!=='constraints');}
 // Additive optional building-scale composition (volumes, roof spans, facade rhythms, entrance).
 if(props?.cameraViews&&props.composition){delete props.composition;out.required=(out.required as string[]).filter(k=>k!=='composition');}
 // Additive optional declaration that a space is attached to its wing (placement extent only).
 if(props?.height&&props.width&&props.depth&&props.outdoor&&props.attached){delete props.attached;out.required=(out.required as string[]).filter(k=>k!=='attached');}
 if(props?.height&&props.width&&props.depth&&props.outdoor){
  const branches=props.height.anyOf as Json[]|undefined;
  expect(branches).toHaveLength(2);expect(branches![1]).toEqual({type:'null'});
  props.height=branches![0];
 }
 return out;
}
/** The wire schema with only the additive composition property removed. */
function withoutComposition(node:unknown):unknown{
 if(Array.isArray(node))return node.map(withoutComposition);
 if(!node||typeof node!=='object')return node;
 const out:Json={};for(const [k,v] of Object.entries(node as Json))out[k]=withoutComposition(v);
 const props=out.properties as Record<string,Json>|undefined;
 if(props?.cameraViews&&props.composition){delete props.composition;out.required=(out.required as string[]).filter(k=>k!=='composition');}
 return out;
}
it('the historical prepared wire request is still strict-valid and unmodified',()=>{
 expect(strictSchemaIssues(historical.text.format.schema)).toEqual([]);
 expect(historical.input[0].content).toBe(live.input[0].content);
});
it('serializes the current schema as the historical wire format plus an optional height, two derived opening sides, optional wing placement and declared constraints',async()=>{
 const wire=await serialize(live.input[0].content);
 expect(strictSchemaIssues(wire.text.format.schema)).toEqual([]);
 // Every other byte of the request (model, messages, token ceiling, format name/strictness) is unchanged.
 expect({...wire,text:{...wire.text,format:{...wire.text.format,schema:null}}}).toEqual({...historical,text:{...historical.text,format:{...historical.text.format,schema:null}}});
 expect(revertOptionalHeight(wire.text.format.schema)).toEqual(historical.text.format.schema);
 expect(wire.text.format.schema).not.toEqual(historical.text.format.schema);
});
it('the new optional height is the only wire difference and stays within the OpenAI strict subset',async()=>{
 const wire=await serialize(live.input[0].content);
 const text=JSON.stringify(withoutComposition(wire.text.format.schema));
 expect(text.split('"height"').length-1).toBe(JSON.stringify(historical.text.format.schema).split('"height"').length-1);
 const spaceHeight=(JSON.parse(text) as Json);
 expect(JSON.stringify(spaceHeight)).toContain('"height":{"anyOf":[{"type":"number"');
});
it('every historical plan (explicit heights) still parses and compiles identically under the evolved schema',async()=>{
 const {compileArchitecturalPlan}=await import('./plan');
 const retained=JSON.parse(readFileSync('docs/architecture/canonical-corrected-mansion-2026-11-02/proposal.normalized.json','utf8')).plan;
 expect(architecturalPlanSchema.safeParse(retained).success).toBe(true);
 const {compositionFixture}=await import('./compositions.fixture');
 for(const name of ['compact','waterfront','courtyard'] as const){
  const plan=compositionFixture(name);expect(architecturalPlanSchema.safeParse(plan).success).toBe(true);
  expect(compileArchitecturalPlan(plan).scene.elements.length).toBeGreaterThan(0);
 }
});
it('serializes the current instructions and schema strictly, with the frozen brief; the superseded spatial-authority preparation is left as a retained file',async()=>{
 const system=nextSystem();
 const wire=await serialize(system);
 expect(strictSchemaIssues(wire.text.format.schema)).toEqual([]);
 expect(wire.input[0].content).toBe(system);
 expect(system.startsWith(CANONICAL_INSTRUCTIONS)).toBe(true);expect(system.endsWith(CANONICAL_CONTEXT_PRECEDENCE)).toBe(true);
 // The next controlled request is frozen separately (requestBoundary.test.ts); this earlier, unsubmitted
 // preparation predates the partial-roof instruction and the retrieval filter and is not rewritten.
 expect(existsSync(NEXT_FILE)).toBe(true);
 expect(wire.input[1]).toEqual(historical.input[1]);
});
