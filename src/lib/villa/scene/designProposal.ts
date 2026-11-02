import { z } from 'zod';
import { elementFieldsSchema, validateScene, type ArchitecturalScene } from './model';
import { sceneSpatialGeometry } from './spatial';
import { spatialRelationshipSchema, spatialCoordinationFindings } from './spatial';

const text = z.string().min(1).max(1200);
const id = elementFieldsSchema.shape.id;
const refs = z.array(id).min(1).max(80);
const xyz = z.array(z.number().min(-10000).max(10000)).length(3);
/** Selected architectural geometry, not an operation stream or a layout engine.
 * Anchors use world coordinates even when construction later uses parent frames. */
export const designProposalSchema = z.object({
    version: z.literal('spatial-proposal-1'),
    concept: text,
    alternatives: z.array(z.object({ concept: text, tradeoff: text }).strict()).min(1).max(3),
    selectionReason: text,
    site: z.object({ assumptions: text, arrival: xyz, viewDirection: xyz, organization: text }).strict(),
    anchors: z.array(z.object({
        id, role: z.enum(['floor','enclosure','roof','entrance','circulation','facade','landscape','outdoor']),
        kind: elementFieldsSchema.shape.kind,
        centre: xyz, size: z.array(z.number().positive().max(10000)).length(3),
        yaw: z.number().min(-10000).max(10000),
        geometry: elementFieldsSchema.shape.geometry.unwrap().nullable(),
        material: elementFieldsSchema.shape.material.unwrap(),
        color: elementFieldsSchema.shape.color.unwrap().nullable(),
        panels: elementFieldsSchema.shape.panels.unwrap(),
        roofForm: elementFieldsSchema.shape.roofForm.unwrap().nullable(),
        overhang: elementFieldsSchema.shape.overhang.unwrap().nullable(),
        opening: elementFieldsSchema.shape.opening.unwrap().nullable(),
        designReason: text,
    }).strict()).min(1).max(300),
    spaces: z.array(z.object({
        id, name: text, use: text, environment:z.enum(['interior','outdoor']), floorId: id,
        centre: xyz.describe("World centre of the space box, not its walking datum. Centre Y = referenced floor top + space height / 2."), size: z.array(z.number().positive().max(10000)).length(3), yaw: z.number(),
        enclosureIds: z.array(id).max(80), roofIds: z.array(id).max(80).describe("Overhead roof or plate anchors; an upper floor plate can shelter a lower space. A composite pavilion is not an explicit roof surface."), accessIds: z.array(id).max(80),
        stage: z.enum(['planned-accommodation','allocated-capacity','constructed-space']),
        limitation: text,
    }).strict()).min(1).max(80),
    routes: z.array(z.object({ from: id, to: id, via: refs, description: text }).strict()).min(1).max(80),
    relationships: z.array(spatialRelationshipSchema).max(80),
    roofAndSection: text, facadeAndClimate: text, landscapeAndOutdoorLiving: text,
    limitations: z.array(text).max(30),
}).strict();
export type DesignProposal = z.infer<typeof designProposalSchema>;

