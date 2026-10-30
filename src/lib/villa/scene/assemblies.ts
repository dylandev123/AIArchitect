import { z } from 'zod';
import { elementSchema, type SceneElement, type SceneOperation } from './model';

/** A code-authored construction helper, never an alternate executor or house
 * template. Its output is ordinary editable add operations. No hidden regeneration:
 * after construction every child is owned by the normal scene/history system. */
import {wingAssemblySchema, poolAssemblySchema, assemblySchema, doorwayAssemblySchema, kitchenRunAssemblySchema, straightStairAssemblySchema, facadeBayAssemblySchema} from './assemblyContract';
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
    let edge = -p.width / 2;
    for (let i=0;i<p.bays;i++) {
        const bay = p.bayWidths?.[i] ?? p.width / p.bays;
        const center = p.bayWidths ? edge + bay / 2 : -p.width/2+(i+.5)*bay;
        edge += bay;
        const wallId = `${p.id}-bay-${i}`;
        add(`bay-${i}`,'wall',[center,y,p.depth/2-.15],[bay,p.height,.3],
            {opening:{x:0,sill:p.entryBay===i?0:.15,width:bay-.45,height:p.height-(p.entryBay===i?.25:.4),glazed:false}});
        const entry=p.entryBay===i;
        add(`glass-${i}`,entry?'entrance':'glazing',[0,entry?-.125:-.05,0],[bay-.45,p.height-(entry?.25:.4),entry?.1:.04],{parent:wallId,panels:2});
        // Separately selectable stone header gives the glass actual facade depth.
        add(`reveal-${i}`,'volume',[center,.1+p.height-.08,p.depth/2+.06],
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
  add(`coping-x-${sign===1?'plus':'minus'}`,'plate',[sign*(w/2+.3),.1,centerZ],[.6,.1,d]);
  add(`deck-x-${sign===1?'plus':'minus'}`,'plate',[sign*(w/2+1.1),0,centerZ],[1,.3,d+1.4]);
 }
 add('deck-far','plate',[0,0,2*centerZ],[w+3.2,.3,1.5]);
 return elements.map(element=>({op:'add' as const,element}));
}
/** A real cut wall and sill-aligned door; no room is inferred from its name. */
export function doorwayOperations(input:z.input<typeof doorwayAssemblySchema>):SceneOperation[]{
 const p=doorwayAssemblySchema.parse(input);
 const wall=elementSchema.parse({id:p.id,label:`${p.id} partition`,kind:'wall',parent:p.parent,
  at:[p.at[0],p.at[1]+p.height/2,p.at[2]],rotation:p.rotation,size:[p.width,p.height,p.thickness],material:p.material,
  opening:{x:p.openingX,sill:0,width:p.openingWidth,height:p.openingHeight,glazed:false}});
 const door=elementSchema.parse({id:`${p.id}-door`,label:`${p.id} door`,kind:'entrance',parent:p.id,
  at:[p.openingX,(-p.height+p.openingHeight)/2,0],size:[p.openingWidth,p.openingHeight,.06],material:'timber'});
 return [wall,door].map(element=>({op:'add',element}));
}

/** Shares the renderer's wall-local opening centre, never overlays an uncut host. */
export function facadeBayOperations(input:z.input<typeof facadeBayAssemblySchema>):SceneOperation[]{
 const p=facadeBayAssemblySchema.parse(input);
 const wall=elementSchema.parse({id:p.id,label:`${p.id} facade`,kind:'wall',parent:p.parent,
  at:[p.at[0],p.at[1]+p.height/2,p.at[2]],rotation:p.rotation,size:[p.width,p.height,p.thickness],material:p.material,
  opening:{x:p.openingX,sill:p.sill,width:p.openingWidth,height:p.openingHeight,glazed:false}});
 const panel=elementSchema.parse({id:`${p.id}-panel`,label:`${p.id} ${p.infill}`,kind:p.infill,parent:p.id,
  at:[p.openingX,-p.height/2+p.sill+p.openingHeight/2,0],size:[p.openingWidth,p.openingHeight,p.infill==='entrance'?.06:.04],
  panels:p.panels,material:p.infill==='entrance'?'timber':'bronze'});
 return [wall,panel].map(element=>({op:'add',element}));
}

/** Selected cabinet run, with separately editable base units and worktop. This
 * is physical fit-out evidence, not appliances, plumbing or a certified kitchen. */
export function kitchenRunOperations(input:z.input<typeof kitchenRunAssemblySchema>):SceneOperation[]{
 const p=kitchenRunAssemblySchema.parse(input),h=p.height-.04,w=p.length/p.units;
 const root=elementSchema.parse({id:p.id,label:`${p.id} base unit 1`,kind:'volume',parent:p.parent,
  at:[p.at[0],p.at[1]+h/2,p.at[2]],rotation:p.rotation,size:[w,h,p.depth],material:p.material});
 // Root sits at the first unit centre. All following pieces share that frame.
 const elements=[root];
 for(let i=1;i<p.units;i++) elements.push(elementSchema.parse({id:`${p.id}-unit-${i+1}`,label:`${p.id} base unit ${i+1}`,
  kind:'volume',parent:p.id,at:[i*w,0,0],size:[w,h,p.depth],material:p.material}));
 elements.push(elementSchema.parse({id:`${p.id}-top`,label:`${p.id} worktop`,kind:'volume',parent:p.id,
  at:[(p.length-w)/2,h/2+.02,0],size:[p.length,.04,p.depth],material:'limestone'}));
 return elements.map(element=>({op:'add',element}));
}

/** Solid stepped construction from a selected base datum. Each tread is supported
 * down to the base plane; the last tread reaches exactly rise. No floating plates.
 * The caller owns base support, landings, guards, slab voids and clear approach. */
export function straightStairOperations(input:z.input<typeof straightStairAssemblySchema>):SceneOperation[]{
 const p=straightStairAssemblySchema.parse(input),r=p.rise/p.risers,g=p.run/p.risers;
 const elements:SceneElement[]=[];
 for(let i=0;i<p.risers;i++) {
  const h=(i+1)*r;
  const localZ=(i+.5)*g;
  elements.push(elementSchema.parse({id:i?`${p.id}-step-${i+1}`:p.id,label:`${p.id} step ${i+1}`,kind:'volume',
   parent:i?p.id:p.parent,rotation:i?0:p.rotation,
   at:i?[0,(h-r)/2,i*g]:[p.at[0]+Math.sin(p.rotation)*localZ,p.at[1]+r/2,p.at[2]+Math.cos(p.rotation)*localZ],
   size:[p.width,h,g],material:p.material}));
 }
 return elements.map(element=>({op:'add',element}));
}
export function assemblyOperations(input:z.input<typeof assemblySchema>):SceneOperation[]{
 const a=assemblySchema.parse(input);
 let ops:SceneOperation[];
 switch(a.kind){
  case 'residential-wing':ops=residentialWingOperations(a.parameters);break;
  case 'rectangular-pool':ops=rectangularPoolOperations(a.parameters);break;
  case 'facade-bay':ops=facadeBayOperations(a.parameters);break;
  case 'doorway':ops=doorwayOperations(a.parameters);break;
  case 'kitchen-run':ops=kitchenRunOperations(a.parameters);break;
  case 'straight-stair':ops=straightStairOperations(a.parameters);break;
 }
 return ops.map((op,i)=>i===0&&op.op==='add'?{...op,element:{...op.element,assemblyKind:a.kind}}:op);
}
