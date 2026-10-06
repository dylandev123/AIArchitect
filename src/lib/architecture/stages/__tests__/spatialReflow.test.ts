import { describe, expect, it } from "vitest";
import { sitePlanContextForDocument } from "../../sitePlanContext";
import { normalizeSitePlan, sitePlanSchema } from "../sitePlanStage";
import { reconcileSitePlanExecution } from "../reconcileSitePlanExecution";
import { spatialReflowErrors, type SpatialReflow } from "../spatialReflow";
import { architectDocument, responderOutputs } from "../../__tests__/v2StageResponder";
import type { ArchitecturalDesignDocument } from "../../document";

const clone = <T,>(value: T): T => structuredClone(value);
const document = (): ArchitecturalDesignDocument => architectDocument();
const planFor = (doc: ArchitecturalDesignDocument) => {
  const context = sitePlanContextForDocument(doc.brief, doc)!;
  return sitePlanSchema.parse(normalizeSitePlan(responderOutputs.sitePlan(), context));
};
const reflow = (...elements: SpatialReflow["elements"]): SpatialReflow => ({ elements });
const valid = (beforeDoc: ArchitecturalDesignDocument, afterDoc: ArchitecturalDesignDocument, beforePlan = planFor(beforeDoc), afterPlan = planFor(afterDoc), proposal?: SpatialReflow, directMassIds = new Set(["mass-0"])) =>
  spatialReflowErrors({ beforeDocument: beforeDoc, afterDocument: afterDoc, beforePlan, afterPlan, reflow: proposal, directMassIds });
const porch = (doc: ArchitecturalDesignDocument) => {
  const next = clone(doc);
  next.massing.masses[0].operations = [{ id: "mass-0:expanded-porch", type: "projection", facade: "north", start: .25, end: .75, depth: 2.5, open: true, postSpacing: 2.4 }];
  return next;
};

describe("generalized Architect spatial reflow (mocked/no-network fixtures)", () => {
  it("permits porch → driveway reflow without a driveway exception", () => {
    const before = document(), after = porch(before), oldPlan = planFor(before), nextPlan = clone(oldPlan);
    nextPlan.driveway.offset = 16;
    expect(valid(before, after, oldPlan, nextPlan, reflow({ id: "site:driveway", action: "move", dependsOn: "mass:mass-0", reason: "The expanded arrival porch needs its clear approach width." }))).toEqual([]);
  });

  it("permits terrace → pool → deck as a bounded cascade", () => {
    const before = document(), after = porch(before), oldPlan = planFor(before), nextPlan = clone(oldPlan);
    nextPlan.terrace.depth = 10;
    nextPlan.pool.distance = 12;
    nextPlan.poolDeck.z = 24;
    expect(valid(before, after, oldPlan, nextPlan, reflow(
      { id: "site:terrace", action: "resize", dependsOn: "mass:mass-0", reason: "The enlarged covered outdoor room needs a deeper usable terrace." },
      { id: "site:pool", action: "move", dependsOn: "site:terrace", reason: "The pool shifts only enough to retain the terrace-to-water clearance." },
      { id: "site:poolDeck", action: "move", dependsOn: "site:pool", reason: "The deck follows the adjusted pool edge and remains connected." },
    ))).toEqual([]);
  });

  it("allows architecture to reflow planting and access routing while preserving path semantics", () => {
    const before = document(), after = porch(before), oldPlan = planFor(before), nextPlan = clone(oldPlan);
    nextPlan.landscape[1].z = -15;
    nextPlan.paths[2].bend = 3;
    expect(valid(before, after, oldPlan, nextPlan, reflow(
      { id: "site:landscape:entrance-planting:1", action: "move", dependsOn: "mass:mass-0", reason: "Entry planting clears the enlarged arrival construction." },
      { id: "site:path:entrance>outdoor-living:2", action: "reroute", dependsOn: "mass:mass-0", reason: "Access routing remains clear of the changed architectural edge." },
    ))).toEqual([]);
  });

  it("allows a directly requested rotated mass, while preserving its id and attached Site Plan semantics", () => {
    const seed = document();
    const before = { ...seed, massing: { ...seed.massing, masses: [...seed.massing.masses, { ...clone(seed.massing.masses[0]), id: "wing", name: "Rotatable Wing", role: "bedroom-wing" as const, position: { x: 24, z: 0 }, width: 7, depth: 8 }] } };
    const after = clone(before), oldPlan = planFor(before), nextPlan = clone(oldPlan);
    after.massing.masses[1].rotation = Math.PI / 4;
    expect(valid(before, after, oldPlan, nextPlan, reflow(
      { id: "mass:wing", action: "rotate", dependsOn: "request", reason: "The owner requested a modest rotation of the selected wing." },
    ), new Set(["wing"]))).toEqual([]);
    expect(after.massing.masses[1].id).toBe(before.massing.masses[1].id);
  });

  it("rejects an unrelated element even when it is declared as a reflow", () => {
    const before = document(), after = porch(before), oldPlan = planFor(before), nextPlan = clone(oldPlan);
    nextPlan.landscape[3].x = 30; // view framing is well outside the local arrival edit neighborhood
    const errors = valid(before, after, oldPlan, nextPlan, reflow({ id: "site:landscape:view-framing:3", action: "move", dependsOn: "mass:mass-0", reason: "This should not be allowed as an unrelated landscape rewrite." }));
    expect(errors.join(" ")).toMatch(/dependency-aware local reflow scope/);
    expect(before.massing.masses[0]).toEqual(document().massing.masses[0]);
  });

  it("re-executes an accepted Site Plan deterministically and retains renderer ids where slots survive", () => {
    const doc = document(), plan = planFor(doc), changed = clone(plan);
    changed.driveway.offset = 16;
    const first = reconcileSitePlanExecution({ driveways: [{ id: "drive-1", legacy: true }], parking: [{ id: "parking-1" }] }, changed, sitePlanContextForDocument(doc.brief, doc)!.masses);
    const reloaded = JSON.parse(JSON.stringify(first)) as Record<string, unknown>;
    const second = reconcileSitePlanExecution(reloaded, changed, sitePlanContextForDocument(doc.brief, doc)!.masses);
    expect(second).toEqual(first);
    expect((first.driveways as { id: string }[])[0].id).toBe("drive-1");
    expect((first.parking as { id: string }[])[0].id).toBe("parking-1");
  });
});
