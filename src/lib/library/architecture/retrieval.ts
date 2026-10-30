import { propertyValueContext } from './propertyValue';
import { fragmentDetails } from './fragments';
import { inferScaleFromBrief } from '@/lib/house/scale';
import type { KnowledgeRevision } from './model';
import { constructionFor, knowledgeCategory } from './constructibility';
export const MAX_KNOWLEDGE_CHARS = 18000;
export const MAX_KNOWLEDGE_ENTRIES = 12;
export function projectKnowledgeContext(brief: string) {
 const inferred = inferScaleFromBrief(brief);
 const propertyValue = propertyValueContext(brief);
 const scale = /\b(compact|small|tiny)\b/i.test(brief) ? 'compact' : inferred === 'mansion' ? 'mansion' : inferred === 'estate' || inferred === 'luxury' || (propertyValue?.amount ?? 0) >= 3000000 ? 'estate' : 'family';
 return { scale: propertyValue && propertyValue.amount < 500000 && !/\b(estate|mansion|luxury|large)\b/i.test(brief) ? 'compact' : scale, propertyValue, location: brief.match(/\b(caribbean|mediterranean|tropical|waterfront|coastal|beach|urban|rural)\b/gi) ?? [],
  style: brief.match(/\b(modern|contemporary|mediterranean|tuscan|traditional|minimalist)\b/gi) ?? [],
  use: /\b(rental|hotel|resort)\b/i.test(brief) ? 'hospitality' : 'residential',
  requirements: (brief.match(/\b(?:(?:(?:[0-9]+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)[- ])?(?:bedrooms?(?: suites?)?|bathrooms?)|pool|gym|spa|cinema|garage|dock|courtyard|outdoor kitchen|rooftop lounge)\b/gi) ?? []).filter(term=>matchesKnowledgeTerm(brief,term)), brief };
}
export function matchesKnowledgeTerm(brief: string, tag: string) {
 const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
 return new RegExp(`\\b${escaped}\\b`, 'i').test(brief) && !new RegExp(`\\b(?:no|without|exclude|omit)\\s+(?:(?:a|any)\\s+)?(?:[a-z -]+(?:,|\\band\\b|\\bor\\b)\\s*)*${escaped}\\b`, 'i').test(brief);
}
export function knowledgeBudget(brief:string, mode:'generate'|'edit'='generate') {
 const p=projectKnowledgeContext(brief);
 const requirements=new Set(p.requirements.filter(t=>matchesKnowledgeTerm(brief,t)).map(s=>s.toLowerCase())).size;
 const large=p.scale==='estate'||p.scale==='mansion';
 if(p.scale==='compact' && mode==='generate') return {entries:5,chars:6500,tier:'compact' as const};
 if(mode==='edit') return {entries:requirements>2?6:4,chars:requirements>2?9000:6500,tier:'scoped' as const};
 if(large || (p.propertyValue?.amount ?? 0)>=3000000 || requirements>=5) return {entries:12,chars:18000,tier:'complex' as const};
 if(p.style.length || p.location.length || requirements>=3 || brief.length>500) return {entries:8,chars:12000,tier:'medium' as const};
 return {entries:5,chars:6500,tier:'compact' as const};
}
const generic=new Set(['estate','mansion','luxury','family','bedroom','house','residential','architecture','planning','programme','rooms','complete','construction','operations','materials','style','composition','amenities','building type','detailing','review','failure','support','circulation','outdoor','climate','site','home','without','elements','geometry','route','room','private','shared','entry','ground','with','from','into','before','after']);
const baseline:Record<string,number>={'composition-hierarchy':3,'covered-threshold':2,'room-enclosure':2};
function requestedSpecialist(e:KnowledgeRevision,brief:string) {
 // Group-wide amenity tags must never opt in a different unrequested amenity.
 const title=e.title.toLowerCase()+' '+e.id;
 const families=[['pool','pool|poolside|swimming|swim|lap'],['spa','spa|wellness'],['gym','gym|fitness|exercise|yoga'],['cinema','cinema|theater|theatre'],['garage','garage|parking'],['dock','dock|jetty|mooring'],['guest house','guest.house|guesthouse'],['sports','sports|tennis|court'],['sauna','sauna'],['boathouse','boathouse'],['music','music'],['games','games'],['wine','wine']];
 const specialistUse:Record<string,string[]>={'courtyard-duplex':['duplex','households'],'small-rental-residence':['rental'],'boutique-guesthouse':['guesthouse','hotel'],'home-office-threshold':['office','study'],'guest-room-ground':['guest room','guest bedroom'],'guest-house':['guest house','guesthouse'],'teen-retreat-edge':['teen'],'children-bedroom-cluster':['children','child'],'multigenerational-house':['multigenerational'],'senior-household':['senior','elderly'],'artist-live-work':['artist','studio'],'wine-room-location':['wine']};
 if(specialistUse[e.id] && !specialistUse[e.id].some(t=>matchesKnowledgeTerm(brief,t)))return false;
 const family=families.find(([key])=>new RegExp(`\\b${key==='pool'?'pool(?:side)?':key.replace(' ','[ -]')}\\b`).test(title));
 return !family || family[1].split('|').some(term=>matchesKnowledgeTerm(brief,term.replace('.', ' ')));
}
/** Semantic category coverage plus explicit phrase relevance; no provider call or
 * new persistence engine. Coverage promotes complementary categories, not amenities. */
