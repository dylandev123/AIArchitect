/** Offline, read-only diagnosis of the exact saved Terra proposal. No network, credentials, database or provider.
 * Writes a findings inventory and a clearly labelled DIAGNOSTIC drawing of the AUTHORED arrangement.
 * The drawing is not constructed geometry and not an accepted model result. Exclusive writes. */
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {diagnosePlan} from '../src/lib/villa/canonical/diagnose';
import type {ArchitecturalPlan} from '../src/lib/villa/canonical/plan';
const src='docs/architecture/canonical-roof-retrieval-2026-11-02',dir='docs/architecture/canonical-diagnosis-2026-11-02';
if(existsSync(dir))throw Error(`${dir} exists; refusing to overwrite`);
const bytes=readFileSync(`${src}/proposal.normalized.json`);
const plan:ArchitecturalPlan=JSON.parse(bytes.toString()).plan;
const d=diagnosePlan(plan);
const errors=d.findings.filter(f=>f.severity==='error');
const bad=new Set(errors.filter(f=>f.stage!=='roofs').flatMap(f=>f.id.split('/')));
const badPortals=new Set(errors.filter(f=>f.stage==='openings').map(f=>f.id));
const S=8,pad=30,all=[...Object.values(d.rects),...Object.values(d.siteRects)];
const rr=Object.values(d.rects),bx=(Math.min(...rr.map(r=>r.x))+Math.max(...rr.map(r=>r.x+r.width)))/2,bz=(Math.min(...rr.map(r=>r.z))+Math.max(...rr.map(r=>r.z+r.depth)))/2;
const x0=Math.min(bx-plan.site.width/2,...all.map(r=>r.x))-2,x1=Math.max(bx+plan.site.width/2,...all.map(r=>r.x+r.width))+2,z0=Math.min(bz-plan.site.depth/2,...all.map(r=>r.z))-2,z1=Math.max(bz+plan.site.depth/2,...all.map(r=>r.z+r.depth))+2;
const X=(x:number)=>pad+(x-x0)*S,Y=(z:number)=>pad+(z1-z)*S,W=(x1-x0)*S+2*pad,H=(z1-z0)*S+2*pad+40;
const colour:Record<string,string>={'arrival-mass':'#e8dcc0','social-mass':'#dfe9d8','east-suite-wing':'#d6dfee','west-suite-wing':'#d6dfee','service-mass':'#eed9d9','waterfront-outdoor-mass':'#e5f0f0'};
const mass=new Map(plan.spaces.map(s=>[s.id,s.mass]));
let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Helvetica,Arial,sans-serif"><rect width="100%" height="100%" fill="#fff"/>`;
// Site boundary (centred on room cells, as the compiler does).
svg+=`<rect x="${X(bx-plan.site.width/2)}" y="${Y(bz+plan.site.depth/2)}" width="${plan.site.width*S}" height="${plan.site.depth*S}" fill="none" stroke="#888" stroke-dasharray="8 5"/><text x="${X(bx-plan.site.width/2)+4}" y="${Y(bz+plan.site.depth/2)+14}" font-size="11" fill="#888">authored site ${plan.site.width}×${plan.site.depth} m (centred on room cells)</text>`;
for(const [id,r] of Object.entries(d.siteRects)){const pool=plan.pools.some(p=>p.id===id);svg+=`<rect x="${X(r.x)}" y="${Y(r.z+r.depth)}" width="${r.width*S}" height="${r.depth*S}" fill="${pool?'#bfe0ee':'#e3efd6'}" stroke="${bad.has(id)?'#c00':'#789'}" stroke-width="${bad.has(id)?2.5:1}" ${bad.has(id)?'stroke-dasharray="6 3"':''}/><text x="${X(r.x)+4}" y="${Y(r.z+r.depth)+14}" font-size="10">${id}</text>`;}
for(const [id,r] of Object.entries(d.rects))svg+=`<rect x="${X(r.x)}" y="${Y(r.z+r.depth)}" width="${r.width*S}" height="${r.depth*S}" fill="${colour[mass.get(id)!]??'#eee'}" fill-opacity=".85" stroke="${bad.has(id)?'#c00':'#444'}" stroke-width="${bad.has(id)?2.5:1}"/>`;
for(const f of errors.filter(f=>f.stage==='volumes')){const [a,b]=f.id.split('/').map(i=>d.rects[i]),x=Math.max(a.x,b.x),z=Math.max(a.z,b.z),w=Math.min(a.x+a.width,b.x+b.width)-x,h=Math.min(a.z+a.depth,b.z+b.depth)-z;svg+=`<rect x="${X(x)}" y="${Y(z+h)}" width="${w*S}" height="${h*S}" fill="#e00" fill-opacity=".55"/>`;}
for(const [id,r] of Object.entries(d.rects))svg+=`<text x="${X(r.x)+3}" y="${Y(r.z+r.depth)+11}" font-size="9" fill="#222">${id}</text>`;
// Openings at the position the compiler would use (directed edge: south→+x, east→+z, north→−x, west→−z).
for(const p of plan.portals){const r=d.rects[p.host.space];if(!r)continue;const len=p.host.side==='south'||p.host.side==='north'?r.width:r.depth,c=p.alignment==='centre'?len/2:p.alignment==='start'?p.width/2+.25:len-p.width/2-.25;
 const pt=p.host.side==='south'?[r.x+c,r.z]:p.host.side==='north'?[r.x+r.width-c,r.z+r.depth]:p.host.side==='east'?[r.x+r.width,r.z+c]:[r.x,r.z+r.depth-c];
 const col=badPortals.has(p.id)?'#e00':p.mode==='window'?'#27c':p.mode==='door'?'#852':'#2a5';
 svg+=`<circle cx="${X(pt[0])}" cy="${Y(pt[1])}" r="${badPortals.has(p.id)?5:3}" fill="${col}"/>`;}
svg+=`<rect x="0" y="${H-42}" width="${W}" height="42" fill="#fff3cd"/><text x="10" y="${H-24}" font-size="12" font-weight="bold" fill="#7a5a00">DIAGNOSTIC DRAWING of the AUTHORED arrangement — NOT constructed geometry, NOT an accepted model result.</text><text x="10" y="${H-8}" font-size="11" fill="#7a5a00">Red = conflict (overlaps filled; roof-eave conflicts are in findings.json, not drawn). Dots: red misfit opening, blue window, brown door, green passage. N = up.</text></svg>`;
mkdirSync(dir,{recursive:true});
const w=(n:string,v:string|Buffer)=>writeFileSync(`${dir}/${n}`,v,{flag:'wx'});
w('authored-arrangement.DIAGNOSTIC.svg',svg);
w('authored-arrangement.DIAGNOSTIC.png',await sharp(Buffer.from(svg)).png().toBuffer());
w('findings.json',JSON.stringify({readOnly:true,providerCalls:0,sourceProposalSha256:createHash('sha256').update(bytes).digest('hex'),errorCount:errors.length,byStage:Object.fromEntries([...new Set(errors.map(e=>e.stage))].map(s=>[s,errors.filter(e=>e.stage===s).length])),metrics:d.metrics,findings:d.findings},null,2));
console.log(JSON.stringify({errors:errors.length,byStage:Object.fromEntries([...new Set(errors.map(e=>e.stage))].map(s=>[s,errors.filter(e=>e.stage===s).length]))}));
