import {readFileSync} from 'node:fs';
import type {ArchitecturalPlan} from './plan';
import {compositionFixture} from './compositions.fixture';
/** DEVELOPER-AUTHORED FIXTURES AND MOCKS ONLY. None is Terra output or evidence that a model can coordinate its own
 * revisions. The retained Terra files are read, never written. */
export const REVISION_RECORD='docs/architecture/canonical-plan-revision-2026-11-02/revision-record.json';
export const ORIGINAL_MANSION='docs/architecture/canonical-roof-retrieval-2026-11-02/proposal.normalized.json';
export const originalMansion=():ArchitecturalPlan=>JSON.parse(readFileSync(ORIGINAL_MANSION,'utf8')).plan;
/** Terra's latest rejected revision, exactly as retained (87 findings under the earlier diagnosis). */
export const rejectedRevision=():ArchitecturalPlan=>JSON.parse(readFileSync(REVISION_RECORD,'utf8')).revised.plan;
type Portal=ArchitecturalPlan['portals'][number];
/** Rewrites only HOW a declared connection is located: every door/passage between two rooms keeps its host, target, mode, width and
 * alignment, and its wall and offset are left to the software ("shared"). Windows are untouched. */
export function connectionsAsRelationships(plan:ArchitecturalPlan):ArchitecturalPlan{
 const p=structuredClone(plan);
 for(const x of p.portals)if(x.to!=='exterior'&&x.mode!=='window')x.host.side='shared';
 return p;
}
/** Adds ONLY connections the plan's own rooms imply but never declared: each unreachable upper room to the landing that shares its wall.
 * Developer-declared for the test; a model would have to declare them (the software never does). */
export function declareLandingConnections(plan:ArchitecturalPlan,landing:string,rooms:string[]):ArchitecturalPlan{
 const p=structuredClone(plan);
 for(const r of rooms)p.portals.push({id:`${landing}-to-${r}`,host:{space:landing,side:'shared'},to:r,alignment:'centre',width:1.1,height:2.4,mode:'door'} as Portal);
 return p;
}
/** Two rooms and an arrival yard: `b` sits on the given side of `a` with the given alignment, connected by one `shared` door. */
export function miniPair(side:'north'|'east'|'south'|'west',alignment:'start'|'centre'|'end',doorAlignment:'start'|'centre'|'end'='centre',explicit?:'south'|'east'|'north'|'west'):ArchitecturalPlan{
 const opposite={north:'south',south:'north',east:'west',west:'east'} as const;
 const room=(id:string,w:number,d:number,rel:string|null,sd:'origin'|'north'|'east'|'south'|'west',al:'start'|'centre'|'end',outdoor=false)=>({id,mass:'main',level:'ground',use:id,width:w,depth:d,height:3.2,outdoor,placement:{relativeTo:rel,side:sd,alignment:al,gap:0}});
 return {version:'architectural-plan-1',id:`mini-${side}-${alignment}`,thesis:'Developer fixture: two rooms joined by a derived opening.',orientation:0,site:{width:60,depth:60,elevation:0,grade:0,fall:'z'},
  levels:[{id:'ground',above:null,rise:.2}],masses:[{id:'main',role:'all'}],
  spaces:[room('a',8,8,null,'origin','centre'),room('b',4,6,'a',side,alignment),room('yard',3,2,'a',opposite[side],'centre',true)],
  portals:[{id:'front',host:{space:'a',side:'shared'},to:'yard',alignment:'centre',width:1.1,height:2.3,mode:'door'},{id:'link',host:{space:'a',side:explicit??'shared'},to:'b',alignment:doorAlignment,width:1,height:2.2,mode:'door'}],
  stairs:[],arrival:'yard',roofs:[{space:'a',form:'flat'},{space:'b',form:'flat'}],terraces:[],pools:[],landscape:[],materials:{floor:'limestone',wall:'ivory',roof:'timber'},cameraViews:['Aerial','Arrival','Garden','Poolside']};
}
/** A compact two-level house (developer composition fixture): a tall stair hall with upper gallery and a suite over a guest wing. */
export const waterfrontBase=():ArchitecturalPlan=>compositionFixture('waterfront');
const door=(id:string,host:string,to:string,width:number,alignment:'start'|'centre'|'end'='centre'):Portal=>({id,host:{space:host,side:'shared'},to,alignment,width,height:2.2,mode:'door'} as Portal);
/** Mock revision of the compact house. New requirements: an ensuite bathroom and a study upstairs. The change touches the guest wing below
 * (deeper, to carry the bath), the suite (re-aligned), and every opening on the walls those rooms now share.
 * Written ONLY as relationships: connections "shared", the suite's view window named on its one remaining exterior wall. */
export function waterfrontRevisionMock():ArchitecturalPlan{
 const p=structuredClone(waterfrontBase());
 p.id='waterfront-ensuite-study-mock';
 p.spaces.find(s=>s.id==='guest-wing')!.depth=11;
 p.spaces.find(s=>s.id==='master-suite')!.placement.alignment='end';
 p.spaces.push({id:'master-bath',mass:'upper-mass',level:'upper',use:'master bathroom',width:7,depth:4,height:3.2,outdoor:false,placement:{relativeTo:'master-suite',side:'south',alignment:'start',gap:0}});
 p.spaces.push({id:'upper-study',mass:'upper-mass',level:'upper',use:'study',width:6,depth:6,height:3.2,outdoor:false,placement:{relativeTo:'upper-gallery',side:'east',alignment:'start',gap:0}});
 p.portals.find(q=>q.id==='suite-passage')!.host.side='shared';
 p.portals.find(q=>q.id==='suite-view')!.host.side='west';
 p.portals.push(door('master-bath-door','master-suite','master-bath',.9),door('study-door','upper-gallery','upper-study',1),
  {id:'bath-window',host:{space:'master-bath',side:'west'},to:'exterior',alignment:'centre',width:1.2,height:1.2,mode:'window',sill:1},
  {id:'study-window',host:{space:'upper-study',side:'east'},to:'exterior',alignment:'centre',width:2,height:1.6,mode:'window',sill:.8});
 p.roofs.push({space:'master-bath',form:'flat',rise:.25},{space:'upper-study',form:'flat',rise:.25});
 return p;
}
/** The same intent with every opening located by a guessed edge and alignment, as the earlier contract required: the suite door at the middle of the
 * gallery wall, the bath door on the side the author supposed the bath lay, the suite window on the wall that was exterior before the bath existed. */
export function waterfrontNaiveExplicitMock():ArchitecturalPlan{
 const p=waterfrontRevisionMock();
 Object.assign(p.portals.find(q=>q.id==='suite-passage')!,{alignment:'centre'});p.portals.find(q=>q.id==='suite-passage')!.host.side='west';
 p.portals.find(q=>q.id==='master-bath-door')!.host.side='north';
 return p;
}
