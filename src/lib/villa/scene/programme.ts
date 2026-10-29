import { z } from 'zod';
import type { ArchitecturalScene } from './model';
import { sceneSpatialGeometry } from './spatial';

export const programmeSpaceSchema = z.object({
    name: z.string().min(1).max(80),
    zone: z.enum(['public', 'private', 'service', 'circulation', 'outdoor']),
    strategy: z.string().min(1).max(180),
    floorIds: z.array(z.string().min(1).max(120)).max(8),
    enclosureIds: z.array(z.string().min(1).max(120)).max(12),
    roofIds: z.array(z.string().min(1).max(120)).max(8),
    accessIds: z.array(z.string().min(1).max(120)).max(12),
    limitation: z.string().max(180),
}).strict();
export const programmeSchema = z.array(programmeSpaceSchema).min(1).max(24);

/** References expose commitments; they never create rooms or certify access. */
export function reviewProgramme(scene: ArchitecturalScene) {
    const plan = scene.architecturalPlan as {programme?: unknown; intendedSpaces?: unknown} | undefined;
    const parsed = programmeSchema.safeParse(plan?.programme);
    if (!parsed.success) return {status:'unrecorded', spaces:[], issues:['Programme construction commitments are unrecorded; narrative spaces do not establish built accommodation.']};
    const g = sceneSpatialGeometry(scene);
    const spaces = parsed.data.map(space => {
        const issues: string[] = [];
        const resolve = (ids: string[], kinds: string[], role: string) => ids.flatMap(id => {
            const e = g.map.get(id);
            if (!e || !kinds.includes(e.kind)) {issues.push(`${role}: ${id} missing or wrong kind`);return [];}
            return [e];
        });
        const floors = resolve(space.floorIds,space.zone==='circulation'?['plate','volume']:space.zone==='outdoor'?['plate','pavilion']:['plate'],'floor');
        const enclosure = resolve(space.enclosureIds,['wall','glazing','entrance'],'enclosure');
        const roofs = resolve(space.roofIds,space.zone==='outdoor'?['roof','plate','pavilion']:['roof','plate'],'roof');
        const access = resolve(space.accessIds,['plate','entrance','wall','volume'],'access').filter(e=>{
            if(e.kind==='wall' && (!e.opening || e.opening.glazed || e.opening.sill>.25)) {issues.push(`${e.id}: wall has no walking-height unglazed passage`);return false;}
            return true;
        });
        const enclosed = space.zone !== 'outdoor' && space.zone !== 'circulation';
        if (!floors.length) issues.push('no allocated floor evidence');
        if (!access.length) issues.push('no access construction evidence');
        if (enclosed && (!enclosure.length || !roofs.length)) issues.push('interior enclosure or overhead evidence missing');
        for (const floor of floors) {
            if (enclosed && !enclosure.some(e=>g.separation(e,floor)<=.25 && g.top(e)>g.top(floor)+.5 && g.bottom(e)<=g.top(floor)+.25)) issues.push(`${floor.id}: local enclosure evidence missing`);
            if (enclosed && !roofs.some(r=>g.contains(r,floor) && g.bottom(r)>=g.top(floor))) issues.push(`${floor.id}: full overhead coverage unverified`);
            if (!access.some(a=>a.id!==floor.id && g.separation(a,floor)<=.25 && g.top(a)>=g.top(floor)-.25 && g.bottom(a)<=g.top(floor)+.25)) issues.push(`${floor.id}: local access at walking datum unverified`);
        }
        const sharedWith = parsed.data.filter(other=>other!==space && other.floorIds.some(id=>space.floorIds.includes(id))).map(s=>s.name);
        if (sharedWith.length) issues.push(`shared floor allocation with ${sharedWith.join(', ')}; distinct rooms/areas unverified`);
        if (space.limitation) issues.push(space.limitation);
        return {...space, floorSurfaceM2:floors.reduce((sum,f)=>sum+f.size[0]*f.size[2],0), walkingDatums:floors.map(f=>f.kind==='pavilion'?g.world(f)[1]:g.top(f)), allocation:floors.map(f=>({id:f.id,world:g.world(f),size:f.size,walkingDatum:f.kind==='pavilion'?g.world(f)[1]:g.top(f)})), issues, status:issues.length?'missing-evidence':'referenced-geometry', verifiedComplete:false};
    });
    const names = new Set(spaces.map(s=>s.name));
    const omitted = Array.isArray(plan?.intendedSpaces) ? plan.intendedSpaces.filter(n=>typeof n==='string' && !names.has(n)).map(n=>`Programme: ${n} has no construction commitment.`) : [];
    return {status:'recorded', spaces, issues:[...omitted,...spaces.flatMap(s=>s.issues.map(i=>`Programme ${s.name}: ${i}`))]};
}
