import type { CapabilityMetadata } from "../../types";

export const metadata: CapabilityMetadata = {
  id: "bridge-masses", name: "Bridge Masses", category: "massing", version: 1, status: "supported",
  description: "A connecting volume spanning the gap between two masses at a shared elevation.",
  parameters: [{ key: "massId", required: true }, { key: "secondaryMassId", required: true }, { key: "width" }, { key: "height" }],
  constraints: ["Requires both masses to be present in the document", "Approximates each mass's edge as a circle; does not miter to an exact wall face"],
  visualImpact: 7, implementationDifficulty: 5, performanceCost: 2, architecturalImportance: 7,
  fallback: "Leave the two masses unconnected; place them close enough to read as one composition.",
  implementationNotes: "Single procedural corridor volume between the two masses' nearest edges.",
};
