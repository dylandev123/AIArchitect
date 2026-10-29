/** One explicitly authorized paid call through the unchanged homepage scene route. */
import {readFileSync,writeFileSync,mkdirSync,readdirSync,statSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const dir='docs/architecture/coordinated-assembly-live';
if(existsSync(`${dir}/call-started.json`))throw Error('One-call guard: this test has already started.');
mkdirSync(dir,{recursive:true});
const save=(name:string,data:unknown)=>writeFileSync(`${dir}/${name}`,typeof data==='string'?data:JSON.stringify(data,null,2));
for(const line of readFileSync('.env.local','utf8').split('\n')){const m=line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,'');}
if(!process.env.OPENAI_API_KEY?.trim())throw Error('Missing authorized key');
const walk=(p:string):string[]=>readdirSync(p).flatMap(n=>{const f=`${p}/${n}`;return statSync(f).isDirectory()?walk(f):[f];});
const retained=[...walk('docs'),...walk('.data')].filter(p=>!p.startsWith(dir+'/')&&!p.includes('ai-usage')&&!p.includes('/scene-responses/'));
const hash=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
const original=retained.map(path=>({path,sha256:hash(path)}));save('preservation-before.json',original);
const input={mode:'generate',prompt:'Design an original contemporary tropical luxury villa in Saint Lucia on a flat property overlooking the sea. Create a sophisticated main residence with a strong architectural identity, thoughtfully arranged residential wings, distinctive roof composition, generous glazing, an elegant entrance and integrated outdoor living. Include a swimming pool with a well-coordinated deck and shaded entertainment area. Use the available coordinated architectural assemblies wherever they improve construction quality. Avoid basic rectangular bungalow compositions, oversized repetitive roofs and disconnected outdoor structures. The result must be a fully editable 3D residence, with individual components accessible for later modification.'};
save('request.json',input);
const realFetch=globalThis.fetch;let calls=0;
globalThis.fetch=async(url,init)=>{
 const address=String(url);
 if(!address.startsWith('https://api.openai.com/'))throw Error('Unexpected outbound request blocked');
 if(++calls!==1)throw Error('Additional paid call blocked');
 const body=JSON.parse(String(init?.body));save('provider-request.json',body);save('call-started.json',{at:new Date().toISOString(),model:body.model,allowedCalls:1,maxRetries:0});
 const response=await realFetch(url,init);save('provider-response.raw.json',await response.clone().text());save('provider-http.json',{status:response.status});return response;
};
const {POST}=await import('../src/app/api/ai/scene/route');
const response=await POST(new Request('http://localhost/api/ai/scene',{method:'POST',body:JSON.stringify(input)}));
const body=await response.json();save('route-response.json',body);
if(body.responseId){const artifact=JSON.parse(readFileSync(`.data/scene-responses/${body.responseId}.json`,'utf8'));save('retained-response.json',artifact);save('instructions.txt',artifact.requestSystem??'');save('knowledge.json',artifact.knowledge??{});}
if(body.scene)save('scene.UNAPPROVED.json',body.scene);
const preservation=original.map(p=>({...p,unchanged:hash(p.path)===p.sha256}));save('preservation-after.json',preservation);
save('call-result.json',{status:response.status,providerCalls:calls,approved:false,originalFilesUnchanged:preservation.every(p=>p.unchanged),error:body.error});
console.log(JSON.stringify({status:response.status,providerCalls:calls,responseId:body.responseId,elements:body.scene?.elements.length,error:body.error}));
