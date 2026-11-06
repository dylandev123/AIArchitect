/**
 * Stage 4 and Stage 5 requests for automatic generation (design-intent contracts v2).
 * Every number is measured from the accepted checkpoint; the model never authors coordinates.
 * The Breezeway-era `exteriorRequest`/`siteDesignRequest` remain unchanged for historical replay.
 */
import {allRooms, blockRect} from './layout';
import {EAVE_M, PITCH_RANGE, exteriorWalls, maxGardenDoors, roofableBlocks, terraceBlocks} from './exterior';
import {outdoorIntentions} from './intentions';
import {POOL_SCALES} from './siteContract';
import {siteContext} from './siteGeneral';
import {wallTopOf, type HouseSpec} from './spec';
import {poolRequirement} from './requirements';
import {siteFeasibility} from './siteFeasibility';

export function exteriorRequestV2(brief: string, spec: HouseSpec): {system: string; prompt: string} {
  const rf = new Set(roofableBlocks(spec).map(b => b.id)), terr = terraceBlocks(spec).map(b => b.id);
  const blocks = spec.blocks.map(b => { const r = blockRect(b); return `${b.id}: level ${b.level}, ${b.w} x ${b.d} m, x ${r.x0}..${r.x1}, z ${r.z0}..${r.z1}; role: ${b.role}; top: ${rf.has(b.id) ? 'EXPOSED, needs a roof' : 'under an upper volume (roof terrace, no roof)'}${b.height ? `; height ${b.height}, wall top ${wallTopOf(b).toFixed(1)} m${b.rank ? `, rank ${b.rank}` : ''}` : ''}`; });
  // exteriorWalls labels every open space "covered"; say what each one actually is (v1 request text stays unchanged).
  const kinds = new Map(outdoorIntentions(spec).map(o => [o.id, o.kind]));
  const outside = (text: string) => text.replace(/^covered (\S+) \(open space\)$/, (_m, id: string) => kinds.get(id) === 'veranda' ? `veranda ${id} (to be covered)` : `${kinds.get(id) ?? 'open'} ${id} (open, not covered)`);
  const walls = exteriorWalls(spec).map(w => `${w.room} (${w.type}, level ${w.level}, block ${w.block}) side ${w.side}: ${w.free} m free; outside = ${outside(w.outside)}`);
  const rooms = allRooms(spec).map(r => `${r.id}: ${r.name} (${r.type}, level ${r.level}) ${(r.x1 - r.x0).toFixed(1)}x${(r.z1 - r.z0).toFixed(1)} m`);
  const open = outdoorIntentions(spec).map(o => `${o.id} (${o.kind}; host ${o.host}, side ${o.side}, ${o.w} x ${o.d} m): ${o.role}`);
  const d = spec.direction;
  const system = `You are the exterior architect of a staged house generator. Blocks, rooms, stairs and circulation are FIXED and accepted. Design only the exterior ARCHITECTURAL CHARACTER. Never give coordinates, window positions, roof geometry or wall changes: software measures the building and derives every position, eave, rise, opening, column and trim piece from your choices.
Follow the BRIEF and accepted direction; do not impose a Mediterranean or Caribbean villa on another style. Create a clear roof hierarchy (the primary mass reads as the crown; secondary masses lower or flatter), a legible entrance, facade depth, shadow and climate-appropriate shading.
Rules: north = -z, south = +z. Pitched roofs ${PITCH_RANGE[0]}-${PITCH_RANGE[1]} degrees. Eaves: ${Object.entries(EAVE_M).map(([k, v]) => `${k} = ${v} m`).join(', ')}; software reduces them where a neighbour or the site edge leaves less room. Every EXPOSED block needs exactly one roofs entry; give none for blocks under an upper volume. Roof finishes: terracotta / aged-terracotta (clay tiles), warm-bronze or slate-grey (standing-seam metal); flat roofs read as stone-capped parapet roofs.
Facades (only list non-default sides; default large-windows): glass-wall (floor-to-ceiling glazed bays), large-windows, punched (smaller, wall-dominant), solid. Generous glazing toward garden/veranda; calmer walls toward arrival and neighbours.
entrance.room must be the ground-level foyer on one of its EXTERIOR WALLS sides.${spec.construction === 'scale-1' ? ' canopy none/shallow (1.8 m)/deep (3.2 m)/grand (4.2 m deep, up to 8 m wide); court compact (5x4 m)/generous (7x6 m)/grand (formal arrival court 12-24 m wide, 12 m deep). Either grand option also opens a wide double entrance door (2.4 m; 2.8 m in a tall or double-height hall). Use grand only for a grand, luxury or estate brief; a modest house stays modest.' : ''} doors: garden = French doors from a ground room to the garden or a veranda; terrace = from an upper room onto a roof terrace (see "outside"). Only walls with at least 2.1 m free. At most ${maxGardenDoors(spec)} doors.
verandas: exactly one entry for every OPEN SPACE whose kind is veranda, and none for terrace or pool kinds (those stay open). Use [] when there is none.
blockFinishes per block: stucco (painted render), stone (natural stone walls) or timber-clad. Use stone/timber to articulate a base, tower or wing, not everywhere.
Identifiers: copy block, room and open-space IDs exactly as listed. Statement <=900 characters; intentions: up to 6 short sentences.`;
  const prompt = `BRIEF: ${brief}
SITE: ${spec.site.width} x ${spec.site.depth} m, flat. Storey height 3.4 m${spec.blocks.some(b => b.height) ? ' (block wall heights vary: see BLOCKS)' : ''}.
ACCEPTED DIRECTION: ${JSON.stringify({name: d.name, concept: d.concept, hierarchy: d.hierarchy, roofLanguage: d.roofLanguage, entrance: d.entrance, outdoorLiving: d.outdoorLiving, palette: d.palette, ...(d.vision ? {vision: d.vision} : {})})}${d.vision ? `
VISION CHECKS AT THIS STAGE: roof strategy ${d.vision.roofStrategy}; the primary volume's roof must read as the crown when the strategy is primary-crown-with-lower-wings; layered-roofs needs roof tops at clearly different heights; glass-pavilion needs a volume with at least two glass-wall facades. Volumes of different heights: a lower roof tucks under a taller volume's eave; keep lower roofs below the taller wall top.` : ''}
BLOCKS (fixed):
${blocks.join('\n')}
OPEN SPACES (fixed, not rooms): ${open.join('; ') || 'none'}
ROOF TERRACES: ${terr.join(', ') || 'none'}
ROOMS (solved, authoritative): ${rooms.join('; ')}
EXTERIOR WALLS (measured):
${walls.join('\n')}
Return the exterior design as JSON matching the schema.`;
  return {system, prompt};
}

