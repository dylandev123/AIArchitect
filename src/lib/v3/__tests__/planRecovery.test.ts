import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { preparePlanEvaluation, checkoutPlanEvaluation, unresolvedPlanItems } from '../architecturalPlanEvaluation';
import { prepareV3ArchitecturalPlan, elaborateV3ArchitecturalPlan, unresolvedPlanFindings } from '../architecturalPlanFirst';
import { expandPlanAuthoring } from '../architecturalPlanAuthoring';
import { compileV3Scene } from '../scene';
import { deriveArchitecturalPlan } from '../architecturalPlanning';
import { useProjectStore } from '@/store/useProjectStore';

beforeEach(()=>{const data=new Map<string,string>();vi.stubGlobal('window',{localStorage:{getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>data.set(key,value),removeItem:(key:string)=>data.delete(key)}});});
afterEach(()=>vi.unstubAllGlobals());

/** An estate unrelated to any retained provider response: two small buildings, a terrace, a pool and a lawn. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- a provider-shaped JSON document that each case edits freely
const estate = (): any => ({
  format:'v3-architectural-plan-1',
  concept:'A compact courtyard retreat: a cottage and a small studio share a planted terrace, with a lap pool set to the north of the terrace.',
  site:{width:80,depth:60,groundColor:'#61754b',north:'-z',access:[{id:'lane-gate',boundary:'south',point:[-10,0,30]}]},
  buildings:[
    {id:'cottage',label:'Garden Cottage',role:'Residence',location:{x:-10,z:2},plan:{kind:'rectangle',width:20,depth:12},
      storeys:[{id:'cottage-ground',label:'Ground',role:'Living',spaces:[
        {id:'living',label:'Living',program:'Living and dining',footprint:{x:-4,z:0,width:12,depth:10}},
        {id:'bedroom',label:'Bedroom',program:'Bedroom',footprint:{x:6,z:0,width:8,depth:10}}]}],
      accessOpenings:[{id:'front-door',facade:'south',type:'door',start:.4,end:.5,serves:'living'}]},
    {id:'studio',label:'Studio',role:'Workroom',location:{x:22,z:0},plan:{kind:'rectangle',width:10,depth:8},
      storeys:[{id:'studio-ground',label:'Ground',role:'Studio',spaces:[
        {id:'studio-room',label:'Studio room',program:'Studio',footprint:{x:0,z:0,width:8,depth:6}}]}],
      accessOpenings:[{id:'studio-door',facade:'south',type:'door',start:.4,end:.6,serves:'studio-room'}]}],
  features:[
    {id:'terrace',label:'Terrace',role:'Outdoor living',type:'terrace',location:{x:-10,z:-9},width:16,depth:5},
    {id:'lap-pool',label:'Lap pool',role:'Swimming',type:'pool',location:{x:-10,z:-15},width:12,depth:4},
    {id:'lawn',label:'Lawn',role:'Garden',type:'landscape-zone',location:{x:0,z:16},width:30,depth:8}],
  connections:[
    {id:'drive',purpose:'Vehicle approach from the lane to the cottage door',from:{kind:'site-access',accessId:'lane-gate'},to:{kind:'entrance',entranceId:'front-door',approachDistance:3},use:'vehicle',width:3.5,waypoints:[]},
    {id:'studio-walk',purpose:'Walk from cottage to studio',from:{kind:'entrance',entranceId:'front-door',approachDistance:2},to:{kind:'entrance',entranceId:'studio-door',approachDistance:2},use:'pedestrian',width:1.5,waypoints:[[-11,0,12],[22,0,12]]},
    {id:'pool-walk',purpose:'Walk from terrace to pool edge',from:{kind:'surface',objectId:'terrace',local:[0,0]},to:{kind:'surface',objectId:'terrace',local:[0,-2]},use:'pedestrian',width:1.5,waypoints:[]}],
  verticalCirculation:[], requirements:[], relationships:[]
});

type Plan = ReturnType<typeof estate>;
const prepare = (mutate: (p: Plan) => void = () => {}) => { const plan = estate(); mutate(plan); return {plan, result: preparePlanEvaluation(structuredClone(plan))}; };
const fatalCodes = (r: {findings: {severity: string; code: string}[]}) => r.findings.filter(f => f.severity === 'fatal').map(f => f.code);
/** A pool contact that touches a terrace laid against the pool's near edge. */
const terraceAgainstPool = (p: Plan) => {
  p.features[0].location.z = -12;
  p.connections[2].from = {kind: 'surface', objectId: 'terrace', local: [0, 2]};
  p.connections[2].to = {kind: 'surface', objectId: 'lap-pool', local: [0, 2]};
};
const drawn = (r: ReturnType<typeof preparePlanEvaluation>) => r.scene!.estatePlan!.circulation.map(c => c.id).sort();

