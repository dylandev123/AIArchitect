import {generateText, Output, type LanguageModel} from 'ai';
import {getAiModel, getAiModelId} from '@/lib/ai/model';
import {DEFAULT_PRICING} from '@/lib/ai/pricing';
import {blockRect, allRooms} from './layout';
import {EAVE_M, PITCH_RANGE, exteriorDesignSchema, exteriorWalls, roofableBlocks, roomPlanWarnings, terraceBlocks, type ExteriorDesign} from './exterior';
import {DesignerError, type Usage} from './pipeline';
import type {HouseSpec} from './spec';

/** The exact request Terra receives for Stage 4. Every number in it is measured from the accepted Stage 2/3 checkpoint. */
export function exteriorRequest(brief: string, spec: HouseSpec, requestedAreas: Record<string, number> = {}): {system: string; prompt: string} {
  const rf = new Set(roofableBlocks(spec).map(b => b.id)), terr = terraceBlocks(spec).map(b => b.id);
  const blocks = spec.blocks.map(b => { const r = blockRect(b); return `${b.id}: level ${b.level} (${b.level ? 'upper storey' : 'ground'}), ${b.w} x ${b.d} m, x ${r.x0}..${r.x1}, z ${r.z0}..${r.z1}; role: ${b.role}; top: ${rf.has(b.id) ? 'EXPOSED, needs a roof' : 'under an upper volume, becomes a roof terrace with a railing (no roof)'}`; });
  const walls = exteriorWalls(spec).map(w => `${w.room} (${w.type}, level ${w.level}, block ${w.block}) side ${w.side}: wall ${w.run} m, ${w.free} m free; outside = ${w.outside}`);
  const rooms = allRooms(spec).map(r => `${r.id}: ${r.name} (${r.type}) ${(r.x1 - r.x0).toFixed(1)}x${(r.z1 - r.z0).toFixed(1)} m`);
  const d = spec.direction;
  const system = `You are the exterior architect of a staged villa generator. The building (blocks, rooms, stair, circulation) is FIXED and already accepted. You design only its exterior ARCHITECTURAL CHARACTER. You never give coordinates, window positions, roof geometry or wall changes: software measures the building and derives every position, size, eave, rise, opening and column from your decisions.
Style target: follow the user BRIEF and accepted design direction. Choose hip, gable or flat roof forms and finishes appropriate to that identity; do not impose a Mediterranean or Caribbean villa on another style. Develop an architectural entrance, facade depth, shadow, proportion and climate-appropriate shading within the available vocabulary. The site is flat.
Rules: north = -z, south = +z. Roof pitch ${PITCH_RANGE[0]}-${PITCH_RANGE[1]} degrees (Mediterranean roofs are about 18-30). Eaves: ${Object.entries(EAVE_M).map(([k, v]) => `${k} = ${v} m`).join(', ')}; software shrinks them where a neighbour or the site edge leaves less room. Differentiate the roofs: the primary upper mass should read as the crown; a gable or flatter roof can mark secondary masses. Every block whose top is EXPOSED needs exactly one roof entry; blocks under an upper volume are roof terraces: give no roof for them. Facade styles: glass-wall (floor-to-ceiling French-door bays), large-windows (tall vertical windows), punched (smaller, wall-dominant windows), solid (blank). Pick styles per block side to create hierarchy: glass and generous glazing toward the garden/veranda, calmer punched walls toward the street/arrival and the neighbours. Only list facade sides you want to be non-default (default = large-windows). The main entrance must be on the ground-level foyer on one of its exterior sides. doors: garden = French doors to the garden or veranda (ground level only); terrace = door from an upper room onto its roof terrace (the wall list shows what lies outside each wall). Use only walls listed under EXTERIOR WALLS with at least 2.1 m free for a door. Do not suggest moving interior walls, rooms or the stair. Statement: <=900 characters. intentions: up to 6 short sentences. blockFinishes: stucco, stone (natural stone walls) or timber-clad per block; use stone for a base/plinth mass and keep most masses cream stucco with timber accents.`;
  const prompt = `BRIEF: ${brief}
SITE: ${spec.site.width} x ${spec.site.depth} m, flat. Storey height 3.4 m.
STAGE 1 DESIGN DIRECTION (accepted): ${JSON.stringify({name: d.name, concept: d.concept, hierarchy: d.hierarchy, roofLanguage: d.roofLanguage, entrance: d.entrance, outdoorLiving: d.outdoorLiving})}
BLOCKS (fixed):
${blocks.join('\n')}
OPEN SPACES (fixed, not rooms; the veranda must be one of these): ${spec.openSpaces.map(o => `${o.id} (host ${o.host}, side ${o.side}, ${o.w} x ${o.d} m): ${o.role}`).join('; ') || 'none'}
ROOF TERRACES (blocks under upper volumes): ${terr.join(', ') || 'none'}
ROOMS (fixed): ${rooms.join('; ')}
EXTERIOR WALLS (measured):
${walls.join('\n')}
KNOWN STAGE 3 PLAN WARNINGS (not yours to fix; they stay visible): ${roomPlanWarnings(spec, requestedAreas).map(w => w.message).join(' | ') || 'none'}
Return the exterior design as JSON matching the schema.`;
  return {system, prompt};
}

/** ONE model call. Zero SDK retries, hard token ceiling, no correction. The model object is injectable so tests use a mocked provider. */
export class LiveExteriorDesigner {
  constructor(private opts: {model?: LanguageModel; modelId?: string; maxOutputTokens?: number} = {}) {}
  lastRaw = '';
  readonly modelId = this.opts.modelId ?? getAiModelId();
  async design(brief: string, spec: HouseSpec, requestedAreas: Record<string, number> = {}): Promise<{value: ExteriorDesign; usage: Usage; finishReason?: string; raw: string}> {
    const {system, prompt} = exteriorRequest(brief, spec, requestedAreas), id = this.modelId, pr = DEFAULT_PRICING[id];
    const cost = (i: number, o: number) => pr ? (i * pr.input + o * pr.output) / 1e6 : 0;
    let r;
    try {
      r = await generateText({model: this.opts.model ?? getAiModel(undefined, id, {requireReservation: true}), maxRetries: 0, maxOutputTokens: this.opts.maxOutputTokens ?? 8000, abortSignal: AbortSignal.timeout(170000),
        providerOptions: {openai: {strictJsonSchema: true}}, system, prompt, output: Output.object({schema: exteriorDesignSchema as never})});
    } catch (e) {
      const raw = (e as {text?: string}).text ?? '', eu = (e as {usage?: {inputTokens?: number; outputTokens?: number}}).usage;
      this.lastRaw = raw || String((e as Error).message);
      throw new DesignerError((e as Error).message, {usage: eu ? {model: id, inputTokens: eu.inputTokens ?? 0, outputTokens: eu.outputTokens ?? 0, costUsd: cost(eu.inputTokens ?? 0, eu.outputTokens ?? 0)} : undefined, raw, finishReason: (e as {finishReason?: string}).finishReason});
    }
    this.lastRaw = r.text;
    const i = r.usage.inputTokens ?? 0, o = r.usage.outputTokens ?? 0;
    return {value: exteriorDesignSchema.parse(r.output), raw: r.text, finishReason: r.finishReason, usage: {model: id, inputTokens: i, outputTokens: o, costUsd: cost(i, o)}};
  }
}
