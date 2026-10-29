import { programmeSchema, reviewProgramme } from './programme';
import { focusedConstructionFindings } from './focusedConstruction';
import { spatialRelationshipSchema, spatialCoordinationFindings } from './spatial';
import { z } from 'zod';
import { circulationFindings, type CompletionFinding } from './completion';
import type { ArchitecturalScene, SceneElement } from './model';
const text = z.string().min(1).max(1200);
const refs = z.array(z.string().min(1));
export const architecturalPlanSchema = z.object({
    scaleRationale: text.describe('Explain scale in relation to budget, brief and site; justify an unusually compact luxury residence.'),
    levels: z.number().int().positive(),
    enclosedAreaM2: z.number().positive(),
    arrivalAndCirculation: text,
    volumeHierarchy: text,
    relationshipsAndViews: text,
    roofFacadeAndMaterials: text,
    spaces: z.array(z.object({
        name: text, use: z.enum(['interior', 'outdoor']), level: z.number().int().nonnegative(),
        areaM2: z.number().positive(), floorIds: refs,
        enclosureIds: z.array(z.string()), roofIds: z.array(z.string()),
    }).strict()).min(1),
    commitments: z.array(z.object({
        description: text,
        kind: z.enum(['entrance', 'circulation', 'primary-volume', 'secondary-volume', 'roof', 'facade', 'terrace']),
        elementIds: refs,
    }).strict()).min(1),
}).strict();
/** New authoring contract keeps design intent without a parallel geometry ledger. */
export const designDecisionSchema = z.object({
    disposition: z.enum(['constructed', 'guidance', 'considered', 'unsupported']).optional(),
    knowledgeId: z.string().min(1).max(80), decision: z.string().min(1).max(300),
    elementIds: z.array(z.string().min(1).max(120)).max(12), limitation: z.string().max(300),
}).strict();
export const architecturalIntentSchema = architecturalPlanSchema.pick({scaleRationale:true,arrivalAndCirculation:true,volumeHierarchy:true,relationshipsAndViews:true,roofFacadeAndMaterials:true}).extend({intendedSpaces:z.array(text).min(1),programme:programmeSchema.describe('Return for every new Generate: selected accommodation mapped to final construction IDs; omit only for legacy compatibility.').optional(),spatialRelationships:z.array(spatialRelationshipSchema).max(40).optional(),designDecisions:z.array(designDecisionSchema).max(12).optional()}).strict();
export const providerArchitecturalPlanSchema = z.union([architecturalIntentSchema,architecturalPlanSchema]);
export type ArchitecturalPlan = z.infer<typeof architecturalPlanSchema>;

/** Evidence audit only; never repairs or generates geometry. Area is a conservative
 * floor-surface estimate, not a certified net internal area or room layout. */
