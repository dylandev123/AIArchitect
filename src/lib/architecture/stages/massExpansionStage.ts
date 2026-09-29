import type { Timings } from "@/lib/ai/timing";
import type { UsageMeta } from "@/lib/ai/usage/track";
import type { CapabilityRequest } from "@/types/library";
import type { CapabilityIntent } from "@/lib/capabilities/types";
import { capabilityById, normalizeCapability } from "@/lib/library/capabilities";
import type { ArchitecturalIntent } from "../designEngine";
import type { ArchitecturalDesignDocument, MassVolume, SiteStrategy } from "../document";
import { resolveMasses } from "../compiler";
import { runStage } from "./runStage";
import { massExpansionStageOutputSchema, SIDE_RESOLVED_KINDS } from "./schemas";

const SYSTEM = `You are a senior residential architect building a composition one volume at a time. You are shown the primary mass and every mass accepted so far, with its resolved position. For each turn, decide: does the composition need one more piece — and if so, what, why it exists, what it connects to, what it serves, and whether it should contrast with or reinforce what's already there — or is the composition complete? Never add a mass just to fill a quota; stop as soon as the brief and intent are well served. Prefer a small number of decisive, purposeful volumes over many redundant ones.`;

/** A generation-level ceiling, distinct from the capability-need mechanism: it bounds latency/cost, it never signals an unsupported operation. */
const MAX_ADDITIONAL_MASSES = 6;

export interface MassExpansionContext { brief: string; intent: ArchitecturalIntent; siteStrategy: SiteStrategy; primaryMass: MassVolume; }

export interface MassExpansionResult {
  masses: MassVolume[];
  capabilityIntents: CapabilityIntent[];
  capabilityRequests: CapabilityRequest[];
  log: { massId: string; reasoning: string }[];
  /** True if the hard cap was hit before the model signaled the composition was complete. */
  truncated: boolean;
}

const describeMass = (m: MassVolume) => `${m.id} "${m.name}" (${m.role}, ${m.width.toFixed(1)}x${m.depth.toFixed(1)}m, pos ${m.position.x.toFixed(1)},${m.position.z.toFixed(1)}, elev ${m.elevation.toFixed(1)}m)`;

/** Reuses the compiler's own relationship resolver on a minimal stub — never duplicated here. */
function resolvedSoFar(masses: readonly MassVolume[]): MassVolume[] {
  const stub = { massing: { composition: "rectangular-pavilion", masses } } as unknown as ArchitecturalDesignDocument;
  return resolveMasses(stub);
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
  let sawDone = false;

  for (let i = 0; i < MAX_ADDITIONAL_MASSES; i++) {
    const remaining = remainingBudgetMs - timings.elapsed();
    if (remaining < 3_000) break;
    const resolved = resolvedSoFar(masses);
    const result = await runStage({
      stageName: `mass-expansion-${i + 1}`,
      system: SYSTEM,
      buildMessage: (previousErrors) => [
        `BRIEF:\n${ctx.brief}`,
        `Architectural intent: mood ${ctx.intent.mood.join(", ")}; hierarchy goals: ${ctx.intent.hierarchyGoals.join("; ")}; composition bias ${ctx.intent.compositionBias}.`,
        `Site strategy: environment=${ctx.siteStrategy.environment}, terrain=${ctx.siteStrategy.terrain}, view faces ${ctx.siteStrategy.viewDirection}, arrival from ${ctx.siteStrategy.arrivalDirection}.`,
        `Masses placed so far (${resolved.length}):\n${resolved.map(describeMass).join("\n")}`,
        log.length ? `Why each was added:\n${log.map((l) => `- ${l.massId}: ${l.reasoning}`).join("\n")}` : "",
        `You may add up to ${MAX_ADDITIONAL_MASSES - i} more mass(es) in total. Every relationship "target" must be one of the mass ids listed above. Relationship kinds adjacent-to, connected-to, offset-from, separated-from and bridge-between require a "side" to be placed; stepped-above/stepped-below adjust elevation and never need one.`,
        previousErrors.length ? `Your previous attempt was rejected:\n${previousErrors.map((e) => `- ${e}`).join("\n")}` : "",
      ].filter(Boolean).join("\n\n"),
      schema: massExpansionStageOutputSchema,
      timings, remainingBudgetMs, usageMeta,
      maxOutputTokens: 500,
      validate: (value) => {
        if (value.decision === "done") return [];
        const ids = new Set(resolved.map((m) => m.id));
        const errors: string[] = [];
        for (const rel of value.relationships) {
          if (!ids.has(rel.target)) errors.push(`Unknown relationship target "${rel.target}". Use one of: ${[...ids].join(", ")}.`);
          if ((SIDE_RESOLVED_KINDS as readonly string[]).includes(rel.kind) && !rel.side) errors.push(`Relationship kind "${rel.kind}" requires a "side".`);
        }
        return errors;
      },
    });
    if (!result.ok) break; // Gave up after retries; stop without claiming the model said the composition was complete.
    if (result.value.decision === "done") {
      sawDone = true;
      break;
    }
    const value = result.value;
    const id = `mass-${masses.length}`;
    const mass: MassVolume = {
      id, name: value.mass.name, role: value.mass.role,
      position: { x: 0, z: 0 }, width: value.mass.width, depth: value.mass.depth, floors: value.mass.floors,
      elevation: 0, rotation: 0,
      relationships: value.relationships,
      ...(value.cantilever ? { cantilever: value.cantilever } : {}),
    };
    masses.push(mass);
    log.push({ massId: id, reasoning: value.reasoning });
    if (value.requestedOperation) {
      const normalized = normalizeCapability(value.requestedOperation);
      const capability = normalized ? capabilityById(normalized) : undefined;
      if (capability?.status === "supported") capabilityIntents.push({ id: capability.id, stage: "mass-expansion", parameters: { massId: id } });
      else capabilityRequests.push({ operation: normalized ?? value.requestedOperation, stage: "mass-expansion", desiredBehaviour: value.reasoning });
    }
    onMassAdded?.(resolvedSoFar(masses));
  }
  return { masses: resolvedSoFar(masses), capabilityIntents, capabilityRequests, log, truncated: !sawDone };
}
