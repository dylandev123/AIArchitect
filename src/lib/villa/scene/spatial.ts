import { z } from 'zod';
import { profileContactTester } from './profileContact';
import type { ArchitecturalScene, SceneElement } from './model';
import type { CompletionFinding } from './completion';

/** References share the construction graph's metres, datums and parent frames.
 * No second coordinate ledger, layout solver, or automatic geometry correction. */
export const spatialRelationshipSchema = z.object({
    subject: z.string().min(1).max(80), target: z.string().min(1).max(80),
    relation: z.enum(['adjacent-to', 'connected-to', 'above', 'below', 'facing', 'set-back-from', 'covering', 'clear-of', 'inside']),
    clearance: z.number().finite().nonnegative().max(10000),
    reason: z.string().min(1).max(300),
}).strict();
export type SpatialRelationship = z.infer<typeof spatialRelationshipSchema>;

export function sceneSpatialGeometry(scene: ArchitecturalScene) {
    const map = new Map(scene.elements.map(e => [e.id, e]));
    const cache = new Map<string, number[]>();
    function world(e: SceneElement): number[] {
        const cached = cache.get(e.id); if (cached) return cached;
        const p = e.parent ? world(map.get(e.parent)!) : undefined;
        const result = p ? [p[0]+Math.cos(p[3])*e.at[0]+Math.sin(p[3])*e.at[2], p[1]+e.at[1], p[2]-Math.sin(p[3])*e.at[0]+Math.cos(p[3])*e.at[2], p[3]+e.rotation] : [...e.at, e.rotation];
        cache.set(e.id, result); return result;
    }
    // Match documented component origins/extents rather than treating every
    // element as a centre-origin box. These remain bounds, not mesh collision.
    const top = (e: SceneElement) => world(e)[1]+(e.geometry ? e.size[1]/2 : e.kind==='pavilion' ? e.size[1]+.29 : e.kind==='water' ? 0 : e.kind==='sofa' ? 1.085 : e.size[1]/2+(e.kind==='roof'&&(!e.roofForm||e.roofForm==='flat')&&e.material==='ivory'?.05:0));
    const bottom = (e: SceneElement) => world(e)[1]+(e.geometry ? -e.size[1]/2 : e.kind==='pavilion' ? -.9 : e.kind==='water' ? 0 : e.kind==='sofa' ? .1 : -e.size[1]/2-(e.kind==='roof'&&(!e.roofForm||e.roofForm==='flat')?.08:0));
    const spans = (e: SceneElement) => {
        const extension=e.kind==='pavilion' ? .65 : e.kind==='roof'&&e.roofForm&&e.roofForm!=='flat' ? e.overhang??0 : 0;
        return [e.size[0]+extension*2, e.kind==='sofa' ? 1.08 : e.size[2]+extension*2];
    };
    // Positive means separated on an OBB axis; negative means penetration.
    // A separation is a conservative lower bound, not Euclidean distance.
    function separation(a: SceneElement, b: SceneElement, insetB = 0) {
        const p=world(a), q=world(b);
        return Math.max(...[p[3],q[3]].flatMap(yaw=>[yaw,yaw+Math.PI/2].map(angle=>{
            const radius=(e:SceneElement,r:number[],inset=0)=>Math.abs(Math.cos(r[3]-angle))*Math.max(0,spans(e)[0]/2-inset)+Math.abs(Math.sin(r[3]-angle))*Math.max(0,spans(e)[1]/2-inset);
            return Math.abs((p[0]-q[0])*Math.cos(angle)-(p[2]-q[2])*Math.sin(angle))-radius(a,p)-radius(b,q,insetB);
        })));
    }
    function contains(host: SceneElement, child: SceneElement) {
        const p=world(host),q=world(child);
        const [hw,hd]=spans(host),[cw,cd]=spans(child);
        return [-1,1].every(x=>[-1,1].every(z=>{
            const dx=q[0]+Math.cos(q[3])*x*cw/2+Math.sin(q[3])*z*cd/2-p[0];
            const dz=q[2]-Math.sin(q[3])*x*cw/2+Math.cos(q[3])*z*cd/2-p[2];
            return Math.abs(Math.cos(p[3])*dx-Math.sin(p[3])*dz)<=hw/2+.02 && Math.abs(Math.sin(p[3])*dx+Math.cos(p[3])*dz)<=hd/2+.02;
        }));
    }
    return { map, world, top, bottom, separation, contains };
}

