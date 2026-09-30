import type { CapabilityMetadata } from "../../types";

export const metadata: CapabilityMetadata = {
  id: "screen-layer", name: "Screen Layer", category: "facade", version: 1, status: "supported",
  description: "A continuous batten screen standing proud of one facade — privacy, shade and a fine facade rhythm over the glazing behind it.",
  parameters: [{ key: "massId", required: true }, { key: "facade", required: true }, { key: "start" }, { key: "end" }, { key: "depth" }, { key: "height" }, { key: "sill" }, { key: "spacing" }, { key: "battenWidth" }],
  constraints: ["`facade` is a world side, resolved against the mass's own rotation", "Additive geometry: does not cut or replace the wall/glazing behind it"],
  visualImpact: 8, implementationDifficulty: 3, performanceCost: 3, architecturalImportance: 7,
  fallback: "Leave the facade as plain glazing/wall without a screen.",
  implementationNotes: "Vertical battens between a head and a foot rail, offset `depth` in front of the facade and turned with the mass; the batten count is capped for render cost.",
};
