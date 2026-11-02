/** Offline diagnostics only. Hypothetical variants are NOT recovered designs. */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {constructSemantic,semanticProposalSchema} from '../src/lib/villa/experimental/semantic-building/generation';
import {normalizeSemanticIdentifiers} from '../src/lib/villa/experimental/semantic-building/identifiers';
import {compileBuilding} from '../src/lib/villa/experimental/semantic-building/compiler';
const source='docs/architecture/semantic-generation/live-fresh-2026-10-31',dir=`${source}/recovery`;
mkdirSync(dir,{recursive:true});globalThis.fetch=async()=>{throw Error('Offline recovery');};
const save=(name:string,data:unknown)=>writeFileSync(`${dir}/${name}.json`,JSON.stringify(data,null,2)+'\n');
const original=JSON.parse(readFileSync(`${source}/proposal.exact.txt`,'utf8')).proposal;
const extracted=JSON.parse(readFileSync(`${source}/semantic-proposal.json`,'utf8'));
if(JSON.stringify(original)!==JSON.stringify(extracted))throw Error('Saved proposal mismatch');
const initial=semanticProposalSchema.safeParse(original);
save('original-validation',initial.success?[]:initial.error.issues);
save('outcome',constructSemantic('Retained original brief',original));
const p=structuredClone(original);p.intent.levels.forEach((l:{id:string})=>l.id=l.id.toLowerCase());p.intent.spaces.forEach((s:{level:string})=>s.level=s.level.toLowerCase());
save('identifier-only-proposal',p);
const stages:unknown[]=[];
const probe=(label:string)=>{try{const c=compileBuilding(p.intent);stages.push({label,status:'compiled-diagnostic-only',elements:c.scene.elements.length});}catch(e){stages.push({label,error:(e as Error).message});}};
probe('Identifier-only; raw compiler');
// Remove a narrative relation ONLY to expose subsequent independent failures.
// Never send these counterfactual variants to constructSemantic or a renderer.
delete p.intent.masses[1].relatesTo;
const isolated=structuredClone(original);delete isolated.intent.masses[1].relatesTo;
save('diagnostic-identifier-mappings',normalizeSemanticIdentifiers(isolated).mappings);
probe('Diagnostic only: remove undeclared mass relation');
p.intent.spaces.find((s:{id:string})=>s.id==='guest-suite-3').roof=false;probe('Diagnostic only: omit conflicting lower guest roof');
// Partial boundary mismatch and stair constraints can be checked independently without changing polygons.
const independent={
 outdoorHeights:original.intent.spaces.filter((s:{outdoor:boolean})=>s.outdoor).map((s:{id:string;height:number})=>({id:s.id,height:s.height})),
 portals:original.intent.portals.map((p:{id:string;offset:number;width:number})=>({id:p.id,startMargin:p.offset-p.width/2,requiredMargin:.18,fitsStart:p.offset-p.width/2>=.18})),
 stair:{rise:4.2,risers:24,riser:4.2/24,run:3.6,going:3.6/24,minimumGoing:.25,lowerLandingMinZ:9-1.5,spaceMinZ:8,wallInset:.09},
 partialUpperEdges:{galleryEast:[[12,8],[12,16]],primaryWest:[[12,16],[12,8]],primarySouth:[[12,8],[24,8]],lowerGuestRoofTop:4.18,upperFloorTop:4.2},
};
save('diagnostic-stages',stages);save('independent-checks',independent);
const manifest=JSON.parse(readFileSync(`${source}/evidence-sha256.json`,'utf8'));
for(const [file,hash] of Object.entries(manifest)){if(createHash('sha256').update(readFileSync(`${source}/${file}`)).digest('hex')!==hash)throw Error(`Original evidence changed: ${file}`);}
save('preservation',{allOriginalManifestHashesMatch:true,files:Object.keys(manifest).length,networkRequests:0,architectureRepairs:0,rendered:false});
save('source-hashes',Object.fromEntries(['request.exact.json','response.exact.json','proposal.exact.txt','semantic-proposal.json','validation.json'].map(f=>[f,createHash('sha256').update(readFileSync(`${source}/${f}`)).digest('hex')])));
console.log(JSON.stringify({stages,status:constructSemantic('Retained original brief',original).status},null,2));
