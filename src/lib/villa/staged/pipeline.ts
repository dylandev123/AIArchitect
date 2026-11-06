import {featureAudit} from './featureAudit';
import {intentionFindings} from './intentions';
/* eslint-disable @typescript-eslint/no-explicit-any -- slice payloads are validated by zod at the boundary */
import {z} from 'zod';
import {assertUniqueJsonKeys,normalizeStage,NormalizationError,type Normalization} from './normalize';
import type {ArchitecturalScene} from '../scene/model';
import {compileHouse, type Stage} from './compile';
import {separateOpenSpaces} from './openSpaces';
import {programmeSchema} from './programme';
import {solveProgramme, type LayoutOption} from './roomSolver';
import {houseSpecSchema, stageSchemas, type HouseSpec} from './spec';
import {relationshipFindings, validateExterior, validateInterior, validateMassing, validateSite, type Finding} from './validate';
import {siteLayoutIssues} from './site';
import {deriveSiteGeneral,generalSiteIssues} from './siteGeneral';
import {siteAccessBlockers,stage5Preflight} from './siteFeasibility';
import {deriveStage4,exteriorDesignV2Schema} from './exterior';
import {siteDesignV2Schema} from './siteContract';
import {allRooms,area} from './layout';
import {failureCategory} from './diagnostics';

export type StageNo = 1 | 2 | 3 | 4 | 5;
export interface Usage {model: string; inputTokens: number; outputTokens: number; costUsd: number}
export interface DesignResult {normalizations?:Normalization[];value: unknown; usage?: Usage; raw?: string; finishReason?: string;request?:{system:string;prompt:string}}
/** A provider failure that still carries what the provider billed and said (usage, raw text, finish reason). */
export class DesignerError extends Error {
  constructor(message: string, readonly detail: {normalizationCode?:string;normalizations?:Normalization[];usage?: Usage; raw?: string; finishReason?: string;validationIssues?:unknown;request?:{system:string;prompt:string}} = {}) { super(message); }
}
export interface StageContext {brief: string; site: HouseSpec['site']; draft: Draft; requiredBedrooms: number; requiredBaths: number; checkpoints: Checkpoint[]}

/** A designer produces the stage slices (a model, or a labelled mock). It never builds geometry. */
export interface Designer {
  readonly label: string;
  design(stage: StageNo, ctx: StageContext): Promise<DesignResult>;
  /** One bounded repair of the same stage, given the measured findings. */
  correct(stage: StageNo, ctx: StageContext, previous: unknown, findings: Finding[]): Promise<DesignResult>;
  /** Upper bound of the serialized provider request in bytes, used to reserve spending before dispatch. */
  wireBytes?(stage: StageNo, ctx: StageContext, correction?: {previous: unknown; findings: Finding[]}): number;
}
/** Server admission refused the call before anything was sent (budget, cancellation, unresolved usage). */
export class DispatchRefused extends Error {}
/** Findings a targeted model correction can plausibly address. Software faults and provider failures are excluded. */
const NOT_REPAIRABLE = new Set(['site-infeasible', 'construction-error', 'compile-failed', 'budget', 'dispatch-refused', 'designer-error', 'duplicate-json-key']);
export const repairable = (findings: Finding[]) => findings.length > 0 && findings.every(f => !NOT_REPAIRABLE.has(f.code));

export type Draft = HouseSpec;
export interface CallRecord {normalizations?:Normalization[];stage: StageNo; purpose: 'design' | 'correction'; usage?: Usage; finishReason?: string;raw?:string;request?:{system:string;prompt:string}; /** Set when the call returned something unusable. */ failure?: {stack?:string;message: string; finishReason?: string; raw?: string;validationIssues?:unknown;request?:{system:string;prompt:string}}}
export interface Checkpoint {normalizations?:Normalization[];
  stage: StageNo; name: string; attempt: number; accepted: boolean;
  slice: unknown; spec: HouseSpec; scene?: ArchitecturalScene; components?: Record<string, string>;
  findings: Finding[]; calls: CallRecord[];
  input?:StageContext; warnings?:Finding[]; failure?:{category:string;message:string;stack?:string;schemaIssues?:unknown;correction:{authorized:false;maxCalls:0;prompt:string}};
  /** Stage 3: what software built from the programme (the slice that was validated and applied). */
  construction?: {chosen: string; options: {id: string; score: number; metrics: LayoutOption['metrics']}[]; slice: unknown; addedLinks: unknown[]; adjustments?: unknown[]};
}
export interface PipelineResult {
  status: 'complete' | 'failed' | 'paused';
  failedStage?: StageNo; findings: Finding[];
  /** Last accepted checkpoint: geometry is always preserved when a later stage fails. */
  lastGood?: Checkpoint; checkpoints: Checkpoint[]; spec?: HouseSpec; scene?: ArchitecturalScene; components?: Record<string, string>;
  calls: CallRecord[]; totalCostUsd: number;
}

