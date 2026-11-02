import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {applySceneOperations,stageSceneOperations,validateScene,type SceneOperation} from './model';
import {sceneRelationshipIssues} from './relationships';
import {sceneSpatialGeometry,waterObstructions} from './spatial';
import {pitchedRoofParts,pitchedRoofPartsIntersect} from './roofIntersection';
import {focusedConstructionFindings} from './focusedConstruction';
const read=(name:string)=>JSON.parse(readFileSync(`docs/architecture/terra-controlled-estate-2026-10-29/${name}.json`,'utf8'));
const original=validateScene(read('draft.REJECTED')),ops=read('authored-operations') as SceneOperation[];
it('preserves all 128 retained elements, changes only newly expanded pool coping abutments and still rejects genuine construction defects atomically',()=>{
 const text=JSON.stringify(original),staged=stageSceneOperations({version:'architectural-scene-1',name:original.name,elements:[]},ops);
 const changed=['pool-coping-x-minus','pool-coping-x-plus'];
 expect(staged.elements.filter(e=>!changed.includes(e.id))).toEqual(original.elements.filter(e=>!changed.includes(e.id)));
 expect(staged.elements).toHaveLength(128);
 for(const id of changed){const old=original.elements.find(e=>e.id===id)!,next=staged.elements.find(e=>e.id===id)!;expect(next.size[0]).toBe(.6);expect(Math.abs(old.at[0])-Math.abs(next.at[0])).toBeCloseTo(.05);}
 // Saved scenes and exact model responses remain untouched; expansion is one-time.
 const issues=sceneRelationshipIssues(original),roofs=issues.filter(i=>i.rule==='assembly-roof-junction');
 expect(roofs).toHaveLength(8); // Four genuine pairs, both directional reports.
 expect(roofs.every(i=>i.id!=='main-salon-roof'&&!i.relatedIds?.includes('main-salon-roof'))).toBe(true);
 expect(issues.some(i=>i.rule==='water-obstruction'&&i.relatedIds?.includes('ocean-link'))).toBe(true);
 expect(issues.some(i=>i.rule==='railing-deck'&&i.id==='belvedere-rail-front')).toBe(true);
 expect(issues.filter(i=>i.rule==='support').map(i=>i.id)).toEqual(expect.arrayContaining(['stair-02','stair-03','stair-04','stair-05']));
 expect(()=>applySceneOperations({version:'architectural-scene-1',name:original.name,elements:[]},ops)).toThrow();
 expect(JSON.stringify(original)).toBe(text);
});
it('tests pitched surfaces/fascia in world frames, including duplicate, separated and nested rotated roofs',()=>{
 const g=sceneSpatialGeometry(original),a=g.map.get('main-salon-roof')!,b=g.map.get('suite-two-roof')!,c=g.map.get('suite-one-roof')!;
 const parts=(e:typeof a)=>pitchedRoofParts(e,g.world(e));
 expect(g.separation(a,b)).toBeLessThan(0);expect(pitchedRoofPartsIntersect(parts(a),parts(b))).toBe(false);
 expect(pitchedRoofPartsIntersect(parts(c),parts(b))).toBe(true);
 const pair=original.elements.filter(e=>e.id==='main-salon'||e.id.startsWith('main-salon-')||e.id==='suite-two'||e.id.startsWith('suite-two-'));
 expect(()=>applySceneOperations({version:'architectural-scene-1',name:'Valid layered roofs',elements:[]},pair.map(element=>({op:'add',element})))).not.toThrow();
 expect(pitchedRoofPartsIntersect(parts(a),parts(a))).toBe(true);
 const fascia=parts(a).find(p=>p.vertices.length===8)!;
 const centre=fascia.vertices.reduce((sum,v)=>sum.add(v),fascia.vertices[0].clone().set(0,0,0)).multiplyScalar(1/8);
 const contained={...fascia,vertices:fascia.vertices.map(v=>v.clone().sub(centre).multiplyScalar(.5).add(centre))};
 expect(pitchedRoofPartsIntersect([fascia],[contained])).toBe(true);
 expect(pitchedRoofPartsIntersect(parts(a),pitchedRoofParts(a,[100,50,100,.7]))).toBe(false);
 // Rotate and translate the entire hierarchy, preserving every relative relation.
 const transformed=structuredClone(original);transformed.elements.forEach(e=>{if(!e.parent){const [x,y,z]=e.at;e.at=[50+Math.cos(.63)*x+Math.sin(.63)*z,y+2,-20-Math.sin(.63)*x+Math.cos(.63)*z];e.rotation+=.63;}});
 const h=sceneSpatialGeometry(transformed),r=(id:string)=>pitchedRoofParts(h.map.get(id)!,h.world(h.map.get(id)!));
 expect(pitchedRoofPartsIntersect(r(a.id),r(b.id))).toBe(false);expect(pitchedRoofPartsIntersect(r(c.id),r(b.id))).toBe(true);
 for(const roofForm of ['gable','hip'] as const){const e={...a,roofForm};expect(pitchedRoofPartsIntersect(pitchedRoofParts(e,[0,5,0,.31]),pitchedRoofParts(e,[0,5,0,.31]))).toBe(true);}
});
it('minimal developer corrections resolve only their corresponding retained defect, preserving unrelated geometry',()=>{
 const before=JSON.stringify(original);
 const seated=applySceneOperations(original,[{op:'place-on',id:'belvedere-rail-front',support:'belvedere-deck',offset:[0,-2.18]}]);
 const g=sceneSpatialGeometry(seated);expect(g.bottom(g.map.get('belvedere-rail-front')!)).toBeCloseTo(g.top(g.map.get('belvedere-deck')!));
 expect(sceneRelationshipIssues(seated).some(i=>i.rule==='railing-deck')).toBe(false);
 expect(seated.elements.filter(e=>e.id!=='belvedere-rail-front')).toEqual(original.elements.filter(e=>e.id!=='belvedere-rail-front'));
 const dry=applySceneOperations(original,[{op:'move',id:'ocean-link',at:[0,.1,25.95]}]);expect(waterObstructions(dry)).toEqual([]);
 const roofs=applySceneOperations(original,original.elements.filter(e=>/^suite-.*-roof$/.test(e.id)).map(e=>({op:'replace',id:e.id,element:{...e,overhang:.2}})));
 expect(sceneRelationshipIssues(roofs).filter(i=>i.rule==='assembly-roof-junction')).toEqual([]);
 expect(sceneRelationshipIssues(roofs).some(i=>i.rule==='water-obstruction')).toBe(true);
 expect(focusedConstructionFindings(original).filter(i=>i.code==='stair-rise-gap')).toHaveLength(6);
 expect(()=>applySceneOperations(original,[{op:'replace',id:'suite-one-roof',element:{...original.elements.find(e=>e.id==='suite-one-roof')!,overhang:.9}}])).toThrow('roof geometry intersects');
 expect(()=>applySceneOperations(original,[{op:'finish',id:'suite-one-roof',material:'bronze'}])).not.toThrow();
 expect(JSON.stringify(original)).toBe(before);
});

it('demonstrates supported equal-rise primitive stairs without claiming a recovered house',()=>{
 const example=validateScene(JSON.parse(readFileSync('docs/architecture/terra-estate-diagnosis/stair-example.DEVELOPER.json','utf8')));
 expect(sceneRelationshipIssues(example)).toEqual([]);
 const findings=focusedConstructionFindings(example);
 expect(findings.filter(f=>/stair-rise-gap|stair-headroom-obstructed|stair-endpoint-disconnected/.test(f.code))).toEqual([]);
 const g=sceneSpatialGeometry(example),steps=example.elements.filter(e=>e.id.startsWith('example-stair-')).map(g.top);
 const datums=[.2,...steps,3.625];for(let i=1;i<datums.length;i++)expect(datums[i]-datums[i-1]).toBeCloseTo(3.425/19);
});