export function auditArchitecturalPlan(scene: ArchitecturalScene, plan: ArchitecturalPlan) {
    const map = new Map(scene.elements.map(e => [e.id, e]));
    const issues: string[] = [];
    const used = new Set<string>();
    const levels = new Set<number>();
    const elevations = new Map<number, number>();
    let enclosedAreaM2 = 0;
    function world(e: SceneElement): number[] {
        if (!e.parent) return [...e.at, e.rotation];
        const p = world(map.get(e.parent)!);
        return [p[0]+Math.cos(p[3])*e.at[0]+Math.sin(p[3])*e.at[2], p[1]+e.at[1], p[2]-Math.sin(p[3])*e.at[0]+Math.cos(p[3])*e.at[2], p[3]+e.rotation];
    }
    const contains = (e: SceneElement, x: number, z: number, margin = .2) => {
        const p=world(e), dx=x-p[0], dz=z-p[2];
        return Math.abs(Math.cos(p[3])*dx-Math.sin(p[3])*dz)<=e.size[0]/2+margin &&
            Math.abs(Math.sin(p[3])*dx+Math.cos(p[3])*dz)<=e.size[2]/2+margin;
    };
    const interiorFloors = plan.spaces.filter(s=>s.use==='interior').flatMap(s=>s.floorIds).flatMap(id=>{
        const e=map.get(id);return e?.kind==='plate' ? [e] : [];
    });
    const lookup = (ids: string[], kinds: string[], name: string) => ids.flatMap(id => {
        const e = map.get(id);
        if (!e || !kinds.includes(e.kind)) { issues.push(`${name}: ${id} missing or wrong architectural kind.`); return []; }
        return [e];
    });
    for (let i=0;i<interiorFloors.length;i++) for (let j=0;j<i;j++) {
        const a=interiorFloors[i], b=interiorFloors[j];
        if (a.id===b.id) continue;
        const pa=world(a), pb=world(b);
        if (Math.abs(pa[1]+a.size[1]/2-pb[1]-b.size[1]/2)>.1) continue;
        const overlaps=[pa[3],pb[3]].every(yaw=>[yaw,yaw+Math.PI/2].every(angle=>{
            const radius=(e:SceneElement,p:number[])=>Math.abs(Math.cos(p[3]-angle))*e.size[0]/2+Math.abs(Math.sin(p[3]-angle))*e.size[2]/2;
            return Math.abs((pa[0]-pb[0])*Math.cos(angle)-(pa[2]-pb[2])*Math.sin(angle))<radius(a,pa)+radius(b,pb)-.01;
        }));
        if (overlaps) issues.push(`Enclosed floors ${a.id} and ${b.id} overlap at the same datum; area cannot be counted twice.`);
    }
    const measuredSpaces = plan.spaces.map(space => {
        const floors = lookup(space.floorIds, ['plate'], space.name);
        let areaM2 = 0;
        for (const floor of floors) {
            if (used.has(floor.id)) issues.push(`${space.name}: floor ${floor.id} counted more than once; split shared slabs into non-overlapping space plates.`);
            used.add(floor.id);
            areaM2 += floor.size[0]*floor.size[2];
            if (space.use === 'interior') {
                const y = world(floor)[1]+floor.size[1]/2;
                const previous = elevations.get(space.level);
                if (previous !== undefined && Math.abs(y-previous) > .5) issues.push(`${space.name}: floor datum disagrees with planned level ${space.level}.`);
                elevations.set(space.level,y);
            }
        }
        if (Math.abs(areaM2-space.areaM2) > space.areaM2*.15) issues.push(`${space.name}: measured floor ${areaM2.toFixed(1)} m² differs from planned ${space.areaM2} m².`);
        if (space.use === 'interior') {
            levels.add(space.level); enclosedAreaM2 += areaM2;
            const enclosure = lookup(space.enclosureIds, ['wall','glazing','entrance'], space.name);
            const roofs = lookup(space.roofIds, ['roof','plate'], space.name);
            if (!enclosure.length || !roofs.length) issues.push(`${space.name}: interior lacks enclosure or overhead coverage evidence.`);
            // Evidence must physically belong to this space, not a remote facade/roof.
            for (const floor of floors) {
                const f = world(floor);
                const nearby = (e: SceneElement) => {
                    const p = world(e), dx=p[0]-f[0], dz=p[2]-f[2];
                    const x=Math.cos(f[3])*dx-Math.sin(f[3])*dz, z=Math.sin(f[3])*dx+Math.cos(f[3])*dz;
                    return Math.abs(x)<=floor.size[0]/2+Math.hypot(e.size[0],e.size[2])/2+.2 && Math.abs(z)<=floor.size[2]/2+Math.hypot(e.size[0],e.size[2])/2+.2;
                };
                if (!roofs.some(e=>nearby(e) && world(e)[1]-e.size[1]/2>f[1]) || !enclosure.some(e=>nearby(e) && world(e)[1]>f[1])) issues.push(`${space.name}: floor ${floor.id} lacks local enclosure/roof evidence.`);
                const point = (x:number,z:number) => [f[0]+Math.cos(f[3])*x+Math.sin(f[3])*z,f[2]-Math.sin(f[3])*x+Math.cos(f[3])*z];
                const covered = (x:number,z:number) => roofs.some(e=>contains(e,x,z) && world(e)[1]-e.size[1]/2>f[1]);
                const edges = [0,1,2,3].every(edge => [.15,.5,.85].every(t=>{
                    const x=edge<2 ? (t-.5)*floor.size[0] : (edge===2?-1:1)*floor.size[0]/2;
                    const z=edge<2 ? (edge===0?-1:1)*floor.size[2]/2 : (t-.5)*floor.size[2];
                    const [px,pz]=point(x,z);
                    const adjacent=interiorFloors.some(other=>other.id!==floor.id && Math.abs(world(other)[1]-f[1])<.5 && contains(other,px,pz,.05));
                    return covered(px,pz) && (adjacent || enclosure.some(e=>contains(e,px,pz,.4) && world(e)[1]+e.size[1]/2>f[1]+.5 && world(e)[1]-e.size[1]/2<f[1]+.5));
                }));
                if (!edges) issues.push(`${space.name}: perimeter samples lack enclosure or overhead coverage; an open deck cannot count as enclosed area.`);

            }
        }
        return { name:space.name, areaM2, level:space.level, use:space.use };
    });
    if (levels.size !== plan.levels) issues.push(`Planned ${plan.levels} levels, measured ${levels.size}.`);
    const datums = [...elevations.values()];
    if (datums.some((y,i)=>datums.some((other,j)=>j<i && Math.abs(y-other)<.5))) issues.push('Distinct planned levels share the same floor datum.');
    if (Math.abs(enclosedAreaM2-plan.enclosedAreaM2)>plan.enclosedAreaM2*.15) issues.push(`Planned enclosed area ${plan.enclosedAreaM2} m²; measured floor evidence ${enclosedAreaM2.toFixed(1)} m².`);
    const kinds: Record<string,string[]> = {entrance:['entrance'],circulation:['plate'], 'primary-volume':['plate','wall','volume'], 'secondary-volume':['plate','wall','volume'],roof:['roof'],facade:['wall','glazing','screen'],terrace:['plate']};
    for (const c of plan.commitments) lookup(c.elementIds,kinds[c.kind],c.description);
    for (const required of ['entrance','circulation','primary-volume','roof','facade']) if (!plan.commitments.some(c=>c.kind===required)) issues.push(`Missing ${required} commitment.`);
    return { status:issues.length ? 'incomplete' as const : 'consistent' as const, enclosedAreaM2, levels:levels.size, spaces:measuredSpaces, issues,
        limitations:['Floor evidence estimates area; enclosure completeness, spatial quality and circulation usability require visual review.'] };
}
export const ARCHITECTURAL_PLANNING_INSTRUCTIONS = `
DESIGN INTENT: Return architecturalPlan with five brief sentences: scaleRationale (requirements versus assumptions; price is context, not an area formula), arrivalAndCirculation (public/private/service and level access), volumeHierarchy (primary/secondary allocation and datums), relationshipsAndViews (arrival and indoor/outdoor links), roofFacadeAndMaterials (identity, roof proportions and facade depth). intendedSpaces contains names only. No fixed programme template.
PROGRAMME BEFORE PARTS: Select accommodation before geometry: shared living, private/service rooms, entrances, level access and outdoors appropriate to the brief. Match its ambition. Return programme with at most 24 grouped entries {name,zone,strategy,floorIds,enclosureIds,roofIds,accessIds,limitation}. Match intendedSpaces names. strategy identifies wing, level and adjacency. IDs reference final elements, including expanded assemblies. Allocate meaningful floors, enclosure, overhead coverage and real access. Shared slabs do not prove distinct rooms; disclose shared/open-plan allocations. Upper wings require constructed stairs, landings and voids. Empty evidence means unbuilt: disclose in limitation and unsupported. Tie critical relationships to spatialRelationships. Check each allocation against final geometry; never manufacture checklist parts.
KNOWLEDGE: Up to twelve designDecisions {knowledgeId,decision,elementIds,limitation,disposition} cite final construction IDs; disclose omitted aspects. References are evidence, not proof. Geometry remains authoritative; programme discrepancies are review warnings, never automatic repairs.
ARCHITECTURAL COMPLETION RESPONSIBILITY: Use this construction checklist within ONE response: (1) composition/layout; (2) floors, rooms, circulation; (3) stairs and level connections; (4) walls, doors, windows; (5) roofs/all facades; (6) terraces, pools/outdoors; (7) detailing/finishing. Reserve stair runs, headroom, landings and slab voids before enclosure; manually compose plate/volume treads and guards. Trace arrival through usable openings to rooms, kitchen/service and every occupied level. An inaccessible upper residence is incomplete. Preserve intentional voids. Check door clearances on both sides. Complete selected pool bottom, perimeter, coping and dry access. Disclose unsupported hydraulics. Design blank facades.
COHERENT CONSTRUCTION: Coordinate datums, rooms, circulation and voids in X/Z; never overlap bedrooms or close promised double-height air. Use non-overlapping slabs; terraces, roofs and water are not enclosed area. Shared boundaries need one wall. Align enclosure bases to slab tops and heads to roof undersides. A railing is not a deck; water and coping are not a basin.
SHARED SPATIAL CONTRACT: Before details derive level datums from slab tops and occupied footprints from programme floors/enclosure. Check roofs against ALL levels: a complete lower roof can cross an upper suite. Explicitly split/replace it around occupied space. Reuse floor IDs for wings, zones and routes; operations alone own coordinates. Record critical spatialRelationships {subject,target,relation,clearance,reason} using construction IDs. Relations: adjacent-to (maximum gap), clear-of/set-back-from/above/below (minimum separation), connected-to, covering, inside, facing (local +Z toward target); otherwise clearance=0. Reserve open pool footprints before splitting terraces. Pavilion entrance faces +Z; connect a dry approach at its floor datum and allow 0.65 m roof/0.25 m floor extensions. Declare intentional roof coverage. Proximity and parentage do not prove access.

COORDINATES: Element at is its centre, including parent-local attachments. For a wall opening the panel's local Y centre is -wallHeight/2 + sill + panelHeight/2. Do not reuse a sill value as the panel centre. Glazed wall openings already render glass; do not add duplicate glazing over them. Fit openings and glazing to actual enclosure. Design every exterior edge and roof return, not only the presentation facade.
HONEST REVIEW: Compare programme with final geometry. Complete supported omissions or disclose them in unsupported. Prose never establishes rooms, access, shelter or pools. Support, attachment and editing checks remain strict.

`;

