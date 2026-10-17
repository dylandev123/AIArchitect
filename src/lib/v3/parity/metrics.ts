import type { HouseModel } from '@/lib/house/types';
import type { V3Scene } from '../scene';
import { primitivesBounds } from '../presentation';
import { resolveV3Renderable } from '../renderability';
/** DEV diagnostics only: counts describe geometry, never authorize rendering. */
export function parityMetrics(scene: V3Scene, model: HouseModel) {
  const p=model.primitives, count=(r:RegExp)=>p.filter(p=>r.test(`${p.componentRole??''} ${p.label}`)).length;
  const roofOverhangEnvelopeArea=scene.objects.filter(o=>o.type==='building-mass').reduce((sum,o)=>{
    const owner=scene.objects.find(r=>r.type==='roof-form'&&r.hostId===o.id)??o;
    const roof=p.filter(p=>p.category==='roof'&&(p.sourceObjectId===owner.id||p.id.startsWith(`architecture-${o.id}-roof`)));
    const bounds=primitivesBounds(roof),a=o.architecture!;
    return sum+(bounds?Math.max(0,(bounds.max[0]-bounds.min[0])*(bounds.max[2]-bounds.min[2])-a.width*a.depth):0);
  },0);
  return {roofOverhangEnvelopeArea,authoredSemanticObjects:scene.objects.length,compiledPrimitives:p.length,
    wallSegments:p.filter(p=>p.componentRole==='facade wall'|| /: Wall/.test(p.label)).length,
    facadeOpenings:p.filter(p=>p.category==='window'&&p.transparent).length,
    glazingPrimitives:p.filter(p=>p.category==='window'&&p.transparent).length,
    roofComponents:p.filter(p=>p.category==='roof').length,
    // Authored rectangular plan-area diagnostic (not union coverage or a geometry quality score).
    roofOverhangArea:scene.objects.filter(o=>o.type==='roof-form'||o.type==='building-mass'&&!scene.objects.some(r=>r.hostId===o.id&&r.type==='roof-form')).reduce((sum,o)=>{const a=o.architecture!,e=o.overhang??.75;return sum+(a.width+2*e)*(a.depth+2*e)-a.width*a.depth;},0),
    materialZones:new Set(p.map(p=>`${p.color}/${p.surface??''}`)).size,
    verandaComponents:p.filter(p=>p.sourceObjectId==='veranda'||/Assembly/.test(p.label)).length,railingEdgeComponents:count(/railing|fascia|parapet|roof cap|Fascia|Trim/),poolComponents:p.filter(p=>p.category==='pool').length,
    fallbackRenderCount:scene.objects.filter(o=>{const r=resolveV3Renderable(o);return !!r.warning || r.strategy==='specialized'&&p.some(p=>p.sourceObjectId===o.id&&p.componentRole?.startsWith('generic'));}).length,
    proxyCount:p.filter(p=>p.componentRole==='render proxy').length};
}
