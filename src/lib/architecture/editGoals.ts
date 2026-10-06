import { z } from "zod";

/**
 * Goal coverage for Architect edits.
 *
 * The Architect owns interpretation: it reads the owner's request and declares the design goals it heard. This module
 * never derives goals from request nouns. It only verifies the bookkeeping of the declared plan — every goal has a
 * disposition, every disposition points at real evidence, and every operation serves a declared goal — so a broad
 * request cannot be reported as finished after one unrelated operation.
 */
export const EDIT_GOAL_STATUSES = ["planned", "already-satisfied", "capability-needed"] as const;
export type EditGoalStatus = (typeof EDIT_GOAL_STATUSES)[number];

export interface EditGoal {
  id: string;
  /** The Architect's statement of the design goal. */
  intent: string;
  /** The owner's own words this goal answers (a verbatim excerpt of the request). */
  request?: string;
  status: EditGoalStatus;
  /** `operation:<index>` references into the plan's operations. Required for planned goals. */
  operationIds?: readonly string[];
  /** Ids of entries in the plan's capabilityNeeds. Required for capability-needed goals. */
  capabilityNeedIds?: readonly string[];
  /** Why the current world already satisfies the goal. Required for already-satisfied goals. */
  evidence?: string;
  /** Stable catalog targets that carry that evidence. Required for already-satisfied goals. */
  evidenceTargetIds?: readonly string[];
}

export interface EditCapabilityNeed { id?: string; capability: string; reason: string; }

export const editGoalSchema = z.object({
  id: z.string().min(1),
  intent: z.string().min(1),
  request: z.string().min(1).optional(),
  status: z.enum(EDIT_GOAL_STATUSES),
  operationIds: z.array(z.string().regex(/^operation:\d+$/)).optional(),
  capabilityNeedIds: z.array(z.string().min(1)).optional(),
  evidence: z.string().min(1).optional(),
  evidenceTargetIds: z.array(z.string().min(1)).optional(),
}).strict();

export const editCapabilityNeedSchema = z.object({ id: z.string().min(1).optional(), capability: z.string().min(1), reason: z.string().min(1) }).strict();

/** The breadth signal the edit context already computed; it never decides what the goals are. */
export type EditBreadth = "local-object" | "local-architecture" | "global-architecture";

export interface EditCoverageInput {
  goals?: readonly EditGoal[];
  /** Only each operation's verb is read: `extrude`/`cut` record a Capability Need rather than changing the world. */
  operations: readonly { op: string }[];
  capabilityNeeds?: readonly EditCapabilityNeed[];
  breadth: EditBreadth;
  /** The owner's exact words; used only for its explicit list structure, never its vocabulary. */
  request: string;
  /** Stable ids the executor can resolve, used to check already-satisfied evidence. */
  knownTargetIds: ReadonlySet<string>;
}

export interface EditCoverageReport {
  code: "INCOMPLETE_PLAN";
  message: string;
  /** Goals with no valid operation, evidence or Capability Need. */
  unaccountedGoalIds: string[];
  /** Explicitly enumerated request items no goal claims. */
  unaccountedRequestItems: string[];
  /** Operations no planned goal claims: they would change the world without serving the request. */
  unmappedOperationIds: string[];
  /** Every finding, one line each, in the same order the repair loop receives them. */
  issues: string[];
}

export const INCOMPLETE_PLAN_PREFIX = "INCOMPLETE_PLAN:";
const INCOMPLETE_MESSAGE = "Several user goals have no operation, already-satisfied evidence, or Capability Need.";

/**
 * The owner's explicit list items: bulleted or numbered lines, or `;`-separated clauses. This is formatting, not
 * vocabulary, so it adds no feature routing; prose without list structure yields no items and leaves goal
 * interpretation entirely to the Architect.
 */
