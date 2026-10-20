/** Explicit offline test-author corrections. Never invoked by generation, editing or saved-project loading. */
import original from '../__tests__/fixtures/blueprint-cloister-attempt-0.json';
import repaired from '../__tests__/fixtures/blueprint-cloister-attempt-1.json';
import { normalizeV3GenerationOutput } from '../generation';
import type { V3Scene } from '../scene';

export function recoveredCloister(attempt:0|1):V3Scene {
  return normalizeV3GenerationOutput(structuredClone(attempt===0?original:repaired),'flat').scene;
}
export function explicitlyCorrectedCloister():V3Scene {
  const scene=recoveredCloister(1), plan=scene.estatePlan!;
  plan.siteAccess=[{id:'siteNorth',boundary:'north',point:[0,0,-60]}];
  // The full 2m ribbons extend 1m north of the author's centreline-only allocations.
  for(const id of ['zone-guests','zone-wellness']){const zone=plan.zones.find(z=>z.id===id)!;zone.allocation!.z-=.5;zone.allocation!.depth+=1;}
  // Test author chooses short external, perpendicular approaches to the EXISTING doors.
  // These choices are never inferred or injected into a recovered generation.
  plan.circulation.find(r=>r.id==='route-guest')!.spatial!.waypoints=[[28,0,-23],[35,0,-8],[35,0,7]];
  plan.circulation.find(r=>r.id==='route-wellness')!.spatial!.waypoints=[[-28,0,-23],[-35,0,-8],[-35,0,9]];
  return normalizeV3GenerationOutput(scene,'flat').scene;
}
