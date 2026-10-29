/** Offline evidence inputs only. No provider, credentials or network imports. */
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import { createHash } from 'node:crypto';
import retained from '../src/lib/villa/__tests__/fixtures/first-live-vision.json';
import { constructVision } from '../src/lib/villa/image-vision';
import { executeCompositionPatch,validateCompositionPreview } from '../src/lib/villa/composition';
import { residenceCompositionStudies } from '../src/lib/villa/residence-composition-studies';
import { architecturalFreedomStudies } from '../src/lib/villa/architectural-freedom-studies';
const root='.data/villa-offline-studies';mkdirSync(root,{recursive:true});
const reference={source:'/inspiration/villa.jpg',image:`data:image/jpeg;base64,${readFileSync('public/inspiration/villa.jpg').toString('base64')}`};
const pairs=[];
const source=constructVision(retained).config;
// One visible near-end window. Dimensions/position are explicit human estimates,
// not values recovered by Terra. Retain massing, roof, pool and hidden facades.
const corrected=executeCompositionPatch(source,{appearance:{exterior:'sand',glazing:'panoramic'},wings:[{type:'adjust',id:source.wings[0].id,changes:{facadeOpenings:[{face:'right',level:0,openings:[{id:'near-window',offset:3.8,width:2.4,sill:.55,height:2.25,kind:'window',frame:'timber'}]}]}}]});
pairs.push({id:'reference-window',before:source,after:corrected,reference,summary:'Manual evidence-guided window study; placement and scale estimated. Roof/patio remain uncorrected.',unsupported:['No confirmed entrance, hidden elevations or interior plan.','Source perspective and near-wall dimensions remain estimated.']});
for(const config of [residenceCompositionStudies()[0],architecturalFreedomStudies()[0]]){
 const after=structuredClone(config),form=after.forms![0];
 // Deliberate controllability tests on existing dissimilar houses, not source reconstructions.
 const edge=0,a=form.points[0],b=form.points[1],length=Math.hypot(b.x-a.x,b.z-a.z);
 form.facades=form.facades?.filter(f=>!f.edges.includes(edge)||f.treatment==='solid');
 form.preciseOpenings=[{id:'arrival-door',edge,offset:length*.28,width:1.6,sill:0,height:2.7,kind:'door',frame:'timber'},{id:'private-window',edge,offset:length*.65,width:1.8,sill:1.1,height:1.5,kind:'window',frame:'bronze'}];
 // Keep the existing view-facing loggias/screens. Upper windows remain independent.
 if(form.levels){form.levels[0].preciseOpenings=[{id:'suite-window',edge:0,offset:4,width:2,sill:.9,height:1.8,kind:'window',frame:'bronze'}];form.levels[0].facades=form.levels[0].facades?.filter(f=>!f.edges.includes(0));}
 pairs.push({id:form.levels?'branching-levels':'angular-volumes',before:config,after:validateCompositionPreview(after),summary:'Offline opening-placement experiment, no source image; architectural quality unverified.',unsupported:['No reference image: this tests supported editing and rendering, not image similarity.']});
}
for(const pair of pairs)for(const phase of ['before','after'] as const)writeFileSync(`${root}/${pair.id}-${phase}.json`,JSON.stringify({config:pair[phase],summary:pair.summary,unsupported:pair.unsupported,reference:pair.reference}));
mkdirSync('docs/villa-playground/terra-intelligence',{recursive:true});
writeFileSync('docs/villa-playground/terra-intelligence/offline-manifest.json',JSON.stringify({providerCalls:0,referenceSha256:createHash('sha256').update(readFileSync('public/inspiration/villa.jpg')).digest('hex'),pairs:pairs.map(p=>({id:p.id,summary:p.summary,unsupported:p.unsupported,before:p.before,after:p.after}))},null,2));
console.log('Three offline comparison pairs saved; originals and retained responses untouched.');
