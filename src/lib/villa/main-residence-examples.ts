import retained from './__tests__/fixtures/main-residence-estate.response.json';
import { validateCompositionPreview, type VillaComposition } from './composition';
import type { FootprintBuilding } from './footprint';

// Same estate grounds and sea pavilion; residential wings become one principal form.
// Full local configurations, never a preset selection in Terra's executor.
const base={builder:'footprint-building@1',x:0,z:-12,orientation:0,height:4.2,material:'ivory',openings:'panoramic'} as const;
const forms:FootprintBuilding[]=[
  {...base,id:'crescent-crown',points:[
    {x:-28,z:7,curve:{x:-30,z:-17}},{x:0,z:-17,curve:{x:30,z:-17}},{x:28,z:7},
    {x:20,z:8,curve:{x:18,z:-7}},{x:0,z:-7,curve:{x:-18,z:-7}},{x:-20,z:8}],
    upper:{height:3.8,points:[{x:-20,z:-4,curve:{x:-20,z:-13}},{x:0,z:-13,curve:{x:20,z:-13}},{x:20,z:-4},{x:16,z:-6,curve:{x:0,z:-14}},{x:-16,z:-6}]}},
  {...base,id:'terrace-ziggurat',material:'limestone',points:[
    {x:-29,z:-13},{x:12,z:-13},{x:12,z:-7},{x:29,z:-7},{x:29,z:8},{x:5,z:8},{x:5,z:3},{x:-29,z:3}],
    upper:{height:4.5,points:[{x:-23,z:-10},{x:8,z:-10},{x:8,z:-3},{x:20,z:-3},{x:20,z:4},{x:9,z:4},{x:9,z:0},{x:-23,z:0}]}},
  {...base,id:'butterfly-headland',material:'sand',height:4.8,points:[
    {x:-29,z:-8},{x:-23,z:-16},{x:0,z:-7},{x:23,z:-16},{x:29,z:-8},{x:8,z:5},{x:0,z:9},{x:-8,z:5}],
    upper:{height:3.4,points:[{x:-7,z:-7},{x:0,z:-4},{x:7,z:-7},{x:9,z:-3},{x:0,z:4},{x:-9,z:-3}]}},
];
// Curved facade sampling remains within the existing 180-bay per-floor budget.
for(const level of [forms[0],forms[0].upper!]) level.points=level.points.map(p=>({x:p.x*.78,z:p.z*.78,...(p.curve?{curve:{x:p.curve.x*.78,z:p.curve.z*.78}}:{})}));
export function mainResidenceExamples():VillaComposition[]{
  return forms.map((f,i)=>validateCompositionPreview({...structuredClone(retained.changes),
    id:f.id,name:['Crescent Crown','Terrace Ziggurat','Butterfly Headland'][i],
    character:['A continuous crescent residence, crowned by an inset curved sky floor.',
      'Staggered limestone volumes rise above a long, folded terrace plinth.',
      'Two splayed living arms converge beneath a compact elevated arrival crown.'][i],
    wings:[],connections:[],forms:[f],
  }));
}