describe('recoverable 2D planning: a localized defect cannot remove a coherent estate', () => {
  it('accepts a valid multi-building estate unchanged, with nothing unresolved', () => {
    const {result} = prepare();
    expect(result.ok).toBe(true);
    expect(result.unresolved).toEqual([]);
    expect(fatalCodes(result)).toEqual([]);
    expect(drawn(result)).toEqual(['drive', 'pool-walk', 'studio-walk']);
  });

  it('never ends a walkway in water: the route is unresolved, verbatim, and everything else is drawn', () => {
    const {plan, result} = prepare(p => { p.connections[2].to = {kind: 'surface', objectId: 'lap-pool', local: [0, 0]}; });
    expect(result.ok).toBe(true);
    expect(result.unresolved!.map(i => [i.kind, i.id])).toEqual([['connection', 'pool-walk']]);
    expect(result.unresolved![0].findings[0]).toMatchObject({code: 'PLAN_REFERENCE', severity: 'fatal'});
    expect(result.unresolved![0].raw).toEqual(expect.objectContaining({to: plan.connections[2].to}));
    expect(drawn(result)).toEqual(['drive', 'studio-walk']);
    // Nothing else changed: buildings, rooms and features are exactly the authored ones.
    expect(result.scene!.objects.filter(o => o.type === 'building-mass').map(o => o.id).sort()).toEqual(['cottage', 'studio']);
    expect(result.scene!.interior!.rooms.map(r => r.id).sort()).toEqual(['bedroom', 'living', 'studio-room']);
    expect(['terrace', 'lap-pool', 'lawn'].every(id => result.scene!.objects.some(o => o.id === id))).toBe(true);
    // The original input was not mutated.
    expect(plan.connections[2].to).toEqual({kind: 'surface', objectId: 'lap-pool', local: [0, 0]});
  });

  it('derives a dry endpoint only when the authored contact lies on exactly one dry surface', () => {
    const {result} = prepare(terraceAgainstPool);
    expect(result.ok).toBe(true);
    expect(result.unresolved).toEqual([]);
    const note = result.findings.find(f => f.code === 'PLAN_ENDPOINT_RESEATED')!;
    expect(note).toMatchObject({severity: 'advisory', targetIds: ['pool-walk', 'terrace', 'lap-pool']});
    const route = result.plan!.connections.find(c => c.id === 'pool-walk')!;
    expect(route.to).toEqual({kind: 'surface', objectId: 'terrace', local: [0, -1]});
    expect(drawn(result)).toContain('pool-walk');
    // Strict (non-draft) authoring never re-addresses anything.
    const strict = (() => { const p = estate(); terraceAgainstPool(p); return prepareV3ArchitecturalPlan(expandPlanAuthoring(p).data); })();
    expect(strict.ok).toBe(false);
  });

  it('leaves an ambiguous dry destination unresolved instead of choosing a surface', () => {
    const {result} = prepare(p => {
      terraceAgainstPool(p);
      p.features.push({id: 'terrace-b', label: 'Second terrace', role: 'Outdoor living', type: 'terrace', location: {x: -10, z: -12}, width: 8, depth: 5});
    });
    expect(result.ok).toBe(true);
    expect(result.unresolved!.map(i => i.id)).toEqual(['pool-walk']);
    expect(result.unresolved![0].findings[0].code).toBe('PLAN_ENDPOINT_AMBIGUOUS');
    expect(result.findings.some(f => f.code === 'PLAN_ENDPOINT_RESEATED')).toBe(false);
  });

  it('draws a minor room-boundary conflict as authored with diagnostics', () => {
    const {result} = prepare(p => { p.buildings[0].storeys[0].spaces[1].footprint.width = 12; });
    expect(result.ok).toBe(true);
    expect(result.unresolved).toEqual([]);
    expect(fatalCodes(result).sort()).toEqual(['BLUEPRINT_SPACE_OUTSIDE_HOST', 'BLUEPRINT_SPACE_OVERLAP']);
    expect(result.scene!.interior!.rooms.find(r => r.id === 'bedroom')!.footprint.width).toBe(12);
    expect(deriveArchitecturalPlan(result.scene!, compileV3Scene(result.scene!), 0).rooms).toHaveLength(3);
  });

  it('keeps a localized entrance mismatch as authored and withholds only the route that needs its wall address', () => {
    const {result} = prepare(p => {
      p.buildings[1].plan = {kind: 'articulated', width: 10, depth: 8, operations: [{id: 'recess', type: 'entry-recess', facade: 'south', width: 2, depth: 1}]};
      Object.assign(p.buildings[1].accessOpenings[0], {start: .35, end: .65});
    });
    expect(result.ok).toBe(true);
    expect(result.unresolved!.map(i => i.id)).toEqual(['studio-walk']);
    expect(result.findings.some(f => f.code === 'BLUEPRINT_ENTRANCE_WALL' && f.targetIds.includes('studio-door'))).toBe(true);
    expect(result.unresolved![0].findings.some(f => f.code === 'PLAN_ENTRANCE_UNRESOLVED')).toBe(true);
    const door = result.scene!.objects.find(o => o.id === 'studio')!.composition!.openings!.find(o => o.id === 'studio-door') as {start: number; end: number};
    expect([door.start, door.end]).toEqual([.35, .65]);
    expect(drawn(result)).toEqual(['drive', 'pool-walk']);
  });

  it('withholds a route that crosses a building rather than drawing or rerouting it', () => {
    const {result} = prepare(p => { p.connections[1].waypoints = [[-11, 0, 2], [22, 0, 2]]; });
    expect(result.ok).toBe(true);
    expect(result.unresolved!.map(i => i.id)).toEqual(['studio-walk']);
    expect(result.unresolved![0].findings.some(f => f.code === 'ESTATE_ROUTE_BLOCKED')).toBe(true);
    expect((result.unresolved![0].raw as {waypoints: unknown}).waypoints).toEqual([[-11, 0, 2], [22, 0, 2]]);
  });

  it('withholds routes that name an unknown entrance or a gate that is not on the boundary', () => {
    expect(prepare(p => { p.connections[0].to.entranceId = 'nope'; }).result.unresolved!.map(i => i.id)).toEqual(['drive']);
    const gate = prepare(p => { p.site.access[0].point = [-10, 0, 10]; }).result;
    expect(gate.ok).toBe(true);
    expect(gate.unresolved!.map(i => i.id)).toEqual(['drive']);
  });

  it('withholds a site feature whose own boundary is invalid, and anything that ends on it, keeping the rest', () => {
    const {result} = prepare(p => {
      const pts = [[-5, -3], [5, 3], [5, -3], [-5, 3]];
      p.features[2].footprint = {kind: 'outline', operations: [], segments: pts.map((a, i) => ({id: `e${i}`, type: 'line', start: a, end: pts[(i + 1) % 4]}))};
    });
    expect(result.ok).toBe(true);
    expect(result.unresolved!.map(i => [i.kind, i.id])).toEqual([['feature', 'lawn']]);
    expect(result.scene!.objects.some(o => o.id === 'lawn')).toBe(false);
    expect(result.scene!.objects.filter(o => ['terrace', 'lap-pool'].includes(o.id))).toHaveLength(2);
    expect(checkoutPlanEvaluation(JSON.parse(JSON.stringify(result.scene))).plan!.features.find(f => f.id === 'lawn')).toBeDefined();
  });

  it('does not let intent that points at a withheld object reject the draft', () => {
    const bowtie = [[-5, -3], [5, 3], [5, -3], [-5, 3]];
    const {result} = prepare(p => {
      p.features[2].footprint = {kind: 'outline', operations: [], segments: bowtie.map((a, i) => ({id: `e${i}`, type: 'line', start: a, end: bowtie[(i + 1) % 4]}))};
      p.connections[2].to = {kind: 'surface', objectId: 'lawn', local: [0, 0]};
      p.requirements = [{id: 'req-lawn', source: 'user', statement: 'A lawn for the garden', metric: 'feature', objectIds: ['lawn']}];
      p.relationships = [{id: 'rel-1', intent: 'The lawn fronts the cottage', from: 'lawn', to: 'cottage', kind: 'aligns'}, {id: 'rel-2', intent: 'A walk joins terrace and pool', from: 'pool-walk', to: 'terrace', kind: 'connects'}];
    });
    expect(result.ok, JSON.stringify(result.findings.filter(f => f.severity === 'fatal'))).toBe(true);
    expect(result.unresolved!.map(i => i.id).sort()).toEqual(['lawn', 'pool-walk']);
    // The requirement and relationships themselves are retained in the draft.
    expect(result.scene!.estatePlan!.requirements.map(r => r.id)).toEqual(['req-lawn']);
    expect(result.scene!.estatePlan!.relationships.map(r => r.id).sort()).toEqual(['rel-1', 'rel-2']);
  });

  it('withholds a room adjacency between different storeys; both rooms remain', () => {
    const {result} = prepare(p => { p.roomAdjacencies = [{from: 'living', to: 'studio-room'}]; });
    expect(result.ok).toBe(true);
    expect(result.unresolved!.map(i => [i.kind, i.id])).toEqual([['adjacency', 'living|studio-room']]);
    expect(result.scene!.interior!.rooms.map(r => r.id)).toEqual(expect.arrayContaining(['living', 'studio-room']));
  });

  it('draws a site feature that overhangs the boundary, and a building without a ground entrance, with diagnostics', () => {
    const overhang = prepare(p => { p.features[2].location.x = 30; }).result;
    expect(overhang.ok).toBe(true);
    expect(overhang.findings.some(f => f.code === 'BLUEPRINT_SITE_BOUNDS' && f.targetIds[0] === 'lawn')).toBe(true);
    const noDoor = prepare(p => { p.buildings[1].accessOpenings = []; p.connections = p.connections.filter((c: {id: string}) => c.id !== 'studio-walk'); }).result;
    expect(noDoor.ok).toBe(true);
    expect(noDoor.findings.some(f => f.code === 'PLAN_ENTRANCE')).toBe(true);
    // Neither may proceed to a paid 3D build until addressed.
    expect(unresolvedPlanFindings(noDoor).map(f => f.code)).toEqual(['PLAN_ENTRANCE']);
  });

  it('still rejects what makes the core layout unrepresentable', () => {
    const cases: [string, (p: Plan) => void][] = [
      ['an open primary footprint', p => { p.buildings[0].plan = {kind: 'outline', segments: [{id: 'a', type: 'line', start: [0, 0], end: [10, 0]}, {id: 'b', type: 'line', start: [10, 0], end: [10, 10]}]}; }],
      ['a building outside the site', p => { p.buildings[1].location.x = 100; }],
      ['an ambiguous identity', p => { p.features[0].id = 'cottage'; }],
      ['independent buildings that overlap', p => { p.buildings[1].location = {x: -10, z: 2}; }],
    ];
    for (const [name, mutate] of cases) {
      const {result} = prepare(mutate);
      expect(result.ok, name).toBe(false);
    }
    expect(preparePlanEvaluation({format: 'v3-architectural-plan-1'}).ok).toBe(false);
  });

  it('keeps Build in 3D closed while anything is unresolved', () => {
    const {result} = prepare(p => { p.connections[2].to = {kind: 'surface', objectId: 'lap-pool', local: [0, 0]}; });
    const blockers = unresolvedPlanFindings(result);
    expect(blockers.map(f => [f.code, f.targetIds])).toEqual([['PLAN_UNRESOLVED', ['pool-walk']]]);
    expect(elaborateV3ArchitecturalPlan(result, {}).findings.map(f => f.code)).toEqual(['PLAN_UNRESOLVED']);
  });

  it('saves, undoes, redoes, reloads and then accepts a correction of the unresolved route', () => {
    const {result} = prepare(p => { p.connections[2].to = {kind: 'surface', objectId: 'lap-pool', local: [0, 0]}; });
    const store = useProjectStore.getState(), project = store.createProject('Recovery', 'house', 'v3-scene');
    const root = {version: 3, generationMode: 'v3-scene', v3Scene: result.scene};
    store.appendVersion(project.id, 'Plan', JSON.stringify(root));
    const saved = store.getProject(project.id)!.houseConfigJson;
    expect(unresolvedPlanItems(JSON.parse(saved).v3Scene).map(i => i.id)).toEqual(['pool-walk']);
    // Edit: correct the walkway in the plan editor's own document.
    const editor = checkoutPlanEvaluation(JSON.parse(saved).v3Scene);
    expect(editor.ok).toBe(true);
    const doc = editor.plan!;
    doc.connections.find(c => c.id === 'pool-walk')!.to = {kind: 'surface', objectId: 'terrace', local: [0, -2]};
    const corrected = preparePlanEvaluation(doc);
    expect(corrected.ok).toBe(true);
    expect(corrected.unresolved).toEqual([]);
    store.appendVersion(project.id, 'Corrected route', JSON.stringify({...root, v3Scene: corrected.scene}));
    const fixed = store.getProject(project.id)!.houseConfigJson;
    expect(unresolvedPlanItems(JSON.parse(fixed).v3Scene)).toEqual([]);
    store.undo(project.id);
    expect(store.getProject(project.id)!.houseConfigJson).toBe(saved);
    expect(unresolvedPlanItems(JSON.parse(store.getProject(project.id)!.houseConfigJson).v3Scene).map(i => i.id)).toEqual(['pool-walk']);
    store.redo(project.id);
    expect(store.getProject(project.id)!.houseConfigJson).toBe(fixed);
    // Reload: a fresh checkout of the persisted document reproduces the same plan.
    expect(checkoutPlanEvaluation(JSON.parse(fixed).v3Scene).ok).toBe(true);
    expect(drawn(corrected)).toEqual(['drive', 'pool-walk', 'studio-walk']);
  });
});
