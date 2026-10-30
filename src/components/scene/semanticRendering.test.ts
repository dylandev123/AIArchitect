import * as React from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {validateScene,type SceneElement} from '@/lib/villa/scene/model';
import {resolveSceneResult} from '@/lib/villa/scene/terra';
import {OperationScene} from './OperationScene';
import {Glazing,Roof} from './architecture';
afterEach(()=>vi.unstubAllGlobals());
type Node={type:unknown;props:{children?:unknown;element?:SceneElement;frameColor?:string;color?:string}};
function find(node:unknown,type:unknown):Node|undefined{
 if(Array.isArray(node)){for(const child of node){const found=find(child,type);if(found)return found;}return;}
 if(!node||typeof node!=='object'||!('props' in node))return;
 const element=node as Node;
 return element.type===type?element:find(element.props.children,type);
}
it('renders a targeted window finish and roof color without changing other elements or default glazing',()=>{
 vi.stubGlobal('React',React);
 const before=validateScene({version:'architectural-scene-1',name:'Render fixture',elements:[
  {id:'window',label:'Window',kind:'glazing',at:[0,1.5,0],size:[1,1,.1]},
  {id:'roof',label:'Roof',kind:'roof',at:[0,3,0],size:[5,.2,5]},
 ]});
 const after=resolveSceneResult({mode:'edit',current:before,prompt:'Change window material'}, {name:before.name,summary:'Timber frame',unsupported:[],operations:[{op:'finish',id:'window',material:'timber'}]}).scene;
 function renderPart(scene:typeof before,index:number){
  const root=OperationScene({scene,onSelect:()=>{}});
  const node=(root.props.children as unknown as Node[])[index];
  return (node.type as {type:(props:unknown)=>unknown}).type(node.props);
 }
 expect(find(renderPart(before,0),Glazing)?.props.frameColor).toBeUndefined();
 expect(find(renderPart(after,0),Glazing)?.props.frameColor).toBe('#795239');
 expect(after.elements[1]).toBe(before.elements[1]);
 const colored=resolveSceneResult({mode:'edit',current:after,prompt:'Change roof color'}, {name:after.name,summary:'Roof color',unsupported:[],operations:[{op:'replace',id:'roof',element:{...after.elements[1],color:'#0000ff'}}]}).scene;
 expect(find(renderPart(colored,1),Roof)?.props.color).toBe('#0000ff');
 expect(colored.elements[0]).toBe(after.elements[0]);
});