/** Scene-derived inventory. Plan references never change kinds or manufacture parts.
 * Totals describe modelled surfaces, not certified enclosed/net residential area. */
export function reviewSceneArchitecture(scene: ArchitecturalScene) {
    const parsed = architecturalPlanSchema.safeParse(scene.architecturalPlan);
    const plan = parsed.success ? parsed.data : undefined;
    const intent = architecturalIntentSchema.safeParse(scene.architecturalPlan);
    const original = plan ? auditArchitecturalPlan(scene, plan) : undefined;
    const programme = reviewProgramme(scene);
    const issues = [...(original?.issues ?? []), ...programme.issues];
    const map = new Map(scene.elements.map(e => [e.id,e]));
    const world = (e: SceneElement): number[] => {
        if (!e.parent) return [...e.at,e.rotation];
        const p = world(map.get(e.parent)!);
        return [p[0]+Math.cos(p[3])*e.at[0]+Math.sin(p[3])*e.at[2],p[1]+e.at[1],p[2]-Math.sin(p[3])*e.at[0]+Math.cos(p[3])*e.at[2],p[3]+e.rotation];
    };
    const designDecisions = intent.success ? (intent.data.designDecisions ?? []).map(d => {
        const existing = d.elementIds.filter(id => scene.elements.some(e => e.id === id));
        const missing = d.elementIds.filter(id => !scene.elements.some(e => e.id === id));
        if (d.disposition && d.disposition !== 'constructed') return {...d, existingElementIds:[], missingElementIds:[], missingKinds:[], detachedElementIds:[], status:d.disposition, verifiedComplete:false};
        if (!existing.length || missing.length) issues.push(`Knowledge decision ${d.knowledgeId}: ${d.decision}; ${missing.length ? 'missing elements '+missing.join(', ') : 'no constructed element evidence'}.`);
        const requirement=scene.knowledgeEvidence?.find(e=>e.id===d.knowledgeId);
        const referenced=scene.elements.filter(e=>existing.includes(e.id));
        const missingKinds=requirement?.requiredKinds.filter(kind=>!referenced.some(e=>e.kind===kind)) ?? [];
        const anchors=referenced.filter(e=>e.kind==='plate');
        const detached=anchors.length ? referenced.filter(e=>e.kind!=='plate' && !anchors.some(f=>{
            const a=world(f),b=world(e);
            return Math.hypot(a[0]-b[0],a[2]-b[2]) <= (Math.hypot(f.size[0],f.size[2])+Math.hypot(e.size[0],e.size[2]))/2+.5;
        })).map(e=>e.id) : [];
        if(detached.length) issues.push(`Knowledge decision ${d.knowledgeId}: evidence ${detached.join(', ')} is remote from referenced floors; feature relationship unverified.`);
        if(scene.knowledgeEvidence && !requirement) issues.push(`Knowledge decision ${d.knowledgeId}: not in retrieved knowledge evidence; applicability unverified.`);
        if(missingKinds.length) issues.push(`Knowledge decision ${d.knowledgeId}: referenced geometry lacks required kinds ${missingKinds.join(', ')}; descriptions are not construction.`);
        if (d.limitation) issues.push(`Knowledge decision ${d.knowledgeId}: ${d.limitation}`);
        return {...d, existingElementIds:existing, missingElementIds:missing, missingKinds, detachedElementIds:detached, status:!existing.length || missing.length || missingKinds.length || detached.length ? 'missing-evidence' : 'referenced-geometry', verifiedComplete:false};
    }) : [];

    // Cover every retrieved selection, including uncited entries. A complete set
    // of primitive kinds is necessary evidence, never proof of feature quality.
    const knowledgeUse = (scene.knowledgeEvidence ?? []).map(requirement => {
        const decisions = designDecisions.filter(d => d.knowledgeId === requirement.id);
        const constructed = decisions.filter(d => !d.disposition || d.disposition === 'constructed');
        const supported = constructed.filter(d => d.status === 'referenced-geometry');
        const status = supported.length ? 'construction-evidence'
            : constructed.length ? (constructed.some(d => d.existingElementIds.length) ? 'partial-construction' : 'selected-missing')
            : decisions.some(d => d.disposition === 'unsupported') ? 'unsupported'
            : decisions.some(d => d.disposition === 'guidance') ? 'guidance'
            : decisions.length ? 'considered' : 'selected-missing';
        if (status === 'selected-missing') issues.push(`Retrieved knowledge ${requirement.id}: selected but no construction or explicit disposition evidence.`);
        return {id:requirement.id, version:requirement.version, status,
            elementIds:[...new Set(constructed.flatMap(d => d.existingElementIds))], verifiedComplete:false};
    });

    if (scene.architecturalPlan && !parsed.success && !intent.success) issues.push('Stored design intent is malformed; review the original metadata. Geometry remains authoritative.');
    const surfaces = scene.elements.filter(e=>e.kind==='plate' || e.kind==='water').map(e=>({id:e.id,kind:e.kind,areaM2:e.size[0]*e.size[2],walkingDatum:world(e)[1]+(e.kind==='plate'?e.size[1]/2:0)}));
    const plates=scene.elements.filter(e=>e.kind==='plate');
    const overlaps: string[][]=[];
    for(let i=0;i<plates.length;i++) for(let j=0;j<i;j++) {
        const a=plates[i],b=plates[j],pa=world(a),pb=world(b);
        if(Math.abs(pa[1]+a.size[1]/2-pb[1]-b.size[1]/2)>.01) continue;
        const intersect=[pa[3],pb[3]].every(yaw=>[yaw,yaw+Math.PI/2].every(angle=>{
            const radius=(e:SceneElement,p:number[])=>Math.abs(Math.cos(p[3]-angle))*e.size[0]/2+Math.abs(Math.sin(p[3]-angle))*e.size[2]/2;
            return Math.abs((pa[0]-pb[0])*Math.cos(angle)-(pa[2]-pb[2])*Math.sin(angle))<radius(a,pa)+radius(b,pb)-.001;
        }));
        if(intersect) {overlaps.push([a.id,b.id]);issues.push(`Floor surfaces ${a.id} and ${b.id} overlap at the same datum; summed usable area is withheld.`);}
    }
    if(!scene.elements.some(e=>e.kind==='roof' || e.kind==='pavilion')) issues.push('No roof elements are modelled; overhead coverage is unverified.');
    if(!scene.elements.some(e=>e.kind==='entrance')) issues.push('No entrance element is modelled; entrance completeness is unverified.');
    const kindCounts = Object.fromEntries([...new Set(scene.elements.map(e=>e.kind))].map(kind=>[kind,scene.elements.filter(e=>e.kind===kind).length]));
    // Recheck space coverage using actual nearby construction rather than plan IDs.
    // These remain architectural warnings: no enclosure or roof is fabricated.
    if (plan) {
        const geometryPlan = {...plan,spaces:plan.spaces.map(s=>({...s,
            floorIds:[...new Set(s.floorIds.filter(id=>map.get(id)?.kind==='plate'))],
            enclosureIds:scene.elements.filter(e=>['wall','glazing','entrance'].includes(e.kind)).map(e=>e.id),
            roofIds:scene.elements.filter(e=>e.kind==='roof').map(e=>e.id),
        }))};
        issues.push(...auditArchitecturalPlan(scene,geometryPlan).issues.filter(i=>/perimeter samples|lacks local|interior lacks/.test(i)).map(i=>'Construction review: '+i));
    } else { if(intent.success) issues.push(...intent.data.intendedSpaces.map(name=>`Requested space: ${name}. Geometry inventory is available; enclosure, allocation and completeness require review.`)); issues.push('Space allocation and requested-space completeness are unverified; no detailed plan evidence is available.'); }
    for (const e of scene.elements) {
        if (e.kind==='water') {
            const p=world(e);
            const basin = scene.elements.some(b=>['plate','volume'].includes(b.kind) && world(b)[1]+b.size[1]/2 < p[1] &&
                Math.hypot(world(b)[0]-p[0],world(b)[2]-p[2])<.2 && b.size[0]>=e.size[0] && b.size[2]>=e.size[2]);
            // Sample all four water edges in world space. A bottom alone does
            // not establish a basin; these are necessary geometric checks only.
            const bounded=[0,1,2,3].every(edge=>[.15,.5,.85].every(t=>{
                const x=edge<2?(t-.5)*e.size[0]:(edge===2?-1:1)*e.size[0]/2;
                const z=edge<2?(edge===0?-1:1)*e.size[2]/2:(t-.5)*e.size[2];
                const wx=p[0]+Math.cos(p[3])*x+Math.sin(p[3])*z,wz=p[2]-Math.sin(p[3])*x+Math.cos(p[3])*z;
                return scene.elements.some(w=>{
                    if(w.kind!=='wall'&&w.kind!=='volume')return false;
                    const q=world(w),dx=wx-q[0],dz=wz-q[2];
                    return Math.abs(Math.cos(q[3])*dx-Math.sin(q[3])*dz)<=w.size[0]/2+.2 &&
                        Math.abs(Math.sin(q[3])*dx+Math.cos(q[3])*dz)<=w.size[2]/2+.2 &&
                        q[1]-w.size[1]/2<p[1] && q[1]+w.size[1]/2>=p[1];
                });
            }));
            if(!bounded) issues.push(`${e.id}: water perimeter lacks local basin wall evidence; pool construction is incomplete.`);
            if (!basin) issues.push(`${e.id}: water surface exists, but a complete basin bottom is not evidenced; coping alone is not a constructed pool.`);
        }
        if ((e.kind==='entrance' || e.kind==='glazing') && e.parent) {
            const host=map.get(e.parent)!;
            if (e.kind==='entrance' && host.kind==='wall' && !host.opening) issues.push(`${e.id}: door host ${host.id} has no wall opening; a door panel does not cut access.`);
            if (host.kind==='wall' && host.opening) {
                if (e.kind==='glazing' && host.opening.glazed) issues.push(`${e.id}: ${host.id}'s glazed opening already renders glass; the extra attached panel duplicates glazing evidence and needs review.`);
                const o=host.opening, expected=-host.size[1]/2+o.sill+o.height/2;
                if (e.kind==='entrance' && (o.glazed || Math.abs(Math.sin(e.rotation))>.01 ||
                    Math.abs(e.at[2])>(host.size[2]+e.size[2])/2+.05 ||
                    Math.abs(e.at[0]-o.x)+e.size[0]/2>o.width/2+.05 || Math.abs(e.at[1]-expected)+e.size[1]/2>o.height/2+.05))
                    issues.push(`${e.id}: attached door does not fit an unglazed host opening in the rendered wall plane; access is unverified.`);

                if (e.kind==='entrance' && Math.abs(e.at[1]-e.size[1]/2-(-host.size[1]/2+o.sill))>.05)
                    issues.push(`${e.id}: door sill does not align with ${host.id}'s opening sill; review vertical placement.`);
                // Smaller doors can be sill-aligned within a larger portal. Centre alignment
                // is only required for panels intended to fill the opening.
                if ((Math.abs(e.size[1]-o.height)<.05 && Math.abs(e.at[1]-expected)>.05) ||
                    (Math.abs(e.size[0]-o.width)<.05 && Math.abs(e.at[0]-o.x)>.05))
                    issues.push(`${e.id}: attached panel centre does not align with ${host.id}'s opening (expected local Y ${expected.toFixed(3)}, actual ${e.at[1]}). Review centre versus sill coordinates; geometry was preserved.`);
            }
        }
    }
    const circulation = [...circulationFindings(scene), ...focusedConstructionFindings(scene), ...spatialCoordinationFindings(scene)];
    issues.push(...circulation.map(f=>f.message));
    const uniqueIssues=[...new Set(issues)];
    const findings: CompletionFinding[] = uniqueIssues.map(message => circulation.find(f=>f.message===message) ?? ({
        category: /door host .*no wall opening|door does not fit|door sill does not align|panel centre does not align|duplicates glazing/.test(message) ? 'confirmed-technical-defect'
            : /not represented|unsupported|not verified|certification|compliance/.test(message) ? 'unsupported-capability' : 'likely-architectural-incompleteness',
        code: /water perimeter|basin bottom/.test(message) ? 'pool-evidence-missing' : /Knowledge decision|Retrieved knowledge/.test(message) ? 'feature-evidence' : 'architectural-review',
        elementIds: scene.elements.filter(e=>message.includes(e.id)).map(e=>e.id), message,
    }));
    return {status:uniqueIssues.length?'incomplete' as const:'consistent' as const,issues:uniqueIssues,findings,
        originalPlanAudit:original,programme,designDecisions,knowledgeUse,geometry:{kindCounts,surfaces,overlaps,walkingDatums:[...new Set(surfaces.filter(s=>s.kind==='plate').map(s=>Math.round(s.walkingDatum*1000)/1000))],plateSurfaceAreaM2:overlaps.length?null:surfaces.filter(s=>s.kind==='plate').reduce((n,s)=>n+s.areaM2,0),waterSurfaceAreaM2:surfaces.filter(s=>s.kind==='water').reduce((n,s)=>n+s.areaM2,0)},
        limitations:['Surface areas are per physical element; overlapping surfaces are not additional usable area. Enclosed area, requested-space completeness, pool construction and circulation require architectural review. A renderable model is not a completed building.']};
}
