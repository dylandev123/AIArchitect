import type { CapabilityMetadata } from "../../types";

export const metadata: CapabilityMetadata = {
  id: "pilotis", name: "Pilotis", category: "structure", version: 1, status: "supported",
  description: "Exposed structural columns lifting an already-elevated mass clear of grade.",
  parameters: [{ key: "massId", required: true }, { key: "columnSize" }, { key: "inset" }, { key: "groundY" }],
  constraints: ["Requires the target mass to already have a real gap above grade (e.g. via stepped-above) — this plugin adds columns, it does not itself elevate a mass", "Ignores the target mass's own rotation"],
  visualImpact: 7, implementationDifficulty: 3, performanceCost: 1, architecturalImportance: 6,
  fallback: "Leave the elevated volume reading as an unsupported cantilever.",
  implementationNotes: "Corner columns from grade to the mass's underside, plus mid-span columns on the long axis when a span exceeds 8m; columns that would stand inside a lower mass are skipped, so a volume resting partly on another is only propped where it cantilevers.",
};
