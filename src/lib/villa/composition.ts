import { z } from 'zod';
import { defaultVilla, STYLES, STYLE_RULES } from './design';
import { VILLA_TEXT_LIMITS } from './responseMetadata';
import { isApprovedBuilder } from './component-registry';
import { pavilionPlacementSchema, pavilionBounds, pavilionApproachBounds } from './experimental/curved-pavilion';
import { estateLandscapeSchema, landscapeBounds, landscapeFindings } from './estate-landscape';
import { operateWings, validateWings, wallContacts, wingBounds, type Wing, type WingComposition } from '@/app/dev/villa-playground/wing-composition';

const id = z.string().regex(/^[a-z][a-z0-9-]{0,47}$/);
const position = z.number().min(-200).max(200);
const rectangle = z.object({ x: position, z: position, width: z.number().min(.6).max(256), depth: z.number().min(.6).max(256) }).strict();
export const appearanceSchema = z.object({
  style: z.enum(STYLES), roof: z.enum(['flat', 'hip', 'gable']),
  exterior: z.enum(['ivory', 'sand', 'limestone', 'warm-stone']),
  glazing: z.enum(['panoramic', 'divided']), landscape: z.enum(['tropical', 'mediterranean']),
}).strict();
export const buildingWingSchema = z.object({
  id, role: z.enum(['main', 'living', 'guest']), parentId: id.nullable(), detached: z.boolean(),
  x: position, z: position, width: z.number().min(4).max(32), depth: z.number().min(4).max(32),
  orientation: z.number().min(0).max(345).multipleOf(15),
  storeys: z.union([z.literal(1), z.literal(2)]), storeyHeight: z.number().min(3).max(4.5),
  veranda: z.number().min(0).max(3), balcony: z.number().min(0).max(2.4),
}).strict();
const connectionSchema = z.object({ id, from: id, to: id, width: z.number().min(1.2).max(5) }).strict();
const terraceSchema = rectangle.extend({ id, kind: z.enum(['terrace', 'courtyard']), timber: z.boolean() }).strict();
const poolSchema = rectangle.extend({ width: z.number().min(8).max(32), depth: z.number().min(4).max(12) }).strict();
export const gardenSchema = z.object({ x: z.number().min(-256).max(256), z: z.number().min(-256).max(256), width: z.number().min(12).max(1024), depth: z.number().min(12).max(1024) }).strict();
/** Stable library payload. Galleries remain derived by the existing wing builder. */
export const compositionSchema = z.object({
  version: z.literal(1), id, name: z.string().min(1).max(VILLA_TEXT_LIMITS.name).describe('Villa display title, 1–80 characters.'), character: z.string().min(1).max(VILLA_TEXT_LIMITS.character).describe('Villa display tagline, 1–160 characters.'),
  appearance: appearanceSchema, wings: z.array(buildingWingSchema).min(1).max(8),
  connections: z.array(connectionSchema).max(8), terraces: z.array(terraceSchema).max(16),
  pool: poolSchema.nullable(), garden: gardenSchema,
  // Missing policy is a legacy fixed garden; only new Terra generation opts into derivation.
  siteMode: z.enum(['derived', 'fixed']).optional(),
  landscapeMargin: z.number().min(2).max(30).optional(),
  components: z.array(pavilionPlacementSchema).max(4).optional(),
  experimentalForms: z.array(pavilionPlacementSchema).max(4).optional(),
  estateLandscape: estateLandscapeSchema.optional(),
}).strict();
export type VillaComposition = z.infer<typeof compositionSchema>;
const wingChanges = buildingWingSchema.omit({ id: true }).partial().strict();
export const compositionPatchSchema = z.object({
  estateLandscape: estateLandscapeSchema.nullable().optional(),
  appearance: appearanceSchema.partial().strict().optional(),
  wings: z.array(z.discriminatedUnion('type', [
    z.object({ type: z.literal('add'), wing: buildingWingSchema }).strict(),
    z.object({ type: z.literal('adjust'), id, changes: wingChanges }).strict(),
    z.object({ type: z.literal('remove'), id }).strict(),
  ])).max(16).optional(),
  connections: z.array(z.discriminatedUnion('type', [
    z.object({ type: z.literal('put'), connection: connectionSchema }).strict(),
    z.object({ type: z.literal('remove'), id }).strict(),
  ])).max(16).optional(),
  terraces: z.array(z.discriminatedUnion('type', [
    z.object({ type: z.literal('put'), terrace: terraceSchema }).strict(),
    z.object({ type: z.literal('remove'), id }).strict(),
  ])).max(32).optional(),
  components: z.array(z.discriminatedUnion('type', [
    z.object({ type: z.literal('put'), component: pavilionPlacementSchema }).strict(),
    z.object({ type: z.literal('adjust'), id, changes: pavilionPlacementSchema.omit({id:true,builder:true}).partial().strict() }).strict(),
    z.object({ type: z.literal('remove'), id }).strict(),
  ])).max(8).optional(),
  landscapeMargin: z.number().min(2).max(30).optional(),
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
  const eave=w.role === 'gallery' ? .1 : c.appearance.roof==='flat' ? .7 : c.appearance.style==='caribbean' ? 1.15 : .65;
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
  const occupied = [...wings.map(w=>wingEnvelope(w,c)), ...c.terraces.map(bounds),
    ...(c.pool ? [poolEnvelope(c.pool)] : []), ...(c.experimentalForms ?? []).map(pavilionBounds), ...(c.components ?? []).flatMap(p=>[pavilionBounds(p),pavilionApproachBounds(p)]),...(c.estateLandscape ? landscapeBounds(c.estateLandscape) : [])];
  const margin=c.landscapeMargin ?? 2;
  const left=Math.min(...occupied.map(b=>b.left))-margin, right=Math.max(...occupied.map(b=>b.right))+margin;
  const rear=Math.min(...occupied.map(b=>b.rear))-margin, front=Math.max(...occupied.map(b=>b.front))+margin;
  return gardenSchema.parse({x:(left+right)/2,z:(rear+front)/2,width:Math.max(12,right-left),depth:Math.max(12,front-rear)});
}
export function validateComposition(input: unknown): VillaComposition {
  const c=compositionSchema.parse(input);
  if(!(STYLE_RULES[c.appearance.style].roofs as readonly string[]).includes(c.appearance.roof)) fail('appearance.roof',`${c.appearance.style} supports ${STYLE_RULES[c.appearance.style].roofs.join(', ')} roofs.`);
  const ids=[...c.wings,...c.connections,...c.terraces,...(c.experimentalForms ?? []),...(c.components ?? [])].map(x=>x.id);
  if(new Set(ids).size!==ids.length) fail('ids','Wing, gallery and terrace IDs must be unique.');
  for(const p of c.components ?? []) if(!isApprovedBuilder(p.builder)) fail(`components.${p.id}.builder`, `Missing capability: ${p.builder} is not an approved versioned builder.`);
  const roots=c.wings.filter(w=>w.role==='main');
  if(roots.length!==1 || roots[0].parentId!==null || roots[0].detached) fail('wings','Exactly one main wing must have parentId=null and detached=false.');
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
  for(const w of c.wings) {
    const parent=c.wings.find(p=>p.id===w.parentId);
    const links=c.connections.filter(l=>l.from===w.id || l.to===w.id);
    const neighbours=c.wings.filter(p=>p.id!==w.id && touching(w,p));
    if(w.detached && (links.length || neighbours.length)) fail(`wings.${w.id}.detached`,'Detached wings cannot touch buildings or have galleries.');
    if(parent && !w.detached && !touching(w,parent) && !links.some(l=>l.from===parent.id || l.to===parent.id)) fail(`wings.${w.id}.parentId`,'Connected wing must share >= 1.2 m of wall with its parent or use an aligned straight gallery.');
    if(c.appearance.roof!=='flat' && neighbours.length) fail(`wings.${w.id}`,'Pitched wings need separated roofs joined by a lower gallery; direct roof junctions are unsupported.');
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
  const contained=(b: ReturnType<typeof bounds>)=>b.left>=site.left && b.right<=site.right && b.rear>=site.rear && b.front<=site.front;
  if(c.estateLandscape) {
    const findings=landscapeFindings(c.estateLandscape,wings.map(wingBounds),c.pool ? poolEnvelope(c.pool) : undefined);
    if(findings.length) throw new CompositionError(findings);
    for(const b of landscapeBounds(c.estateLandscape)) if(!contained(b)) fail('estateLandscape','Circulation and its planting reserve extend outside the fixed site. Revise the landscape or explicitly change the boundary.');
    // Cars stay outside the roof/veranda envelope; walks may shelter below the eaves.
    const drives={...c.estateLandscape,routes:c.estateLandscape.routes.filter(r=>r.kind==='drive')};
    const clearance=landscapeFindings(drives,wings.map(w=>wingEnvelope(w,c)));
    if(clearance.length) throw new CompositionError(clearance);
    for(const form of [...(c.components ?? []),...(c.experimentalForms ?? [])]) {
      const f=landscapeFindings(c.estateLandscape,[pavilionBounds(form)]);
      if(f.length) throw new CompositionError(f);
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
  return validateComposition(c);
}
/** Adapt the contract to the existing R3F component library; never select a composition preset. */
export function buildComposition(input: VillaComposition): WingComposition {
  const c=validateComposition(input);
  return {authored:true,id:c.id,name:c.name,character:c.character,config:{...defaultVilla(c.appearance.style),...c.appearance},
    wings:derive(c),terraces:c.terraces,pool:c.pool ?? {x:0,z:0,width:10,depth:5,enabled:false},garden:c.garden,...(c.components ? {components:c.components} : {}),...(c.experimentalForms ? {experimentalForms:c.experimentalForms} : {}),...(c.estateLandscape ? {estateLandscape:c.estateLandscape} : {})};
}
export function compositionFindings(error: unknown) {
  if(error instanceof CompositionError) return error.findings;
  if(error instanceof z.ZodError) return error.issues.map(i=>({path:i.path.join('.'),message:i.path.at(-1)==='builder' ? 'Missing capability: this versioned builder is unavailable. Only the approved curved-pavilion@1 open lounge can be constructed; develop and validate a reusable component for other forms.' : i.message}));
  return [{path:'composition',message:'Unsupported composition.'}];
}
