import {expect,it} from 'vitest';
import {resolveSceneResult,SceneConstructionError,SCENE_ASSEMBLY_INSTRUCTIONS} from './terra';
import {assemblyOperations} from './assemblies';
import {type SceneOperation} from './model';

it('reports responsible assembly operations without changing or accepting rejected geometry',()=>{
 const wing=(id:string,x:number):SceneOperation=>({op:'assemble',assembly:{kind:'residential-wing',parameters:{id,at:[x,.1,0],rotation:0,width:12,depth:8,height:3.4,bays:3,material:'ivory',roofForm:'flat',roofRise:1,overhang:1,entryBay:1}}});
 const output={name:'Collision',summary:'Offline diagnostic',unsupported:[],operations:[wing('first',0),wing('second',13)]};
 const before=JSON.stringify(output);
 try{resolveSceneResult({mode:'generate',prompt:'Offline'},output);throw Error('Expected rejection');}
 catch(error){expect(error).toBeInstanceOf(SceneConstructionError);expect(String(error)).toContain('0:assemble:first');expect(String(error)).toContain('1:assemble:second');expect((error as SceneConstructionError).recoverableDraft.elements.some(e=>e.id==='first-roof')).toBe(true);}
 expect(JSON.stringify(output)).toBe(before);
});

it('documents actual pool child IDs and the elevation-aware assembly roof restriction',()=>{
 const ops=assemblyOperations({kind:'rectangular-pool',parameters:{id:'id',at:[0,.15,0],rotation:0,width:6,depth:4,basinDepth:1.4,material:'limestone'}});
 for(const [name,kind] of [['id-floor','plate'],['id-water','water'],['id-wall-x-minus','wall'],['id-wall-z-plus','wall'],['id-deck-far','plate']])expect(ops.some(op=>op.op==='add'&&op.element.id===name&&op.element.kind===kind)).toBe(true);
 expect(SCENE_ASSEMBLY_INSTRUCTIONS).toContain('id-wall-x-minus/plus');
 expect(SCENE_ASSEMBLY_INSTRUCTIONS).toContain('separated roof layers are allowed');
});
