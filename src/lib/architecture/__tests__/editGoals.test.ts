import { describe, expect, it } from "vitest";
import { asSchema } from "ai";
import { describeEditGoalSummary, editGoalsRequired, editPlanCoverage, enumeratedRequestItems, summarizeEditGoals, type EditCoverageInput, type EditGoal } from "../editGoals";
import { auditCirculation, introducedCirculationIssues } from "../circulationAudit";
import { sceneEditPlanSchema } from "../sceneOperations";
import { ARCHITECT_EDIT_SYSTEM_PROMPT, architectEditWireSchema, architectPlanValidationResult } from "../stages/architectStage";
import type { ArchitecturalAssembly, ArchitecturalDesignDocument, MassVolume } from "../document";
import { ARCHITECTURE_FIXTURES } from "../fixtures";

/** A five-item broad request. Its items are only list structure to the validator, never routed vocabulary. */
const FIVE_ITEMS = `Improve the property:
- complete the missing upper terraces
- make the roof usable as outdoor space
- improve the pool patio for outdoor living
- add depth to the facade with landscaping
- connect every floor with stairs`;
const KNOWN = new Set(["mass:main", "assembly:main:portico", "site:pool", "site:terrace"]);
const op = (verb = "create") => ({ op: verb });
const input = (patch: Partial<EditCoverageInput>): EditCoverageInput => ({ operations: [], breadth: "global-architecture", request: FIVE_ITEMS, knownTargetIds: KNOWN, ...patch });
const goal = (id: string, request: string, patch: Partial<EditGoal> = {}): EditGoal => ({ id, intent: request, request, status: "planned", operationIds: ["operation:0"], ...patch });
const FULL_GOALS: EditGoal[] = [
  goal("terraces", "complete the missing upper terraces", { operationIds: ["operation:0", "operation:1"] }),
  goal("roof", "make the roof usable as outdoor space", { status: "capability-needed", operationIds: undefined, capabilityNeedIds: ["roof-access"] }),
  goal("patio", "improve the pool patio for outdoor living", { operationIds: ["operation:2"] }),
  goal("facade", "add depth to the facade with landscaping", { status: "already-satisfied", operationIds: undefined, evidence: "The terrace planting already layers the south facade.", evidenceTargetIds: ["site:terrace"] }),
  goal("stairs", "connect every floor with stairs", { status: "capability-needed", operationIds: undefined, capabilityNeedIds: ["stairs"] }),
];
const NEEDS = [{ id: "roof-access", capability: "roof access stair", reason: "No vertical circulation primitive." }, { id: "stairs", capability: "interior stair and floor opening", reason: "No floor cut primitive." }];

