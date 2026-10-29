import retained from './__tests__/fixtures/horizon-estate.response.json';
import { validateCompositionPreview } from './composition';
import { footprintSchema, type FootprintBuilding } from './footprint';
type Sections=NonNullable<FootprintBuilding['facades']>;
const treatments:Sections[]=[
 [{edges:[0,7],treatment:'solid',material:'warm-stone'},{edges:[1],treatment:'entrance'},{edges:[2,3],treatment:'screen'},{edges:[4,5,6],treatment:'loggia'}],
 [{edges:[0,1,2],treatment:'solid',material:'limestone',terraceEdge:'solid'},{edges:[3,4,5],treatment:'glass'},{edges:[6],treatment:'screen'},{edges:[7],treatment:'entrance'}],
 [{edges:[7],treatment:'solid',material:'sand',terraceEdge:'solid'},{edges:[0,2],treatment:'colonnade',material:'sand',terraceEdge:'solid'},{edges:[1],treatment:'entrance',material:'limestone'},{edges:[3,4,5,6],treatment:'colonnade',material:'sand',terraceEdge:'solid'}],
];
export function facadeExamples(){return treatments.map((facades,i)=>{
 const form=footprintSchema.parse(retained.changes.forms[0]);
 form.facades=facades;
 form.upper!.facades=i===0?[{edges:[0,1,5],treatment:'solid',material:'warm-stone'},{edges:[2,3,4],treatment:'screen'}]:i===1?[{edges:[0,1,2],treatment:'solid',material:'limestone'},{edges:[3,4,5],treatment:'glass'}]:[{edges:[0,1,5],treatment:'solid',material:'sand'},{edges:[2,3,4],treatment:'colonnade',material:'sand'}];
 return validateCompositionPreview({...structuredClone(retained.changes),id:['tropical-loggia','sculptural-horizon','mediterranean-rhythm'][i],name:['Tropical Loggia','Sculptural Horizon','Mediterranean Rhythm'][i],character:'Same retained Horizon footprint and estate · deterministic façade study',forms:[form,...retained.changes.forms.slice(1)]});
});}
