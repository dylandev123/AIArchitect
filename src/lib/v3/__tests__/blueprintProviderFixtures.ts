/** Synthetic provider responses only; these never enter production prompts. */
import type { V3Scene } from '../scene';
import { diverseBlueprintFixtures, mansionBlueprintFixture } from './blueprintFixtures';

export function blueprintProviderOutput(scene: V3Scene): Record<string, unknown> {
  const { metadata, interior, objects, site, ...root } = structuredClone(scene);
  void metadata;
  // The recovered investigation used camelCase object ids. This explicitly authored
  // test variant uses the generation contract's kebab ids, updating every exact ref.
  const ids = new Map(objects.map(o=>[o.id,o.id.replace(/[A-Z]/g,c=>`-${c.toLowerCase()}`)]));
  const rename = (value: unknown): unknown => typeof value === 'string' ? ids.get(value) ?? value
    : Array.isArray(value) ? value.map(rename)
    : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k,v])=>[k,rename(v)])) : value;
  return rename({
    ...root,
    site:{width:site.width,depth:site.depth,baseElevation:site.baseElevation??0,...(site.groundMaterial ? {groundColor:site.groundMaterial.color} : {})},
    objects: objects.map(o=>{
      const { transform, dimensions, support, metadata: objectMetadata, ...intent } = o;
      void objectMetadata;
      return { ...intent, ...(!o.architecture ? { transform, dimensions } : {}),
        ...(support ? {support:{kind:support.kind,levelId:support.levelId??'',hostId:support.hostId??support.objectId??'',relationship:support.relationship??'none',grounding:support.grounding??'grounded'}} : {}) };
    }),
    ...(interior?.circulation?.length ? { circulation: interior.circulation.map(c=>{
      const host=objects.find(o=>o.id===c.hostMassId)!, yaw=host.transform.rotation[1], p=c.footprint;
      return {id:c.id,type:c.type,hostId:c.hostMassId,fromLevel:c.fromLevel,toLevel:c.toLevel,
        x:host.transform.position[0]+p.x*Math.cos(yaw)+p.z*Math.sin(yaw),
        z:host.transform.position[2]-p.x*Math.sin(yaw)+p.z*Math.cos(yaw),width:p.width,depth:p.depth,
        ...(c.stairType ? {stairType:c.stairType} : {}), ...(c.direction ? {direction:c.direction} : {}), ...(c.turn ? {turn:c.turn} : {})};
    }) } : {}),
  }) as Record<string, unknown>;
}

export function blueprintProviderFixtures() {
  const [sculpture, mediterranean, circle, conventional] = diverseBlueprintFixtures();
  return [
    {name:'sculptural contemporary mansion',scene:sculpture.scene},
    {name:'Mediterranean luxury estate',scene:mediterranean.scene},
    {name:'circular residence',scene:circle.scene},
    {name:'multi-building compound',scene:mansionBlueprintFixture()},
    {name:'conventional residence',scene:conventional.scene},
  ].map(f=>({name:f.name,output:blueprintProviderOutput(f.scene)}));
}
