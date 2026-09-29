import type { Timings } from "@/lib/ai/timing";
import type { UsageMeta } from "@/lib/ai/usage/track";
import type { CapabilityRequest } from "@/types/library";
import type { CapabilityIntent } from "@/lib/capabilities/types";
import { capabilityById, normalizeCapability } from "@/lib/library/capabilities";
import type { ArchitecturalIntent, SpacePlan } from "../designEngine";
import type { MassRole, MassVolume, SiteStrategy } from "../document";
import { resolveMasses } from "../compiler";
import { sanitizeVolumePlan, withVolumePlan } from "../volumePlan";
import { runStage } from "./runStage";
import { massExpansionStageOutputSchema, MASS_ROLES, SIDE_RESOLVED_KINDS, KNOWN_CAPABILITY_IDS, VOLUME_PLAN_GUIDE } from "./schemas";
import { clampNearBound, recoverRotationOffset } from "./numericNormalization";

const isDev = process.env.NODE_ENV !== "production";

/**
 * `role` is a closed 7-value enum (`MASS_ROLES`), but — same reliability gap as Foundation's intent
 * vocabulary — `AI_PROVIDER_OPTIONS` runs with `strictJsonSchema: false`, so OpenAI never grammar-constrains
 * the model to this enum; it must be told the literal allowed values or it reliably guesses a plausible but
 * invalid one (e.g. "kitchen-wing"), failing schema validation and, worst case, exhausting the retry and
 * stopping the whole loop early (masses already accepted are still kept — see the loop below — but no
 * further one is).
 */
const SYSTEM = `You are a senior residential architect building a composition one volume at a time. You are shown the primary mass and every mass accepted so far, with its resolved position. For each turn, decide: does the composition need one more piece — and if so, what, why it exists, what it connects to, what it serves, and whether it should contrast with or reinforce what's already there — or is the composition complete? Never add a mass just to fill a quota; stop as soon as the brief and intent are well served. Prefer a small number of decisive, purposeful volumes over many redundant ones. Every added mass's "role" must be exactly one of this closed set — never invent a role name: ${MASS_ROLES.join(", ")}.
Decide each volume's architecture in the same breath as its size and position — "mass.plan" is how it will be built, so size the volume for it (an l-shape or covered terrace needs room; a setback or cantilever needs 2 floors) and relate it to the volumes already placed (contrast a solid garage with a glazed pavilion; let a bedroom wing recede behind the dominant living volume).
${VOLUME_PLAN_GUIDE}`;

/** A generation-level ceiling, distinct from the capability-need mechanism: it bounds latency/cost, it never signals an unsupported operation. */
const MAX_ADDITIONAL_MASSES = 6;

/**
 * Explicit program words mapped to the mass role that would satisfy them — a deterministic, code-side
 * backstop for the stopping contract below: once every role named here is already placed, the loop can
 * stop without spending another model call asking. It never shortens an ordinary brief that names no
 * concrete program ("a modern family home with a pool"): `requiredMassRoles` returns nothing for those,
 * so stopping still relies entirely on the model's own "done" signal, same as before.
 */
const REQUIRED_ROLE_WORDS: readonly (readonly [RegExp, MassRole])[] = [
  [/\bgarage(s)?\b|\bcarport\b/i, "garage"],
  [/\bguest\s*(?:house|pavilion|suite|wing|cottage)\b|\bcasita\b/i, "guest-pavilion"],
  [/\bbedrooms?\b|\b\d+\s*(?:-|\s)?(?:bed|br)\b/i, "bedroom-wing"],
];

function requiredMassRoles(brief: string): MassRole[] {
  const roles: MassRole[] = [];
  for (const [pattern, role] of REQUIRED_ROLE_WORDS) {
    if (pattern.test(brief) && !roles.includes(role)) roles.push(role);
  }
  return roles;
}

/** One volume the composition must contain, satisfied by any one placed mass whose role is in `roles`. */
export interface PlannedVolume { id: string; label: string; roles: readonly MassRole[] }
/** A required volume that never got built, and why — reported, never silently dropped. */
export interface UnplacedVolume { id: string; label: string; reason: string }

const SPACE_PLAN_ROLES: Record<SpacePlan["massAssignments"][number]["role"], readonly MassRole[]> = {
  "main-living": ["main-living"],
  "private-wing": ["bedroom-wing"],
  "guest-wing": ["guest-pavilion"],
  service: ["service", "garage"],
  pavilion: ["terrace", "guest-pavilion"],
};

