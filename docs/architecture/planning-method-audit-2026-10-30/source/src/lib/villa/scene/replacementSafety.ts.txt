import type {ArchitecturalScene,SceneOperation} from './model';

function constructionReferences(value:unknown,keys=['floorIds','enclosureIds','roofIds','accessIds','elementIds']):string[]{
 if(!value||typeof value!=='object')return [];
 if('disposition' in value&&value.disposition!=='constructed')return [];
 return Object.entries(value).flatMap(([key,item])=>
  keys.includes(key)&&Array.isArray(item)
   ?item.filter((id):id is string=>typeof id==='string')
   :Array.isArray(item)?item.flatMap(v=>constructionReferences(v,keys)):constructionReferences(item,keys));

}
/** Narrow edit-only evidence check. Missing amenities/rooms are never hard gates.
 * Require destruction + explicit replacement claim + newly promised missing IDs.
 * Historical missing references and ordinary removal-only edits remain compatible. */
export function incompleteReplacement(previous:ArchitecturalScene,next:ArchitecturalScene,operations:SceneOperation[],summary:string):string|undefined{
 const removed=operations.filter(op=>op.op==='remove').map(op=>previous.elements.find(e=>e.id===op.id))
  .filter(e=>e&&['roof','plate','wall','entrance','volume'].includes(e.kind));
 if(!removed.length)return;
 const plan=next.architecturalPlan;
 const sentences=(plan&&typeof plan==='object'?Object.values(plan).filter((v):v is string=>typeof v==='string'):[]).flatMap(v=>v.split(/[.!?]/));
 const replacement=/\b(?:replac(?:e[ds]?|ing|ement)|rebuild(?:ing|s)?|rebuilt|reconstruct(?:ed|ion|ing)?)\b/i;
 const assertsReplacement=(text:string)=>replacement.test(text)&&!/(?:without|no|not a)\s+(?:new\s+)?replacement/i.test(text);
 const old=new Set([...constructionReferences(previous.architecturalPlan),...previous.elements.map(e=>e.id)]);
 const existing=new Set(next.elements.map(e=>e.id));
 const roles=new Set(removed.flatMap(e=>e!.kind==='roof'?['roofIds']:e!.kind==='wall'?['enclosureIds']:e!.kind==='entrance'?['accessIds']:['floorIds']));
 const missing=[...new Set(constructionReferences(plan,[...roles]))].filter(id=>!old.has(id)&&!existing.has(id));
 const explicit=assertsReplacement(summary)||sentences.some(sentence=>assertsReplacement(sentence)&&removed.some(e=>sentence.includes(e!.id))&&missing.some(id=>sentence.includes(id)));
 const claimedBuild=assertsReplacement(summary)&&/\b(?:replac\w*|rebuilt|reconstruct\w*)\b.{0,160}\b(?:with|by)\b.{0,100}\b(?:roofs?|stairs?|staircase|bridge|floors?|walls?|doors?|landing)\b/i.test(summary);
 const changedConstruction=next.elements.some(e=>removed.some(r=>r!.kind===e.kind)&&JSON.stringify(e)!==JSON.stringify(previous.elements.find(old=>old.id===e.id)));
 if(explicit&&missing.length)return `Destructive incomplete replacement: removed ${removed.map(e=>e!.id).join(', ')} while claiming replacement construction absent from the final scene: ${missing.join(', ')}. Original scene preserved; return the replacement operations or revise the removal-only intent.`;
 if(claimedBuild&&!changedConstruction&&operations.every(op=>op.op==='remove'||op.op==='finish'))return `Destructive incomplete replacement: ${summary} Removed ${removed.map(e=>e!.id).join(', ')} but returned no replacement construction operations. Original scene preserved.`;
}
