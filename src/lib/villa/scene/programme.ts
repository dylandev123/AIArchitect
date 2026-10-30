import { z } from 'zod';
import type { ArchitecturalScene } from './model';
import { sceneSpatialGeometry } from './spatial';

export const programmeSpaceSchema = z.object({
    name: z.string().min(1).max(80),
    zone: z.enum(['public', 'private', 'service', 'circulation', 'outdoor']),
    strategy: z.string().min(1).max(180),
    // Optional for historical scenes and exterior capacity allocations. Roles refer to
    // actual final parts; neither labels nor provenance generate any geometry.
    requirement: z.object({origin:z.enum(['user-required','design-choice']),briefQuote:z.string().max(300)}).strict().optional(),
    purpose: z.enum(['bedroom','bathroom','kitchen','living','access','outdoor','other']).optional(),
    construction: z.object({
        partitionIds:z.array(z.string().min(1).max(120)).max(12),
        fitOutIds:z.array(z.string().min(1).max(120)).max(16),
        bathroomNames:z.array(z.string().min(1).max(80)).max(8),
        levelAccessIds:z.array(z.string().min(1).max(120)).max(40),
    }).strict().optional(),
    floorIds: z.array(z.string().min(1).max(120)).max(64),
    enclosureIds: z.array(z.string().min(1).max(120)).max(128),
    roofIds: z.array(z.string().min(1).max(120)).max(64),
    accessIds: z.array(z.string().min(1).max(120)).max(64).describe('Existing entrance IDs at actual passages, or supported stair/landing route IDs. Fixed glazing is not a door; never cite glazing IDs as access.'),
    limitation: z.string().max(180),
}).strict();
export const programmeSchema = z.array(programmeSpaceSchema).min(1).max(24);

/** Exact rectangle-union evidence in a shared yaw frame. Unlike requiring one
 * huge roof, this admits coordinated split roofs/upper slabs without bridging
 * uncovered gaps. Mixed-yaw unions remain conservatively unverified. */
function overheadCoverage(g: ReturnType<typeof sceneSpatialGeometry>, floor: ArchitecturalScene['elements'][number], roofs: ArchitecturalScene['elements']) {
    if (floor.geometry) return false; // Rectangle subtraction cannot prove profile coverage.
    const candidates=roofs.filter(r=>!r.geometry && g.bottom(r)>=g.top(floor));
    if(candidates.some(r=>g.contains(r,floor))) return true;
    const f=g.world(floor);
    let remaining=[[-floor.size[0]/2,floor.size[0]/2,-floor.size[2]/2,floor.size[2]/2]];
    for(const roof of candidates){
        const p=g.world(roof);
        if(Math.abs(Math.sin(p[3]-f[3]))>.00001) continue;
        const dx=p[0]-f[0],dz=p[2]-f[2],x=Math.cos(f[3])*dx-Math.sin(f[3])*dz,z=Math.sin(f[3])*dx+Math.cos(f[3])*dz;
        const overhang=roof.kind==='roof' && roof.roofForm && roof.roofForm!=='flat' ? roof.overhang??0 : 0;
        const w=roof.size[0]/2+overhang,d=roof.size[2]/2+overhang;
        remaining=remaining.flatMap(([x0,x1,z0,z1])=>{
            const a=Math.max(x0,x-w),b=Math.min(x1,x+w),c=Math.max(z0,z-d),e=Math.min(z1,z+d);
            if(a>=b || c>=e) return [[x0,x1,z0,z1]];
            return [[x0,a,z0,z1],[b,x1,z0,z1],[a,b,z0,c],[a,b,e,z1]].filter(r=>r[1]-r[0]>.00001 && r[3]-r[2]>.00001);
        });
    }
    return !remaining.length;
}

