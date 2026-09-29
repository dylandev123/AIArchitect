import type { CapabilityMetadata } from "../../types";

export const metadata: CapabilityMetadata = {
  id: "courtyard-edge-wall", name: "Courtyard Edge Wall", category: "voids", version: 1, status: "supported",
  description: "A low garden wall along one edge of a mass that borders a courtyard, without cutting the shell.",
  parameters: [{ key: "massId", required: true }, { key: "side", required: true }, { key: "height" }, { key: "thickness" }],
  constraints: ["Does not boolean-cut the shell", "Intentionally narrower than a true courtyard-cut, which remains unsupported"],
  visualImpact: 5, implementationDifficulty: 2, performanceCost: 1, architecturalImportance: 4,
  fallback: "Leave the courtyard edge open; rely on the surrounding masses to read the enclosure.",
  implementationNotes: "Single low wall box offset just outside the mass's declared edge.",
};
