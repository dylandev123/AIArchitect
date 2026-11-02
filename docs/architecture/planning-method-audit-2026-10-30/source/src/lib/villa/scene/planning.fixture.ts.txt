import type { ArchitecturalPlan } from './planning';
/** Plan for the retained Ladera regression scene, not a production design preset. */
export const laderaPlan: ArchitecturalPlan = {
 scaleRationale:'Compact two-level garden residence, retained test study.',levels:2,enclosedAreaM2:307,
 arrivalAndCirculation:'Arrival steps lead to pivot door; garden stair connects bridge.',
 volumeHierarchy:'Salon primary, east dining wing and recessed bridge suite subordinate.',
 relationshipsAndViews:'Salon faces garden; bridge overlooks terrace.',roofFacadeAndMaterials:'Layered flat roofs with stone walls and timber shade.',
 spaces:[
  {name:'Salon',use:'interior',level:0,areaM2:150,floorIds:['salon-floor'],enclosureIds:['salon-back','salon-west','salon-front','salon-east'],roofIds:['salon-roof']},
  {name:'Dining',use:'interior',level:0,areaM2:66,floorIds:['east-floor'],enclosureIds:['east-back','east-front','east-side'],roofIds:['east-roof']},
  {name:'Bridge suite',use:'interior',level:1,areaM2:91,floorIds:['bridge-floor'],enclosureIds:['bridge-rear','bridge-west','bridge-front','bridge-east'],roofIds:['bridge-roof']},
  {name:'Balcony',use:'outdoor',level:1,areaM2:28.6,floorIds:['balcony-deck'],enclosureIds:[],roofIds:[]},
 ],
 commitments:[
  {kind:'entrance',description:'Sheltered pivot door',elementIds:['pivot-door']},
  {kind:'circulation',description:'Arrival and stair landing',elementIds:['arrival-step-0','stair-landing']},
  {kind:'primary-volume',description:'Garden salon',elementIds:['salon-floor','salon-back']},
  {kind:'secondary-volume',description:'Bridge suite',elementIds:['bridge-floor']},
  {kind:'roof',description:'Layered roof hierarchy',elementIds:['salon-roof','bridge-roof','east-roof']},
  {kind:'facade',description:'Stone and glazed garden facade',elementIds:['salon-back','salon-front']},
  {kind:'terrace',description:'Suite balcony',elementIds:['balcony-deck']},
 ],
};
