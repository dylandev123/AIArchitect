import { z } from 'zod';
import type { ArchitecturalScene, SceneElement } from './model';
import { sceneSpatialGeometry } from './spatial';

/** Demand is chosen by the architect from the brief, never derived from price. */
export const physicalProgrammeSchema = z.object({
    propertyType: z.string().min(1).max(160),
    basis: z.string().min(1).max(800).describe('Exact requirements, assumptions, property value versus construction budget, site constraints and why this accommodation fits.'),
    allocations: z.array(z.object({
        name: z.string().min(1).max(100),
        quantity: z.number().int().positive().max(100),
        unitNetAreaM2: z.number().positive(),
        allowanceM2: z.number().nonnegative().describe('Additional circulation, walls, storage or service allowance for this whole allocation; do not count it twice.'),
        floorIds: z.array(z.string().min(1).max(120)).min(1).max(64),
    }).strict()).min(1).max(32),
}).strict();

/** Rectangular floor capacity only. Shared slabs are counted once, overlapping
 * slabs never inflate area. This does not certify enclosure, rooms or access. */
export function reviewPhysicalProgramme(scene: ArchitecturalScene) {
    const raw = (scene.architecturalPlan as {physicalProgramme?: unknown} | undefined)?.physicalProgramme;
    const parsed = physicalProgrammeSchema.safeParse(raw);
    if (!parsed.success) return {status:'unrecorded' as const, groups:[], issues:['Physical programme demand is unrecorded; room labels and floor totals cannot establish adequate accommodation.']};
    const g = sceneSpatialGeometry(scene);
    const issues: string[] = [];
    // Merge allocations sharing any floor, so partial/shared references cannot
    // repeatedly spend the same area on different suites or services.
    const groups: {allocations: typeof parsed.data.allocations; ids: Set<string>}[] = [];
    for (const allocation of parsed.data.allocations) {
        const matches = groups.filter(group => allocation.floorIds.some(id => group.ids.has(id)));
        const group = {allocations:[allocation], ids:new Set(allocation.floorIds)};
        for (const match of matches) {
            group.allocations.push(...match.allocations);
            for (const id of match.ids) group.ids.add(id);
            groups.splice(groups.indexOf(match),1);
        }
        groups.push(group);
    }
    const allFloors = [...new Set(parsed.data.allocations.flatMap(a=>a.floorIds))].flatMap(id=>{
        const e=g.map.get(id);
        if (!e || e.kind!=='plate') {issues.push(`Physical programme: ${id} is missing or is not a floor plate.`);return [];}
        return [e];
    });
    const overlapping = new Set<string>();
    function overlaps(a: SceneElement,b: SceneElement) {
        const pa=g.world(a),pb=g.world(b);
        if(Math.abs(g.top(a)-g.top(b))>.1) return false;
        return [pa[3],pb[3]].every(yaw=>[yaw,yaw+Math.PI/2].every(angle=>{
            const radius=(e:SceneElement,p:number[])=>Math.abs(Math.cos(p[3]-angle))*e.size[0]/2+Math.abs(Math.sin(p[3]-angle))*e.size[2]/2;
            return Math.abs((pa[0]-pb[0])*Math.cos(angle)-(pa[2]-pb[2])*Math.sin(angle))<radius(a,pa)+radius(b,pb)-.001;
        }));
    }
    allFloors.forEach((a,i)=>allFloors.slice(0,i).forEach(b=>{
        if(overlaps(a,b)){overlapping.add(a.id);overlapping.add(b.id);issues.push(`Physical programme: overlapping floor bounds ${a.id}/${b.id}; capacity unverified.`);}
    }));
    const measured = groups.map(group=>{
        const floors=allFloors.filter(f=>group.ids.has(f.id));
        const requiredM2=group.allocations.reduce((sum,a)=>sum+a.quantity*a.unitNetAreaM2+a.allowanceM2,0);
        const capacityM2=floors.length!==group.ids.size || floors.some(f=>f.geometry || overlapping.has(f.id)) ? null : floors.reduce((sum,f)=>sum+f.size[0]*f.size[2],0);
        const names=group.allocations.map(a=>a.name);
        if(capacityM2===null) issues.push(`Physical programme ${names.join(', ')}: actual-surface capacity unverified.`);
        else if(capacityM2+.01<requiredM2) issues.push(`Physical programme ${names.join(', ')}: ${requiredM2.toFixed(1)} m² required, only ${capacityM2.toFixed(1)} m² of gross floor evidence; programme underprovided.`);
        return {names,floorIds:[...group.ids],requiredM2,capacityM2,datums:[...new Set(floors.map(f=>g.top(f)))],status:capacityM2===null?'unverified':capacityM2+.01<requiredM2?'underprovided':'capacity-only'};
    });
    return {status:issues.length?'discrepancy' as const:'capacity-only' as const,propertyType:parsed.data.propertyType,groups:measured,issues,
        limitations:['Gross referenced floor capacity is an upper bound, not verified enclosed/net area. Enclosure, distinct rooms, connected wings, usable level access, site/eave clearance and exterior amenities require the existing construction and rendered reviews. Adequate area alone never certifies a completed property.']};
}

export const PHYSICAL_PROGRAMME_GUIDANCE = `
PHYSICAL PROGRAMME BEFORE GEOMETRY: First resolve property category, explicit accommodation and site constraints. Distinguish property value from construction budget; neither supplies a price-to-area formula. Return physicalProgramme {propertyType,basis,allocations:[{name,quantity,unitNetAreaM2,allowanceM2,floorIds}]}. Choose plausible room/suite net areas from this brief; include bathrooms/dressing in suite allowances or separate allocations, then living/dining/kitchen, services, circulation, storage and walls without double counting. A six-suite brief needs six times the chosen suite area plus the rest of the residence. Group repeated uses; exterior scope reserves capacity without requiring interior fit-out. Cite surviving occupied floor plate IDs, never roofs, terraces or water. Allocations may share a slab, but their demands sum and that slab is spent only once. Demand is a commitment, not a measurement: do not reduce room sizes to excuse an undersized shell.
Resolve total demand into footprint and levels within the available site before composing operations. Reconcile every allocation with actual dimensions and slab-top datums. If it does not fit, change proportions, arrangement or reachable levels while respecting constraints; disclose the exact unresolved requirement/capability rather than silently shrinking. Main living, private and service areas need intentional connections and actual doors/stairs; repeated detached boxes and oversized empty slabs do not establish a mansion. Prioritize (1) property type and scale (2) programme and composition (3) connected plausible construction (4) architectural identity (5) component refinement. All safety gates remain active. Check area against construction, then existing enclosure/access/amenity evidence and four rendered views; report failure separately from geometric acceptance. No preset size, level count or layout applies.
`;
