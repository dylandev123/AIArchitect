/** Mock architectural decisions only. Never overwrite or attribute these choices to Terra. */
import {readFileSync} from 'node:fs';
import type {BuildingIntent} from '../src/lib/villa/experimental/semantic-building/compiler';
export const retainedProposal=()=>JSON.parse(readFileSync('docs/architecture/semantic-generation/live-fresh-2026-10-31/semantic-proposal.json','utf8'));
export function mockedRetainedRevision(){
 const response=retainedProposal();
 // Explicit mock choice: keep masses/uses/levels; extend the rear band for a straight stair.
 const p=response.intent as BuildingIntent;
 p.levels.forEach(l=>l.id=l.id.toLowerCase());p.spaces.forEach(s=>s.level=s.level.toLowerCase());
 p.masses.find(m=>m.id==='social-belvedere')!.relatesTo='arrival-plinth';
 p.spaces.find(s=>s.id==='guest-suite-3')!.roof=false;
 for(const s of p.spaces)for(const q of s.polygon){if(q[1]>=16)q[1]+=2;else if(s.id==='ocean-terrace'&&q[1]===14)q[1]=18;}
 p.stairs[0].run=6;p.stairs[0].start=[-4,9.6];
 // Explicit mock offsets in metres: architectural placement, not normalized-offset recovery.
 for(const portal of p.portals){const s=p.spaces.find(s=>s.id===portal.host.space)!,a=s.polygon[portal.host.edge],b=s.polygon[(portal.host.edge+1)%s.polygon.length];portal.offset=Math.hypot(b[0]-a[0],b[1]-a[1])/2;}
 return response;
}
