import { buildMassOpenings, openingBands, type Band } from '@/lib/architecture/geometry/openings';
import { facadePointAt, type WallEdge } from '@/lib/architecture/geometry/footprint';

type Opening = Parameters<typeof buildMassOpenings>[3][number];
type Facade = Opening['facade'];
export interface ResolvedFacadeBand extends Band { ownerId: string; operation: Opening; unresolved: boolean }
const EPS = 1e-8;
export const LOCAL_FACADE_CODES = new Set(['ARCHITECTURAL_OPENING_SPAN', 'ARCHITECTURAL_OPENING_TARGET', 'ARCHITECTURAL_OPENING_CLIPPED', 'ARCHITECTURAL_OPENING_OVERLAP']);

/** Pure plan shared by preflight and construction. Never move, resize or merge intent. */
export function resolveFacadeOpeningBands(openings: readonly Opening[], facade: Facade, width: number, depth: number, level: number, height: number) {
  const bands: ResolvedFacadeBand[] = [], invalidIds = new Set<string>();
  for (const op of openings) {
    if (op.facade !== facade || op.floors === 'ground' && level !== 0 || op.floors === 'upper' && level === 0) continue;
    const length = facade === 'north' || facade === 'south' ? width : depth;
    const requested = openingBands(facade, width, depth, [op], level, height);
    const invalid = 'start' in op && op.end <= op.start
      || op.type === 'opening-rhythm' && op.width * (op.count + (op.count - 1) * .4) > length * .9 + EPS
      || !requested.length || requested.some(b => {
        const wanted = op.type === 'glazing-zone' ? op.heightRatio * height : op.height;
        return wanted !== undefined && Math.abs((b.height ?? 0) - wanted) > EPS
          || (b.sill ?? 0) < 0 || (b.sill ?? 0) > height - .2 || (b.height ?? 0) < .3
          || (b.sill ?? 0) + (b.height ?? 0) > height + EPS;
      });
    if (invalid) invalidIds.add(op.id!);
    for (const band of requested) bands.push({...band, ownerId: op.id!, operation: op, unresolved: invalid});
  }
  const conflicts: [ResolvedFacadeBand, ResolvedFacadeBand][] = [];
  for (const [i, a] of bands.entries()) for (const b of bands.slice(i + 1)) {
    // A clerestory above a door is not an overlapping cut. Shared legacy
    // construction only sweeps horizontally; the V3 adapter tiles both axes.
    if (Math.min(a.end,b.end)-Math.max(a.start,b.start)>EPS
      && Math.min((a.sill??0)+(a.height??0),(b.sill??0)+(b.height??0))-Math.max(a.sill??0,b.sill??0)>EPS) {
      conflicts.push([a,b]); a.unresolved = true; b.unresolved = true;
    }
  }
  return {bands, invalidIds, conflicts};
}

/**
 * Blueprint-only adapter. Ordinary spans retain shared construction and ids.
 * Unresolved cuts are withheld symmetrically, never resolved by array order.
 * Retained wall cells carry an amber, labelled placeholder; supported openings
 * still use the real shared frame/leaf builder. No V2 construction is changed.
 */
export const buildArchitecturalFacadeOpenings: typeof buildMassOpenings = (edges,width,depth,openings,level,base,height,prefix,materials,ids) => {
  const primitives: ReturnType<typeof buildMassOpenings>['primitives'] = [];
  for (const edge of edges) {
    if (!edge.facade) continue;
    const facade = edge.facade, plan = resolveFacadeOpeningBands(openings,facade,width,depth,level,height);
    const projectedOverlap = plan.bands.some((a,i)=>plan.bands.slice(i+1).some(b=>Math.min(a.end,b.end)-Math.max(a.start,b.start)>EPS));
    if (!plan.invalidIds.size && !plan.conflicts.length && !projectedOverlap) {
      primitives.push(...buildMassOpenings([edge],width,depth,openings,level,base,height,prefix,materials,ids).primitives); continue;
    }
    const u = (p: readonly number[]) => facade==='north'||facade==='south'?(p[0]+width/2)/width:(p[1]+depth/2)/depth;
    const lo=Math.min(u(edge.a),u(edge.b)), hi=Math.max(u(edge.a),u(edge.b));
    const relevant=plan.bands.filter(b=>b.end>lo+EPS&&b.start<hi-EPS);
    const safe=relevant.filter(b=>!b.unresolved), unsafe=relevant.filter(b=>b.unresolved);
    const subedge=(start:number,end:number):WallEdge=>({...edge,a:facadePointAt(facade,start,width,depth),b:facadePointAt(facade,end,width,depth)});
    // Keep whole, semantically identified frames. Sill/head infill is instead
    // tiled below so vertically separated openings never cover one another.
    for (const band of safe) {
      const built=buildMassOpenings([subedge(Math.max(lo,band.start),Math.min(hi,band.end))],width,depth,[band.operation],level,base,height,prefix,materials,ids);
      primitives.push(...built.primitives.filter(p=>p.category==='window'||p.label==='Window Surround Post'));
    }
    const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
    const xs=[...new Set([lo,hi,...relevant.flatMap(b=>[clamp(b.start,lo,hi),clamp(b.end,lo,hi)])])].sort((a,b)=>a-b);
    const ys=[...new Set([0,height,...relevant.flatMap(b=>[clamp(b.sill??0,0,height),clamp((b.sill??0)+(b.height??0),0,height)])])].sort((a,b)=>a-b);
    for(let x=0;x<xs.length-1;x++)for(let y=0;y<ys.length-1;y++){
      const x0=xs[x],x1=xs[x+1],y0=ys[y],y1=ys[y+1],cx=(x0+x1)/2,cy=(y0+y1)/2;
      if(x1-x0<EPS||y1-y0<EPS||safe.some(b=>cx>b.start-EPS&&cx<b.end+EPS&&cy>(b.sill??0)-EPS&&cy<(b.sill??0)+(b.height??0)+EPS))continue;
      const unresolved=unsafe.filter(b=>cx>b.start-EPS&&cx<b.end+EPS&&cy>(b.sill??0)-EPS&&cy<(b.sill??0)+(b.height??0)+EPS);
      const owner=ids?.wall({idPrefix:prefix,bandIndex:0,bandCount:1})??prefix;
      const cellId=`${owner}:cell-${x0.toFixed(8)}-${y0.toFixed(8)}`;
      const cell=buildMassOpenings([subedge(x0,x1)],width,depth,[],level,base+y0,y1-y0,cellId,materials).primitives;
      primitives.push(...cell.map(p=>({...p,id:cellId,...(unresolved.length?{label:`Unresolved facade opening: ${[...new Set(unresolved.map(b=>b.ownerId))].join(', ')}`,color:'#e6a23c',roughness:.9,metalness:0}:{} )})));
    }
  }
  return {primitives,warnings:[]};
};
