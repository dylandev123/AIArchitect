import type { CapabilityMetadata } from "../../types";

export const metadata: CapabilityMetadata = {
  id: "entry-canopy", name: "Entry Canopy", category: "facade", version: 1, status: "supported",
  description: "A freestanding roof-only canopy with two posts, projecting from one facade to shelter an entry.",
  parameters: [{ key: "massId", required: true }, { key: "facade", required: true }, { key: "width" }, { key: "depth" }, { key: "height" }],
  constraints: ["Ignores the target mass's own rotation, same approximation as Courtyard Edge Wall", "Purely additive geometry — does not interact with the mass's footprint or walls"],
  visualImpact: 6, implementationDifficulty: 3, performanceCost: 1, architecturalImportance: 6,
  fallback: "Leave the entry sheltered only by the mass's own roof overhang.",
  implementationNotes: "Roof plate + two posts, independent of the entry-recess footprint operation (which carves the wall) — the two are meant to be used together.",
};
