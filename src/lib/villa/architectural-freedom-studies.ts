import { validateCompositionPreview, type VillaComposition } from './composition';
import type { FootprintBuilding } from './footprint';
import { residenceCompositionStudies } from './residence-composition-studies';
const rect=(x:number,z:number,w:number,d:number)=>[{x,z},{x:x+w,z},{x:x+w,z:z+d},{x,z:z+d}];
const shell={builder:'footprint-building@1',x:0,z:0,orientation:0,material:'ivory',openings:'panoramic'} as const;
const sky:FootprintBuilding={...shell,id:'sky-court',height:6.8,rooftop:'railed',
 points:[{x:-18,z:-12},{x:13,z:-12},{x:18,z:-5},{x:18,z:10},{x:2,z:10},{x:2,z:5},{x:-18,z:5}],
 facades:[{edges:[0],treatment:'entrance',material:'warm-stone'},{edges:[1],treatment:'screen',material:'limestone'},{edges:[3,5],treatment:'loggia'},{edges:[6],treatment:'screen'}],
 levels:[
 {id:'west-suites',parentId:'base',points:rect(-16,-10,14,13),height:3.3,material:'warm-stone',openings:'private',rooftop:'railed',facades:[{edges:[2],treatment:'screen'}]},
 {id:'view-salon',parentId:'base',points:[{x:1,z:-10},{x:14,z:-9},{x:19,z:1},{x:16,z:9},{x:1,z:7}],height:3.2,material:'ivory',openings:'panoramic',rooftop:'lounge',facades:[{edges:[0],treatment:'solid'},{edges:[2,3],treatment:'loggia'}]},
 {id:'library-tower',parentId:'west-suites',points:rect(-15,-9,11,10),height:3.4,material:'limestone',openings:'rhythm',rooftop:'none',facades:[{edges:[0,3],treatment:'solid'},{edges:[2],treatment:'glass'}]},
 {id:'sky-room',parentId:'library-tower',points:[{x:-15,z:-9},{x:-4,z:-9},{x:-3,z:-1},{x:-14,z:1}],height:3.1,material:'ivory',openings:'panoramic',rooftop:'shaded',facades:[{edges:[2],treatment:'screen'},{edges:[3],treatment:'solid'}]},
 ]};
const fold:FootprintBuilding={...shell,id:'folded-ridge',height:4.1,rooftop:'none',
 points:[{x:-20,z:-7},{x:-4,z:-11},{x:19,z:-4},{x:22,z:5},{x:5,z:10},{x:-6,z:3},{x:-20,z:7}],
 facades:[{edges:[0],treatment:'solid',material:'warm-stone'},{edges:[1],treatment:'screen'},{edges:[2],treatment:'entrance'},{edges:[3,4],treatment:'loggia'},{edges:[5],treatment:'colonnade'}],
 levels:[{id:'splayed-library',parentId:'base',points:[{x:-17,z:-6},{x:-5,z:-9},{x:3,z:-6},{x:0,z:0},{x:-17,z:4}],height:4.5,material:'limestone',openings:'private',rooftop:'none',facades:[{edges:[0],treatment:'solid'},{edges:[2,3],treatment:'glass'}]}]};
/** Deterministic validation inputs; no study names or topology enter the provider schema. */
export function architecturalFreedomStudies():VillaComposition[]{
 const old=residenceCompositionStudies(),clean={...old[0],forms:[],components:[]};
 const estate=structuredClone(old[2]);estate.id='freedom-estate';estate.name='Palm Court Estate';
 estate.wings[1].z+=4;estate.wings[1].eave=1.8;
 estate.wings[1].appearance={style:'caribbean',roof:'gable',exterior:'warm-stone',glazing:'panoramic'};
 estate.wings[2].appearance={style:'modern',roof:'flat',exterior:'limestone',glazing:'panoramic'};
 const river=structuredClone(old[1]);river.id='freedom-river';river.name='River Ribbon House';
 const f=river.forms![0],upper=f.volumes![0];delete f.volumes;
 f.levels=[{...upper,id:'curved-library',parentId:'base',material:'warm-stone',openings:'panoramic',rooftop:'none'}];
 return [
  {...clean,id:'freedom-sky',name:'Sky Court Mansion',character:'A double-height arrival, splayed salon and four-storey stone tower with a roof garden.',forms:[sky]},
  estate,
  {...clean,id:'freedom-fold',name:'Folded Ridge House',character:'An angular living landscape with a stone library crossing its shaded garden edge.',forms:[fold]},
  river,
 ].map(s=>validateCompositionPreview(s));
}
