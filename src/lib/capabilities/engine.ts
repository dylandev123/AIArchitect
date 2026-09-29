import { capabilityRegistry } from "./registry";
import type { Capability, CapabilityGeometryContext, CapabilityIntent, CapabilityOutcome, CapabilityPlugin } from "./types";

const outcomes = new Map<string, { success: number; failure: number }>();
/** Lifecycle adapter: all methods except `apply` are generic and deliberately not plugin responsibilities. */
export function capabilityFrom(plugin: CapabilityPlugin): Capability {
  const count = () => outcomes.get(plugin.metadata.id) ?? { success: 0, failure: 0 };
  return {
    ...plugin.metadata,
    validate: (parameters) => plugin.metadata.parameters.filter((p) => p.required && parameters[p.key] === undefined).map((p) => `Missing parameter: ${p.key}`),
    canApply: (_context, parameters) => plugin.metadata.status === "supported" && plugin.metadata.parameters.filter((p) => p.required).every((p) => parameters[p.key] !== undefined),
    estimateDifficulty: () => plugin.metadata.implementationDifficulty,
    estimateVisualImpact: () => plugin.metadata.visualImpact,
    estimatePerformanceCost: () => plugin.metadata.performanceCost,
    apply: (context, parameters) => plugin.implementation.apply(context, parameters), fallback: () => plugin.metadata.fallback,
    recordSuccess: () => { const current = count(); outcomes.set(plugin.metadata.id, { ...current, success: current.success + 1 }); },
    recordFailure: () => { const current = count(); outcomes.set(plugin.metadata.id, { ...current, failure: current.failure + 1 }); },
  };
}

/** Generic lifecycle: validate → can apply → apply or fallback → an outcome that learning can record. */
export function requestCapability(intent: CapabilityIntent, context: CapabilityGeometryContext): CapabilityOutcome {
  const plugin = capabilityRegistry.get(intent.id);
  if (!plugin || plugin.metadata.status === "missing" || plugin.metadata.status === "deprecated") {
    return { id: intent.id, status: "unavailable", primitives: [], fallback: plugin?.metadata.fallback ?? "Continue with the closest supported composition." };
  }
  const capability = capabilityFrom(plugin); const parameters = intent.parameters ?? {};
  const validation = capability.validate(parameters);
  if (!capability.canApply(context, parameters)) { capability.recordFailure(); return { id: intent.id, status: "fallback", primitives: [], fallback: capability.fallback(), note: validation.join(", ") || "Capability cannot apply in this context." }; }
  try {
    const result = capability.apply(context, parameters); capability.recordSuccess();
    return { id: intent.id, status: "applied", primitives: result.primitives, remove: result.remove, fallback: capability.fallback(), note: result.note };
  } catch (error) {
    capability.recordFailure(); return { id: intent.id, status: "fallback", primitives: [], fallback: capability.fallback(), note: error instanceof Error ? error.message : String(error) };
  }
}

export const capabilityPlugins = () => capabilityRegistry.all();