export function validateDesignProposal(raw: unknown): DesignProposal {
    const p = designProposalSchema.parse(raw);
    const map = new Map(p.anchors.map(a=>[a.id,a]));
    if(map.size!==p.anchors.length) throw Error('Spatial proposal has duplicate anchor IDs.');
    const geometry:ArchitecturalScene=validateScene({version:'architectural-scene-1',name:'Selected proposal',elements:p.anchors.map(a=>({id:a.id,label:a.id,kind:a.kind,at:a.centre,size:a.size,rotation:a.yaw,material:a.material,panels:a.panels,
        ...(a.color?{color:a.color}:{}),...(a.geometry?{geometry:a.geometry}:{}),...(a.opening?{opening:a.opening}:{}),...(a.roofForm?{roofForm:a.roofForm}:{}),...(a.overhang!==null?{overhang:a.overhang}:{})}))});
    const relationIssues=spatialCoordinationFindings({...geometry,architecturalPlan:{spatialRelationships:p.relationships}}).filter(f=>f.code==='spatial-intent-mismatch');
    if(relationIssues.length)throw Error('Selected proposal has inconsistent spatial relationships: '+relationIssues.map(f=>f.message).join(' '));
    if(p.site.viewDirection.every(v=>v===0))throw Error('View direction must be nonzero.');
    const spaces = new Set(p.spaces.map(s=>s.id));
    if(spaces.size!==p.spaces.length) throw Error('Spatial proposal has duplicate space IDs.');
    const requireAnchor=(key:string)=>{if(!map.has(key))throw Error(`Spatial proposal references absent anchor ${key}.`);};
    for(const s of p.spaces){
        [s.floorId,...s.enclosureIds,...s.roofIds,...s.accessIds].forEach(requireAnchor);
        if(s.environment==='interior'&&(!s.enclosureIds.length||!s.roofIds.length||!s.accessIds.length))throw Error(`${s.id}: interior accommodation needs selected enclosure, roof and access anchors.`);
        if(map.get(s.floorId)?.kind!=='plate')throw Error(`${s.id}: selected floor must be a plate.`);
        if(s.enclosureIds.some(key=>!['wall','glazing','entrance'].includes(map.get(key)!.kind)))throw Error(`${s.id}: enclosure anchor has wrong kind.`);
        if(s.roofIds.some(key=>!['roof','plate'].includes(map.get(key)!.kind)))throw Error(`${s.id}: overhead anchor must be a roof or plate.`);
        if(s.accessIds.some(key=>map.get(key)!.kind!=='entrance'))throw Error(`${s.id}: access must identify an actual entrance, not fixed glazing.`);
    }
    for(const r of p.routes){
        if(!spaces.has(r.from)||!spaces.has(r.to))throw Error('Spatial route endpoints must be selected space IDs.');
        r.via.forEach(requireAnchor);
        if(!r.via.some(key=>['plate','volume'].includes(map.get(key)!.kind)))throw Error('Spatial routes need actual walking-surface or stair anchors.');
    }
    for(const r of p.relationships){requireAnchor(r.subject);requireAnchor(r.target);}
    const fit=reviewDesignFidelity(geometry,p);
    if(fit.issues.length)throw Error('Spatial proposal cannot preserve its own commitments: '+fit.issues.join(' '));
    return p;
}

/** Fidelity checks commitments, never taste, usability or engineering. Profile
 * bounds are insufficient to certify usable surfaces; that stays explicit. */
export function reviewDesignFidelity(scene: ArchitecturalScene, proposal: DesignProposal) {
    const g=sceneSpatialGeometry(scene);
    const issues:string[]=[];
    for(const a of proposal.anchors){
        const e=g.map.get(a.id);
        if(!e){issues.push(`Selected ${a.role} ${a.id} was omitted.`);continue;}
        const w=g.world(e);
        if(e.panels!==a.panels || (e.color??null)!==a.color || e.material!==a.material || (e.roofForm??null)!==a.roofForm || (e.overhang??null)!==a.overhang || JSON.stringify(e.opening??null)!==JSON.stringify(a.opening))
            issues.push(`${a.id}: selected material, roof form/eaves or opening changed.`);
        if(e.kind!==a.kind)issues.push(`${a.id}: selected ${a.kind} replaced by ${e.kind}.`);
        if(a.centre.some((v,i)=>Math.abs(v-w[i])>.02)||a.size.some((v,i)=>Math.abs(v-e.size[i])>.02)||Math.abs(Math.atan2(Math.sin(w[3]-a.yaw),Math.cos(w[3]-a.yaw)))>.002)
            issues.push(`${a.id}: construction changed selected world position, dimensions or orientation.`);
        if(JSON.stringify(a.geometry)!==JSON.stringify(e.geometry??null))issues.push(`${a.id}: selected profile was changed or replaced.`);
    }
    const spatialFindings=spatialCoordinationFindings({...scene,architecturalPlan:{spatialRelationships:proposal.relationships}}).filter(f=>f.code==='spatial-intent-mismatch'||f.code==='profile-spatial-review');
    issues.push(...spatialFindings.filter(f=>f.code==='spatial-intent-mismatch').map(f=>f.message));
    const spaceEvidence=proposal.spaces.map(s=>{
        const floor=g.map.get(s.floorId);
        if(!floor)return {id:s.id,status:'missing-floor'};
        const bounds=elementFieldsSchema.parse({id:`zone-${s.id}`.slice(0,80),label:s.name.slice(0,120),kind:'volume',at:s.centre,size:s.size,rotation:s.yaw});
        const contained=g.contains(floor,bounds);
        const aligned=Math.abs(s.centre[1]-s.size[1]/2-g.top(floor))<=.02;
        return {id:s.id,status:!contained||!aligned?'bounds-mismatch':floor.geometry?'profile-surface-unverified':'bounds-only'};
    });
    issues.push(...spaceEvidence.filter(s=>s.status==='bounds-mismatch'||s.status==='missing-floor').map(s=>`${s.id}: selected accommodation does not fit its referenced floor bounds or walking datum.`));
    const spatialGeometry=proposal.spaces.map(s=>({space:s,bounds:elementFieldsSchema.parse({id:`zone-${s.id}`.slice(0,80),label:s.name.slice(0,120),kind:'volume',at:s.centre,size:s.size,rotation:s.yaw})}));
    for(let i=0;i<spatialGeometry.length;i++)for(let j=0;j<i;j++){
        const a=spatialGeometry[i],b=spatialGeometry[j];
        if(a.space.stage!=='constructed-space'||b.space.stage!=='constructed-space')continue;
        if(g.separation(a.bounds,b.bounds)<-.02 && Math.min(g.top(a.bounds),g.top(b.bounds))-Math.max(g.bottom(a.bounds),g.bottom(b.bounds))>.02)
            issues.push(`${a.space.id}/${b.space.id}: selected constructed spaces overlap; distinct rooms are not evidenced.`);
    }
    return {spaceEvidence,spatialFindings,status:issues.length?'diverged' as const:'matched-anchors' as const,issues,
        accommodation:proposal.spaces.map(s=>({id:s.id,name:s.name,plannedStage:s.stage,
            evidence:s.stage==='allocated-capacity'?'allocated-capacity':s.stage==='planned-accommodation'?'planned-accommodation-unverified':'constructed-space-unverified',
            completedUsableRoom:false,limitation:s.limitation})),
        limitations:['Matching selected anchors does not verify enclosure, room independence, navigability, headroom, actual profile surfaces, architectural quality or completed usable rooms. Existing construction and architectural review still apply.']};
}

