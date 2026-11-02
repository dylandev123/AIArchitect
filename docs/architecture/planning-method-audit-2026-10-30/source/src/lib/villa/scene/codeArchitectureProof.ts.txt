import { residentialWingOperations } from './assemblies';
import { elementSchema, applySceneOperations, type ArchitecturalScene, type SceneOperation } from './model';
/** Developer studies only. Not imported by the production generation workflow. */
export function codeArchitectureStudies() {
    const wing = (id:string,at:[number,number,number],width:number,depth:number,height:number,bays:number,
        extra:Record<string,unknown>={}) => residentialWingOperations({id,at,width,depth,height,bays,
        rotation:0,material:'ivory',roofForm:'flat',roofRise:1.6,overhang:.8,...extra});
    const build = (name:string,operations:SceneOperation[]):ArchitecturalScene => applySceneOperations({version:'architectural-scene-1',name,elements:[]},operations);
    // Solana's offset salon/suite, double-height arrival and subordinate dining wing.
    const solanaBase = build('Solana techniques · developer study',[
        ...wing('salon',[-7,.1,0],14,10,4.2,4),
        ...wing('suite',[-8,4.6,-1],12,8,3.4,3),
        ...wing('arrival',[2,.1,-1],4,8,8.4,1,{material:'limestone'}),
        ...wing('dining',[9,.1,-1],10,12,4,3),
    ]);
    const bay=solanaBase.elements.find(e=>e.id==='arrival-bay-0')!;
    const part=(id:string,kind:string,at:number[],size:number[])=>({op:'add' as const,element:elementSchema.parse({id,label:id,kind,parent:bay.id,at,size,material:'bronze'})});
    const solana=applySceneOperations(solanaBase,[
        {op:'replace',id:bay.id,element:{...bay,opening:{x:0,sill:0,width:3.55,height:8.15,glazed:false}}},
        {op:'remove',id:'arrival-glass-0'},
        part('arrival-door','entrance',[0,-2.4,0],[2,3.6,.15]),
        part('arrival-sidelight-west','glazing',[-1.3875,-2.4,0],[.775,3.6,.04]),
        part('arrival-sidelight-east','glazing',[1.3875,-2.4,0],[.775,3.6,.04]),
        part('arrival-transom','glazing',[0,1.675,0],[3.55,4.55,.04]),
    ]);
    // A low sheltered court, enclosed on three sides, with pitched roofs and
    // inward-facing glazing. Same helper, different topology and roof hierarchy.
    const court = build('Sheltered court · developer study',[
        ...wing('north',[0,.1,-9],22,7,3.6,5,{roofForm:'hip',material:'limestone'}),
        ...wing('west',[-9,.1,.5],12,7,3.1,3,{rotation:Math.PI/2,roofForm:'gable'}),
        ...wing('east',[9,.1,.5],12,7,3.1,3,{rotation:-Math.PI/2,roofForm:'gable'}),
    ]);
    return {solana,court};
}
