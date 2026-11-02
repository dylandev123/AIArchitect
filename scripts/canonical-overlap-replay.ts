// Offline: replays the retained corrected-mansion proposal through the unchanged compiler. No network, no writes.
import { readFileSync } from 'node:fs';
import { compileArchitecturalPlan } from '../src/lib/villa/canonical/plan';
const proposal=JSON.parse(readFileSync('docs/architecture/canonical-corrected-mansion-2026-11-02/proposal.normalized.json','utf8'));
try{compileArchitecturalPlan(proposal.plan);console.log('compiled');}
catch(error){console.log((error as {decisions?:string[]}).decisions?.join('\n')??String(error));}
