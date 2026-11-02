import type { SceneOperation, ArchitecturalScene } from './model';
import { resolveSceneResult } from './terra';

/** Developer-authored OFFLINE construction studies, not templates used by Generate,
 * autonomous Terra generations, completed room plans or proof of beauty. Both
 * answer the same broad brief with different massing/circulation organizations. */
export const estateStudyBrief = 'A $25m tropical waterfront estate on a flat site; choose an original residential composition, differentiated private accommodation and shaded outdoor living. Site orientation and household are unspecified.';
const wing = (id:string,at:number[],width:number,depth:number,rotation=0,height=3.6):SceneOperation => ({op:'assemble',assembly:{kind:'residential-wing',parameters:{id,at,width,depth,rotation,height,bays:4,material:'ivory',roofForm:'flat',roofRise:1,overhang:.6,entryBay:1}}});
const terrace = (id:string,at:[number,number,number],size:[number,number,number]):SceneOperation => ({op:'add',element:{id,label:id,kind:'plate',at,size,rotation:0,panels:1,material:'limestone'}});
export function estateConceptStudy(concept:'court'|'promenade'): ArchitecturalScene {
 const court = concept === 'court';
 const operations:SceneOperation[] = court ? [
  wing('primary',[0,.1,0],36,18,0,4.8),
  wing('private-west',[-32,.1,4],18,24,Math.PI/2),
  wing('private-east',[32,.1,4],18,24,-Math.PI/2),
  wing('guest',[0,.1,36],24,16,Math.PI),
  terrace('court-walk',[0,.1,18.5],[40,.2,19]),
 ] : [
  wing('primary',[0,.1,0],36,18,0,4.8),
  wing('private',[42,.1,-4],24,22),
  wing('guest',[-38,.1,4],22,18),
  wing('service',[-64,.1,-2],18,14),
  terrace('promenade',[0,.1,17],[146,.2,8]),
  terrace('primary-link',[0,.1,11],[4,.2,4]),
  terrace('private-link',[42,.1,10],[4,.2,6]),
  terrace('service-link',[-64,.1,9],[4,.2,8]),
 ];
 const result=resolveSceneResult({mode:'generate',prompt:estateStudyBrief},{
  name:`Offline developer study: ${court?'Garden court':'Staggered coastal promenade'}`,
  summary:'Developer-authored structural organization study using existing residential-wing assemblies and editable plates.',
  unsupported:['Exterior construction study only: no internal suite partitions, covered links, site survey, engineering, market valuation or certified circulation. Outdoor paths are geometric connections; no thermal performance is simulated.'],
  architecturalPlan:{
   scaleRationale:'Assume an estate programme for the stated qualitative property value, not construction spend. Different residential blocks distribute floor surfaces while preserving room-scale bay heights. Surface totals do not certify enclosed usable area.',
   arrivalAndCirculation:court?'Assumptions: arrival crosses court-walk; each wing entry faces the court. Internal subdivisions and weather protection need further design.':'Assumptions: arrive from the west, follow promenade and branching links to differentiated residential blocks. Internal privacy and weather protection remain undeveloped.',
   volumeHierarchy:court?'Garden court: taller primary salon anchors two unequal-use private wings and a subordinate guest block across an outdoor room.':'Staggered coastal promenade: taller primary salon anchors a lateral sequence of private, guest and service blocks with different depths and setbacks.',
   relationshipsAndViews:'Assume water toward +Z; primary living and outdoor approach relate to the view. No surveyed north, coastline or access is asserted.',
   roofFacadeAndMaterials:'Independent flat roofs at enclosure heads; recessed framed glazing and stone reveals. Roof envelopes remain separated. Covered external circulation is not claimed.',
   intendedSpaces:['Primary living and entertaining','Private accommodation','Guest accommodation','Outdoor arrival and living'],
   spatialRelationships:[{subject:'primary',target:court?'court-walk':'primary-link',relation:'connected-to',clearance:0,reason:'Shared floor datum at the main entrance side.'}],
  },operations,
 });
 return result.scene;
}
