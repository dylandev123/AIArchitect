import { createdComponentSchema } from './creation/instance';
import { validateProposal, worldBounds } from './creation/geometry';
import { facadeOpeningSchema,validatePreciseOpenings,footprintSchema, footprintBounds, validateFootprint, footprintFacadeBays } from './footprint';
import { VILLA_LIMITS as L } from './limits';
import { z } from 'zod';
import { defaultVilla, STYLES, STYLE_RULES } from './design';
import { VILLA_TEXT_LIMITS } from './responseMetadata';
import { isApprovedBuilder } from './component-registry';
import { pavilionPlacementSchema, pavilionBounds, pavilionApproachBounds } from './experimental/curved-pavilion';
import { estateLandscapeSchema, landscapeBounds, landscapeFindings } from './estate-landscape';
import { operateWings, validateWings, wallContacts, wingBounds, type Wing, type WingComposition } from '@/app/dev/villa-playground/wing-composition';

const id = z.string().regex(/^[a-z][a-z0-9-]{0,47}$/);
const position = z.number().min(-L.position).max(L.position);
const rectangle = z.object({ x: position, z: position, width: z.number().min(.6).max(L.rectangle), depth: z.number().min(.6).max(L.rectangle) }).strict();
export const appearanceSchema = z.object({
  style: z.enum(STYLES), roof: z.enum(['flat', 'hip', 'gable']),
  exterior: z.enum(['ivory', 'sand', 'limestone', 'warm-stone']),
  glazing: z.enum(['panoramic', 'divided']), landscape: z.enum(['tropical', 'mediterranean']),
}).strict();
export const buildingWingSchema = z.object({
  roofRise:z.number().min(.5).max(8).optional(),
  facadeOpenings:z.array(z.object({face:z.enum(['front','rear','left','right']),level:z.number().int().min(0).max(1),openings:z.array(facadeOpeningSchema.omit({edge:true})).max(24)}).strict()).max(8).optional(),
  eave: z.number().min(.3).max(3).optional(),
  appearance: appearanceSchema.omit({landscape:true}).optional(),
  id, role: z.enum(['main', 'living', 'guest']), parentId: id.nullable(), detached: z.boolean(),
  x: position, z: position, width: z.number().min(4).max(L.wing), depth: z.number().min(4).max(L.wing),
  orientation: z.number().min(0).max(345).multipleOf(15),
  storeys: z.union([z.literal(1), z.literal(2)]), storeyHeight: z.number().min(3).max(L.storeyHeight),
  veranda: z.number().min(0).max(L.veranda), balcony: z.number().min(0).max(2.4),
}).strict();
const connectionSchema = z.object({ id, from: id, to: id, width: z.number().min(1.2).max(L.galleryWidth) }).strict();
const terraceSchema = rectangle.extend({ id, kind: z.enum(['terrace', 'courtyard']), timber: z.boolean() }).strict();
const poolSchema = rectangle.extend({ width: z.number().min(8).max(L.poolWidth), depth: z.number().min(4).max(L.poolDepth) }).strict();
export const gardenSchema = z.object({ x: z.number().min(-L.position).max(L.position), z: z.number().min(-L.position).max(L.position), width: z.number().min(12).max(L.garden), depth: z.number().min(12).max(L.garden) }).strict();
/** Stable library payload. Galleries remain derived by the existing wing builder. */
export const compositionSchema = z.object({
  version: z.literal(1), id, name: z.string().min(1).max(VILLA_TEXT_LIMITS.name).describe('Villa display title, 1–80 characters.'), character: z.string().min(1).max(VILLA_TEXT_LIMITS.character).describe('Villa display tagline, 1–160 characters.'),
  appearance: appearanceSchema, wings: z.array(buildingWingSchema).min(0).max(L.wings),
  connections: z.array(connectionSchema).max(L.galleries), terraces: z.array(terraceSchema).max(L.terraces),
  pool: poolSchema.nullable(), garden: gardenSchema,
  // Missing policy is a legacy fixed garden; only new Terra generation opts into derivation.
  siteMode: z.enum(['derived', 'fixed']).optional(),
  landscapeMargin: z.number().min(2).max(L.margin).optional(),
  components: z.array(pavilionPlacementSchema).max(L.pavilions).optional(),
  createdComponents: z.array(createdComponentSchema).max(2).optional(),
  forms: z.array(footprintSchema).max(3).optional(),
  experimentalForms: z.array(pavilionPlacementSchema).max(L.pavilions).optional(),
  estateLandscape: estateLandscapeSchema.optional(),
}).strict();
export type VillaComposition = z.infer<typeof compositionSchema>;
const wingChanges = buildingWingSchema.omit({ id: true }).partial().strict();
const landscapeChangesSchema = z.object({
  court: z.object(estateLandscapeSchema.shape.court.unwrap().shape).partial().strict().nullable().optional(),
  routes: z.array(z.discriminatedUnion('type', [
    z.object({type:z.literal('put'),route:estateLandscapeSchema.shape.routes.element}).strict(),
    z.object({type:z.literal('remove'),id}).strict(),
  ])).max(L.routes*2).optional(),
  beds: z.array(z.discriminatedUnion('type', [
    z.object({type:z.literal('put'),bed:estateLandscapeSchema.shape.beds.element}).strict(),
    z.object({type:z.literal('remove'),id}).strict(),
  ])).max(L.beds*2).optional(),
}).strict();
export const compositionPatchSchema = z.object({
  createdComponents: z.array(z.discriminatedUnion('type', [
    z.object({type:z.literal('adjust'),id,placement:z.object({x:position,z:position,orientation:z.number().min(0).max(359)}).partial().strict()}).strict(),
    z.object({type:z.literal('remove'),id}).strict(),
  ])).max(4).optional(),
  forms: z.array(z.discriminatedUnion('type', [z.object({type:z.literal('put'),form:footprintSchema}).strict(),z.object({type:z.literal('remove'),id}).strict()])).max(6).optional(),
  estateLandscapeChanges: landscapeChangesSchema.optional(),
  estateLandscape: estateLandscapeSchema.nullable().optional(),
  appearance: appearanceSchema.partial().strict().optional(),
  wings: z.array(z.discriminatedUnion('type', [
    z.object({ type: z.literal('add'), wing: buildingWingSchema }).strict(),
    z.object({ type: z.literal('adjust'), id, changes: wingChanges }).strict(),
    z.object({ type: z.literal('remove'), id }).strict(),
  ])).max(L.wings*2).optional(),
  connections: z.array(z.discriminatedUnion('type', [
    z.object({ type: z.literal('put'), connection: connectionSchema }).strict(),
    z.object({ type: z.literal('remove'), id }).strict(),
  ])).max(L.galleries*2).optional(),
  terraces: z.array(z.discriminatedUnion('type', [
    z.object({ type: z.literal('put'), terrace: terraceSchema }).strict(),
    z.object({ type: z.literal('remove'), id }).strict(),
  ])).max(L.terraces*2).optional(),
  components: z.array(z.discriminatedUnion('type', [
    z.object({ type: z.literal('put'), component: pavilionPlacementSchema }).strict(),
    z.object({ type: z.literal('adjust'), id, changes: pavilionPlacementSchema.omit({id:true,builder:true}).partial().strict() }).strict(),
    z.object({ type: z.literal('remove'), id }).strict(),
  ])).max(L.pavilions*2).optional(),
  landscapeMargin: z.number().min(2).max(L.margin).optional(),
  pool: poolSchema.partial().strict().nullable().optional(), garden: gardenSchema.partial().strict().optional(),
}).strict();
export type CompositionPatch = z.infer<typeof compositionPatchSchema>;
export class CompositionError extends Error {
  constructor(public findings: { path: string; message: string }[]) {
    super(findings.map(f => `${f.path}: ${f.message}`).join('\n'));
    this.name = 'CompositionError';
  }
}
function fail(path: string, message: string): never { throw new CompositionError([{ path, message }]); }
type Rect = z.infer<typeof rectangle>;
const bounds = (r: Rect) => ({ left: r.x-r.width/2, right: r.x+r.width/2, rear: r.z-r.depth/2, front: r.z+r.depth/2 });
const overlaps = (a: ReturnType<typeof bounds>, b: ReturnType<typeof bounds>, gap = 0) =>
  Math.min(a.right,b.right)-Math.max(a.left,b.left)>-gap+.01 && Math.min(a.front,b.front)-Math.max(a.rear,b.rear)>-gap+.01;