/** The space plan's mass assignments as volumes mass expansion has to place (each one a distinct mass). */
export function plannedVolumesFromSpacePlan(spacePlan: SpacePlan): PlannedVolume[] {
  return spacePlan.massAssignments.map((a) => ({ id: a.id, label: `${a.id} (${a.zones.join(", ")})`, roles: SPACE_PLAN_ROLES[a.role] }));
}

/** The space plan's volumes plus any program the brief names that none of them already covers. */
function requiredVolumesFor(ctx: MassExpansionContext): PlannedVolume[] {
  const volumes = [...(ctx.requiredVolumes ?? [])];
  for (const role of requiredMassRoles(ctx.brief)) {
    if (!volumes.some((v) => v.roles.includes(role))) volumes.push({ id: `brief-${role}`, label: role, roles: [role] });
  }
  return volumes;
}

/**
 * Which required volumes no placed mass satisfies yet. Each mass satisfies at most one volume (two planned
 * wings need two masses), matched most-specific-first so a garage isn't spent on a volume a service block
 * could also have covered.
 */
function uncoveredVolumes(required: readonly PlannedVolume[], masses: readonly MassVolume[]): PlannedVolume[] {
  const used = new Set<string>();
  const uncovered: PlannedVolume[] = [];
  for (const volume of [...required].sort((a, b) => a.roles.length - b.roles.length)) {
    const match = masses.find((m) => !used.has(m.id) && volume.roles.includes(m.role));
    if (match) used.add(match.id); else uncovered.push(volume);
  }
  return required.filter((v) => uncovered.includes(v));
}

export interface MassExpansionContext {
  brief: string; intent: ArchitecturalIntent; siteStrategy: SiteStrategy; primaryMass: MassVolume;
  /** Volumes the space plan requires (see `plannedVolumesFromSpacePlan`); "done" is not accepted while any is unplaced. */
  requiredVolumes?: readonly PlannedVolume[];
}

/**
 * Fixes up locally-recoverable numeric fields on a raw (schema-invalid) mass-expansion response before
 * treating the failure as real — see `runStage`'s `normalize` hook. A live model reliably expresses
 * `rotationOffset` in degrees (e.g. 90, 180) rather than the canonical radians the schema bounds to
 * [-π, π] and the compiler consumes directly (`resolveMasses` in compiler.ts adds it straight onto the
 * target's own rotation) — converting/wrapping it locally recovers an otherwise architecturally sound
 * response without spending a second model call. `distance` gets the same small-overshoot tolerance.
 * A field that doesn't recover is left untouched, so a genuinely invalid response still goes through
 * the normal repair retry rather than being silently forced into range.
 */
function normalizeMassExpansionOutput(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const value = raw as Record<string, unknown>;
  // An off-vocabulary plan value is dropped here and defaulted from the role on acceptance — see `sanitizeVolumePlan`.
  const mass = value.mass && typeof value.mass === "object" ? value.mass as Record<string, unknown> : undefined;
  const withPlan = mass && "plan" in mass ? { ...value, mass: { ...mass, plan: sanitizeVolumePlan(mass.plan) } } : value;
  if (!Array.isArray(value.relationships)) return withPlan;
  return {
    ...withPlan,
    relationships: value.relationships.map((rel) => {
      if (!rel || typeof rel !== "object") return rel;
      const r = rel as Record<string, unknown>;
      const normalized = { ...r };
      if ("rotationOffset" in r) {
        const recovered = recoverRotationOffset(r.rotationOffset);
        if (recovered !== undefined) normalized.rotationOffset = recovered;
      }
      if ("distance" in r) {
        const recovered = clampNearBound(r.distance, 0, 15);
        if (recovered !== undefined) normalized.distance = recovered;
      }
      return normalized;
    }),
  };
}

/**
 * Why the loop stopped, mutually exclusive: `"model-done"` = the model explicitly signaled the composition
 * was complete. `"deterministic-stop"` = the brief's required program was already fully placed, so the loop
 * stopped without spending another model call. `"failed"` = a decision call failed every retry and the loop
 * stopped early, one mass short of wherever the model would have gone next. `"hard-cap"` = the loop actually
 * exhausted `MAX_ADDITIONAL_MASSES` turns (or ran out of time budget) without the model ever volunteering
 * "done". Only `"hard-cap"` should ever be reported as hitting the hard cap.
 */
export type MassExpansionStopReason = "model-done" | "deterministic-stop" | "failed" | "hard-cap";