/** References expose commitments; they never create rooms or certify access. */
export function reviewProgramme(scene: ArchitecturalScene) {
    const plan = scene.architecturalPlan as {programme?: unknown; intendedSpaces?: unknown; constructionScope?: unknown} | undefined;
    const parsed = programmeSchema.safeParse(plan?.programme);
    if (!parsed.success) return {status:'unrecorded', spaces:[], issues:['Programme construction commitments are unrecorded; narrative spaces do not establish built accommodation.']};
    const exterior = plan?.constructionScope === 'exterior';
    const deferredInteriors: string[] = [];
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
            if(e.geometry){issues.push(`${e.id}: profile access requires actual-surface passage review`);return false;}
            if(e.kind==='wall' && (!e.opening || e.opening.glazed || e.opening.sill>.25)) {issues.push(`${e.id}: wall has no walking-height unglazed passage`);return false;}
            return true;
        });
        const enclosed = space.zone !== 'outdoor' && space.zone !== 'circulation';
        if (!floors.length) issues.push('no allocated floor evidence');
        if (!access.length) issues.push('no access construction evidence');
        if (enclosed && (!enclosure.length || !roofs.length)) issues.push('interior enclosure or overhead evidence missing');
        for (const floor of floors) {
            if (enclosed && !enclosure.some(e=>g.separation(e,floor)<=.25 && g.top(e)>g.top(floor)+.5 && g.bottom(e)<=g.top(floor)+.25)) issues.push(`${floor.id}: local enclosure evidence missing`);
            if (enclosed && !overheadCoverage(g,floor,roofs)) issues.push(`${floor.id}: full overhead coverage unverified`);
            if (!access.some(a=>a.id!==floor.id && g.separation(a,floor)<=.25 && g.top(a)>=g.top(floor)-.25 && g.bottom(a)<=g.top(floor)+.25)) issues.push(`${floor.id}: local access at walking datum unverified`);
        }
        if (space.requirement?.origin === 'user-required' && (!space.requirement.briefQuote ||
            !scene.generationBrief?.includes(space.requirement.briefQuote)))
            issues.push('required-space provenance is not an exact excerpt of the retained brief');
        const construction = space.construction;
        if (construction) {
            const partitions=resolve(construction.partitionIds,['wall'],'partition');
            const fitOut=resolve(construction.fitOutIds,['volume'],'fit-out');
            resolve(construction.levelAccessIds,['plate','volume','entrance','wall'],'level access');
            for (const e of [...partitions,...fitOut]) if (!floors.some(f=>g.separation(e,f)<=.25 &&
                g.bottom(e)>=g.top(f)-.25 && g.bottom(e)<g.top(f)+3)) issues.push(`${e.id}: interior construction is remote from allocated floors`);
            if (!exterior && space.purpose==='kitchen' && !fitOut.length) issues.push('kitchen has no physical fit-out evidence');
            if (!exterior && space.purpose==='bedroom') {
                if (!construction.bathroomNames.length) issues.push('bedroom bathroom provision is unrecorded');
                for (const name of construction.bathroomNames) {
                    const bathroom=parsed.data.find(s=>s.name===name && s.purpose==='bathroom');
                    if (!bathroom || !bathroom.enclosureIds.length || !bathroom.accessIds.length)
                        issues.push(`bathroom ${name} lacks a separate accommodation/access commitment`);
                }
            }
        } else if(!exterior && (space.purpose==='bedroom' || space.purpose==='kitchen')) issues.push('interior construction commitments are unrecorded');
        const sharedWith = parsed.data.filter(other=>other!==space && other.floorIds.some(id=>space.floorIds.includes(id))).map(s=>s.name);
        if (!exterior && sharedWith.length) issues.push(`shared floor allocation with ${sharedWith.join(', ')}; distinct rooms/areas unverified`);
        // Retain disclosures separately: deferred fit-out is expected, not an exterior defect.
        // Reference validity and physical exterior evidence above are still reviewed.
        if (exterior && enclosed) deferredInteriors.push(`${space.name}: interior subdivision and fit-out unverified; ${space.limitation || 'deferred'}`);
        if (space.limitation && (!exterior || !enclosed)) issues.push(space.limitation);
        return {...space, floorSurfaceM2:floors.reduce((sum,f)=>sum+f.size[0]*f.size[2],0), walkingDatums:floors.map(f=>f.kind==='pavilion'?g.world(f)[1]:g.top(f)), allocation:floors.map(f=>({id:f.id,world:g.world(f),size:f.size,walkingDatum:f.kind==='pavilion'?g.world(f)[1]:g.top(f)})), issues, status:issues.length?'missing-evidence':'referenced-geometry', verifiedComplete:false};
    });
    const names = new Set(spaces.map(s=>s.name));
    const omitted = Array.isArray(plan?.intendedSpaces) ? plan.intendedSpaces.filter(n=>typeof n==='string' && !names.has(n)).map(n=>`Programme: ${n} has no construction commitment.`) : [];
    return {status:'recorded', spaces, deferredInteriors, issues:[...omitted,...spaces.flatMap(s=>s.issues.map(i=>`Programme ${s.name}: ${i}`))]};
}
