import { z } from 'zod';
import { elementSchema, type SceneElement, type SceneOperation } from './model';

/** A code-authored construction helper, never an alternate executor or house
 * template. Its output is ordinary editable add operations. No hidden regeneration:
 * after construction every child is owned by the normal scene/history system. */
import {wingAssemblySchema, poolAssemblySchema, assemblySchema} from './assemblyContract';
export {wingAssemblySchema} from './assemblyContract';
export type WingAssembly = z.input<typeof wingAssemblySchema>;
export function residentialWingOperations(input: WingAssembly): SceneOperation[] {
    const p = wingAssemblySchema.parse(input), elements: SceneElement[] = [];
    const add = (suffix: string, kind: SceneElement['kind'], at: number[], size: number[], extra = {}) => {
        elements.push(elementSchema.parse({ id: suffix ? `${p.id}-${suffix}` : p.id,
            label: `${p.id} ${suffix || 'floor'}`, kind, ...(suffix ? {parent:p.id} : {}),
            at, size, material: p.material, ...extra }));
    };
    // Root is a real slab, not an invisible/opaque whole-building volume.
    add('', 'plate', p.at, [p.width, .2, p.depth], {rotation: p.rotation});
    const y = .1 + p.height / 2;
    add('rear', 'wall', [0,y,-p.depth/2+.15], [p.width,p.height,.3]);
    for (const [side, sign] of [['west',-1],['east',1]] as const)
        add(side,'wall',[sign*(p.width/2-.15),y,0],[p.depth-.6,p.height,.3],{rotation:Math.PI/2});
    const bay = p.width / p.bays;
    for (let i=0;i<p.bays;i++) {
        const wallId = `${p.id}-bay-${i}`;
        add(`bay-${i}`,'wall',[-p.width/2+(i+.5)*bay,y,p.depth/2-.15],[bay,p.height,.3],
            {opening:{x:0,sill:p.entryBay===i?0:.15,width:bay-.45,height:p.height-(p.entryBay===i?.25:.4),glazed:false}});
        const entry=p.entryBay===i;
        add(`glass-${i}`,entry?'entrance':'glazing',[0,entry?-.125:-.05,0],[bay-.45,p.height-(entry?.25:.4),entry?.1:.04],{parent:wallId,panels:2});
        // Separately selectable stone header gives the glass actual facade depth.
        add(`reveal-${i}`,'volume',[-p.width/2+(i+.5)*bay,.1+p.height-.08,p.depth/2+.06],
            [bay,.16,.5],{material:'limestone'});
    }
    const rise = p.roofForm === 'flat' ? .25 : p.roofRise;
    add('roof','roof',[0,.1+p.height+rise/2,0],
        [p.width+(p.roofForm==='flat'?2*p.overhang:0),rise,p.depth+(p.roofForm==='flat'?2*p.overhang:0)],
        {roofForm:p.roofForm,overhang:p.overhang});
    return elements.map(element=>({op:'add',element}));
}

/** Rectangular basin adapted from the retained interval/dry-route proof. at.y is
 * the deck slab centre; walking datum = at.y+.15, water = at.y+.05. */
export function rectangularPoolOperations(input:z.input<typeof poolAssemblySchema>):SceneOperation[]{
 const p=poolAssemblySchema.parse(input),w=p.width,d=p.depth,h=p.basinDepth;
 const elements:SceneElement[]=[];
 const add=(suffix:string,kind:SceneElement['kind'],at:number[],size:number[])=>elements.push(elementSchema.parse({id:suffix?`${p.id}-${suffix}`:p.id,label:`${p.id} ${suffix||'deck'}`,kind,...(suffix?{parent:p.id}:{}),at,size,rotation:suffix?0:p.rotation,material:p.material}));
 // Root is one real dry deck strip; every other component uses its local frame.
 add('','plate',p.at,[w+3.2,.3,1.5]);
 const centerZ=d/2+1.45;
 add('floor','plate',[0,.05-h-.1,centerZ],[w+.4,.2,d+.4]);
 add('water','water',[0,.05,centerZ],[w,.02,d]);
 for(const sign of [-1,1]){
  add(`wall-z-${sign===1?'plus':'minus'}`,'wall',[0,(.15+.05-h)/2,centerZ+sign*(d/2+.1)],[w+.4,h+.1,.2]);
  add(`wall-x-${sign===1?'plus':'minus'}`,'wall',[sign*(w/2+.1),(.15+.05-h)/2,centerZ],[.2,h+.1,d]);
  add(`coping-z-${sign===1?'plus':'minus'}`,'plate',[0,.1,centerZ+sign*(d/2+.35)],[w+1.2,.1,.7]);
  add(`coping-x-${sign===1?'plus':'minus'}`,'plate',[sign*(w/2+.35),.1,centerZ],[.7,.1,d]);
  add(`deck-x-${sign===1?'plus':'minus'}`,'plate',[sign*(w/2+1.1),0,centerZ],[1,.3,d+1.4]);
 }
 add('deck-far','plate',[0,0,2*centerZ],[w+3.2,.3,1.5]);
 return elements.map(element=>({op:'add' as const,element}));
}
export function assemblyOperations(input:z.input<typeof assemblySchema>):SceneOperation[]{
 const a=assemblySchema.parse(input);
 const ops=a.kind==='residential-wing'?residentialWingOperations(a.parameters):rectangularPoolOperations(a.parameters);
 return ops.map((op,i)=>i===0&&op.op==='add'?{...op,element:{...op.element,assemblyKind:a.kind}}:op);
}
