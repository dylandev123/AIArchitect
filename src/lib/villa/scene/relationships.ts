import { profileContactTester, profileDeckIntervals } from './profileContact';
import { v3NaturalGroundHeight } from '@/lib/v3/grading';
import type { ArchitecturalScene, SceneElement } from './model';
import { waterObstructions, occupiedRoofConflicts } from './spatial';
import { pitchedRoofParts, pitchedRoofPartsIntersect } from './roofIntersection';

// Geometric relationship checks only: no generated geometry or engineering claims.
// Match the renderer's recursive THREE Y rotations (local X -> [cos, -sin]).
const CONTACT = .16;
type Placed = SceneElement & { world: [number, number, number]; yaw: number };
export type SceneRelationshipIssue = { id: string; relatedIds?: string[]; rule: string; message: string };
export function sceneRelationshipIssues(scene: ArchitecturalScene): SceneRelationshipIssue[] {
    const map = new Map(scene.elements.map(e => [e.id, e]));
    const placed = new Map<string, Placed>();
    function place(e: SceneElement): Placed {
        const cached = placed.get(e.id); if (cached) return cached;
        const p = e.parent ? place(map.get(e.parent)!) : undefined;
        const c = Math.cos(p?.yaw ?? 0), s = Math.sin(p?.yaw ?? 0);
        const world: Placed['world'] = p ? [p.world[0] + c * e.at[0] + s * e.at[2], p.world[1] + e.at[1], p.world[2] - s * e.at[0] + c * e.at[2]] : [...e.at];
        const result = { ...e, world, yaw: e.rotation + (p?.yaw ?? 0) }; placed.set(e.id, result); return result;
    }
    const all = scene.elements.map(place);
    const contact = profileContactTester();
    const bottom = (e: Placed) => e.world[1] - e.size[1] / 2;
    const top = (e: Placed) => e.world[1] + e.size[1] / 2;
    const local = (a: Placed, x: number, z: number) => {
        const dx = x - a.world[0], dz = z - a.world[2];
        return [Math.cos(a.yaw) * dx - Math.sin(a.yaw) * dz, Math.sin(a.yaw) * dx + Math.cos(a.yaw) * dz];
    };
    // Oriented rectangle SAT, preserving diagonal and non-cardinal designs.
    function overlaps(a: Placed, b: Placed, tolerance = CONTACT) {
        return [a.yaw, b.yaw].every(yaw => [yaw, yaw + Math.PI / 2].every(angle => {
            const x = Math.cos(angle), z = -Math.sin(angle);
            const radius = (e: Placed) => Math.abs(Math.cos(e.yaw) * x - Math.sin(e.yaw) * z) * e.size[0] / 2 + Math.abs(Math.sin(e.yaw) * x + Math.cos(e.yaw) * z) * e.size[2] / 2;
            return Math.abs((a.world[0] - b.world[0]) * x + (a.world[2] - b.world[2]) * z) <= radius(a) + radius(b) + tolerance;
        }));
    }
    // Assembly provenance survives normal editing/reload; no hidden regeneration.
    // Oriented broad phase, then builder geometry for pitched pairs. Empty space
    // below a hip slope is not a physical roof intersection.
    const assemblyIssues:SceneRelationshipIssue[]=[];
    const root=(e:Placed):Placed=>e.assemblyKind?e:e.parent?root(placed.get(e.parent)!):e;
    const wings=all.filter(e=>e.assemblyKind==='residential-wing');
    const roofs=all.filter(e=>e.kind==='roof');
    const pitched=(e:Placed)=>!!e.roofForm&&e.roofForm!=='flat';
    const roofParts=new Map<string,ReturnType<typeof pitchedRoofParts>>();
    const parts=(e:Placed)=>{let p=roofParts.get(e.id);if(!p){p=pitchedRoofParts(e,[...e.world,e.yaw]);roofParts.set(e.id,p);}return p;};
    for(const wing of wings){
        for(const other of all.filter(e=>e.kind==='plate'&&e.id!==wing.id&&root(e).id!==root(wing).id)){
            if(Math.abs(bottom(wing)-bottom(other))<.01&&overlaps(wing,other,.01)&&other.assemblyKind==='residential-wing')
                assemblyIssues.push({id:wing.id,relatedIds:[other.id],rule:'assembly-junction',message:`${wing.id}: shared/overlapping wing junction with ${other.id} is unsupported; author a single explicit junction or separate the wings. No walls were removed.`});
        }
        for(const a of roofs.filter(e=>root(e).id===root(wing).id))for(const b of roofs.filter(e=>root(e).id!==root(wing).id)){
            const envelope=(e:Placed):Placed=>({...e,size:[e.size[0]+(e.roofForm&&e.roofForm!=='flat'?2*((e.overhang??0)+.1):0),e.size[1],e.size[2]+(e.roofForm&&e.roofForm!=='flat'?2*((e.overhang??0)+.1):0)]});
            if(bottom(a)-(pitched(a) ? .28 : 0)<top(b)-.001 && top(a)>bottom(b)-(pitched(b) ? .28 : 0)+.001 && overlaps(envelope(a),envelope(b),-.001) && contact(a,b,0) && (!(pitched(a)&&pitched(b)) || pitchedRoofPartsIntersect(parts(a),parts(b))))assemblyIssues.push({id:a.id,relatedIds:[b.id],rule:'assembly-roof-junction',message:`${a.id}: roof geometry intersects ${b.id} (pitched pairs use builder surfaces/fascia; other pairs use envelopes); automatic roof unions are unsupported. Separate eaves or author the junction explicitly.`});
        }
    }
    const solids = all.filter(e => ['plate', 'wall', 'volume', 'roof', 'glazing'].includes(e.kind));
    const grounded = new Set<string>();
    for (const e of solids) {
        const terrain = scene.terrain;
        const ground = terrain ? v3NaturalGroundHeight({width:terrain.width,depth:terrain.depth,naturalGround:terrain}, e.world[0], e.world[2]) : 0;
        if (bottom(e) <= ground + CONTACT && top(e) >= ground - CONTACT) grounded.add(e.id);
    }
    // A parent is a transform, not proof of support. Contact is symmetric:
    // suspended members, side cantilevers and clerestory roof bands can connect
    // to the rooted composition without each member resting on the one below.
    // This establishes geometric connectivity, not load-bearing capacity.
    let changed = true;
    while (changed) {
        changed = false;
        for (const e of solids) if (!grounded.has(e.id) && solids.some(s => grounded.has(s.id) && overlaps(e, s) &&
            bottom(e) <= top(s) + CONTACT && top(e) >= bottom(s) - CONTACT && contact(e,s,CONTACT)
        )) { grounded.add(e.id); changed = true; }
    }
    const issues: SceneRelationshipIssue[] = [...assemblyIssues, ...occupiedRoofConflicts(scene).filter(f=>f.category==='confirmed-technical-defect').map(f=>({id:f.elementIds[0],relatedIds:f.elementIds.slice(1),rule:f.code,message:f.message}))];
    for (const {water,solid} of waterObstructions(scene)) issues.push({id:water.id,relatedIds:[solid.id],rule:'water-obstruction',message:`${water.id}: solid ${solid.id} crosses the interior water plane; split the floor/deck around the pool reservation or explicitly redesign the water. Geometry was not moved.`});
    const issue = (e: Placed, rule: string, message: string) => issues.push({id:e.id,rule,message:`${e.id}: ${message}`});
    for (const e of all) {
        if (e.kind === 'plate' && !grounded.has(e.id))
            issue(e, 'support', 'Elevated floor/deck needs contact with a ground-connected slab, wall, glazing, roof, pier or beam (volume); attachment alone is not support.');
        if (e.kind === 'balcony') {
            // Glazing's depth is not rendered; a deep balcony cannot author a deck.
            if (e.size[2] > .3) issue(e, 'railing-depth', 'Balcony is glass railing only; use a plate for the deck and thin local Z for the railing.');
            // Clip the rendered railing line against every rooted walking surface;
            // the union may span several independently editable deck plates.
            const intervals: [number,number][] = [];
            for (const slab of solids) {
                if (!['plate','volume'].includes(slab.kind) || !grounded.has(slab.id) || Math.abs(bottom(e)-top(slab)) > CONTACT) continue;
                if(slab.geometry){intervals.push(...profileDeckIntervals(slab,e));continue;}
                const a = local(slab,e.world[0],e.world[2]);
                const b = local(slab,e.world[0]+Math.cos(e.yaw),e.world[2]-Math.sin(e.yaw));
                let lo = -e.size[0]/2, hi = e.size[0]/2;
                for (const axis of [0,1]) {
                    const bound = slab.size[axis === 0 ? 0 : 2]/2 + CONTACT, direction = b[axis]-a[axis];
                    if (Math.abs(direction) < 1e-9) { if (Math.abs(a[axis]) > bound) hi = -Infinity; }
                    else {
                        const t1 = (-bound-a[axis])/direction, t2 = (bound-a[axis])/direction;
                        lo = Math.max(lo,Math.min(t1,t2)); hi = Math.min(hi,Math.max(t1,t2));
                    }
                }
                if (hi >= lo) intervals.push([lo,hi]);
            }
            let covered = -e.size[0]/2;
            for (const [lo,hi] of intervals.sort((a,b)=>a[0]-b[0])) {
                if (lo > covered + 1e-9) break;
                covered = Math.max(covered,hi);
            }
            const deck = covered >= e.size[0]/2 - 1e-9;
            if (!deck) issue(e, 'railing-deck', 'Railing base and full rendered span need a supporting deck at the walking surface.');
        }
        if (e.geometry) continue; // Profile glazing follows its actual extrusion, not the legacy thin-X panel contract.
        if (e.kind !== 'glazing' && e.kind !== 'screen') continue;
        if (e.kind === 'glazing' && e.size[2] > .3)
            issue(e, 'glazing-depth', 'Glazing renders along local X, not depth Z; put facade span in width and rotate the element.');
        const declaredHost = e.parent ? placed.get(e.parent) : undefined;
        // World-authored panels can still lie on a wall face. Infer only an actual
        // face at the panel centre, avoiding arbitrary nearest-building guesses.
        const inferredHost = !declaredHost ? all.find(w => {
            if (w.kind !== 'wall' || bottom(e) >= top(w) || top(e) <= bottom(w)) return false;
            const [x,z] = local(w,e.world[0],e.world[2]);
            const sideways = w.size[2] > w.size[0];
            const normal = Math.abs(sideways ? x : z), along = Math.abs(sideways ? z : x);
            return normal > Math.min(e.size[2],.3)/2 &&
                normal <= Math.min(w.size[0],w.size[2])/2 + CONTACT &&
                along < Math.max(w.size[0],w.size[2])/2;
        }) : undefined;
        const host = declaredHost ?? inferredHost;
        if (host?.kind === 'wall') {
            const wallYaw = host.yaw + (host.size[2] > host.size[0] ? Math.PI/2 : 0);
            const aligned = Math.abs(Math.sin(e.yaw - wallYaw)) < .01;
            const [x,z] = local(host,e.world[0],e.world[2]);
            const normal = host.size[2] > host.size[0] ? x : z;
            const depth = Math.min(host.size[0],host.size[2]);
            const along = host.size[2] > host.size[0] ? z : x;
            const span = Math.max(host.size[0],host.size[2]);
            if (!aligned || Math.abs(normal) > (depth + e.size[2])/2 + CONTACT ||
                Math.abs(along) > (span + e.size[0])/2 + CONTACT ||
                bottom(e) > top(host) + CONTACT || top(e) < bottom(host) - CONTACT)
                issue(e, 'facade', 'Glazing/screen must run parallel to its host wall and remain at its facade; child rotation is local.');
        }
        // Ambiguous deep, narrow slats intersecting a facade need an explicit wall
        // attachment. Standalone fins and horizontal pergolas remain unrestricted.
        const nearFacade = all.some(w => w.id !== e.id && (w.kind === 'wall' || w.kind === 'glazing') && bottom(e) < top(w) && top(e) > bottom(w) && overlaps(e,w));
        if (e.kind === 'screen' && e.size[2] > e.size[0] && declaredHost?.kind !== 'wall' && nearFacade)
            issue(e, 'screen-axis', 'Screen slats distribute along local X; use width for the facade span and rotate to align, or attach a deliberately deep screen parallel to its wall.');
    }
    return issues;
}