export class BudgetExceeded extends Error {}
export class CallBudget {
  used = 0; cost = 0;
  constructor(readonly maxCalls: number, readonly maxCostUsd: number) {}
  beforeCall() { if (this.used >= this.maxCalls) throw new BudgetExceeded(`Model-call budget of ${this.maxCalls} reached.`); if (this.cost >= this.maxCostUsd) throw new BudgetExceeded(`Cost budget of $${this.maxCostUsd} reached.`); this.used++; }
  record(u?: Usage) { this.cost += u?.costUsd ?? 0; }
}

const STAGE_NAMES: Record<StageNo, string> = {1: 'architectural designer', 2: 'building massing', 3: 'interior spatial planning', 4: 'exterior architecture', 5: 'materials and site'};

/** Placeholders only fill fields of later stages so earlier stages compile from the same spec type. */
export function emptyDraft(site: HouseSpec['site']): Draft {
  return {
    version: 'staged-house-1', site,
    direction: {name: 'Untitled', concept: '-', hierarchy: ['-', '-'], roofLanguage: '-', entrance: '-', outdoorLiving: '-', landscape: '-', palette: {walls: 'ivory', accent: 'timber', roof: 'timber', deck: 'limestone'}},
    blocks: [], openSpaces: [], links: [], stairs: [],
    exterior: {facades: {}, doors: [], entrance: {door: '-', canopy: {depth: 0, width: 2, material: 'timber'}, court: {w: 2, d: 2}}, verandas: []},
    siteWork: {pool: {x: 0, z: 0, w: 3, d: 2, basinDepth: 1}, lawns: [], beds: [], trees: [], hedges: [], paths: []},
  };
}

export function applySlice(draft: Draft, stage: StageNo, slice: any): Draft {
  switch (stage) {
    case 1: return {...draft, direction: slice};
    case 2: { const sep = separateOpenSpaces(slice.blocks); return {...draft, openSpaces: sep.openSpaces, blocks: sep.blocks.map((b: any) => ({...b, plan: {room: {id: `${b.id}-room`, name: b.role, type: 'hall'}}, roof: {form: 'flat', overhang: 0, material: 'bronze'}, wall: 'ivory'}))}; }
    case 3: return {...draft, blocks: draft.blocks.map(b => ({...b, plan: slice.plans[b.id] ?? b.plan})), links: slice.links, stairs: slice.stairs};
    case 4: return {...draft, blocks: draft.blocks.map(b => ({...b, roof: slice.roofs[b.id] ?? b.roof, ...(slice.walls?.[b.id] ?? {})})), exterior: slice.exterior, ...(slice.trim ? {trim: slice.trim} : {})};
    case 5: return {...draft, siteWork: slice.siteWork, ...(slice.sitePresentation ? {sitePresentation: slice.sitePresentation} : {}), blocks: draft.blocks.map(b => ({...b, ...(slice.finishes[b.id] ? {wall: slice.finishes[b.id].wall, wallColor: slice.finishes[b.id].wallColor} : {})}))};
  }
}

const generalSiteIssues5 = (d: Draft) => d.sitePresentation?.version === 'staged-site-2' ? generalSiteIssues(d) : [];