const faces = ['front','rear','left','right'] as const;
function touching(a: Wing, b: Wing) {
  return faces.flatMap(face => wallContacts(a,[a,b],face)).some(c => c.end-c.start >= 1.2);
}
/** Bounds of existing eaves and front veranda, in world coordinates. */
export function wingEnvelope(w: Wing, c: VillaComposition) {
  const appearance=w.appearance??c.appearance;
  const eave=w.role === 'gallery' ? .1 : w.eave!==undefined ? w.eave+.1 : appearance.roof==='flat' ? .7 : appearance.style==='caribbean' ? 1.15 : .65;
  const b = wingBounds({...w,width:w.width+2*eave,depth:w.depth+2*eave});
  const front = (w.veranda ?? 0)+.4;
  if(w.orientation===0) b.front=Math.max(b.front,wingBounds(w).front+front);
  if(w.orientation===90) b.right=Math.max(b.right,wingBounds(w).right+front);
  if(w.orientation===180) b.rear=Math.max(b.rear,wingBounds(w).rear-front);
  if(w.orientation===270) b.left=Math.min(b.left,wingBounds(w).left-front);
  if(w.orientation % 90) {
    const a=w.orientation*Math.PI/180;
    const veranda=wingBounds({...w,x:w.x+Math.sin(a)*(w.depth/2+front/2),z:w.z+Math.cos(a)*(w.depth/2+front/2),depth:front});
    b.left=Math.min(b.left,veranda.left);b.right=Math.max(b.right,veranda.right);
    b.rear=Math.min(b.rear,veranda.rear);b.front=Math.max(b.front,veranda.front);
  }
  return b;
}
const formsForCreation=(c:VillaComposition)=>[...(c.components ?? []).flatMap(p=>[pavilionBounds(p),pavilionApproachBounds(p)]),...(c.experimentalForms ?? []).map(pavilionBounds)];
function derive(c: VillaComposition): Wing[] {
  let wings: Wing[] = c.wings.map(w => ({...w}));
  try { validateWings(wings); }
  catch(e) { fail('wings', e instanceof Error ? e.message : 'Invalid wings.'); }
  for(const link of c.connections) {
    if(link.from===link.to) fail(`connections.${link.id}`, 'A gallery needs two different hosts.');
    try { wings=operateWings(wings,{type:'connect',...link}); }
    catch(e) { fail(`connections.${link.id}`, e instanceof Error ? e.message : 'Invalid gallery.'); }
  }
  try { validateWings(wings); }
  catch(e) { fail('wings', e instanceof Error ? e.message : 'Invalid wings.'); }
  return wings;
}
const poolEnvelope = (p: Rect) => {
  const b=bounds(p);
  return {left:b.left-2.2,right:b.right+3.8,rear:b.rear-1.2,front:b.front+2.2};
};
/** Includes eaves, verandas, derived galleries, paving, experimental roofs and pool furniture.
 * Derived planting/circulation margin beyond occupied envelopes; no geometry changes. */