export interface MassExpansionResult {
  masses: MassVolume[];
  capabilityIntents: CapabilityIntent[];
  capabilityRequests: CapabilityRequest[];
  log: { massId: string; reasoning: string }[];
  /** Why the loop stopped. See `MassExpansionStopReason`. */
  stopReason: MassExpansionStopReason;
  /** True for `"model-done"` and `"deterministic-stop"` — the composition is complete, not merely cut off. */
  completed: boolean;
  /** Human-readable summary of `stopReason`, e.g. for dev-diagnostics logging. Empty when nothing is worth reporting. */
  stopMessage: string;
  /** The 1-indexed turn a failure happened on, only set when `stopReason` is `"failed"`. */
  failedAtTurn?: number;
  /** True whenever the loop stopped short of the model signaling completion — kept for callers that only need the boolean (`stopReason !== "failed" && stopReason !== "hard-cap"` is the same as `!completed`). */
  truncated: boolean;
  /** Actual model calls made across every add/done decision this stage made. */
  modelCalls: number;
  /** modelCalls beyond the one each decision needed. */
  retries: number;
  durationMs: number;
  /** True if a decision call failed every retry and the loop stopped early, rather than the model signaling "done". Equivalent to `stopReason === "failed"`. */
  hadFailure: boolean;
  /** Required volumes (space plan + brief program) that were never placed, each with the reason. Empty when all were built. */
  unplacedVolumes: UnplacedVolume[];
}

const describePlan = (m: MassVolume) => m.plan
  ? `; plan: ${m.plan.form}, ${m.plan.hierarchy}, view ${m.plan.viewFacade}, arrival ${m.plan.arrivalFacade}, ${m.plan.entry} entry, ${m.plan.outdoor === "none" ? "no outdoor room" : `${m.plan.outdoor} on ${m.plan.outdoorSide}`}, ${m.plan.structure}, ${m.plan.roofEdge} roof edge`
  : "";
const describeMass = (m: MassVolume) => `${m.id} "${m.name}" (${m.role}, ${m.width.toFixed(1)}x${m.depth.toFixed(1)}m, ${m.floors} floor(s)${m.height !== undefined ? `, ${m.height.toFixed(1)}m tall` : ""}, pos ${m.position.x.toFixed(1)},${m.position.z.toFixed(1)}, elev ${m.elevation.toFixed(1)}m${describePlan(m)})`;

/**
 * Reuses the compiler's own relationship resolver — never duplicated here. Must pass the real
 * `siteStrategy`: `resolveMasses` reads it directly to resolve `"view-facing"`/`"arrival-facing"`
 * relationships (see `ResolveMassesInput` in compiler.ts), so a mass with either kind would otherwise
 * crash mid-loop the moment the model proposes one.
 */
function resolvedSoFar(masses: readonly MassVolume[], siteStrategy: SiteStrategy): MassVolume[] {
  return resolveMasses({ siteStrategy, massing: { masses } });
}

