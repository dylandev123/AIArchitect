import { it,expect } from 'vitest';
import { defaultVilla } from './design';
import { learningContext,validateDesignLesson } from './design-learning';
const bytes=Buffer.alloc(36);Buffer.from('\x89PNG\r\n\x1a\n','binary').copy(bytes);bytes.write('IHDR',12);bytes.writeUInt32BE(640,16);bytes.writeUInt32BE(360,20);
const shots=['Aerial','Arrival','Poolside'].map(view=>({view,image:`data:image/png;base64,${bytes.toString('base64')}`,camera:{position:[1,2,3],target:[0,0,0]}}));
const lesson=()=>({version:1,brief:'Tropical courtyard private residence',verdict:'rejected',feedback:'The pale wall loses the entrance contrast in arrival view.',before:defaultVilla('modern'),after:{...defaultVilla('modern'),exterior:'sand'},beforeCaptures:shots,afterCaptures:structuredClone(shots),origin:'terra'});
it('requires comparable captures and preserves rejection provenance',()=>{const l=validateDesignLesson(lesson());expect(learningContext([l],l.brief)).toContain('rejected');expect(learningContext([l],'Snow cabin')).toBe('');expect(learningContext([{...l,origin:'mock'}],l.brief)).toBe('');const bad=structuredClone(lesson());bad.afterCaptures[0].camera.position=[4,5,6];expect(()=>validateDesignLesson(bad)).toThrow(/identical cameras/);expect(()=>validateDesignLesson({...lesson(),feedback:'good'})).toThrow();});
it('rejects unchanged snapshots and missing viewpoints',()=>{expect(()=>validateDesignLesson({...lesson(),after:lesson().before})).toThrow(/changed/);expect(()=>validateDesignLesson({...lesson(),afterCaptures:[shots[0],shots[0],shots[0]]})).toThrow(/distinct/);});

it('accepts direct scene snapshots using the same immutable lesson contract',async()=>{
 const {laderaScene}=await import('./scene/example');
 const {applySceneOperations}=await import('./scene/model');
 const after=applySceneOperations(laderaScene,[{op:'finish',id:'suite-screen',material:'limestone'}]);
 const result=validateDesignLesson({...lesson(),before:laderaScene,after});
 expect(result.before).toEqual(laderaScene);expect(result.after).toEqual(after);
 const corrupt=structuredClone(after);corrupt.elements[0].parent='missing';
 expect(()=>validateDesignLesson({...lesson(),before:laderaScene,after:corrupt})).toThrow('Missing attachment');
});
