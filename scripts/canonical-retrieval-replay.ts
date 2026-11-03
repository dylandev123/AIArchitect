/** Offline replay of canonical knowledge retrieval for the retained brief of the end-to-end diagnostic, against the PRESERVED library snapshot
 * (docs/architecture/unified-knowledge/library-snapshot.json) and the code seeds. No model call, no database; the production knowledge is not read or written. */
import {readFileSync,writeFileSync} from 'node:fs';
import {latestKnowledge} from '../src/lib/library/architecture/service';
import {legacyRecipeKnowledge} from '../src/lib/library/architecture/legacyRecipes';
import {retrieveArchitecturalKnowledge} from '../src/lib/library/architecture/retrieval';
const D='docs/architecture/';
const snap=JSON.parse(readFileSync(`${D}unified-knowledge/library-snapshot.json`,'utf8'));
const library=[...latestKnowledge(snap.architecturalKnowledge),...legacyRecipeKnowledge(snap.recipes)];
const brief=JSON.parse(readFileSync(`${D}e2e-generation-diagnostic-2026-11-03/brief.json`,'utf8')).prompt as string;
const retained=JSON.parse(readFileSync(`${D}e2e-generation-diagnostic-2026-11-03/stage-a-input.json`,'utf8')).knowledge.selectedRecords.map((r:{id:string})=>r.id) as string[];
const r=retrieveArchitecturalKnowledge(library,brief,'generate',{canonical:true});
const now=r.selected.map(s=>s.id);
const out={label:'Offline retrieval replay. No model call, no database.',libraryRecords:library.length,eligible:r.metrics.eligible,
 retainedSelection:retained,selectionNow:now,droppedFromRetained:retained.filter(i=>!now.includes(i)),addedSinceRetained:now.filter(i=>!retained.includes(i)),
 excludedByBriefExclusion:r.metrics.excluded.filter(e=>/explicitly excludes/.test(e.reason)),
 providerFacingTextMentionsInfinity:/infinity/i.test(r.text),providerFacingChars:r.chars,providerFacingText:r.text};
writeFileSync('docs/architecture/consolidated-corrections-2026-11-03/retrieval-replay.json',JSON.stringify(out,null,1));
console.log(JSON.stringify({dropped:out.droppedFromRetained,added:out.addedSinceRetained,excluded:out.excludedByBriefExclusion,mentionsInfinity:out.providerFacingTextMentionsInfinity}));
