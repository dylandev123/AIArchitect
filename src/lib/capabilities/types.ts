import type { HousePrimitive } from "@/lib/house/types";
import type { CapabilityCategory, CapabilityParameter, CapabilityStatus } from "@/types/library";

/** A stage asks for intent. It never imports a geometry builder. */
export interface CapabilityIntent {
  id: string;
  stage: string;
  parameters?: Record<string, unknown>;
  projectId?: string | null;
  recipeId?: string;
}

export interface CapabilityGeometryContext {
  primitives: readonly HousePrimitive[];
  /** Kept deliberately open so plugins can receive a stage's typed target without the engine knowing its shape. */
  target?: unknown;
}

export interface CapabilityGeometryResult {
  primitives: HousePrimitive[];
  note?: string;
}

/** The only method a geometry plugin has to implement. Lifecycle and learning belong to the engine. */
export interface CapabilityImplementation {
  apply(context: CapabilityGeometryContext, parameters: Record<string, unknown>): CapabilityGeometryResult;
}

export interface CapabilityMetadata {
  id: string; name: string; category: CapabilityCategory; version: number;
  status: CapabilityStatus; description: string;
  parameters: CapabilityParameter[]; constraints: string[];
  visualImpact: number; implementationDifficulty: number; performanceCost: number;
  architecturalImportance: number; fallback: string; implementationNotes: string;
}

export interface CapabilityPlugin { metadata: CapabilityMetadata; implementation: CapabilityImplementation; }
/** Complete public contract exposed by the engine; plugins provide only `implementation.apply`. */
export interface Capability {
  id: string; name: string; category: CapabilityCategory; version: number; status: CapabilityStatus; description: string;
  validate(parameters: Record<string, unknown>): string[];
  canApply(context: CapabilityGeometryContext, parameters: Record<string, unknown>): boolean;
  estimateDifficulty(): number; estimateVisualImpact(): number; estimatePerformanceCost(): number;
  apply(context: CapabilityGeometryContext, parameters: Record<string, unknown>): CapabilityGeometryResult;
  fallback(): string;
  recordSuccess(): void; recordFailure(): void;
}
export interface CapabilityOutcome {
  id: string; status: "applied" | "fallback" | "unavailable";
  primitives: HousePrimitive[]; fallback: string; note?: string;
}
