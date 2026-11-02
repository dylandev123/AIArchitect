/** Offline, no credentials, database, network, or provider imports. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {Output,zodSchema} from 'ai';
import {canonicalProposalSchema} from '../src/lib/villa/canonical/plan';
import {strictSceneResponseSchema} from '../src/lib/villa/scene/terra';
import {strictSchemaIssues,type SchemaNode} from '../src/lib/villa/scene/strictSchema';
const oldDir='docs/architecture/canonical-live-mansion-2026-11-02',dir='docs/architecture/canonical-schema-compatibility';
mkdirSync(dir,{recursive:true});
const originalBytes=readFileSync(`${oldDir}/provider-request.exact.json`),old=JSON.parse(originalBytes.toString());
const source=await zodSchema(canonicalProposalSchema).jsonSchema;
assert.deepEqual(source,old.text.format.schema);
const format=await Output.object({schema:await strictSceneResponseSchema(canonicalProposalSchema)}).responseFormat;
if(format?.type!=='json'||!format.schema)throw Error('Expected JSON schema');
const schema=format.schema!;
assert.deepEqual(strictSchemaIssues(schema as SchemaNode),[]);
const corrected=structuredClone(old);corrected.text.format.schema=schema;
const withoutSchema=(v:typeof old)=>{const r=structuredClone(v);delete r.text.format.schema;return r;};
assert.deepEqual(withoutSchema(old),withoutSchema(corrected));
const changes:{path:string;before?:unknown;after?:unknown}[]=[];
function diff(a:unknown,b:unknown,path:string){
 if(JSON.stringify(a)===JSON.stringify(b))return;
 if(Array.isArray(a)&&Array.isArray(b)&&a.length===b.length){a.forEach((v,i)=>diff(v,b[i],`${path}/${i}`));return;}
 if(a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)&&!Array.isArray(b)){
  for(const k of new Set([...Object.keys(a),...Object.keys(b)]))diff((a as Record<string,unknown>)[k],(b as Record<string,unknown>)[k],`${path}/${k}`);
 }else changes.push({path,before:a,after:b});
}
// Compare the moved union in place so every internal conversion is enumerated.
const relocated=structuredClone(old.text.format.schema);delete relocated.$schema;relocated.anyOf=relocated.oneOf;delete relocated.oneOf;
diff(relocated,(schema.properties as Record<string,unknown>).result,'text/format/schema/properties/result');
const bytes=Buffer.from(JSON.stringify(corrected));
writeFileSync(`${dir}/provider-request.prepared.NOT-SUBMITTED.json`,bytes);
const hash=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
writeFileSync(`${dir}/verification.json`,JSON.stringify({offline:true,providerCalls:0,originalSha256:hash(originalBytes),preparedSha256:hash(bytes),preparedBytes:bytes.length,nonSchemaFieldsIdentical:true,sourceSchemaEqualsRejectedSchema:true,originalCompatibilityIssues:strictSchemaIssues(old.text.format.schema),correctedCompatibilityIssues:[],rootChange:'required result object envelope; original exclusive alternatives preserved beneath nested anyOf',changes},null,2));
console.log(JSON.stringify({preparedBytes:bytes.length,sha256:hash(bytes),originalIssues:strictSchemaIssues(old.text.format.schema),changes:changes.map(c=>c.path)},null,2));