describe("edit goal coverage", () => {
  it("rejects a broad five-item request answered by one operation and no goal ledger", () => {
    const report = editPlanCoverage(input({ operations: [op("delete")] }));
    expect(report?.code).toBe("INCOMPLETE_PLAN");
    expect(report?.unaccountedRequestItems).toHaveLength(5);
    expect(report?.unmappedOperationIds).toEqual(["operation:0"]);
    expect(report?.issues[0]).toMatch(/^INCOMPLETE_PLAN: .*declare goals\[\]/);
  });

  it("requires every declared goal to carry a valid disposition", () => {
    const report = editPlanCoverage(input({
      operations: [op()],
      goals: [goal("a", "complete the missing upper terraces", { operationIds: [] }), goal("b", "make the roof usable as outdoor space", { status: "already-satisfied", operationIds: undefined }), goal("c", "improve the pool patio for outdoor living", { status: "capability-needed", operationIds: undefined, capabilityNeedIds: ["missing"] }), goal("d", "add depth to the facade with landscaping", { operationIds: ["operation:7"] }), goal("e", "connect every floor with stairs")],
    }));
    expect(report?.unaccountedGoalIds.sort()).toEqual(["a", "b", "c", "d"]);
    expect(report?.issues.join("\n")).toMatch(/operation:7, which is not an operation/);
    expect(report?.issues.join("\n")).toMatch(/gives no evidence/);
  });

  it("accepts many operations for one goal, already-satisfied evidence, and Capability Needs", () => {
    expect(editPlanCoverage(input({ operations: [op(), op(), op()], goals: FULL_GOALS, capabilityNeeds: NEEDS }))).toBeUndefined();
  });

  it("lets one operation serve several related goals when the mapping is explicit", () => {
    const goals = [goal("terraces", "complete the missing upper terraces"), goal("roof", "make the roof usable as outdoor space"), goal("patio", "improve the pool patio for outdoor living"), goal("facade", "add depth to the facade with landscaping"), goal("stairs", "connect every floor with stairs")];
    expect(editPlanCoverage(input({ operations: [op()], goals }))).toBeUndefined();
  });

  it("requires already-satisfied evidence to cite real targets", () => {
    const goals = FULL_GOALS.map((g) => (g.id === "facade" ? { ...g, evidenceTargetIds: ["site:invented"] } : g));
    const report = editPlanCoverage(input({ operations: [op(), op(), op()], goals, capabilityNeeds: NEEDS }));
    expect(report?.unaccountedGoalIds).toEqual(["facade"]);
  });

  it("does not let an unmapped operation ride along with the goals", () => {
    const report = editPlanCoverage(input({ operations: [op(), op(), op(), op("delete")], goals: FULL_GOALS, capabilityNeeds: NEEDS }));
    expect(report?.unmappedOperationIds).toEqual(["operation:3"]);
  });

  it("does not let one trivial goal stand in for an enumerated request", () => {
    const report = editPlanCoverage(input({ operations: [op("delete")], goals: [goal("tidy", "remove the entry portico addition")] }));
    expect(report?.unaccountedRequestItems).toEqual(enumeratedRequestItems(FIVE_ITEMS));
  });

  it("treats extrude/cut as not executed, so they cannot complete a planned goal", () => {
    const goals = [goal("stairs", "connect every floor with stairs")];
    const report = editPlanCoverage(input({ request: "connect every floor with stairs", operations: [op("cut")], goals }));
    expect(report?.unaccountedGoalIds).toEqual(["stairs"]);
  });

  it("keeps a local one-goal edit lightweight: no ledger required", () => {
    expect(editGoalsRequired("local-object", "move the table two metres")).toBe(false);
    expect(editPlanCoverage(input({ breadth: "local-object", request: "move the table two metres", operations: [op("move")] }))).toBeUndefined();
    expect(editPlanCoverage(input({ breadth: "local-architecture", request: "add a pergola over the terrace", operations: [op()] }))).toBeUndefined();
  });

  it("imposes no operation ceiling on a broad plan", () => {
    const operations = Array.from({ length: 24 }, () => op());
    const goals = FULL_GOALS.map((g) => (g.id === "terraces" ? { ...g, operationIds: operations.map((_, i) => `operation:${i}`) } : g.id === "patio" ? { ...g, operationIds: ["operation:3"] } : g));
    expect(editPlanCoverage(input({ operations, goals, capabilityNeeds: NEEDS }))).toBeUndefined();
  });

  it("reads list structure only, never architectural vocabulary", () => {
    // Prose naming many architectural nouns has no list structure, so the Architect alone interprets it.
    expect(enumeratedRequestItems("Add balconies, stairs, a roof terrace, doors, and a pergola by the pool.")).toEqual([]);
    // The same list structure with nonsense words is enforced identically.
    const nonsense = "Please:\n- frobnicate the wibble\n- defrangle the zop";
    expect(enumeratedRequestItems(nonsense)).toEqual(["frobnicate the wibble", "defrangle the zop"]);
    expect(editPlanCoverage(input({ breadth: "local-architecture", request: nonsense, operations: [op()], goals: [goal("w", "frobnicate the wibble")] }))?.unaccountedRequestItems).toEqual(["defrangle the zop"]);
  });

  it("summarizes actual coverage, partial when any goal needs a capability", () => {
    const summary = summarizeEditGoals(FULL_GOALS, 3, NEEDS)!;
    expect(summary).toMatchObject({ completed: 2, alreadySatisfied: 1, capabilityNeeded: 2, operationsApplied: 3, complete: false });
    const text = describeEditGoalSummary(summary);
    expect(text).toBe("Architectural revision partially applied: 2 goals completed, 3 operations applied, 1 already satisfied, 2 require new geometry capabilities. Not yet possible: make the roof usable as outdoor space (needs roof access stair); connect every floor with stairs (needs interior stair and floor opening).");
    expect(describeEditGoalSummary(summarizeEditGoals([FULL_GOALS[0]], 2)!)).toBe("Architectural revision applied: 1 goal completed, 2 operations applied.");
    expect(summarizeEditGoals(undefined, 1)).toBeUndefined();
  });

  it("feeds incomplete plans back as structured INCOMPLETE_PLAN feedback", () => {
    const plan = { intent: "tidy", operations: [{ op: "delete" as const, target: "assembly:main:portico" as const }] };
    const report = editPlanCoverage(input({ operations: plan.operations }))!;
    const validation = architectPlanValidationResult(plan, report.issues, [], report);
    expect(validation.coverage).toMatchObject({ code: "INCOMPLETE_PLAN", message: "Several user goals have no operation, already-satisfied evidence, or Capability Need.", unmappedOperationIds: ["operation:0"] });
    expect(validation.errors.every((error) => error.code === "INCOMPLETE_PLAN")).toBe(true);
    expect(validation.errors[0].targetId).toBeUndefined();
  });

  it("offers the provider only the operation plan — never a replacement document", () => {
    const wire = JSON.stringify(asSchema(architectEditWireSchema).jsonSchema);
    expect(wire).not.toContain('"document"');
    expect(wire).not.toContain('"scope"');
    expect(wire).toContain('"goals"');
    expect(wire.length).toBeLessThan(8_000);
    expect(sceneEditPlanSchema.safeParse({ intent: "x", operations: [], status: "capability-needed", capabilityNeeds: NEEDS, goals: [FULL_GOALS[1]] }).success).toBe(true);
    expect(ARCHITECT_EDIT_SYSTEM_PROMPT).not.toContain("Return only { document }");
    expect(ARCHITECT_EDIT_SYSTEM_PROMPT).toMatch(/GOALS\./);
  });
});