export function deriveGarden(c: VillaComposition, wings = derive(c)) {
  const occupied = [...(c.createdComponents ?? []).map(i=>worldBounds(i.proposal,i.placement)), ...wings.map(w=>wingEnvelope(w,c)), ...c.terraces.map(bounds), ...(c.forms ?? []).map(footprintBounds),
    ...(c.pool ? [poolEnvelope(c.pool)] : []), ...(c.experimentalForms ?? []).map(pavilionBounds), ...(c.components ?? []).flatMap(p=>[pavilionBounds(p),pavilionApproachBounds(p)]),...(c.estateLandscape ? landscapeBounds(c.estateLandscape) : [])];
  const margin=c.landscapeMargin ?? 2;
  const left=Math.min(...occupied.map(b=>b.left))-margin, right=Math.max(...occupied.map(b=>b.right))+margin;
  const rear=Math.min(...occupied.map(b=>b.rear))-margin, front=Math.max(...occupied.map(b=>b.front))+margin;
  return gardenSchema.parse({x:(left+right)/2,z:(rear+front)/2,width:Math.max(12,right-left),depth:Math.max(12,front-rear)});
}
// Only known route/bed geometry conflicts may become editable drafts. Court and
// identity failures, schemas and every fixed-site check remain blocking.
function blockingLandscapeFindings(c: VillaComposition, findings: {path:string;message:string}[]) {
  const l=c.estateLandscape;
  return findings.filter(f=>!l || ![...l.routes.map(r=>`estateLandscape.routes.${r.id}`),
    ...l.beds.flatMap(b=>[`estateLandscape.${b.id}`,`estateLandscape.beds.${b.id}`])].includes(f.path));
}
export function validateComposition(input: unknown): VillaComposition {
  return validateCompositionPreview(input,false);
}
export function validateCompositionPreview(input: unknown, landscapePreview = true): VillaComposition {
  const c=compositionSchema.parse(input);
  if(!(STYLE_RULES[c.appearance.style].roofs as readonly string[]).includes(c.appearance.roof)) fail('appearance.roof',`${c.appearance.style} supports ${STYLE_RULES[c.appearance.style].roofs.join(', ')} roofs.`);
  const ids=[...c.wings,...c.connections,...c.terraces,...(c.experimentalForms ?? []),...(c.components ?? []),...(c.forms ?? []),...(c.createdComponents ?? [])].map(x=>x.id);
  if(new Set(ids).size!==ids.length) fail('ids','Wing, gallery and terrace IDs must be unique.');
  for(const p of c.components ?? []) if(!isApprovedBuilder(p.builder)) fail(`components.${p.id}.builder`, `Missing capability: ${p.builder} is not an approved versioned builder.`);
  const roots=c.wings.filter(w=>w.role==='main');
  if(c.wings.length ? (roots.length!==1 || roots[0].parentId!==null || roots[0].detached) : !(c.forms?.length)) fail('wings','Exactly one main wing must have parentId=null and detached=false.');
  for(const w of c.wings) {
    if(w.orientation % 90 && (!w.detached || w.role==='main')) fail(`wings.${w.id}.orientation`,'Non-cardinal wings must be detached secondary wings; shared walls and diagonal galleries are unsupported.');
    if(w.storeys===2 && w.width<8) fail(`wings.${w.id}.width`,'Two storeys require width >= 8 m for the existing stair.');
    if(w.balcony>Math.min(2.4,w.depth/3) || (w.storeys===1 && w.balcony>0)) fail(`wings.${w.id}.balcony`,'Balconies require two storeys and depth <= min(2.4 m, wing depth / 3).');
    const seen=new Set([w.id]); let child=w;
    while(child.parentId!==null) {
      const parent=c.wings.find(p=>p.id===child.parentId);
      if(!parent) fail(`wings.${child.id}.parentId`,'Parent must name an existing building wing.');
      if(seen.has(parent.id)) fail(`wings.${w.id}.parentId`,'Hierarchy cannot contain cycles.');
      seen.add(parent.id); child=parent;
    }
    if(child.id!==roots[0].id) fail(`wings.${w.id}.parentId`,'Every secondary wing needs a hierarchy path to the main wing.');
  }
  const wings=derive(c);
  // Facade bays and railings grow with perimeter and storeys, not site area.
  // Preserve the old worst-case wing workload while allowing larger individual volumes.
  const openingCount=c.wings.reduce((n,w)=>n+(w.facadeOpenings??[]).reduce((sum,f)=>sum+f.openings.length,0),0)+(c.forms??[]).reduce((n,f)=>n+(f.preciseOpenings?.length??0)+(f.levels??[]).reduce((sum,l)=>sum+(l.preciseOpenings?.length??0),0)+(f.upper?.preciseOpenings?.length??0)+(f.volumes??[]).reduce((sum,l)=>sum+(l.preciseOpenings?.length??0),0),0);
  if(openingCount>128)fail('preciseOpenings','Combined precise-opening budget is 128 per residence.');
  for(const w of c.wings){
    if(w.roofRise!==undefined&&(w.appearance??c.appearance).roof==='flat')fail(`wings.${w.id}.roofRise`,'Roof rise requires a pitched roof.');
    const seen=new Set<string>();
    for(const facade of w.facadeOpenings??[]){
      const key=`${facade.level}:${facade.face}`;
      if(seen.has(key)||facade.level>=w.storeys)fail(`wings.${w.id}.facadeOpenings`,'Each face/storey must exist and be unique.');seen.add(key);
      const width=['front','rear'].includes(facade.face)?w.width:w.depth-(facade.level?(w.balcony??0):0);
      validatePreciseOpenings({height:w.storeyHeight-.24,points:[{x:0,z:0},{x:width,z:0},{x:width,z:4},{x:0,z:4}],preciseOpenings:facade.openings.map(o=>({...o,edge:0}))});
      // Shared walls/gallery cuts remain the authoritative connection geometry.
      if(wallContacts(w,wings,facade.face).some(c=>c.height>facade.level*w.storeyHeight))fail(`wings.${w.id}.facadeOpenings`,'Precise facade must be exposed; connected wall cutouts are unsupported.');
    }
  }
  if(wings.reduce((sum,w)=>sum+2*(w.width+w.depth)*w.storeys,0)>L.facadeWork)
    fail('wings',`Combined facade workload exceeds the browser budget (${L.facadeWork} perimeter-metres × storeys). Reduce wing count, perimeter or storeys; site area is unrestricted within its schema.`);

  for(const w of c.wings) {
    const appearance=w.appearance??c.appearance;
    if(!STYLE_RULES[appearance.style].roofs.includes(appearance.roof as never)) fail(`wings.${w.id}.appearance.roof`,'Roof is incompatible with this wing style.');
    const parent=c.wings.find(p=>p.id===w.parentId);
    const links=c.connections.filter(l=>l.from===w.id || l.to===w.id);
    const neighbours=c.wings.filter(p=>p.id!==w.id && touching(w,p));
    if(w.detached && (links.length || neighbours.length)) fail(`wings.${w.id}.detached`,'Detached wings cannot touch buildings or have galleries.');
    if(parent && !w.detached && !touching(w,parent) && !links.some(l=>l.from===parent.id || l.to===parent.id)) fail(`wings.${w.id}.parentId`,'Connected wing must share >= 1.2 m of wall with its parent or use an aligned straight gallery.');
    if((w.appearance??c.appearance).roof!=='flat' && neighbours.length) fail(`wings.${w.id}`,'Pitched wings need separated roofs joined by a lower gallery; direct roof junctions are unsupported.');
  }
  // Non-contacting buildings must leave room for both roofs and their front verandas.
  for(let i=0;i<c.wings.length;i++) for(const b of c.wings.slice(i+1)) {
    const a=c.wings[i];
    if(!touching(a,b) && overlaps(wingEnvelope(a,c),wingEnvelope(b,c),.2)) fail(`wings.${a.id},${b.id}`,'Roof/veranda envelopes need at least 0.2 m separation. Move the wings or reduce verandas.');
  }
  for(const gallery of wings.filter(w=>w.connects)) {
    for(const hostId of gallery.connects!) {
      const host=wings.find(w=>w.id===hostId)!;
      if(gallery.storeyHeight+.3>host.storeys*host.storeyHeight) fail(`connections.${gallery.id}`,`Host ${hostId} must rise at least 0.3 m above the gallery (gallery height ${gallery.storeyHeight} m). Raise the host or remove the link.`);
    }
  }
  for(const gallery of wings.filter(w=>w.connects)) for(const other of c.wings) {
    if(!gallery.connects!.includes(other.id) && overlaps(wingEnvelope(gallery,c),wingEnvelope(other,c),.2)) fail(`connections.${gallery.id}`,`Gallery roof/veranda clearance intersects unrelated wing ${other.id}.`);
  }
  if(c.siteMode==='derived') c.garden=deriveGarden(c,wings);
  const site=bounds(c.garden);
  const formBounds=(c.forms ?? []).map(f=>{
    try { validateFootprint(f); } catch(e) { fail(`forms.${f.id}`,e instanceof Error?e.message:'Invalid footprint.'); }
    return footprintBounds(f);
  });
  if((c.forms ?? []).reduce((n,f)=>n+footprintFacadeBays(f),0)>300) fail('forms','Combined footprint facade budget is 300 bays.');
  for(const [i,f] of (c.forms ?? []).entries()) {
    const b=formBounds[i];
    if(b.left<site.left||b.right>site.right||b.rear<site.rear||b.front>site.front) fail(`forms.${f.id}`,'Footprint extends outside fixed site.');
    const obstacles=[...wings.map(w=>wingEnvelope(w,c)),...formBounds.filter((_,j)=>i!==j),...(c.components ?? []).flatMap(p=>[pavilionBounds(p),pavilionApproachBounds(p)]),...(c.experimentalForms ?? []).map(pavilionBounds),...(c.pool?[poolEnvelope(c.pool)]:[]),...c.terraces.filter(t=>t.kind==='courtyard').map(bounds)];
    if(obstacles.some(o=>overlaps(b,o,.2))) fail(`forms.${f.id}`,'Footprint needs clear roof envelopes, pool clearance and open courtyards; shared walls/galleries unsupported.');
    if(c.estateLandscape){const findings=landscapeFindings(c.estateLandscape,[b]);if(findings.length && (!landscapePreview || blockingLandscapeFindings(c,findings).length))throw new CompositionError(landscapePreview ? blockingLandscapeFindings(c,findings) : findings);}
  }
  const contained=(b: ReturnType<typeof bounds>)=>b.left>=site.left && b.right<=site.right && b.rear>=site.rear && b.front<=site.front;
  if(c.estateLandscape) {
    const findings=landscapeFindings(c.estateLandscape,wings.map(wingBounds),c.pool ? poolEnvelope(c.pool) : undefined);
    if(findings.length && (!landscapePreview || blockingLandscapeFindings(c,findings).length)) throw new CompositionError(landscapePreview ? blockingLandscapeFindings(c,findings) : findings);
    for(const b of landscapeBounds(c.estateLandscape)) if(!contained(b)) fail('estateLandscape','Circulation and its planting reserve extend outside the fixed site. Revise the landscape or explicitly change the boundary.');
    // Cars stay outside the roof/veranda envelope; walks may shelter below the eaves.
    const drives={...c.estateLandscape,routes:c.estateLandscape.routes.filter(r=>r.kind==='drive')};
    const clearance=landscapeFindings(drives,wings.map(w=>wingEnvelope(w,c)));
    if(clearance.length && (!landscapePreview || blockingLandscapeFindings(c,clearance).length)) throw new CompositionError(landscapePreview ? blockingLandscapeFindings(c,clearance) : clearance);
    for(const form of [...(c.components ?? []),...(c.experimentalForms ?? [])]) {
      const f=landscapeFindings(c.estateLandscape,[pavilionBounds(form)]);
      if(f.length && (!landscapePreview || blockingLandscapeFindings(c,f).length)) throw new CompositionError(landscapePreview ? blockingLandscapeFindings(c,f) : f);
    }
  }
  for(const instance of c.createdComponents ?? []) {
    const field=`createdComponents.${instance.id}`;
    try { validateProposal(instance.proposal); } catch(e) { fail(field,e instanceof Error?e.message:'Invalid creation geometry.'); }
    if(instance.candidateId!==instance.proposal.id) fail(field,'Candidate identity must match the geometry snapshot.');
    const b=worldBounds(instance.proposal,instance.placement);
    if(!contained(b)) fail(field,'Attachment gap: rotated canopy envelope extends outside the garden.');
    const obstacles=[...wings.map(w=>wingEnvelope(w,c)),...formBounds,
      ...formsForCreation(c),...(c.pool?[poolEnvelope(c.pool)]:[]),...c.terraces.filter(t=>t.kind==='courtyard').map(bounds),
      ...(c.createdComponents ?? []).filter(i=>i!==instance).map(i=>worldBounds(i.proposal,i.placement))];
    if(obstacles.some(o=>overlaps(b,o,.3))) fail(field,'Attachment gap: canopy needs 0.3 m clearance from buildings, pool clearance, courtyard and other components.');
    if(c.estateLandscape) {
      const findings=landscapeFindings(c.estateLandscape,[b]);
      if(findings.length && (!landscapePreview || blockingLandscapeFindings(c,findings).length)) throw new CompositionError(landscapePreview ? blockingLandscapeFindings(c,findings) : findings);
    }
  }
  for(const w of wings) if(!contained(wingEnvelope(w,c))) fail(`wings.${w.id}`,'Roof/veranda extends outside the garden. Respect the fixed site; revise the composition or explicitly change the site.');
  const forms=[...(c.experimentalForms ?? []),...(c.components ?? [])];
  for(const form of forms) {
    const field=(c.components ?? []).includes(form) ? 'components' : 'experimentalForms';
    const b=pavilionBounds(form);
    if(!contained(b)) fail(`${field}.${form.id}`,'Pavilion roof extends outside the fixed site.');
    for(const w of wings) if(overlaps(b,wingEnvelope(w,c),.2)) fail(`${field}.${form.id}`,`Pavilion needs 0.2 m clearance from ${w.id}.`);
    for(const other of forms) if(other!==form && overlaps(b,pavilionBounds(other),.2)) fail(`${field}.${form.id}`,'Pavilions need 0.2 m roof separation.');
    if(c.pool && overlaps(b,poolEnvelope(c.pool))) fail(`${field}.${form.id}`,'Pavilion intersects pool clearance/furniture.');
    if(field==='components') {
      const approach=pavilionApproachBounds(form);
      if(!contained(approach)) fail(`${field}.${form.id}`, 'Pavilion pedestrian approach extends outside the fixed site.');
      for(const obstacle of [...wings.map(w=>wingEnvelope(w,c)),...forms.filter(p=>p!==form).map(pavilionBounds),...(c.pool ? [poolEnvelope(c.pool)] : [])]) {
        if(overlaps(approach,obstacle)) fail(`${field}.${form.id}`, 'Pavilion needs a clear 2.4 m pedestrian approach; rotate or reposition it.');
      }
    }
    for(const t of c.terraces) if(t.kind==='courtyard' && overlaps(b,bounds(t))) fail(`${field}.${form.id}`,'Pavilion cannot occupy an open courtyard.');
  }
  for(const t of c.terraces) {
    if(!contained(bounds(t))) fail(`terraces.${t.id}`,'Terrace extends outside the garden.');
    if(t.kind==='courtyard') for(const w of wings) if(overlaps(bounds(t),wingBounds(w))) fail(`terraces.${t.id}`,`Courtyard must remain open; overlaps ${w.id}. Resize/reposition the courtyard or wings together.`);
    // Paving may run beneath raised building slabs, but must not hide water.
    if(c.pool && overlaps(bounds(t),bounds(c.pool),.15)) fail(`terraces.${t.id}`,'Paving must leave the pool opening plus 0.15 m clearance. Split surrounding decks into rectangles.');
  }
  if(c.pool) {
    // Existing pool furniture and spill channel occupy this surrounding outdoor zone.
    const outdoor=poolEnvelope(c.pool);
    if(!contained(outdoor)) fail('pool','Pool, coping, spill channel and furniture need room inside the garden (west 2.2, east 3.8, rear 1.2, front 2.2 m).');
    for(const w of wings) if(overlaps(outdoor,wingEnvelope(w,c))) fail('pool',`Pool clearance/furniture intersects ${w.id}'s roof or veranda. Reposition the pool or wing.`);
  }
  return c;
}
/** One transaction for manual and conversational edits. Validate only the final candidate. */
export function executeCompositionPatch(current: VillaComposition, input: unknown): VillaComposition {
  const p=compositionPatchSchema.parse(input), c=structuredClone(current);
  for(const op of p.forms ?? []) {
    c.forms ??=[]; const key=op.type==='put'?op.form.id:op.id,index=c.forms.findIndex(f=>f.id===key);
    if(op.type==='put'){if(index<0)c.forms.push(op.form);else c.forms[index]=op.form;}
    else {if(index<0)fail(`forms.${key}`,'Unknown footprint form.');c.forms.splice(index,1);}
  }
  if(p.estateLandscape !== undefined && p.estateLandscapeChanges) fail('estateLandscapeChanges','Use replacement or targeted landscape changes, never both.');
  if(p.estateLandscapeChanges) {
    const l=c.estateLandscape, patch=p.estateLandscapeChanges;
    if(!l) fail('estateLandscapeChanges','Create a complete estate landscape before editing its features.');
    if(patch.court===null) delete l.court;
    else if(patch.court) {
      if(l.court && patch.court.id && patch.court.id!==l.court.id) fail('estateLandscapeChanges.court.id','Preserve the court ID.');
      l.court=estateLandscapeSchema.shape.court.unwrap().parse({...l.court,...patch.court});
    }
    for(const op of patch.routes ?? []) {
      const key=op.type==='put'?op.route.id:op.id, index=l.routes.findIndex(r=>r.id===key);
      if(op.type==='put') { if(index<0) l.routes.push(op.route); else l.routes[index]=op.route; }
      else { if(index<0) fail('estateLandscapeChanges.routes','Unknown route: '+key); l.routes.splice(index,1); }
    }
    for(const op of patch.beds ?? []) {
      const key=op.type==='put'?op.bed.id:op.id, index=l.beds.findIndex(b=>b.id===key);
      if(op.type==='put') { if(index<0) l.beds.push(op.bed); else l.beds[index]=op.bed; }
      else { if(index<0) fail('estateLandscapeChanges.beds','Unknown bed: '+key); l.beds.splice(index,1); }
    }
  }
  if(p.estateLandscape===null) delete c.estateLandscape;
  else if(p.estateLandscape) c.estateLandscape=p.estateLandscape;
  if(p.appearance) Object.assign(c.appearance,p.appearance);
  for(const op of p.wings ?? []) {
    const index=c.wings.findIndex(w=>w.id===('wing' in op ? op.wing.id : op.id));
    if(op.type==='add') { if(index>=0) fail(`wings.${op.wing.id}`,'Wing already exists.'); c.wings.push(op.wing); }
    else {
      if(index<0) fail(`wings.${op.id}`,'Unknown wing.');
      if(op.type==='adjust') Object.assign(c.wings[index],op.changes);
      else { c.wings.splice(index,1); c.connections=c.connections.filter(l=>l.from!==op.id && l.to!==op.id); }
    }
  }
  for(const op of p.connections ?? []) {
    const key=op.type==='put' ? op.connection.id : op.id, index=c.connections.findIndex(l=>l.id===key);
    if(op.type==='put') { if(index<0) c.connections.push(op.connection); else c.connections[index]=op.connection; }
    else { if(index<0) fail(`connections.${key}`,'Unknown gallery.'); c.connections.splice(index,1); }
  }
  for(const op of p.terraces ?? []) {
    const key=op.type==='put' ? op.terrace.id : op.id, index=c.terraces.findIndex(t=>t.id===key);
    if(op.type==='put') { if(index<0) c.terraces.push(op.terrace); else c.terraces[index]=op.terrace; }
    else { if(index<0) fail(`terraces.${key}`,'Unknown terrace.'); c.terraces.splice(index,1); }
  }
  for(const op of p.components ?? []) {
    c.components ??= [];
    const key=op.type==='put' ? op.component.id : op.id, index=c.components.findIndex(p=>p.id===key);
    if(op.type==='put') { if(index<0) c.components.push(op.component); else c.components[index]=op.component; }
    else {
      if(index<0) fail(`components.${key}`, 'Unknown component.');
      if(op.type==='adjust') Object.assign(c.components[index],op.changes);
      else c.components.splice(index,1);
    }
  }
  if(p.landscapeMargin!==undefined) c.landscapeMargin=p.landscapeMargin;
  if(p.pool===null) c.pool=null;
  else if(p.pool) c.pool=c.pool ? {...c.pool,...p.pool} : poolSchema.parse(p.pool);
  if(p.garden) { Object.assign(c.garden,p.garden); c.siteMode='fixed'; }
  for(const op of p.createdComponents ?? []) {
    const index=c.createdComponents?.findIndex(i=>i.id===op.id) ?? -1;
    if(index<0) fail(`createdComponents.${op.id}`,'Unknown created component.');
    if(op.type==='remove') c.createdComponents!.splice(index,1);
    else Object.assign(c.createdComponents![index].placement,op.placement);
  }
  return validateCompositionPreview(c);
}
/** Adapt the contract to the existing R3F component library; never select a composition preset. */
export function buildComposition(input: VillaComposition): WingComposition {
  const c=validateCompositionPreview(input);
  return {authored:true,id:c.id,name:c.name,character:c.character,config:{...defaultVilla(c.appearance.style),...c.appearance},
    createdComponents:c.createdComponents,forms:c.forms,wings:derive(c),terraces:c.terraces,pool:c.pool ?? {x:0,z:0,width:10,depth:5,enabled:false},garden:c.garden,...(c.components ? {components:c.components} : {}),...(c.experimentalForms ? {experimentalForms:c.experimentalForms} : {}),...(c.estateLandscape ? {estateLandscape:landscapeAcceptance(c).rendered} : {})};
}
export function compositionFindings(error: unknown) {
  if(error instanceof CompositionError) return error.findings;
  if(error instanceof z.ZodError) return error.issues.map(i=>({path:i.path.join('.'),message:i.path.at(-1)==='builder' ? 'Missing capability: this versioned builder is unavailable. Use the approved versioned component registry; flexible enclosed forms use forms with footprint-building@1.' : i.message}));
  return [{path:'composition',message:'Unsupported composition.'}];
}

