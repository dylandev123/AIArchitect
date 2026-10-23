import { approvedComponents } from './component-record';
import type { ArchitecturalComponentRecord } from './component-record';

/** Versioned architectural component records; approval does not register arbitrary geometry. */
export const ARCHITECTURAL_COMPONENTS: ArchitecturalComponentRecord[] = [{
  schemaVersion:1,id:'curved-pavilion',version:1,name:'Curved garden pavilion',status:'approved',
  provenance:{kind:'procedural',source:'Bounded Three.js ellipse and annular-sector extrusion; no AI mesh'},
  reference:{kind:'builder',id:'curved-pavilion@1'},
  coordinates:{units:'metres',origin:'floor-centre',up:'+y',front:'+z',rotation:'degrees-about-y'},
  dimensions:{width:8,depth:6,height:3.5},
  parameters:[{key:'width',min:6,max:10,unit:'m'},{key:'depth',min:5,max:8,unit:'m'},{key:'height',min:3,max:4.2,unit:'m'},{key:'orientation',min:0,max:359,unit:'degrees'}],
  connections:[{id:'entry',kind:'open-entry',position:[0,0,2.8618176042508367],normal:[0,0,1],width:2.4,follows:'Local z=(depth/2)*sqrt(1-(1.2/(width/2))^2), y=0; playground floor y=0.47; pavilionEntry applies placement and yaw. Pedestrian approach only; no wing/gallery attachment.'}],
  materials:[{slot:'shell',options:['ivory','limestone']},{slot:'soffit',options:['timber']},{slot:'frame',options:['bronze']},{slot:'glazing',options:['clear']}],
  validation:{status:'passed',checks:['schema bounds','finite extruded geometry','rotated roof envelope','site/pool/wing clearance','two browser compositions','estate-scale executor and provider compatibility'],evidence:['docs/villa-playground/new-forms/REPORT.md','docs/villa-playground/new-forms/browser-checks.json','docs/villa-playground/new-forms/geometry-checks.json','docs/villa-playground/creative-freedom/REPORT.md'],limitations:['Detached single-storey open lounge only','No enclosed thermal shell, automatic gallery joins or structural certification','Only the bounded curved-pavilion@1 builder is approved; no enclosed rooms or gallery attachments']},
}, {
  schemaVersion:1,id:'estate-landscape',version:1,name:'Composed estate arrival and gardens',status:'approved',availability:'local',
  provenance:{kind:'procedural',source:'Centripetal path ribbons and existing elliptical extrusion, villa PBR materials and vegetation'},
  reference:{kind:'builder',id:'estate-landscape@1'},
  coordinates:{units:'metres',origin:'floor-centre',up:'+y',front:'+z',rotation:'degrees-about-y'},
  dimensions:{width:24,depth:18,height:0.3},
  parameters:[{key:'drivewayWidth',min:3.5,max:6,unit:'m'},{key:'walkWidth',min:.9,max:3,unit:'m'},{key:'courtWidth',min:12,max:28,unit:'m'},{key:'courtDepth',min:12,max:28,unit:'m'}],
  connections:[],materials:[{slot:'paving',options:['existing-paving']},{slot:'curb',options:['existing-stone']},{slot:'planting',options:['tropical','mediterranean']}],
  validation:{status:'passed',checks:['bounded route controls','full paved width collision','court lane clearance','derived and fixed site bounds','finite geometry','three estate browser views'],evidence:['docs/villa-playground/estate-creativity/REPORT.md','docs/villa-playground/estate-creativity/browser-checks.json','docs/villa-playground/estate-creativity/geometry-checks.json'],limitations:['Local composition executor only; provider schema and prompt rollout still required','Flat sites only; conceptual vehicle circulation, no turning simulation','2–8 controls per route, at most 10 routes, 12 beds, one optional court','Court island options none, planted or fountain; no arbitrary polygons']},
}, {
  schemaVersion:1,id:'rotated-detached-wing',version:1,name:'Rotated detached villa wing',status:'approved',availability:'local',
  provenance:{kind:'procedural',source:'Existing ComposedWing local transform; roof, facade, veranda and interiors rotate together'},
  reference:{kind:'builder',id:'rotated-detached-wing@1'},
  coordinates:{units:'metres',origin:'floor-centre',up:'+y',front:'+z',rotation:'degrees-about-y'},
  dimensions:{width:16,depth:7,height:4},
  parameters:[{key:'orientation',min:0,max:345,unit:'degrees'},{key:'width',min:4,max:32,unit:'m'},{key:'depth',min:4,max:32,unit:'m'}],
  connections:[],materials:[{slot:'appearance',options:['existing-shared-villa-appearance']}],
  validation:{status:'passed',checks:['15 degree bounded rotations','rotated envelopes','detached-only validation','roof and facade world transforms','Splay House browser inspection'],evidence:['docs/villa-playground/estate-creativity/REPORT.md','docs/villa-playground/estate-creativity/browser-checks.json','docs/villa-playground/estate-creativity/geometry-checks.json'],limitations:['15 degree increments; secondary detached wings only','No diagonal galleries or shared walls; no new construction engine','Conservative axis-aligned collision envelopes can reject close diagonal placements','Provider prompt still advertises cardinal wings until the deliberate integration step']},
}];

/** Only approved, validated, version-pinned builders can be requested by Terra. */
export function terraComponents() { return approvedComponents(ARCHITECTURAL_COMPONENTS).filter(c=>c.availability!=='local'); }
export function isApprovedBuilder(builder: string) {
  return terraComponents().some(c => c.reference.kind === 'builder' && c.reference.id === builder);
}