const doc = (): ArchitecturalDesignDocument => structuredClone(ARCHITECTURE_FIXTURES.cantileverHouse);
/** Replaces the first mass, keeping the document's readonly mass list immutable. */
const withMain = (document: ArchitecturalDesignDocument, patch: (mass: MassVolume) => MassVolume): ArchitecturalDesignDocument => {
  const next = structuredClone(document);
  return { ...next, massing: { ...next.massing, masses: next.massing.masses.map((mass, i) => (i === 0 ? patch(mass) : mass)) } };
};
const withAssembly = (document: ArchitecturalDesignDocument, assembly: ArchitecturalAssembly) => withMain(document, (mass) => ({ ...mass, assemblies: [...(mass.assemblies ?? []), assembly] }));

describe("circulation audit", () => {
  it("reports what it cannot verify instead of claiming it passes", () => {
    const audit = auditCirculation(doc());
    expect(audit.limitations.join(" ")).toMatch(/Rooms and interior partitions are not represented/);
    const twoStorey = withMain(doc(), (mass) => ({ ...mass, floors: 2 }));
    expect(auditCirculation(twoStorey).limitations.join(" ")).toMatch(/Stairs and floor openings are not represented/);
  });

  it("flags a mass with no door and no declared connection", () => {
    const sealed = doc();
    sealed.massing.masses = sealed.massing.masses.map((mass) => ({ ...mass, openings: (mass.openings ?? []).filter((opening) => opening.type !== "door"), parentId: undefined, relationships: [] }));
    expect(auditCirculation(sealed).issues.filter((issue) => issue.kind === "mass-unreachable")).toHaveLength(sealed.massing.masses.length);
  });

  it("reports only issues an edit introduces, with edge-protection and access findings for an upper slab", () => {
    const before = withMain(doc(), (mass) => ({ ...mass, floors: 2 }));
    const id = before.massing.masses[0].id;
    const bare = withAssembly(before, { id: "deck", intent: "upper terrace", parts: [{ id: "s", type: "slab", facade: "south", start: .2, end: .5, depth: 1.5, host: { kind: "facade", facade: "south", level: 1 } }] });
    const introduced = introducedCirculationIssues(before, bare);
    expect(introduced.map((issue) => issue.kind).sort()).toEqual(["elevated-slab-inaccessible", "elevated-slab-unprotected"]);
    expect(introduced[0].targetId).toBe(`part:${id}:deck:s`);

    const withDoor = withMain(before, (mass) => ({ ...mass, openings: [...(mass.openings ?? []), { type: "door", facade: "south", start: .3, end: .4, floors: "upper" }] }));
    const protectedDeck = withAssembly(withDoor, { id: "deck", intent: "upper terrace", parts: [{ id: "s", type: "slab", facade: "south", start: .2, end: .5, depth: 1.5, host: { kind: "facade", facade: "south", level: 1 } }, { id: "r", type: "railing", slabId: "s", edges: ["outer", "start", "end"], height: 1.05 }] });
    expect(introducedCirculationIssues(withDoor, protectedDeck)).toEqual([]);
    // A pre-existing finding does not block an unrelated later edit.
    expect(introducedCirculationIssues(bare, structuredClone(bare))).toEqual([]);
  });

  it("states roof-terrace access as a limitation rather than certainty", () => {
    const roof = withAssembly(doc(), { id: "roofdeck", intent: "roof terrace", parts: [{ id: "s", type: "slab", facade: "south", start: .1, end: .9, depth: 3, host: { kind: "roof" } }, { id: "r", type: "railing", slabId: "s", edges: ["outer"], height: 1.05 }] });
    const audit = auditCirculation(roof);
    expect(audit.issues.filter((issue) => issue.targetId.includes("roofdeck"))).toEqual([]);
    expect(audit.limitations.join(" ")).toMatch(/Roof terraces have no representable access/);
  });
});
