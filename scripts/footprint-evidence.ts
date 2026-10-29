/** Offline retained-generation audit and reproducible geometry evidence. No provider imports/calls. */
import { readFileSync,mkdirSync,writeFileSync } from 'node:fs';
import { footprintExamples } from '../src/lib/villa/footprint-examples';
import { validateFootprint,footprintPlate,footprintBounds } from '../src/lib/villa/footprint';
import { resolveVillaResult } from '../src/lib/villa/terra';
import { compositionFindings } from '../src/lib/villa/composition';
const dir='docs/villa-playground/flexible-footprints';mkdirSync(dir,{recursive:true});
const retained=['src/lib/villa/__tests__/fixtures/garden-boundary.response.json','src/lib/villa/__tests__/fixtures/long-summary.response.json','docs/villa-playground/expanded-limits/original.response.json'].map(file=>{
 const raw=JSON.parse(readFileSync(file,'utf8'));let result;
 try{const r=resolveVillaResult({mode:'generate',prompt:'Offline retained generation audit'},raw);result={accepted:true,garden:'garden' in r.config?r.config.garden:undefined};}catch(e){result={accepted:false,findings:compositionFindings(e)};}
 return {file,name:raw.changes.name,character:raw.changes.character,summary:raw.summary,unsupported:raw.unsupported,wingCount:raw.changes.wings.length,builders:raw.changes.components?.map((p:{builder:string})=>p.builder)??[],...result};
});
const examples=footprintExamples();
const geometry=examples.map(c=>{const f=c.forms![0],v=validateFootprint(f),g=footprintPlate(v,.3),position=g.attributes.position;const edges=new Map<string,number>();
 const key=(i:number)=>[position.getX(i),position.getY(i),position.getZ(i)].map(n=>n.toFixed(4)).join(',');
 for(let i=0;i<position.count;i+=3)for(const [a,b] of [[i,i+1],[i+1,i+2],[i+2,i]]){const k=[key(a),key(b)].sort().join('|');edges.set(k,(edges.get(k)??0)+1);}
 const closed=[...edges.values()].every(n=>n===2);if(!closed)throw Error('Nonmanifold plate: '+c.id);
 const entry={id:c.id,controls:f.points.length,facadeBays:v.length,bounds:footprintBounds(f),plateTriangles:position.count/3,closedPlateEveryEdgeTwice:closed,finite:[...position.array].every(Number.isFinite)};g.dispose();return entry;
});
writeFileSync(`${dir}/examples.json`,JSON.stringify(examples,null,2));writeFileSync(`${dir}/geometry-checks.json`,JSON.stringify({providerCalls:0,retained,geometry},null,2));console.log(JSON.stringify({geometry,retained:retained.map(r=>({file:r.file,accepted:r.accepted,findings:'findings' in r?r.findings:undefined}))},null,2));