/** Authored features stay in config; only this renderer projection excludes drafts.
 * No positional correction is unambiguous without knowing the intended entrance.
 */
export function landscapeAcceptance(c: VillaComposition) {
  const l=c.estateLandscape;
  if(!l) return {unresolved:[],accessWarning:false,rendered:undefined};
  const wings=derive(c);
  const obstacles=[...(c.createdComponents ?? []).map(i=>worldBounds(i.proposal,i.placement)),...wings.map(wingBounds),...(c.forms ?? []).map(footprintBounds),
    ...(c.components ?? []).map(pavilionBounds),...(c.experimentalForms ?? []).map(pavilionBounds)];
  const findings=landscapeFindings(l,obstacles,c.pool ? poolEnvelope(c.pool) : undefined);
  findings.push(...landscapeFindings({...l,routes:l.routes.filter(r=>r.kind==='drive')},wings.map(w=>wingEnvelope(w,c))));
  const unresolved=Array.from(new Map(findings.map(f=>[f.path+'|'+f.message,f])).values());
  const blocked=(id:string)=>unresolved.some(f=>f.path===`estateLandscape.routes.${id}` || f.path===`estateLandscape.beds.${id}` || f.path===`estateLandscape.${id}`);
  // Conservatively treat every unresolved route as potentially serving access.
  // Generated route IDs are not a reliable semantic access classification.
  const accessWarning=l.routes.some(r=>blocked(r.id));
  return {unresolved,accessWarning,rendered:{...l,routes:l.routes.filter(r=>!blocked(r.id)),beds:l.beds.filter(b=>!blocked(b.id))}};
}
