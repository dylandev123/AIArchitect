import {expect,it} from 'vitest';
import {generationDiagnostics} from './generationDiagnostics';
import {laderaScene} from './example';
it('traces exact adds, edits and atomic rollback without changing retained output',()=>{
 const output={name:'Replay',summary:'Original',unsupported:[],operations:laderaScene.elements.map(element=>({op:'add',element}))};
 const before=JSON.stringify(output);
 const report=generationDiagnostics('test',{mode:'generate',prompt:'Original brief'},output);
 expect(report.outcome).toBe('accepted');
 expect(report.components?.length).toBe(laderaScene.elements.length);
 expect(report.components?.every(c=>c.directOperationIndexes.length===1)).toBe(true);
 expect(JSON.stringify(output)).toBe(before);
 const rejected=generationDiagnostics('edit',{mode:'edit',prompt:'Remove missing',current:laderaScene},{...output,operations:[{op:'remove',id:'missing'}]});
 expect(rejected.outcome).toBe('rejected');
 expect(rejected.operations?.[0].disposition).toBe('transaction-rolled-back');
 expect(rejected.constructed).toBeNull();
});
it('preserves original indexes when flat staging excludes terrain',()=>{
 const result=generationDiagnostics('test',{mode:'generate',prompt:'Build'}, {name:'Scene',summary:'Scene',unsupported:[],operations:[{op:'set-terrain',terrain:null},...laderaScene.elements.map(element=>({op:'add',element}))]});
 expect(result.operations?.[0].disposition).toBe('excluded-flat-staging');
 expect(result.components?.[0].operationIndexes).toEqual([1]);
});
