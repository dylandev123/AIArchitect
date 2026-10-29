import { validateComposition,type VillaComposition } from './composition';
import type { FootprintBuilding } from './footprint';
const base={builder:'footprint-building@1',x:0,z:0,orientation:0,height:3.8,material:'ivory',openings:'panoramic'} as const;
const forms:FootprintBuilding[]=[
 {...base,id:'ocean-arc',points:[{x:-16,z:3,curve:{x:0,z:-10}},{x:16,z:3},{x:14,z:10,curve:{x:0,z:-1}},{x:-14,z:10}]},
 {...base,id:'asymmetric-crescent',height:3.4,material:'limestone',openings:'rhythm',points:[{x:-15,z:7,curve:{x:-21,z:-12}},{x:0,z:-10,curve:{x:19,z:-10}},{x:17,z:6},{x:12,z:4,curve:{x:6,z:-7}},{x:-4,z:-2,curve:{x:-12,z:0}},{x:-12,z:9}]},
 {...base,id:'articulated-house',height:4.2,material:'sand',openings:'rhythm',points:[{x:-15,z:-7},{x:2,z:-7},{x:2,z:-3},{x:14,z:-3},{x:17,z:4},{x:9,z:8},{x:3,z:8},{x:3,z:4},{x:-5,z:4},{x:-5,z:8},{x:-15,z:8}]},
];
export function footprintExamples():VillaComposition[]{return forms.map((f,i)=>validateComposition({version:1,id:f.id,name:['Ocean Arc Residence','Asymmetric Crescent Pavilion','Articulated Contemporary Residence'][i],character:'Deterministic local footprint study · no AI calls',appearance:{style:'modern',roof:'flat',exterior:f.material,glazing:'panoramic',landscape:'tropical'},wings:[],connections:[],terraces:[],pool:null,garden:{x:0,z:0,width:50,depth:40},siteMode:'derived',landscapeMargin:5,forms:[f]}));}