export function enumeratedRequestItems(request: string): string[] {
  const lines = request.split(/\r?\n/).map((line) => line.trim());
  const bullets = lines.filter((line) => /^(?:[-*•]|\d+[.)])\s+\S/.test(line)).map((line) => line.replace(/^(?:[-*•]|\d+[.)])\s+/, "").trim());
  const items = bullets.length >= 2 ? bullets : request.split(";").map((part) => part.trim()).filter((part) => part.split(/\s+/).length >= 2);
  return items.length >= 2 ? items.map((item) => item.replace(/[.;:,]+$/, "")) : [];
}

const tokens = (text: string) => new Set((text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((word) => word.length > 2));
/** Fraction of an item's words a goal repeats. Purely lexical overlap between the owner's words and the goal's quote. */
const overlap = (item: string, goal: EditGoal) => {
  const wanted = tokens(item);
  if (!wanted.size) return 1;
  const have = tokens(`${goal.request ?? ""} ${goal.intent}`);
  return [...wanted].filter((word) => have.has(word)).length / wanted.size;
};
const ITEM_COVERAGE = 0.5;
const UNEXECUTABLE = new Set(["extrude", "cut"]);

/** Goals are mandatory once the edit is broad: global breadth, or an owner request that is itself a list. */
export const editGoalsRequired = (breadth: EditBreadth, request: string) => breadth === "global-architecture" || enumeratedRequestItems(request).length >= 2;

/** Verifies the declared goal ledger. Returns undefined when the plan accounts for the whole request. */
export function editPlanCoverage(input: EditCoverageInput): EditCoverageReport | undefined {
  const operationCount = input.operations.length;
  const goals = input.goals ?? [];
  const needs = input.capabilityNeeds ?? [];
  const issues: string[] = [];
  const unaccounted = new Set<string>();
  const items = enumeratedRequestItems(input.request);
  if (!goals.length) {
    if (!editGoalsRequired(input.breadth, input.request)) return undefined;
    issues.push(`This is a broad request${items.length ? ` with ${items.length} listed items` : ""}: declare goals[] — one entry per distinct design goal in the owner's words — each planned (operationIds), already-satisfied (evidence + evidenceTargetIds), or capability-needed (capabilityNeedIds).`);
    return report(issues, [], items, operationCount ? Array.from({ length: operationCount }, (_, i) => `operation:${i}`) : []);
  }
  const seen = new Set<string>();
  const needIds = new Set(needs.map((need) => need.id).filter((id): id is string => Boolean(id)));
  const claimed = new Set<number>();
  const claimedNeeds = new Set<string>();
  for (const goal of goals) {
    if (seen.has(goal.id)) issues.push(`goal "${goal.id}" is declared twice; goal ids must be unique.`);
    seen.add(goal.id);
    const fault = (message: string) => { unaccounted.add(goal.id); issues.push(`goal "${goal.id}" ${message}`); };
    if (goal.status === "planned") {
      const refs = goal.operationIds ?? [];
      if (!refs.length) fault("is planned but references no operationIds.");
      for (const ref of refs) {
        const index = Number(ref.slice("operation:".length));
        if (!Number.isInteger(index) || index < 0 || index >= operationCount) fault(`references ${ref}, which is not an operation in this plan (operations are operation:0..operation:${Math.max(operationCount - 1, 0)}).`);
        else claimed.add(index);
      }
      if (refs.length && refs.every((ref) => UNEXECUTABLE.has(input.operations[Number(ref.slice("operation:".length))]?.op ?? ""))) {
        fault("is planned only with extrude/cut, which the engine cannot execute; mark it capability-needed with a capabilityNeeds entry instead.");
      }
    } else if (goal.status === "already-satisfied") {
      if (!goal.evidence?.trim()) fault("is already-satisfied but gives no evidence.");
      const targets = goal.evidenceTargetIds ?? [];
      if (!targets.length) fault("is already-satisfied but names no evidenceTargetIds from the current world.");
      const unknown = targets.filter((target) => !input.knownTargetIds.has(target));
      if (unknown.length) fault(`cites evidence targets that do not exist: ${unknown.join(", ")}.`);
      if (goal.operationIds?.length) fault("is already-satisfied and must not claim operations.");
    } else {
      const refs = goal.capabilityNeedIds ?? [];
      if (!refs.length) fault("is capability-needed but references no capabilityNeedIds.");
      const unknown = refs.filter((ref) => !needIds.has(ref));
      if (unknown.length) fault(`references Capability Needs that are not in capabilityNeeds[]: ${unknown.join(", ")}.`);
      refs.forEach((ref) => claimedNeeds.add(ref));
    }
  }
  const unmapped = Array.from({ length: operationCount }, (_, i) => i).filter((i) => !claimed.has(i)).map((i) => `operation:${i}`);
  if (unmapped.length) issues.push(`${unmapped.join(", ")} serve${unmapped.length === 1 ? "s" : ""} no declared goal; map every operation to the goal it advances, or remove it.`);
  const orphanNeeds = needs.filter((need) => !need.id || !claimedNeeds.has(need.id));
  if (orphanNeeds.length) issues.push(`Capability Needs ${orphanNeeds.map((need) => `"${need.id ?? need.capability}"`).join(", ")} are not referenced by any goal; give each an id and reference it from the goal it blocks.`);
  const uncovered = items.filter((item) => !goals.some((goal) => overlap(item, goal) >= ITEM_COVERAGE));
  for (const item of uncovered) issues.push(`The owner's listed item "${item}" is not claimed by any goal; quote it in a goal's request field and give that goal a disposition.`);
  return issues.length ? report(issues, [...unaccounted], uncovered, unmapped) : undefined;
}

function report(issues: string[], unaccountedGoalIds: string[], unaccountedRequestItems: string[], unmappedOperationIds: string[]): EditCoverageReport {
  return { code: "INCOMPLETE_PLAN", message: INCOMPLETE_MESSAGE, unaccountedGoalIds, unaccountedRequestItems, unmappedOperationIds, issues: issues.map((issue) => `${INCOMPLETE_PLAN_PREFIX} ${issue}`) };
}

export interface EditGoalSummary {
  completed: number;
  alreadySatisfied: number;
  capabilityNeeded: number;
  operationsApplied: number;
  /** True only when every declared goal was completed or already satisfied. */
  complete: boolean;
  unfinished: { id: string; intent: string; capabilities: string[] }[];
}

/** Coverage of an accepted plan. A plan without goals is a local edit and is described by its operations alone. */
export function summarizeEditGoals(goals: readonly EditGoal[] | undefined, operationCount: number, capabilityNeeds: readonly EditCapabilityNeed[] = []): EditGoalSummary | undefined {
  if (!goals?.length) return undefined;
  const completed = goals.filter((goal) => goal.status === "planned").length;
  const alreadySatisfied = goals.filter((goal) => goal.status === "already-satisfied").length;
  const blocked = goals.filter((goal) => goal.status === "capability-needed");
  return {
    completed, alreadySatisfied, capabilityNeeded: blocked.length, operationsApplied: operationCount, complete: blocked.length === 0,
    unfinished: blocked.map((goal) => ({ id: goal.id, intent: goal.intent, capabilities: (goal.capabilityNeedIds ?? []).map((id) => capabilityNeeds.find((need) => need.id === id)?.capability ?? id) })),
  };
}

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/** A concise owner-facing line that reflects actual goal coverage, never just the last operation. */
export function describeEditGoalSummary(summary: EditGoalSummary): string {
  const parts = [`${plural(summary.completed, "goal")} completed`, `${plural(summary.operationsApplied, "operation")} applied`];
  if (summary.alreadySatisfied) parts.push(`${summary.alreadySatisfied} already satisfied`);
  if (summary.capabilityNeeded) parts.push(`${summary.capabilityNeeded} ${summary.capabilityNeeded === 1 ? "requires" : "require"} new geometry capabilities`);
  const head = `${summary.complete ? "Architectural revision applied" : "Architectural revision partially applied"}: ${parts.join(", ")}.`;
  if (summary.complete) return head;
  return `${head} Not yet possible: ${summary.unfinished.map((goal) => `${goal.intent}${goal.capabilities.length ? ` (needs ${goal.capabilities.join(", ")})` : ""}`).join("; ")}.`;
}