/** Measured feasibility of each pool scale for each anchor; pool-independent access blockers are never attributed to the pool. */
export function poolFit(spec: HouseSpec, brief: string) {
  return siteFeasibility(spec, brief).options;
}

export function siteRequestV2(brief: string, spec: HouseSpec): {system: string; prompt: string} {
  const ctx = siteContext(spec), pools = ctx.pools, d = spec.direction;
  const system = `You are the landscape architect for an accepted flat-site house. Stages 1-4 are immutable. Design ONLY the outdoor composition through the strict design-intent schema. Never return coordinates or house changes: software measures the house and derives every position, size, crown envelope, route, terrace patch and furniture placement, and rejects choices that do not fit.
Pool scales (water, long x short): ${Object.entries(POOL_SCALES).map(([k, [a, b]]) => `${k} ${a}x${b} m (full deck ${a + 3.2}x${b + 4.4} m)`).join('; ')}; none = no pool. Use none ONLY if the brief does not ask for a pool and no pool intention is retained. Choose a scale marked "fits" in MEASURED POOL FIT for your anchor.
anchor: pool-intention (place the pool on the retained massing reservation; required when one exists), veranda (garden side of the main veranda), living-room (garden side of the living room). separation close = 0.6 m, promenade = 1.2 m from the house front.
terrace: paving finish, sunbeds none/two/four on the pool terrace, social none / dining (four-seat table on the veranda or terrace) / dining-and-lounge (adds a sofa group).
arrival: a straight drive from the property boundary to the measured entrance court; tree-avenue lines it with trees, garden-court keeps it open.
planting: trees palm, canopy (broad shade trees) or mixed; count four/six/eight/ten exact; stature medium (~6 m) or varied-tall (~7-8 m); beds layered (deeper, three planted boundary edges) or restrained (two); the arrival frontage gets a clipped hedge; lawn garden-panels (editable regions) or open-lawn.
Follow the BRIEF and direction (a Mediterranean garden suits canopy trees and restrained beds; a tropical one palms and layered beds). Statement <=900 characters, at most six intentions <=250 characters.`;
  const prompt = `BRIEF: ${brief}
ACCEPTED DIRECTION: ${JSON.stringify({name: d.name, outdoorLiving: d.outdoorLiving, landscape: d.landscape})}
SITE: ${spec.site.width} x ${spec.site.depth} m, flat, no terrain.
SWIMMING POOL: ${({required: 'required by the brief', excluded: 'excluded by the brief: choose scale none', optional: 'not mentioned; your decision'} as const)[poolRequirement(brief)]}
ENTRANCE: main door faces ${ctx.entranceSide ?? 'unknown'}; court ${ctx.court ? `${(ctx.court.x1 - ctx.court.x0).toFixed(1)} x ${(ctx.court.z1 - ctx.court.z0).toFixed(1)} m` : 'none'}.
VERANDAS: ${ctx.verandas.map(v => `${v.id} faces ${v.side}, ${(v.rect.x1 - v.rect.x0).toFixed(1)} x ${(v.rect.z1 - v.rect.z0).toFixed(1)} m`).join('; ') || 'none'}
RETAINED POOL INTENTION: ${pools.map(o => `${o.id} on ${o.host} ${o.side} side, conceptual ${o.w} x ${o.d} m: ${o.role}`).join('; ') || 'none'}
MEASURED POOL FIT: ${JSON.stringify(poolFit(spec, brief))}
Return the site design as JSON matching the schema.`;
  return {system, prompt};
}
