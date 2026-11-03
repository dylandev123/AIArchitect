/** Offline audit of the architectural knowledge library and its retrieval for canonical Generate. Reads the retained library
 * snapshot and the code seeds; makes no model call and touches no database. Writes knowledge-audit.json. */
import {readFileSync,writeFileSync} from 'node:fs';
import {latestKnowledge} from '../src/lib/library/architecture/service';
import {legacyRecipeKnowledge} from '../src/lib/library/architecture/legacyRecipes';
import {retrieveArchitecturalKnowledge} from '../src/lib/library/architecture/retrieval';
import {knowledgeCategory} from '../src/lib/library/architecture/constructibility';
import {isWholeHouseStrategy,unbuildableRoofForm} from '../src/lib/library/architecture/canonicalKnowledge';
const dir='docs/architecture/knowledge-to-construction-2026-11-03';
const snap=JSON.parse(readFileSync('docs/architecture/unified-knowledge/library-snapshot.json','utf8'));
const all=[...latestKnowledge(snap.architecturalKnowledge),...legacyRecipeKnowledge(snap.recipes)];
const isStrategy=isWholeHouseStrategy;
const base=all.filter(e=>!isStrategy(e)),text=(e:typeof all[number])=>[e.when,e.combinations,e.placement,e.principles].join(' ');
const count=(f:(e:typeof all[number])=>string)=>base.reduce<Record<string,number>>((m,e)=>{const k=f(e);m[k]=(m[k]??0)+1;return m;},{});
const domains=[/\broof/i,/fa[cç]ade|window|opening/i,/entrance|porch|arrival|canopy/i,/garden|courtyard|landscape/i,/height|hierarch|subordinate|dominant/i,/route|circulat|corridor|link|passage/i];
const perRecord=base.map(e=>domains.filter(r=>r.test(text(e))).length);
const curated=base.filter(e=>!e.id.startsWith('legacy-')&&e.category!=='property-value'),shared=new Map<string,number>();
curated.forEach(e=>shared.set(e.combinations,(shared.get(e.combinations)??0)+1));
const briefs:Record<string,string>={mansion:JSON.parse(readFileSync('docs/architecture/canonical-live-mansion-2026-11-02/brief.NOT-SUBMITTED.json','utf8')).prompt,
 tropical:'Design a modern tropical pavilion villa in Barbados with four bedrooms, a shaded outdoor living court and a pool, with deep eaves and breezes.',
 courtyard:'Design a private courtyard house on a narrow urban lot in Lisbon with three bedrooms, an inner court and strong privacy from the street.',
 hillside:'Design a dramatic multilevel hillside home overlooking the sea with four bedrooms, view terraces and a pool.',
 compact:'Design a compact but architecturally sophisticated family home with three bedrooms on a small lot, modest budget.',
 contemporary:'Design a contemporary luxury villa with five bedrooms, a pool and refined materials.',plain:'Design a house.'};
const trace=(b:string,canonical:boolean)=>{const r=retrieveArchitecturalKnowledge(all,b,'generate',{canonical});return {entries:r.selected.length,chars:r.chars,allowance:r.budget.chars,ids:r.selected.map(s=>s.id)};};
const out={label:'Offline knowledge audit. No model call, no database.',
 library:{records:base.length,byCategory:count(e=>knowledgeCategory(e)),byKind:count(e=>e.kind),
  averageCharsPerRecord:Math.round(base.reduce((n,e)=>n+text(e).length,0)/base.length),
  recordsTouchingDesignDomains:Object.fromEntries([0,1,2,3,4,5,6].map(n=>[`${n} of 6 (roof, facade, entrance, landscape, hierarchy, circulation)`,perRecord.filter(c=>c===n).length])),
  curatedRecordsWhoseCombinationsFieldIsSharedBoilerplate:[...shared.values()].filter(n=>n>=3).reduce((a,b)=>a+b,0),curatedRecords:curated.length,
  legacyRecipes:base.filter(e=>e.id.startsWith('legacy-')).length,recordsRestingOnUnbuildableRoofForms:base.filter(unbuildableRoofForm).map(e=>e.title),
  recordsMentioningSceneOperations:base.filter(e=>/operation|scene/i.test(e.capabilities+' '+(e.construction?.supports??''))).length},
 strategiesAdded:all.filter(isStrategy).map(e=>e.id),
 retrieval:Object.fromEntries(Object.entries(briefs).map(([k,b])=>[k,{before:trace(b,false),after:trace(b,true)}]))};
writeFileSync(`${dir}/knowledge-audit.json`,JSON.stringify(out,null,1));
console.log(JSON.stringify({library:out.library,mansion:out.retrieval.mansion},null,1).slice(0,3500));
