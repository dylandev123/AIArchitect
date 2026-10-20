import { getObjectTopY } from './elevation';
import type { V3Scene, V3SceneObject } from './scene';
import { auditV3Completeness } from './completeness';
import { authoredOverlap, authoredPlan, planArea } from './authoredPlan';
import { estateRouteSupported, estateEndpoint, estateRouteAccess, endpointFits, siteAccessFits } from './routeGeometry';

const DRY = new Set(['terrace','deck','courtyard','veranda','pool-deck','path','driveway']);
export interface EstateAccessEvidence { reached: Set<string>; connected: (a:string,b:string)=>boolean; }
/** Required estate access is distinct from optional alignment/view intent. Only physical graph edges count.
 * Completeness proves junction passages against constructed walls; its generic exterior node is never used
 * to claim that two independent buildings share an architectural passage. Endpoint-validated route edges
 * remain subject to the mandatory corridor-collision gate; this graph alone never approves a route. */
export function estateAccessEvidence(scene: V3Scene, options:{constructionEvidence?:boolean}={}): EstateAccessEvidence {
  const graph=new Map<string,Set<string>>(), seeds=new Set<string>();
  const link=(a:string,b:string)=>{graph.set(a,new Set([...(graph.get(a)??[]),b]));graph.set(b,new Set([...(graph.get(b)??[]),a]));};
  const flood=(starts:Iterable<string>)=>{const reached=new Set(starts),queue=[...reached];for(let i=0;i<queue.length;i++)for(const n of graph.get(queue[i])??[])if(!reached.has(n)){reached.add(n);queue.push(n);}return reached;};
  if (scene.estatePlan?.circulation.some(r=>r.spatial)) {
    // An independent design may be checked before detailed elaboration. At that
    // boundary only authored spatial routes prove access; compiled passages are
    // deferred to the normal construction gate, whose default remains unchanged.
    const audit=options.constructionEvidence===false?undefined:auditV3Completeness(scene);
    const objectNode=(id:string)=>scene.objects.find(o=>o.id===id)?.type==='building-mass'?`${id}#0`:id;
    for(const e of audit?.edges??[])if(e.from!=='exterior' && e.to!=='exterior')link(e.from,e.to);
    for(const route of scene.estatePlan.circulation)if(estateRouteSupported(scene,route)){
      if (!(['from','to'] as const).every(side=>{
        const p=estateEndpoint(scene,route,side),o=scene.objects.find(o=>o.id===route[side]);
        return p && (o?endpointFits(o,{...estateRouteAccess(scene,route,side),point:p},route.spatial!.width,route.spatial!.use,scene):siteAccessFits(scene,route[side],p));
      })) continue;
      const a=objectNode(route.from),b=objectNode(route.to);
      seeds.add(a);seeds.add(b);
      let previous=a;
      for(const id of route.via){link(previous,id);previous=id;}
      link(previous,b);
    }
    for(const o of scene.objects.filter(o=>o.type==='building-mass'))link(o.id,`${o.id}#0`);
  }
  const reached=flood(seeds);
  // Water is a destination served by a dry perimeter, never a transit link between disconnected decks.
  for(const pool of scene.objects.filter(o=>o.type==='pool'))for(const deck of scene.objects.filter(o=>DRY.has(o.type)&&!['path','driveway'].includes(o.type)&&(!o.collision||['walkable','passable'].includes(o.collision))))
    if(reached.has(deck.id) && Math.abs(getObjectTopY(deck)-getObjectTopY(pool))<=.35 && planArea(authoredPlan(pool))>0 && planArea(authoredPlan(pool))-authoredOverlap(deck,pool)<.02 && planArea(authoredPlan(deck))>planArea(authoredPlan(pool))+.8)reached.add(pool.id);
  return {reached,connected:(a,b)=>flood([a]).has(b)};
}
export const isEstateDestination = (o:V3SceneObject) => o.type==='building-mass' || o.type==='pool' || (DRY.has(o.type) && !['path','driveway'].includes(o.type) && (!o.collision || ['walkable','passable'].includes(o.collision)));
