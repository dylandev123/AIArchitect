import type { KnowledgeRevision } from './model';

/** Backward-compatible defaults for the initial catalog. Stored revisions can
 * supply more specific construction and category metadata through bulk import. */
export function knowledgeCategory(e: KnowledgeRevision): NonNullable<KnowledgeRevision['category']> {
 if(e.category) return e.category;
 const s=`${e.id} ${e.title}`;
 if(/pool|wellness|fitness|gym|cinema|sports|garage|dock|guest.house/.test(s)) return 'amenity';
 if(/entrance|arrival|threshold|foyer/.test(s)) return 'arrival';
 if(/bedroom|suite|kitchen|living|dining|family|bathroom|circulation|service/.test(s)) return 'programme';
 if(/material|durability/.test(s)) return 'materials';
 if(/facade|window|glaz|envelope/.test(s)) return 'envelope';
 if(/roof|terrace|balcon|court|loggia|outdoor|pergola|overhang|shelter|veranda/.test(s)) return 'roof-outdoor';
 if(/tropical|waterfront|climate|privacy|view|site/.test(s)) return 'climate-site';
 if(/bedroom|suite|kitchen|living|dining|family|room/.test(s)) return 'programme';
 if(/material/.test(s)) return 'materials';
 if(/support|vertical|editing|enclosure/.test(s)) return 'construction';
 return 'composition';
}
export function constructionFor(e: KnowledgeRevision): KnowledgeRevision['construction'] {
 if(e.construction) return e.construction;
 const id=e.id;
 const requiredKinds: NonNullable<KnowledgeRevision['construction']>['requiredKinds'] =
 /pergola/.test(id) ? ['plate','volume'] : /pool/.test(id) ? ['plate','wall','water'] : /entrance|threshold|foyer/.test(id) ? ['plate','wall','entrance','roof'] :
 /rooftop|roof-terrace/.test(id) ? ['plate','balcony','entrance','roof'] : /balcony/.test(id) ? ['plate','balcony','entrance'] : /terrace/.test(id) ? ['plate'] : /bedroom|suite|guest-house|family|enclosure/.test(id) ? ['plate','wall','roof','entrance'] :
 /roof/.test(id) ? ['roof'] : /facade|window|envelope/.test(id) ? ['wall'] : ['plate','wall','roof'];
 return {operations:['add','attach','place-on','finish'], requiredKinds,
  materials:'Choose among ivory, limestone, timber, bronze and sage to suit the brief; no custom textures or specialist material certification.',
  supports:'Connect floors, enclosure, actual openings and overhead shelter as applicable; align supports and datums. Elevated decks need guards and actual access.',
  unsupported:e.capabilities+' No automatic circulation, engineering, service equipment or code compliance verification.'};
}
