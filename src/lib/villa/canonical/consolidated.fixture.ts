/** Developer-authored fixtures for the consolidated end-to-end corrections (wing extents, correction verification, shared-wall openings, site and
 * landscape coordination, composition-aware diagnosis, rejected-plan preservation). They are evidence of software capability, never model output
 * and never a claim about architectural quality. The retained Terra mansion is read unmodified from its evidence directory. */
import {readFileSync} from 'node:fs';
import type {ArchitecturalPlan} from './plan';
import {build} from './spatial.fixture';
const DIR='docs/architecture/e2e-generation-diagnostic-2026-11-03';
/** Terra's plan from the instrumented live experiment, exactly as retained (read fresh on every call so no test can alter another's copy). */
export const retainedMansion=():ArchitecturalPlan=>JSON.parse(readFileSync(`${DIR}/canonical-plan.json`,'utf8')).plan;
export const retainedBrief=():string=>JSON.parse(readFileSync(`${DIR}/brief.json`,'utf8')).prompt;
export const retainedLimitations=():string[]=>JSON.parse(readFileSync(`${DIR}/canonical-plan.json`,'utf8')).limitations;

/** The retained failure at small scale: a salon pavilion whose terrace is wider than the salon, with a suite wing placed against the pavilion's extent
 * and a door from the salon to the wing's hall. Declared `attached`, the terrace stays with the pavilion without pushing the wing away from the salon. */
export function terracedPavilion(attached:boolean,orientation=0):ArchitecturalPlan{
 const plan=build({id:'terraced-pavilion',thesis:'Developer fixture: a salon pavilion with a terrace wider than the salon, and a suite wing entered from the salon.',site:[60,60],orientation,
  levels:[{id:'ground',above:null,rise:.2}],
  wings:[
   {id:'pavilion',role:'salon pavilion',rooms:[{id:'salon',w:8,d:10,h:3.6},{id:'terrace',w:14,d:4,outdoor:true,at:{to:'salon',side:'north',al:'centre'}},{id:'porch',w:6,d:3,outdoor:true,at:{to:'salon',side:'south',al:'centre'}}]},
   {id:'suite-wing',role:'two suites behind a hall',at:{to:'pavilion',side:'west',al:'centre'},rooms:[{id:'suite-hall',w:3,d:10,h:3.2},{id:'suite-one',w:6,d:5,h:3.2,at:{to:'suite-hall',side:'west',al:'start'}},{id:'suite-two',w:6,d:5,h:3.2,at:{to:'suite-hall',side:'west',al:'end'}}]},
  ],arrival:'porch',terraces:['terrace'],
  doors:[['salon','porch',2.4],['salon','terrace',3],['salon','suite-hall',1.4],['suite-hall','suite-one',1],['suite-hall','suite-two',1]],
  constraints:[{id:'suites-meet-salon',kind:'adjoin',a:'suite-wing',b:'pavilion',amount:3,reason:'the suite hall is entered from the salon'}]});
 if(attached)plan.spaces.find(s=>s.id==='terrace')!.attached=true;
 return plan;
}

/** Three rooms where B also touches C (an undeclared adjacency, no door between them). Re-aligning B keeps every door and compiles, but ends that adjacency:
 * the kind of edit that is geometrically fine and still an architectural trade-off. */
export function adjacencyTrio():ArchitecturalPlan{
 return build({id:'adjacency-trio',thesis:'Developer fixture: three rooms around a corner; B and C share a wall with no door.',site:[60,60],levels:[{id:'ground',above:null,rise:.2}],
  wings:[{id:'house',role:'one wing',rooms:[{id:'room-a',w:10,d:10,h:3.2},{id:'room-b',w:4,d:14,h:3.2,at:{to:'room-a',side:'east',al:'start'}},{id:'room-c',w:10,d:4,h:3.2,at:{to:'room-a',side:'north',al:'start'}}]}],
  arrival:'room-a',doors:[['room-a','room-b',1.2],['room-a','room-c',1.2]]});
}

/** A hall and a smaller wing room that touches only part of the hall's east wall; the wing room's door is authored with an EXPLICIT side and start alignment.
 * Over the whole 10 m edge "start" lands at 0.85 m, which misses the room (z 6..10): the opening is fitted into the wall they share. */
export function partialWallHouse():ArchitecturalPlan{
 const plan=build({id:'partial-wall-house',thesis:'Developer fixture: a hall, a short wing touching part of its east wall, and an explicit-side door that must land on the shared part.',site:[60,60],levels:[{id:'ground',above:null,rise:.2}],
  wings:[{id:'house',role:'hall and wing',rooms:[{id:'hall',w:10,d:10,h:3.4},{id:'wing-room',w:6,d:4,h:3.4,at:{to:'hall',side:'east',al:'end'}},{id:'porch',w:4,d:3,outdoor:true,at:{to:'hall',side:'south',al:'start'}}]}],
  arrival:'porch',doors:[['hall','porch',2]]});
 plan.portals.push({id:'hall-wing-door',host:{space:'hall',side:'east'},to:'wing-room',alignment:'start',width:1.2,height:2.3,mode:'door'});
 return plan;
}