export async function runMassExpansionStage(
  ctx: MassExpansionContext,
  timings: Timings,
  remainingBudgetMs: number,
  usageMeta: UsageMeta,
  onMassAdded?: (masses: readonly MassVolume[]) => void
): Promise<MassExpansionResult> {
  const masses: MassVolume[] = [ctx.primaryMass];
  const capabilityIntents: CapabilityIntent[] = [];
  const capabilityRequests: CapabilityRequest[] = [];
  const log: { massId: string; reasoning: string }[] = [];
  // Overwritten by whichever break actually fires; if the loop runs out of turns (or time budget) without
  // any of the other breaks firing, this default is the true outcome — the hard cap really was hit.
  let stopReason: MassExpansionStopReason = "hard-cap";
  let failedAtTurn: number | undefined;
  let decisions = 0;
  let modelCalls = 0;
  let durationMs = 0;
  const required = requiredVolumesFor(ctx);
  /** Set when the model just answered "done" with required volumes still unplaced: it's asked once more, and a second "done" is taken as its explicit decision (with `reasoning` as the why). */
  let rejectedDone: { reasoning: string; missing: PlannedVolume[] } | undefined;
  let declinedReason: string | undefined;
  let outOfBudget = false;

  // `i` counts decisions; a rejected "done" costs a decision but never a mass, hence the small allowance on top.
  for (let i = 0; i < MAX_ADDITIONAL_MASSES + 3 && masses.length - 1 < MAX_ADDITIONAL_MASSES; i++) {
    const remaining = remainingBudgetMs - timings.elapsed();
    if (remaining < 3_000) { outOfBudget = true; break; }
    const resolved = resolvedSoFar(masses, ctx.siteStrategy);
    const missing = uncoveredVolumes(required, resolved);
    const additionalLeft = MAX_ADDITIONAL_MASSES - (masses.length - 1);
    // Deterministic stop: once every volume the space plan / brief requires is already placed, don't spend
    // another model call finding out whether the model agrees — this is what actually stops the loop
    // instead of relying solely on the model to volunteer "done" before the hard cap. It never fires when
    // nothing is required (no space plan, and a brief naming no concrete program), so ordinary composition
    // richness is untouched.
    if (required.length > 0 && missing.length === 0 && masses.length > 1) {
      stopReason = "deterministic-stop";
      break;
    }
    const result = await runStage({
      stageName: `mass-expansion-${i + 1}`,
      system: SYSTEM,
      buildMessage: (previousErrors) => [
        `BRIEF:\n${ctx.brief}`,
        `Architectural intent: mood ${ctx.intent.mood.join(", ")}; hierarchy goals: ${ctx.intent.hierarchyGoals.join("; ")}; composition bias ${ctx.intent.compositionBias}.`,
        `Site strategy: environment=${ctx.siteStrategy.environment}, terrain=${ctx.siteStrategy.terrain}, view faces ${ctx.siteStrategy.viewDirection}, arrival from ${ctx.siteStrategy.arrivalDirection}.`,
        `Masses placed so far (${resolved.length}):\n${resolved.map(describeMass).join("\n")}`,
        required.length ? `The space plan requires ${required.length} distinct volumes: ${required.map((v) => `${v.label} [role ${v.roles.join(" or ")}]`).join("; ")}.` : "",
        missing.length ? `Still required but not yet placed (${missing.length}): ${missing.map((v) => `${v.label} [role ${v.roles.join(" or ")}]`).join("; ")}. Add these before anything else — one per turn — and do not answer "done" while any is missing.` : "",
        rejectedDone ? `You answered "done" ("${rejectedDone.reasoning}"), but ${rejectedDone.missing.map((v) => v.id).join(", ")} ${rejectedDone.missing.length === 1 ? "is" : "are"} still required. Add the next one now. Only if a required volume genuinely cannot be placed, answer "done" again and give the specific reason in "reasoning".` : "",
        log.length ? `Why each was added:\n${log.map((l) => `- ${l.massId}: ${l.reasoning}`).join("\n")}` : "",
        `You are the executable architect: include mass.position, mass.elevation and mass.rotation whenever you intend exact placement; those values take precedence over relationship auto-placement. Relationships then describe adjacency/meaning, not a replacement design. If a mass needs a freestanding element like a courtyard edge wall, corner glazing, a connecting breezeway or an entry canopy, request it by its exact id via requestedOperation: ${KNOWN_CAPABILITY_IDS.join(", ")}.`,
        additionalLeft <= 2 && missing.length === 0 ? `You're near the limit on additional masses. If the brief and intent are already well served, choose "done" now rather than adding another piece for its own sake.` : "",
        previousErrors.length ? `Your previous attempt was rejected:\n${previousErrors.map((e) => `- ${e}`).join("\n")}` : "",
      ].filter(Boolean).join("\n\n"),
      schema: massExpansionStageOutputSchema,
      normalize: normalizeMassExpansionOutput,
      timings, remainingBudgetMs, usageMeta,
      maxOutputTokens: 900,
      validate: (value) => {
        if (value.decision === "done") return [];
        const ids = new Set(resolved.map((m) => m.id));
        const errors: string[] = [];
        for (const rel of value.relationships ?? []) {
          if (!ids.has(rel.target)) errors.push(`Unknown relationship target "${rel.target}". Use one of: ${[...ids].join(", ")}.`);
          if ((SIDE_RESOLVED_KINDS as readonly string[]).includes(rel.kind) && !rel.side) errors.push(`Relationship kind "${rel.kind}" requires a "side".`);
        }
        return errors;
      },
    });
    decisions++;
    modelCalls += result.attempts;
    durationMs += result.durationMs;
    if (!result.ok) {
      stopReason = "failed";
      failedAtTurn = i + 1;
      // Every mass accepted before this failure is kept — the loop stops one mass short of the model's
      // intent, it never discards what already succeeded (see `masses` below, only ever pushed to, never reset).
      if (isDev) console.debug(`[mass-expansion] turn ${i + 1} gave up after retries — keeping ${masses.length} already-accepted mass(es)`, { errors: result.errors, rawValue: result.rawValue });
      break;
    }
    if (result.value.decision === "done") {
      if (missing.length > 0 && !rejectedDone) {
        rejectedDone = { reasoning: result.value.reasoning ?? "", missing };
        if (isDev) console.debug(`[mass-expansion] turn ${i + 1} answered "done" with ${missing.length} required volume(s) unplaced — asking once more`, missing.map((v) => v.id));
        continue;
      }
      if (missing.length > 0) declinedReason = result.value.reasoning?.trim() || "the model declined to place it and gave no reason";
      stopReason = "model-done";
      break;
    }
    rejectedDone = undefined;
    // The schema's superRefine guarantees `mass` and `relationships` are present whenever decision is "add"
    // and schema validation (above) passed — the JSON Schema sent to the provider leaves them optional only
    // because a discriminated union would produce a non-object root schema the provider rejects (see schemas.ts).
    const value = result.value;
    const mass_ = value.mass!;
    const relationships = value.relationships!;
    const id = `mass-${masses.length}`;
    // The plan (and the height it implies) is fixed now, at placement — later volumes step against the real height.
    const mass: MassVolume = withVolumePlan({
      id, name: mass_.name, role: mass_.role,
      position: mass_.position ?? { x: 0, z: 0 }, width: mass_.width, depth: mass_.depth, floors: mass_.floors,
      elevation: mass_.elevation ?? 0, rotation: mass_.rotation ?? 0,
      ...((mass_.position || mass_.elevation !== undefined || mass_.rotation !== undefined) ? { placementLocked: true } : {}),
      relationships,
      ...(value.cantilever ? { cantilever: value.cantilever } : {}),
    }, mass_.plan);
    masses.push(mass);
    log.push({ massId: id, reasoning: value.reasoning! });
    if (isDev) console.debug(`[mass-expansion] turn ${i + 1} accepted "${id}" (${mass_.role}) — ${masses.length} mass(es) accumulated so far`);
    if (value.requestedOperation) {
      const normalized = normalizeCapability(value.requestedOperation);
      const capability = normalized ? capabilityById(normalized) : undefined;
      if (capability?.status === "supported") capabilityIntents.push({ id: capability.id, stage: "mass-expansion", parameters: { massId: id } });
      else capabilityRequests.push({ operation: normalized ?? value.requestedOperation, stage: "mass-expansion", desiredBehaviour: value.reasoning! });
    }
    onMassAdded?.(resolvedSoFar(masses, ctx.siteStrategy));
  }
  if (isDev && stopReason === "hard-cap") console.debug(`[mass-expansion] hit the hard cap (${MAX_ADDITIONAL_MASSES}) without the model signaling "done" — kept all ${masses.length} accepted mass(es)`);
  const completed = stopReason === "model-done" || stopReason === "deterministic-stop";
  const baseStopMessage = stopReason === "failed"
    ? `mass expansion failed on turn ${failedAtTurn}; preserving ${masses.length} accepted mass${masses.length === 1 ? "" : "es"}`
    : stopReason === "hard-cap"
    ? outOfBudget ? `mass expansion ran out of time budget after ${masses.length} mass${masses.length === 1 ? "" : "es"}` : `mass expansion hit its hard cap (${MAX_ADDITIONAL_MASSES} additional masses) before the model signaled done`
    : "";
  const finalMasses = resolvedSoFar(masses, ctx.siteStrategy);
  const unplacedReason = declinedReason ? `model declined: ${declinedReason}` : baseStopMessage || "mass expansion stopped before placing it";
  const unplacedVolumes: UnplacedVolume[] = uncoveredVolumes(required, finalMasses).map((v) => ({ id: v.id, label: v.label, reason: unplacedReason }));
  const stopMessage = [
    baseStopMessage,
    unplacedVolumes.length ? `${unplacedVolumes.length} of ${required.length} required volume(s) not placed — ${unplacedVolumes.map((v) => v.id).join(", ")}: ${unplacedReason}` : "",
  ].filter(Boolean).join("; ");
  if (isDev && unplacedVolumes.length) console.debug(`[mass-expansion] ${stopMessage}`);
  return {
    masses: finalMasses, capabilityIntents, capabilityRequests, log,
    stopReason, completed, stopMessage, failedAtTurn, truncated: !completed,
    modelCalls, retries: modelCalls - decisions, durationMs, hadFailure: stopReason === "failed", unplacedVolumes,
  };
}