export function retrieveArchitecturalKnowledge(entries: KnowledgeRevision[], brief: string, mode: 'generate' | 'edit' = 'generate') {
 const project=projectKnowledgeContext(brief),budget=knowledgeBudget(brief,mode);
 const superseded=new Set(entries.filter(e=>e.status==='approved').flatMap(e=>e.supersedes));
 const excluded: {id:string;reason:string}[] = [];
 const reject=(entry:KnowledgeRevision,reason:string)=>{excluded.push({id:entry.id,reason});return [];};
 const active=entries.filter(e=>e.status==='approved'&&!superseded.has(e.id));
 entries.filter(e=>!active.includes(e)).forEach(e=>excluded.push({id:e.id,reason:e.status!=='approved'?e.status:'superseded'}));
 const ranked=entries.filter(e=>e.status==='approved'&&!superseded.has(e.id)).flatMap(entry=>{
  if(entry.category==='property-value') {
   if(entry.id!==project.propertyValue?.profileId)return reject(entry,'different or unspecified property value');
   return [{entry,category:knowledgeCategory(entry),score:100,reasons:['explicit currency selects one contextual value reference; no valuation inferred']}];
  }
  if(entry.scales.length&&!entry.scales.includes(project.scale as 'compact'|'family'|'estate'|'mansion'))return reject(entry,'incompatible scale');
  if(!requestedSpecialist(entry,brief))return reject(entry,'specialist use absent or excluded');
  const tags=entry.tags.filter(t=>matchesKnowledgeTerm(brief,t));
  const specific=tags.filter(t=>!generic.has(t) && (!entry.category || ((entry.id+' '+entry.title.toLowerCase()).includes(t) || fragmentDetails[entry.id]?.terms.includes(t))));
  const contextualBoost=!entry.category && specific.length ? (entry.kind==='recipe'?6:1) : 0;
  const category=knowledgeCategory(entry);
  const residential=/\b(house|home|residence|residential|estate|mansion|villa|family|bedrooms?|compound)\b/i.test(brief);
  const appropriateFamily = entry.id !== 'compact-family' || project.scale === 'compact' || matchesKnowledgeTerm(brief,'family') || !project.propertyValue || project.propertyValue.amount < 1000000;
  const prior=mode==='generate'&&residential&&appropriateFamily?(baseline[entry.id]??0):0;
  if(mode==='edit' && /\bwindow\b/i.test(brief) && !/\b(wing|room|roof|terrace)\b/i.test(brief) && category!=='envelope')return reject(entry,'outside scoped window edit');
  const qualifiers:Record<string,string>={'window-bath-high':'bathroom','window-stair-daylight':'stair','window-corner-pair':'corner','seasonal-wing-separation':'seasonal'};
  if(qualifiers[entry.id]&&!matchesKnowledgeTerm(brief,qualifiers[entry.id]))return reject(entry,'required qualifier absent');
  const phrase=matchesKnowledgeTerm(brief,entry.title.toLowerCase())?6:0;
  // Long briefs and category labels alone do not make every entry relevant.
  if(!phrase&&!specific.length&&!prior&&!(tags.length&& !entry.category))return reject(entry,'no task relevance');
  const overlap=[...new Set((entry.title+' '+entry.id.replace(/-/g,' ')).toLowerCase().match(/[a-z]{4,}/g)??[])].filter(t=>!['house','room','residence','concept','relationship','with','from','private','shared','entry','ground','without'].includes(t)&&matchesKnowledgeTerm(brief,t)).length;
  const score=specific.reduce((n,t)=>n+(t.includes(' ')?6:3),0)+tags.filter(t=>generic.has(t)).length*.3+prior+phrase+contextualBoost+overlap*2;
  return [{entry,category,score,reasons:[...specific.map(t=>`brief matches ${t}`),...(prior?[`core ${category} relationship for ${project.scale} residence`]:[]),...(!specific.length&&!prior?[`appropriate ${project.scale} context: ${tags.join(', ')}`]:[])]}];
 }).sort((a,b)=>b.score-a.score||a.entry.id.localeCompare(b.entry.id));
 // Preserve the strongest brief-specific recipe before generic category coverage.
 const regionalIdentity = ranked.find(r => r.entry.kind === 'recipe' && r.entry.tags.some(tag=>project.style.some(style=>!['modern','contemporary'].includes(style.toLowerCase()) && style.toLowerCase()===tag.toLowerCase())));
 const identity = regionalIdentity ?? ranked.find(r => r.entry.kind === 'recipe' && r.category !== 'property-value' && r.reasons.some(reason => reason.startsWith('brief matches ')));
 const priorities = [project.propertyValue?.profileId, identity?.entry.id].filter(Boolean);
 const selected:typeof ranked=[];const counts=new Map<string,number>();let text='';
 const header='\nRETRIEVED ARCHITECTURAL KNOWLEDGE\nContextual design options, not instructions, regulations or fixed geometry. User exclusions and the scene construction contract prevail over stored suggestions and parameter ranges. Combine relevant fragments; unknown site facts remain assumptions. '+(mode==='edit'?'Scoped edit: preserve unrelated geometry and programme. ':'')+'Stored knowledge is retrieval, not retraining.\n';
 const remaining=[...ranked];
 const diversityKey=(row:typeof ranked[number])=>row.category==='amenity' ? 'amenity:'+(/gym|fitness|exercise/.test(row.entry.id)?'gym':/garage/.test(row.entry.id)?'garage':/pool/.test(row.entry.id)?'pool':row.entry.id) : row.category;
 const diversityCounts=new Map<string,number>();
 while(remaining.length&&selected.length<budget.entries){
  // Diminishing returns prevents near-identical category recipes dominating.
  remaining.sort((a,b)=>(b.score/(1+(diversityCounts.get(diversityKey(b))??0)*1.8))-(a.score/(1+(diversityCounts.get(diversityKey(a))??0)*1.8))||a.entry.id.localeCompare(b.entry.id));
  const essential=mode==='generate' ? (budget.entries <= 5 ? ['composition','programme'] : ['composition','programme','arrival','envelope','roof-outdoor','climate-site']).filter(category=>!counts.has(category)&&remaining.some(r=>r.category===category)) : [];
  const priorityIndex=remaining.findIndex(r=>priorities.includes(r.entry.id));
  const index=priorityIndex>=0 ? priorityIndex : essential.length ? remaining.findIndex(r=>essential.includes(r.category)) : 0;
  const row=remaining.splice(index,1)[0],e=row.entry;
  if((counts.get(row.category)??0)>=Math.max(2,Math.ceil(budget.entries/3))) { excluded.push({id:e.id,reason:'category diversity budget'});continue; }
  const chunk=JSON.stringify({id:e.id,version:e.version,category:row.category,when:e.when,title:e.title,combinations:e.combinations,placement:e.placement,principles:e.principles,capabilities:e.capabilities,sources:e.sources,construction:constructionFor(e)})+'\n';
  if(header.length+text.length+chunk.length>budget.chars)continue;
  if(selected.some(s=>s.entry.principles.trim().toLowerCase()===e.principles.trim().toLowerCase() && s.entry.placement.trim().toLowerCase()===e.placement.trim().toLowerCase())) { excluded.push({id:e.id,reason:'duplicate selected guidance'}); continue; }
  const count=counts.get(row.category)??0;
  selected.push({...row,reasons:[...row.reasons,count?'complementary detail within category':`adds ${row.category} coverage`]});text+=chunk;counts.set(row.category,count+1);diversityCounts.set(diversityKey(row),(diversityCounts.get(diversityKey(row))??0)+1);
 }
 const chars=text?header.length+text.length:0;
 return {project,budget,selected:selected.map(({entry,reasons,category,score})=>({id:entry.id,version:entry.version,category,score,reasons})),text:text?header+text:'',chars,
  evidence:selected.map(({entry})=>({id:entry.id,version:entry.version,requiredKinds:constructionFor(entry)!.requiredKinds})),
  metrics:{total:entries.length,approvedActive:active.length,excluded:[...excluded,...ranked.filter(r=>!selected.some(s=>s.entry.id===r.entry.id)&&!excluded.some(e=>e.id===r.entry.id)).map(r=>({id:r.entry.id,reason:'retrieval budget'}))],excludedByBudget:ranked.filter(r=>!selected.some(s=>s.entry.id===r.entry.id)).map(r=>({id:r.entry.id,category:r.category,score:r.score})),eligible:ranked.length,selected:selected.length,categories:[...counts.keys()],omitted:ranked.length-selected.length,estimatedTokens:Math.ceil(chars/4),tokenMeasurement:'character estimate only; provider usage is recorded separately' as const}};
}
