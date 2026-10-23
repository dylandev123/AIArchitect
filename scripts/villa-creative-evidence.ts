import { mkdirSync, writeFileSync } from 'node:fs';
import { creativeExamples } from '../src/lib/villa/creative-examples';
import { buildComposition } from '../src/lib/villa/composition';
const directory='docs/villa-playground/creative-freedom';
mkdirSync(directory,{recursive:true});
const examples=creativeExamples();
writeFileSync(`${directory}/offline-responses.json`,JSON.stringify(examples.map(changes=>({changes,summary:`Deterministic offline example: ${changes.name}.`,unsupported:[]})),null,2)+'\n');
const evidence=examples.map(c=>({id:c.id,name:c.name,garden:c.garden,landscapeMargin:c.landscapeMargin,buildingWings:c.wings.length,galleries:c.connections.length,detachedWings:c.wings.filter(w=>w.detached).length,
  grossWingFloorArea:c.wings.reduce((sum,w)=>sum+w.width*w.depth*w.storeys,0),pool:c.pool,components:c.components ?? [],renderedVolumes:buildComposition(c).wings.map(w=>({id:w.id,role:w.role,x:w.x,z:w.z,width:w.width,depth:w.depth,storeys:w.storeys,orientation:w.orientation}))}));
writeFileSync(`${directory}/geometry-checks.json`,JSON.stringify({provenance:'Deterministic authored configurations validated by the existing executor; no provider calls.',examples:evidence},null,2)+'\n');
console.log(JSON.stringify(evidence.map(({renderedVolumes:_renderedVolumes,...e})=>e),null,2));
