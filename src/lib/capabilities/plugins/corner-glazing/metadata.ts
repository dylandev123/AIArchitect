import type { CapabilityMetadata } from "../../types";

export const metadata: CapabilityMetadata = {
  id: "corner-glazing", name: "Corner Glazing", category: "openings", version: 1, status: "supported",
  description: "Continuous glazed panels wrapping two adjacent faces of a mass.",
  parameters: [{ key: "massId", required: true }, { key: "corner" }, { key: "width" }, { key: "height" }, { key: "sill" }],
  constraints: ["Requires a rectangular mass", "Does not boolean-cut structural walls yet"],
  visualImpact: 9, implementationDifficulty: 6, performanceCost: 2, architecturalImportance: 8,
  fallback: "Use large adjacent windows at the selected corner.", implementationNotes: "Procedural glazing panels with a shared corner mullion.",
};
