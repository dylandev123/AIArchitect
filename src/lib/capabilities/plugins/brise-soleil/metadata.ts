import type { CapabilityMetadata } from "../../types";

export const metadata: CapabilityMetadata = {
  id: "brise-soleil", name: "Brise Soleil", category: "facade", version: 1, status: "supported",
  description: "Evenly spaced vertical sun-shading fins standing proud of one facade.",
  parameters: [{ key: "massId", required: true }, { key: "facade", required: true }, { key: "count" }, { key: "depth" }, { key: "height" }, { key: "thickness" }, { key: "sill" }],
  constraints: ["Ignores the target mass's own rotation, same approximation as Entry Canopy", "Purely additive geometry — does not interact with the mass's footprint or walls"],
  visualImpact: 7, implementationDifficulty: 2, performanceCost: 2, architecturalImportance: 6,
  fallback: "Leave the facade as plain glazing/wall without shading fins.",
  implementationNotes: "Evenly spaced fin blades across the facade's span, offset outward by `depth`; count defaults from the facade's own length when omitted.",
};
