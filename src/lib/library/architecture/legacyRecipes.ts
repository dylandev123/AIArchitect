import type { DesignRecipe } from '@/types/library';
import type { KnowledgeRevision } from './model';

/** Read existing recipe records in place; never import, approve or rewrite them.
 * Legacy parameter values are options, not executable geometry or capability proof. */
export function legacyRecipeKnowledge(recipes: DesignRecipe[]): KnowledgeRevision[] {
 return recipes.map(r => ({
  id:`legacy-recipe-${r.id}`, title:r.name, kind:'recipe',
  category: ({roof:'roof-outdoor',pool:'amenity','outdoor-living':'roof-outdoor',terrace:'roof-outdoor',courtyard:'roof-outdoor','motor-court':'arrival',facade:'envelope',planting:'climate-site','retaining-wall':'construction','entry-sequence':'arrival',massing:'composition','space-planning':'programme','material-palette':'materials','lighting-strategy':'envelope'} as const)[r.category],
  tags:[...r.styleTags,...r.environmentTags,r.category,...r.name.toLowerCase().split(/[^a-z]+/).filter(t=>t.length>3)],
  scales:[...new Set(r.compatibleScales.map(s=>({cottage:'compact',family:'family',luxury:'estate',estate:'estate',mansion:'mansion'} as const)[s]))], when:`Existing ${r.category} recipe; original compatible scales: ${r.compatibleScales.join(', ') || 'unspecified'}.`,
  combinations:JSON.stringify(r.relationships), placement:r.guidance.join(' '),
  principles:`Adapt approved guidance to the brief. Parameter options: ${JSON.stringify(r.parameters)}.`,
  capabilities:`Required capabilities: ${(r.requiredCapabilities??[]).join(', ')}. Check against the scene construction contract; approval does not implement capabilities.`,
  sources:[{reference:`library recipe ${r.id}`,note:'Existing recipe approval; no new external verification.',kind:'repository',verified:false}],
  status:r.approval==='approved'?'approved':r.approval==='proposed'?'proposed':'retired',
  supersedes:[],review:`Existing recipe approval: ${r.approval}`,version:r.version,updatedAt:r.updated_at,
 }));
}
