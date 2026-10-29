import {mkdirSync,writeFileSync} from 'node:fs';
import {architecturalFreedomStudies} from '../src/lib/villa/architectural-freedom-studies';
import {resolveVillaResult,villaProviderOutputSchema} from '../src/lib/villa/terra';
import {footprintFacadeBays,footprintOutline,footprintPlate,resolveArchitecturalLevels} from '../src/lib/villa/footprint';
const dir='docs/villa-playground/architectural-freedom';mkdirSync(dir,{recursive:true});
const studies=architecturalFreedomStudies();
const checks=studies.map(s=>{
 const request={mode:'generate' as const,prompt:s.character};
 const envelope={changes:s,summary:s.character,unsupported:[]};
 const provider=villaProviderOutputSchema(request).parse(envelope);
 const generated=resolveVillaResult(request,provider).config;
 const edit=resolveVillaResult({mode:'edit',prompt:'Preserve this architecture',current:generated},{changes:{forms:s.forms?.map(form=>({type:'put',form}))},summary:'Same design',unsupported:[]});
 if(JSON.stringify(edit.config)!==JSON.stringify(generated))throw Error('Executor changed the authored study');
 for(const f of s.forms??[])for(const l of resolveArchitecturalLevels(f)){
  const geometry=footprintPlate(footprintOutline(l),.26);
  if(!Array.from(geometry.attributes.position.array).every(Number.isFinite))throw Error('Nonfinite geometry');geometry.dispose();
 }
 return {id:s.id,provider:true,executor:true,bays:s.forms?.map(footprintFacadeBays),levels:s.forms?.map(f=>resolveArchitecturalLevels(f).map(l=>({id:l.id,bottom:l.bottom,storey:l.level+1}))),wings:s.wings.length};
});
writeFileSync(`${dir}/configurations.json`,JSON.stringify(studies,null,2));
writeFileSync(`${dir}/geometry-checks.json`,JSON.stringify({providerCalls:0,checks},null,2));console.log(checks);
