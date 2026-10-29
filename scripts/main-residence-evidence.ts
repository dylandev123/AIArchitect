import { mkdirSync,writeFileSync } from 'node:fs';
import { mainResidenceExamples } from '../src/lib/villa/main-residence-examples';
import { landscapeAcceptance } from '../src/lib/villa/composition';
import { footprintFacadeBays } from '../src/lib/villa/footprint';
const dir='docs/villa-playground/main-residences';mkdirSync(dir,{recursive:true});
const designs=mainResidenceExamples();
writeFileSync(`${dir}/configurations.json`,JSON.stringify(designs,null,2));
writeFileSync(`${dir}/geometry-checks.json`,JSON.stringify(designs.map(c=>({id:c.id,principalForms:c.forms!.length,detachedResidentialWings:c.wings.length,facadeBays:footprintFacadeBays(c.forms![0]),lowerHeight:c.forms![0].height,upperHeight:c.forms![0].upper!.height,landscapeFindings:landscapeAcceptance(c).unresolved})),null,2));
