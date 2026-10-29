import { createHash } from 'node:crypto';
import { knowledgeInputSchema } from '@/lib/library/architecture/model';
import { compareSceneEvidence } from './scene/visualEvidence';
import type { DesignLesson } from './design-learning';

/** A reviewed correction proposes an experience in the SAME revision/approval brain.
 * Human comparison does not automatically approve a transferable generalization. */
export function designLessonKnowledge(lesson: DesignLesson, recordId: string) {
  const t=lesson.transferable;
  if(!t || !lesson.correction || lesson.origin==='mock' || !('version' in lesson.before) || lesson.before.version!=='architectural-scene-1' || !('version' in lesson.after) || lesson.after.version!=='architectural-scene-1')throw Error('No eligible transferable lesson.');
  const normalized=t.title.toLowerCase().replace(/[^a-z0-9]/g,'');
  const id='reviewed-'+createHash('sha256').update(normalized).digest('hex').slice(0,32);
  const comparison=compareSceneEvidence(lesson.before,lesson.after);
  return knowledgeInputSchema.parse({
    id,title:t.title,kind:'experience',tags:t.tags,scales:[],
    when:t.context,combinations:t.exceptions,placement:t.correction,
    principles:`${lesson.verdict==='rejected'?'Rejected correction; avoid treating it as a success.':'Human-reviewed improvement; transfer remains subject to knowledge review.'} Problem: ${t.problem}`,
    capabilities:`${t.rationale} Root cause: ${t.rootCause || 'Not established'}. Confidence: ${t.confidence}.`,
    sources:[{reference:`.data/villa-design-lessons/${recordId}.json`,kind:'reviewed-design',verified:true,
      note:`Human ${lesson.verdict}; scene elements/operations and same-camera captures retained. ${comparison.resolved.length} geometric warnings resolved; ${comparison.introduced.length} introduced. Visual judgment is not structural certification.`}],
    status:'proposed',supersedes:[],review:'Pending authorized knowledge review; inspect evidence, applicability, contradictions and exceptions before approval.',
  });
}
