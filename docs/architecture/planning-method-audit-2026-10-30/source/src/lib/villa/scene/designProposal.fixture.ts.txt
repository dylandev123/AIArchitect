/** Offline contract adapter only. Never imported into provider instructions.
 * Derived from existing geometry, so it proves transport/fidelity, not design. */
import { type ArchitecturalScene } from './model';
import { sceneSpatialGeometry } from './spatial';
import { validateDesignProposal } from './designProposal';
export function proposalFixture(scene:ArchitecturalScene,floorIds?:string[]){
 const g=sceneSpatialGeometry(scene);
 const floors=scene.elements.filter(e=>e.kind==='plate'&&(!floorIds||floorIds.includes(e.id)));
 const floor=floors[0];
 const walls=scene.elements.filter(e=>e.kind==='wall');
 const roofs=scene.elements.filter(e=>e.kind==='roof');
 const doors=scene.elements.filter(e=>e.kind==='entrance');
 if(!floor||!walls.length||!roofs.length||!doors.length)throw Error('Offline fixture needs floor, wall, roof and door evidence.');
 return validateDesignProposal({version:'spatial-proposal-1',concept:'Offline selected geometry; not AI design evidence.',alternatives:[{concept:'Unselected contract alternative',tradeoff:'No aesthetic comparison claimed.'}],selectionReason:'Exercise an existing editable composition.',site:{assumptions:'Unsurveyed flat-site offline fixture.',arrival:g.world(doors[0]).slice(0,3),viewDirection:[0,0,1],organization:'Preserve existing scene relationships.'},anchors:scene.elements.map(e=>({id:e.id,kind:e.kind,role:e.kind==='plate'?'floor':e.kind==='roof'?'roof':e.kind==='entrance'?'entrance':'facade',centre:g.world(e).slice(0,3),size:e.size,yaw:g.world(e)[3],geometry:e.geometry??null,material:e.material,color:e.color??null,panels:e.panels,roofForm:e.roofForm??null,overhang:e.overhang??null,opening:e.opening??null,designReason:'Retained offline construction commitment.'})),spaces:floors.map((f,i)=>({id:`space-${i}`,name:f.label,use:'Referenced floor capacity only',environment:['terrace','path','pool','planting-bed','driveway'].includes(f.semanticType??'')?'outdoor':'interior',floorId:f.id,centre:[g.world(f)[0],g.top(f)+1.5,g.world(f)[2]],size:[f.size[0],3,f.size[2]],yaw:g.world(f)[3],enclosureIds:[walls[0].id],roofIds:[roofs[0].id],accessIds:[doors[0].id],stage:'allocated-capacity',limitation:'Shared shell evidence; no distinct usable room certification.'})),routes:[{from:'space-0',to:`space-${Math.min(1,floors.length-1)}`,via:[floor.id,doors[0].id],description:'References only; navigability remains unverified.'}],relationships:[],roofAndSection:'Existing independent roofs and floor datums.',facadeAndClimate:'Existing selected wall/glazing composition.',landscapeAndOutdoorLiving:'Existing geometry retained without additions.',limitations:['Developer contract fixture; not a fresh architectural proposal.']});
}