/** Lossless load remains schema/attachment validation. Transactions cannot introduce
 * new faults, including indirect faults caused by moving/removing a support/ancestor.
 * Existing issues may be repaired incrementally; finishes and unrelated edits survive. */
export function assertSceneRelationships(next: ArchitecturalScene, previous?: ArchitecturalScene) {
    // Terrain edits remain explicit natural-ground changes, never architectural rewrites.
    if (previous && next.elements === previous.elements) return;
    const geometry = (scene: ArchitecturalScene, id: string): string => {
        const e = scene.elements.find(e => e.id === id);
        if (!e) return '';
        return JSON.stringify([e.kind,e.at,e.rotation,e.size,e.geometry,e.roofForm,e.overhang,e.parent,e.parent ? geometry(scene,e.parent) : null]);
    };
    const existing = new Set(previous ? sceneRelationshipIssues(previous)
        .filter(i => [i.id,...(i.relatedIds ?? [])].every(id=>geometry(previous,id) === geometry(next,id))).map(i => `${i.id}:${i.rule}:${i.relatedIds?.join(',') ?? ''}`) : []);
    const issues = sceneRelationshipIssues(next).filter(i => !existing.has(`${i.id}:${i.rule}:${i.relatedIds?.join(',') ?? ''}`));
    if (issues.length) throw Error(issues.map(i => i.message).join('\n'));
}