export function measure(draft: Draft, stage: StageNo, requiredBedrooms: number, requiredBaths = 0): {findings: Finding[]; scene?: ArchitecturalScene; components?: Record<string, string>;executionError?:{message:string;stack?:string}} {
  if (stage === 1) return {findings: []};
  // Spec-level checks first: they explain failures a compiler crash would hide.
  const own = stage === 2 ? validateMassing(draft) : stage === 3 ? validateInterior(draft, requiredBedrooms, requiredBaths) : stage === 4 ? [...validateInterior(draft, requiredBedrooms, requiredBaths), ...validateExterior(draft)] : [...validateMassing(draft), ...validateInterior(draft,requiredBedrooms,requiredBaths), ...validateExterior(draft), ...validateSite(draft), ...siteLayoutIssues(draft), ...generalSiteIssues5(draft)];
  own.push(...intentionFindings(draft,stage as Stage));
  // Build even when checks fail so the failed stage stays inspectable.
  try {
    const {scene, components} = compileHouse(draft, stage as Stage);
    return {findings: [...own, ...(stage >= 3 ? relationshipFindings(scene, stage as Finding['stage']) : [])], scene, components};
  } catch (e) {
    return {findings: [...own, {stage: stage as Finding['stage'], code: 'compile-failed', subject: 'compiler', message: (e as Error).message}],executionError:{message:e instanceof Error?e.message:String(e),stack:e instanceof Error?e.stack:undefined}};
  }
}

export interface RunOptions {
  requiredStoreys?: number; exactBedrooms?: boolean;
  designer: Designer; brief: string; site: HouseSpec['site']; requiredBedrooms?: number; requiredBaths?: number; /** Stop (status 'paused') after this stage, e.g. to pause between paid stages. */ stopAfter?: StageNo;
  /** One repair per stage at most, hard-capped model calls and cost; no retry loops. */
  maxCorrectionsPerStage?: number; maxCalls?: number; maxCostUsd?: number;
  onCheckpoint?: (c: Checkpoint) => void | Promise<void>;
  /** Optional chooser between valid layouts (e.g. a model call). Default: the software's best-scored layout. */
  chooseLayout?: (options: LayoutOption[]) => Promise<number> | number;
  /** Resume after the last accepted checkpoints instead of restarting. */
  resumeFrom?: Checkpoint[];
}