/** Floor plates crossing the inset water plane are contradictions. Roof shade,
 * bridges above water, basin bottoms, edge walls, pool piers and coping remain legitimate.
 * This does not infer a basin volume from labels or forbid an enclosed pool. */
export function waterObstructions(scene: ArchitecturalScene) {
    const g=sceneSpatialGeometry(scene),contact=profileContactTester();
    const placed=(e:SceneElement)=>({...e,world:g.world(e),yaw:g.world(e)[3]});
    return scene.elements.filter(e=>e.kind==='water').flatMap(water=>scene.elements.filter(solid=>
        solid.kind==='plate' &&
        g.bottom(solid)<g.world(water)[1]+.001 && g.top(solid)>g.world(water)[1]-.001 &&
        g.separation(solid,water,Math.min(.1,water.size[0]/4,water.size[2]/4))<-.001 && contact(placed(solid),placed(water),0)
    ).map(solid=>({water,solid})));
}

/** Intent checks are review findings, never universal restrictions on architecture. */
export function spatialCoordinationFindings(scene: ArchitecturalScene): CompletionFinding[] {
    const plan=scene.architecturalPlan as {spatialRelationships?: unknown} | undefined;
    const parsed=z.array(spatialRelationshipSchema).max(40).safeParse(plan?.spatialRelationships ?? []);
    if (!parsed.success) return [{category:'likely-architectural-incompleteness',code:'spatial-contract',elementIds:[],message:'Spatial relationships are malformed; retained geometry was not modified.'}];
    const g=sceneSpatialGeometry(scene);
    const obstructions: CompletionFinding[]=waterObstructions(scene).map(({water,solid})=>({category:'confirmed-technical-defect',code:'water-obstruction',elementIds:[water.id,solid.id],message:`${solid.id} crosses ${water.id}'s open interior water plane at Y=${g.world(water)[1]} m.`}));
    return [...obstructions,...occupiedRoofConflicts(scene),...parsed.data.flatMap((r):CompletionFinding[]=>{
        const a=g.map.get(r.subject),b=g.map.get(r.target);
        let consistent=false;
        if(a&&b&&(a.geometry||b.geometry)) return [{category:'unsupported-capability' as const,code:'profile-spatial-review',elementIds:[r.subject,r.target],message:`${r.subject} ${r.relation} ${r.target}: profile relationship requires actual-surface review; bounding rectangles are insufficient evidence. ${r.reason}`}];
        if(a&&b&&a!==b) {
            const gap=g.separation(a,b),p=g.world(a),q=g.world(b);
            switch(r.relation) {
                case 'clear-of': case 'set-back-from': consistent=gap>=r.clearance-.02; break;
                case 'above': consistent=g.bottom(a)>=g.top(b)+r.clearance-.02; break;
                case 'below': consistent=g.top(a)<=g.bottom(b)-r.clearance+.02; break;
                case 'covering': consistent=g.contains(a,b)&&g.bottom(a)>=g.top(b)-.02; break;
                case 'inside': consistent=g.contains(b,a); break;
                case 'connected-to': consistent=gap<=.03&&g.bottom(a)<=g.top(b)+.25&&g.top(a)>=g.bottom(b)-.25; break;
                case 'adjacent-to': consistent=gap>=-.02&&gap<=r.clearance+.03; break;
                case 'facing': consistent=Math.sin(p[3])*(q[0]-p[0])+Math.cos(p[3])*(q[2]-p[2])>0; break;
            }
        }
        return consistent ? [] : [{category:'likely-architectural-incompleteness' as const,code:'spatial-intent-mismatch',elementIds:[r.subject,r.target],message:`${r.subject} ${r.relation} ${r.target}: geometry does not evidence the declared relationship (clearance ${r.clearance} m). ${r.reason} Review openings, access and component extents; bounding rectangles alone do not prove usability.`}];
    })];
}

