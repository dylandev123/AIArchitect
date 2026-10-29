import { compareSceneEvidence } from './scene/visualEvidence';
import { designLessonKnowledge } from './design-learning-knowledge';
import { importArchitecturalKnowledge, inspectArchitecturalKnowledge } from '@/lib/library/architecture/service';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { lessonSummarySchema,summarizeLesson,validateDesignLesson } from './design-learning';
const root=()=>path.join(process.cwd(),'.data','villa-design-lessons');
/** Immutable private records alongside existing component candidates; no existing design is edited. */
export async function saveDesignLesson(raw:unknown){
 const lesson=validateDesignLesson(raw),id=randomUUID();
 const comparison='elements' in lesson.before && 'elements' in lesson.after?compareSceneEvidence(lesson.before,lesson.after):null;
 let knowledge:{id:string;status:'proposed'|'needs-consolidation'}|undefined;await mkdir(root(),{recursive:true});
 await writeFile(path.join(root(),`${id}.json`),JSON.stringify({id,createdAt:new Date().toISOString(),lesson,evidence:{comparison,geometric:comparison&&comparison.resolved.length>0&&comparison.introduced.length===0?'verified geometric correction':'unverified geometric benefit',visual:lesson.origin==='mock'?'simulated feedback':`human-${lesson.verdict}`,architecturalKnowledge:'requires separate approval',modelSuggestion:'not proof of architectural success'}}),{flag:'wx',mode:0o600});
 if(lesson.transferable){
  const entry=designLessonKnowledge(lesson,id);
  const existing=await inspectArchitecturalKnowledge();
  // Never overwrite a previous approval or conflicting principle. Consolidation
  // and supersession stay in the existing optimistic-concurrency admin workflow.
  const duplicate=existing.find(r=>r.id===entry.id || r.revisions.at(-1)?.title.toLowerCase().replace(/[^a-z0-9]/g,'')===entry.title.toLowerCase().replace(/[^a-z0-9]/g,''));
  if(duplicate)knowledge={id:duplicate.id,status:'needs-consolidation'};
  else {await importArchitecturalKnowledge([{entry,expectedVersion:0}]);knowledge={id:entry.id,status:'proposed'};}
 }
 await writeFile(path.join(root(),`${Date.now()}-${id}.summary.json`),JSON.stringify({createdAt:new Date().toISOString(),lesson:summarizeLesson(lesson)}),{flag:'wx',mode:0o600});return {id,knowledge};
}
/** Only small validated summaries enter retrieval; full captures remain on disk for audit. */
export async function listDesignLessonSummaries(){
 await mkdir(root(),{recursive:true});
 const names=(await readdir(root())).filter(n=>/^\d{13}-[a-f0-9-]{36}\.summary\.json$/.test(n)).sort().slice(-200);
 const rows=await Promise.all(names.map(async n=>{try{const text=await readFile(path.join(root(),n),'utf8');if(text.length>12000)return null;const r=JSON.parse(text);return {createdAt:String(r.createdAt),lesson:lessonSummarySchema.parse(r.lesson)};}catch{return null;}}));
 return rows.filter(r=>r!==null).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)).slice(-200).map(r=>r.lesson);
}
