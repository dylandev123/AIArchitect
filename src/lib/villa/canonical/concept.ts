/** Concept review of a canonical Generate result: was the architectural composition expected, stated and built?
 * Pure and non-destructive. It reads the brief, the plan and the compiled result; it changes nothing, rejects nothing and
 * produces no score. The composition field stays optional in the schema (old plans and restrained homes remain valid); what
 * this adds is that, for an ambitious commission, an absent or nominal composition is an explicit review finding rather than
 * a silent pass. Unsupported claims from fidelity.ts are carried as observations for a person to weigh. */
import type {CompletionFinding} from '../scene/completion';
import type {ArchitecturalPlan,compileArchitecturalPlan} from './plan';
import {conceptFidelity,type Fidelity} from './fidelity';
import {programmeReview,type ProgrammeReview} from './programmeReview';
type Built=ReturnType<typeof compileArchitecturalPlan>;
const AMBITION=/\b(luxur\w*|estate|mansion|palatial|grand|signature|landmark|flagship|iconic|ambitious|dramatic|compound|multi-?wing(?:ed)?|architecturally (?:ambitious|significant|sophisticated))\b/gi;
/** Interior rooms at or above which a plan is a large house whatever the brief wording. */
export const LARGE_HOUSE_ROOMS=10;
/** Ambition is a property of the commission, not of any style: it asks for composition to be stated, never for complexity. */
const BUDGET=/(?:US\s?)?\$\s?([0-9][0-9,.]*)\s*(million|m\b|mn|billion|bn|k\b)?/gi;
export function ambitiousCommission(prompt:string,plan:ArchitecturalPlan):{ambitious:boolean;reasons:string[]}{
 const reasons:string[]=[];
 for(const m of prompt.matchAll(AMBITION)){
  const before=prompt.slice(Math.max(0,m.index!-16),m.index!);
  if(!/\b(?:no|not|non|without|avoid|never|rather than)\s+(?:an?\s+|the\s+)?(?:\w+\s+)?$/i.test(before)){reasons.push(`brief asks for "${m[0].toLowerCase()}"`);break;}
 }
 for(const m of prompt.matchAll(BUDGET)){
  const n=Number(m[1].replace(/,/g,'')),unit=(m[2]??'').toLowerCase(),usd=n*(/^b/.test(unit)?1e9:/^m/.test(unit)?1e6:unit==='k'?1e3:1);
  if(usd>=5e6){reasons.push(`budget of about US$${(usd/1e6).toFixed(usd%1e6?1:0)} million`);break;}
 }
 const rooms=plan.spaces.filter(s=>!s.outdoor).length;
 if(rooms>=LARGE_HOUSE_ROOMS)reasons.push(`the plan has ${rooms} interior rooms`);
 return {ambitious:reasons.length>0,reasons};
}
/** What a stated composition must contain to count as composition rather than a label. Deliberately small: a single volume
 * under one declared roof with a declared entrance is adequate, so restraint is not penalised. */
export function compositionGaps(plan:ArchitecturalPlan):string[]{
 const c=plan.composition;
 if(!c)return [];
 const gaps:string[]=[];
 if(!c.entrance)gaps.push('no composition.entrance (the arrival is described, not developed)');
 if(!c.roofSpans.length&&!c.volumes.some(v=>v.roof)&&!c.facades.length)gaps.push('no roofSpans or facades (volumes are labels only; nothing structured shapes roofs or elevations)');
 if(c.volumes.length>1&&new Set(c.volumes.map(v=>v.tier)).size===1)gaps.push(`all ${c.volumes.length} volumes share the tier ${c.volumes[0].tier} (no hierarchy)`);
 return gaps;
}
export type ConceptReview={
 commission:{ambitious:boolean;reasons:string[]};
 composition:{declared:boolean;gaps:string[]};
 fidelity:Fidelity;
 /** Brief programme, daylight of primary living spaces and repeated cells, checked against the declared spaces (programmeReview.ts). */
 programme:ProgrammeReview;
 findings:CompletionFinding[];
 /** What this review is not: structure and measurable claims only. */
 limits:string;
};
/** Commission and composition findings that need only the plan, so a rejected plan can be reviewed too. */
function planFindings(prompt:string,plan:ArchitecturalPlan){
 const commission=ambitiousCommission(prompt,plan),gaps=compositionGaps(plan),declared=!!plan.composition,findings:CompletionFinding[]=[];
 if(commission.ambitious&&!declared)findings.push({category:'likely-architectural-incompleteness',code:'composition-missing',elementIds:[],message:`Composition missing for an ambitious commission (${commission.reasons.join('; ')}). The thesis and wing roles are prose; no volumes, hierarchy, roof spans, facade rhythm or declared entrance exist to check the built house against, so the thesis is not evidence of architectural design. A restrained house is acceptable, but its composition must still be stated.`});
 if(commission.ambitious&&declared&&gaps.length)findings.push({category:'likely-architectural-incompleteness',code:'composition-inadequate',elementIds:[],message:`Composition is nominal for an ambitious commission: ${gaps.join('; ')}.`});
 return {commission,gaps,declared,findings};
}
export type PlanConceptReview=Pick<ConceptReview,'commission'|'composition'|'programme'|'findings'>&{limits:string};
/** The same review without a compiled house: brief programme, daylight, repetition, composition. Fidelity of the BUILT geometry is not available and is not claimed. */
export function planConceptReview(prompt:string,plan:ArchitecturalPlan):PlanConceptReview{
 const p=planFindings(prompt,plan),programme=programmeReview(prompt,plan);
 return {commission:p.commission,composition:{declared:p.declared,gaps:p.gaps},programme,findings:[...p.findings,...programme.findings],limits:'Plan-level review only: no house was built, so concept fidelity of built geometry is not assessed. Programme counts come from the brief\'s own words; nothing is scored, rejected or repaired.'};
}
export function conceptReview(prompt:string,plan:ArchitecturalPlan,built:Built):ConceptReview{
 const p=planFindings(prompt,plan),fidelity=conceptFidelity(plan,built),programme=programmeReview(prompt,plan);
 const findings:CompletionFinding[]=[...p.findings,...programme.findings];
 // Claims in the thesis are checked whether or not a composition exists; the "no composition" observation is carried by composition-missing above.
 for(const o of fidelity.observations)if(!/^No composition is declared/.test(o))findings.push({category:'subjective-design-concern',code:'concept-fidelity',elementIds:[],message:`Concept fidelity: ${o}`});
 return {commission:p.commission,composition:{declared:p.declared,gaps:p.gaps},fidelity,programme,findings,limits:`Reports structure and measurable claims in the built geometry only. Not assessed: ${fidelity.notMeasurable.join('; ')}. Thresholds are heuristics; nothing is scored, rejected or repaired.`};
}