/** Occupied envelopes derive from referenced slabs and local enclosure heads.
 * They are evidence bounds, never extra scene geometry or a room generator. */
export function occupiedRoofConflicts(scene: ArchitecturalScene): CompletionFinding[] {
    const g = sceneSpatialGeometry(scene);
    const plan = scene.architecturalPlan as {programme?: unknown; spaces?: unknown} | undefined;
    const entries = z.array(z.object({name:z.string(), zone:z.string().optional(), use:z.string().optional(), floorIds:z.array(z.string()), enclosureIds:z.array(z.string())})).safeParse(plan?.programme ?? plan?.spaces ?? []);
    if (!entries.success) return [];
    const findings: CompletionFinding[] = [];
    const contact=profileContactTester();
    const seen = new Set<string>();
    for (const space of entries.data.filter(s=>s.zone==='public'||s.zone==='private'||s.zone==='service'||s.use==='interior')) {
        for (const id of space.floorIds) {
            const floor=g.map.get(id); if (floor?.kind!=='plate') continue;
            const datum=g.top(floor);
            const enclosure=space.enclosureIds.flatMap(id=>{const e=g.map.get(id);return e&&['wall','glazing','entrance'].includes(e.kind)&&g.separation(e,floor)<=.25&&g.bottom(e)<=datum+.25&&g.top(e)>datum+.5?[e]:[];});
            if (!enclosure.length) continue;
            const ceiling=Math.min(...enclosure.map(g.top));
            for (const roof of scene.elements.filter(e=>e.kind==='roof')) {
                // A pitched envelope is not its solid mesh; do not certify collision
                // from a bounding box. Flat rectangular solids give exact evidence.
                if (roof.roofForm && roof.roofForm!=='flat') continue;
                if (floor.geometry && (floor.geometry.axis!=='y')) continue; // Occupied height from a vertical section is unverified.
                if(roof.geometry || floor.geometry){
                    if(g.bottom(roof)>=ceiling-.1 || g.top(roof)<=datum+.02 || g.separation(roof,floor,.15)>=-.001)continue;
                    const p=g.world(floor),q=g.world(roof);
                    const occupied={...floor,id:`occupied-${space.name}-${floor.id}`,kind:'volume' as const,size:[floor.size[0],ceiling-datum,floor.size[2]] as [number,number,number],world:[p[0],(ceiling+datum)/2,p[2]],yaw:p[3]};
                    if(!contact({...roof,world:q,yaw:q[3]},occupied,0))continue;
                }
                if (g.separation(roof,floor,.15)>=-.001 || g.top(roof)<=datum+.02 || g.bottom(roof)>=ceiling-.1) continue;
                const key=`${roof.id}:${floor.id}`; if(seen.has(key)) continue; seen.add(key);
                // Near-datum intrusion is strong evidence; higher envelopes can be
                // intentional lower ceilings/canopies and stay review-only.
                const nearWalkingSurface=g.bottom(roof)<datum+.5;
                findings.push({category:nearWalkingSurface?'confirmed-technical-defect':'likely-architectural-incompleteness',code:nearWalkingSurface?'roof-occupied-volume':'roof-envelope-review',elementIds:[roof.id,floor.id,...enclosure.map(e=>e.id)],message:`${roof.id} at world [${g.world(roof).slice(0,3).join(', ')}], size [${roof.size.join(', ')}], rendered Y=[${g.bottom(roof)}, ${g.top(roof)}] crosses ${space.name} above ${floor.id} at walking Y=${datum}, enclosure head Y=${ceiling}. Coordinate lower roof sections around this occupied footprint or explicitly redesign the level/roof relationship; no elements were moved.`});
            }
        }
    }
    return findings;
}