export async function runStagedGeneration(o: RunOptions): Promise<PipelineResult> {
  const budget = new CallBudget(o.maxCalls ?? 10, o.maxCostUsd ?? 5), corrections = o.maxCorrectionsPerStage ?? 1;
  const checkpoints: Checkpoint[] = [...(o.resumeFrom ?? [])];
  const calls: CallRecord[] = checkpoints.flatMap(c => c.calls);
  // Resuming is part of the same run, not a new call/cost allowance.
  budget.used = calls.length;
  budget.cost = calls.reduce((sum,c)=>sum+(c.usage?.costUsd??0),0);
  let draft = checkpoints.at(-1)?.spec ?? emptyDraft(o.site);
  const bedrooms = o.requiredBedrooms ?? 0, baths = o.requiredBaths ?? 0;
  const ctx = (): StageContext => ({brief: o.brief, site: o.site, draft, requiredBedrooms: bedrooms, requiredBaths: baths, checkpoints});
  const result = (status: PipelineResult['status'], findings: Finding[], failedStage?: StageNo): PipelineResult => {
    const lastGood = [...checkpoints].reverse().find(c => c.accepted);
    return {status, failedStage, findings, lastGood, checkpoints, spec: lastGood?.spec, scene: lastGood?.scene, components: lastGood?.components, calls, totalCostUsd: budget.cost};
  };
  for (const stage of [1, 2, 3, 4, 5] as StageNo[]) {
    if (checkpoints.some(c => c.stage === stage && c.accepted)) continue;
    const stageCalls: CallRecord[] = [];
    let slice: unknown, findings: Finding[] = [], attempt = 0, trial: ReturnType<typeof measure> | undefined, candidate = draft, construction: Checkpoint['construction'];
    const stageInput=structuredClone({...ctx(),checkpoints:checkpoints.map(c=>({...c,input:undefined}))});
    let schemaIssues:unknown,executionError:{message:string;stack?:string}|undefined;
    const warnings:Finding[]=[];
    for (; attempt <= corrections; attempt++) {
      // Stage 5 is never dispatched (nor corrected) when the accepted geometry admits no acceptable site answer.
      if (stage === 5) { const blocked = stage5Preflight(draft, o.brief); if (blocked.length) return fail(stage, blocked, stageCalls); }
      try { budget.beforeCall(); } catch (e) { return fail(stage, [{stage: Math.max(2, stage) as Finding['stage'], code: 'budget', subject: 'budget', message: (e as Error).message}]); }
      let r: DesignResult;
      try { r = attempt === 0 ? await o.designer.design(stage, ctx()) : await o.designer.correct(stage, ctx(), slice, findings); }
      catch (e) {
        if (e instanceof DispatchRefused) return fail(stage, [{stage: Math.max(2, stage) as Finding['stage'], code: 'dispatch-refused', subject: 'admission', message: e.message.slice(0, 400)}], stageCalls);
        // The provider call is billed even when its answer is unusable: keep usage, finish reason and raw text.
        const detail = e instanceof DesignerError ? e.detail : {};
        budget.record(detail.usage);
        const rec: CallRecord = {normalizations:detail.normalizations,stage, purpose: attempt === 0 ? 'design' : 'correction', usage: detail.usage, failure: {stack:e instanceof Error?e.stack:undefined,message: (e as Error).message, finishReason: detail.finishReason, raw: detail.raw,validationIssues:detail.validationIssues,request:detail.request}};
        calls.push(rec); stageCalls.push(rec);
        let failedSlice:unknown;try{failedSlice=detail.raw?JSON.parse(detail.raw):undefined;}catch{}
        // A completed, billed answer that only failed its schema/identifier contract is specific and repairable.
        const definitive = detail.finishReason === 'stop' && !!detail.usage && failedSlice !== undefined && (!!detail.validationIssues || !!detail.normalizationCode);
        if (definitive && attempt < corrections) {
          slice = failedSlice; trial = undefined; schemaIssues = detail.validationIssues;
          findings = Array.isArray(detail.validationIssues) && detail.validationIssues.length ? (detail.validationIssues as {path?: (string | number)[]; message?: string; code?: string}[]).slice(0, 12).map(i => ({stage: Math.max(2, stage) as Finding['stage'], code: detail.normalizationCode ?? 'schema', subject: i.path?.join('.') || 'slice', message: i.message ?? String(i.code)})) : [{stage: Math.max(2, stage) as Finding['stage'], code: detail.normalizationCode ?? 'schema', subject: 'slice', message: (e as Error).message.slice(0, 400)}];
          if (repairable(findings)) continue;
        }
        return fail(stage, [{stage: Math.max(2, stage) as Finding['stage'], code: detail.normalizationCode??'designer-error', subject: 'designer', message: (e as Error).message.slice(0, 400)}], stageCalls,failedSlice);
      }
      budget.record(r.usage);
      const rec: CallRecord = {stage, purpose: attempt === 0 ? 'design' : 'correction', normalizations:r.normalizations,usage: r.usage, finishReason: r.finishReason,raw:r.raw,request:r.request}; calls.push(rec); stageCalls.push(rec);
      slice = r.value;
      try {
      if(r.raw)assertUniqueJsonKeys(r.raw);
      const normalized=normalizeStage(stage,slice,draft);slice=normalized.value;rec.normalizations=[...(rec.normalizations??[]),...normalized.changes];
      let toApply: unknown = slice;
      if (stage === 3 && slice && typeof slice === 'object' && 'rooms' in slice) {
        // Programme path: Terra gave relationships; software constructs the geometry.
        construction = undefined;
        const prog = programmeSchema.safeParse(slice);
        if (!prog.success) { schemaIssues=prog.error.issues; findings = prog.error.issues.slice(0, 12).map(i => ({stage: 3 as const, code: 'schema', subject: i.path.join('.') || 'programme', message: i.message})); trial = undefined; continue; }
        const built = solveProgramme(draft, prog.data, {requiredBedrooms: bedrooms, requiredBaths: baths, check: sl => measure(applySlice(draft, 3, sl), 3, bedrooms, baths).findings});
        if (!built.ok) { findings = built.conflicts.map(c => ({stage: 3 as const, code: c.code, subject: c.subject, message: c.message})); trial = undefined; continue; }
        const pick = Math.min(built.options.length - 1, Math.max(0, (await o.chooseLayout?.(built.options)) ?? 0));
        toApply = built.options[pick].slice;
        construction = {chosen: built.options[pick].id, options: built.options.map(x => ({id: x.id, score: x.score, metrics: x.metrics})), slice: toApply, addedLinks: built.options[pick].addedLinks};
      }
      if (stage === 4 && slice && typeof slice === 'object' && 'roofFinish' in slice) {
        // Design-intent path: Terra chose architectural character; software measures and derives every coordinate.
        const design = exteriorDesignV2Schema.safeParse(slice);
        if (!design.success) { schemaIssues=design.error.issues; findings = design.error.issues.slice(0, 12).map(i => ({stage: 4 as const, code: 'schema', subject: i.path.join('.') || 'exterior', message: i.message})); trial = undefined; continue; }
        const derived = deriveStage4(draft, design.data);
        if (derived.findings.length) { findings = derived.findings; trial = undefined; continue; }
        const s = derived.spec;
        toApply = {roofs: Object.fromEntries(s.blocks.map(b => [b.id, b.roof])), exterior: s.exterior, trim: {...s.trim!, visualRevision: 'stage4-v2'}, walls: Object.fromEntries(s.blocks.map(b => [b.id, {wall: b.wall, ...(b.wallColor ? {wallColor: b.wallColor} : {})}]))};
        construction = {chosen: 'measured-exterior-derivation', options: [], slice: toApply, addedLinks: [], adjustments: derived.derivation.adjustments};
      }
      if (stage === 5 && slice && typeof slice === 'object' && 'planting' in slice) {
        const design = siteDesignV2Schema.safeParse(slice);
        if (!design.success) { schemaIssues=design.error.issues; findings = design.error.issues.slice(0, 12).map(i => ({stage: 5 as const, code: 'schema', subject: i.path.join('.') || 'site', message: i.message})); trial = undefined; continue; }
        const derived = deriveSiteGeneral(draft, design.data, o.brief);
        if (derived.findings.length) { findings = derived.findings; trial = undefined; continue; }
        const s = derived.spec;
        toApply = {siteWork: s.siteWork, finishes: Object.fromEntries(draft.blocks.map(b => [b.id, {wall: b.wall, ...(b.wallColor ? {wallColor: b.wallColor} : {})}])), sitePresentation: s.sitePresentation};
        construction = {chosen: 'measured-site-derivation', options: [], slice: toApply, addedLinks: [], adjustments: derived.adjustments};
      }
      const parsed = (stageSchemas[stage] as z.ZodType).safeParse(toApply);
      if (!parsed.success) { schemaIssues=parsed.error.issues; findings = parsed.error.issues.slice(0, 12).map(i => ({stage: Math.max(2, stage) as Finding['stage'], code: 'schema', subject: i.path.join('.') || 'slice', message: i.message})); trial = undefined; continue; }
      // Records keyed by component id must cover the accepted building exactly.
      const keyed=stage===3?(parsed.data as any).plans:stage===4?(parsed.data as any).roofs:stage===5?(parsed.data as any).finishes:undefined;
      if(keyed){
       findings=[...draft.blocks.filter(b=>!(b.id in keyed)).map(b=>({stage:stage as Finding['stage'],code:'incomplete-stage',subject:b.id,message:`Stage ${stage} omitted ${b.id}; later-stage placeholders cannot become accepted design.`})),...Object.keys(keyed).filter(id=>!draft.blocks.some(b=>b.id===id)).map(id=>({stage:stage as Finding['stage'],code:'unknown-component',subject:id,message:`Stage ${stage} references unknown block ${id}.`}))];
       if(findings.length){trial=undefined;continue;}
      }
      candidate = applySlice(draft, stage, parsed.data);
      if(stage===5){const complete=houseSpecSchema.safeParse(candidate);if(!complete.success){schemaIssues=complete.error.issues;findings=complete.error.issues.map(i=>({stage:5 as const,code:'schema',subject:i.path.join('.'),message:i.message}));trial=undefined;continue;}}
      trial = measure(candidate, stage, bedrooms, baths);
      findings = trial.findings;
      if(trial.scene&&trial.components)findings.push(...featureAudit(candidate,trial.scene,trial.components,stage as Stage,o.brief).findings);
      // The entrance is decided at Stage 4: verify now that it can be reached at all, while Stage 4 can still repair it.
      if(stage===4)findings.push(...siteAccessBlockers(candidate).map(b=>({...b,stage:4 as const,code:'arrival-access',message:`${b.message} Choose an entrance side and room that the site boundary can reach.`})));
      if(stage===2)for(const o of candidate.openSpaces)if(/\bpool\b/i.test(o.role))warnings.push({stage:2,code:'site-intent-reservation',subject:o.id,message:`${o.id} is an open-space footprint reservation at massing stage, not a constructed swimming pool. Stage 5 places the one actual pool assembly centred on it and records how its envelope resolves the reservation${Math.max(o.w,o.d)<9.2||Math.min(o.w,o.d)<7.4?` (this ${o.w}×${o.d} m reservation is smaller than the smallest pool-with-deck, 9.2×7.4 m, so the constructed envelope will extend beyond it)`:''}.`});
      if(stage===3&&slice&&typeof slice==='object'&&'rooms' in slice){
       const requested=(slice as any).rooms as {id:string;area:number}[];
       for(const room of allRooms(candidate)){
        const target=requested.find(r=>r.id===room.id)?.area,w=room.x1-room.x0,d=room.z1-room.z0;
        if(target&&Math.abs(area(room)-target)/target>.3)warnings.push({stage:3,code:'room-area-deviation',subject:room.id,message:`${room.id}: requested ${target.toFixed(1)} m², constructed ${area(room).toFixed(1)} m² (${(100*(area(room)-target)/target).toFixed(0)}% deviation).`});
        if(Math.max(w,d)/Math.min(w,d)>2.5)warnings.push({stage:3,code:'room-proportion',subject:room.id,message:`${room.id}: ${w.toFixed(1)} × ${d.toFixed(1)} m; elongated proportions.`});
       }
      }
      if(stage===2&&o.requiredStoreys!==undefined&&1+Math.max(...candidate.blocks.map(b=>b.level))!==o.requiredStoreys)
        findings.push({stage:2,code:'brief-storeys',subject:'brief',message:`Description requires ${o.requiredStoreys} storeys.`});
      if(stage>=3&&o.exactBedrooms&&bedrooms>0&&allRooms(candidate).filter(r=>r.type==='bedroom').length!==bedrooms)
        findings.push({stage:3,code:'brief-bedrooms',subject:'brief',message:`Description requires exactly ${bedrooms} bedrooms.`});
      } catch(e) {
        if(e instanceof NormalizationError)rec.normalizations=[...(rec.normalizations??[]),...e.changes];
        executionError={message:e instanceof Error?e.message:String(e),stack:e instanceof Error?e.stack:undefined};
        trial=undefined;candidate=draft;
        findings=[{stage:Math.max(2,stage) as Finding['stage'],code:e instanceof NormalizationError?e.code:'construction-error',subject:'stage-construction',message:e instanceof Error?e.message:'Stage construction failed'}];
      }
      if (!findings.length) break;
      // Only specific, potentially repairable architecture/contract findings earn the bounded correction.
      if (!repairable(findings)) { attempt = corrections; break; }
    }
    const accepted = findings.length === 0;
    const cp: Checkpoint = {normalizations:stageCalls.flatMap(c=>c.normalizations??[]),stage, name: STAGE_NAMES[stage], attempt: Math.min(attempt, corrections), accepted, slice, spec: accepted ? candidate : draft, scene: trial?.scene, components: trial?.components, findings, calls: stageCalls, input:stageInput,warnings,...(!accepted?{failure:{category:failureCategory(stage,findings),message:executionError?.message??findings.map(f=>f.message).join(' | '),stack:executionError?.stack??trial?.executionError?.stack,schemaIssues,correction:{authorized:false as const,maxCalls:0 as const,prompt:`Reconsider only stage ${stage}, preserving accepted components. Diagnostics: ${JSON.stringify(findings)}. Previous response: ${JSON.stringify(slice)}`}}}:{}), ...(construction ? {construction} : {})};
    checkpoints.push(cp); await o.onCheckpoint?.(cp);
    if (!accepted) return result('failed', findings, stage);
    draft = candidate;
    if (o.stopAfter === stage) return result('paused', []);
  }
  // The assembled spec must satisfy the complete contract.
  houseSpecSchema.parse(draft);
  return result('complete', []);

  async function fail(stage: StageNo, findings: Finding[], stageCalls: CallRecord[] = [],failedSlice?:unknown) {
    const cp: Checkpoint = {normalizations:stageCalls.flatMap(c=>c.normalizations??[]),stage, name: STAGE_NAMES[stage], attempt: 0, accepted: false, slice: failedSlice, spec: draft, input:structuredClone({...ctx(),checkpoints:[]}),findings, calls: stageCalls,failure:{category:failureCategory(stage,findings,findings.map(f=>f.message).join(' ')),message:findings.map(f=>f.message).join(' | '),schemaIssues:stageCalls.at(-1)?.failure?.validationIssues,correction:{authorized:false,maxCalls:0,prompt:`Stage ${stage} failed: ${JSON.stringify(findings)}. Preserve the accepted design.`}}};
    checkpoints.push(cp); await o.onCheckpoint?.(cp); return result('failed', findings, stage);
  }
}