export const DESIGN_FIRST_INSTRUCTIONS = `
DESIGN FIRST — SPATIAL PROPOSAL ONLY. You are selecting architecture before any construction operations are requested. Return the spatial-proposal-1 contract, never operations. The construction-response instructions above apply only to the subsequent construction stage.
Consider brief-specific alternatives, then select one for spatial and architectural reasons. Resolve site organization, orientation, arrival, meaningful primary/subordinate masses, occupied floor levels, sections and roof composition, privacy/service relationships, connected routes, entrance identity, developed exposed elevations, climate, materials and composed outdoor/landscape spaces. Ambition must exist in proportions, voids, thresholds and relationships, not luxury adjectives or area alone. Compact briefs should retain compact dimensions. No mandatory style, shape, level count, symmetry or wing arrangement.
Use supported geometry to make the selected design concrete: anchors are principal floors, enclosure surfaces, roofs, doors, route surfaces, facade/shading and outdoor/landscape components with stable IDs, WORLD centres, full dimensions, yaw and explicit profile geometry or null. Include enough anchors to preserve each selected mass and important architectural decision. They are design commitments, not operation recipes; the next stage may add detail but cannot move, shrink, omit or replace them. A rectangular anchor cannot stand in for a selected curved surface. Explain meaningful roof sections and facade depth numerically through anchors. Include selected material, roofForm/overhang and opening explicitly (null when absent); no automatic engineering certification is implied.
Individuate each requested bedroom/suite in spaces with physically plausible bounds and specific floor, enclosure, roof and real entrance anchors, even in exterior scope. Fit-out may remain deferred. An undivided shared shell is allocated-capacity, never six constructed suites. Distinguish planned accommodation, capacity and constructed-space intent; completed usable rooms require later evidence. Avoid duplicated area allocations. Routes connect selected space IDs through actual dry floors, thresholds and stairs/landings; reserve voids/headroom and supports before adding upper floors. Do not avoid a justified level merely because it needs explicit stairs. Use direct parts/profiles when helpers impose the wrong composition; do not design around helper defaults.
Keep the flat-site policy and supported geometry. Identify specific unrepresentable features in limitations rather than quietly substituting boxes; editable planted volumes are supported, species simulation and accurate terrain/hydraulics are separate limitations. Reconcile dimensions and routes before returning. This is not a rendered review or a quality certificate.
`;
export function constructionFromProposal(proposal:DesignProposal){return `\nSELECTED SPATIAL PROPOSAL — CONSTRUCT THIS DESIGN: ${JSON.stringify(proposal)}\nReturn the normal scene operations response. Preserve every anchor ID, world centre, size, yaw and profile. Add the supported enclosure, openings, materials, roof forms, circulation, supports and details described by the proposal. Parent frames and optional helpers may be used only when they reproduce the selected geometry. Do not substitute simpler massing or omit accommodation, route or outdoor commitments to pass validation. If a selected feature cannot be represented, report its specific limitation in unsupported; the candidate will remain unapproved when committed geometry diverges. Default exterior scope defers fit-out, not the selected accommodation zones or circulation. Do not claim completed usable suites from capacity or labels. No alternative construction engine or automatic geometry repair is available.\n`;}
