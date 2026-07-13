import type {
  ColumnStyleKey,
  DoorStyleKey,
  MaterialType,
  RailingStyleKey,
  RoofType,
  SurfaceKey,
  WallFinishKey,
  WindowStyleKey,
} from "./house";

/** A single exterior configuration preset proposed or approved by the AI. */
export interface LearnedStylePreset {
  id: string;
  styleKey: string;
  label: string;
  description: string;
  tags: string[];
  exteriorOptions: {
    wallFinish:   WallFinishKey;
    windowStyle:  WindowStyleKey;
    doorStyle:    DoorStyleKey;
    railingStyle: RailingStyleKey;
    columnStyle:  ColumnStyleKey;
    patioSurface: SurfaceKey;
    poolTile:     SurfaceKey;
  };
  suggestedMaterials: {
    exterior: { material: MaterialType; color: string };
    roof:     { material: MaterialType; color: string };
    trim:     { material: MaterialType; color: string };
    decking:  { material: MaterialType; color: string };
  };
  compatibleRoofs: RoofType[];
}

export type ProposalStatus = "pending" | "approved" | "rejected";

/** A complete AI proposal: one or more style presets with reasoning. */
export interface LearnProposal {
  id: string;
  prompt: string;
  reasoning: string;
  status: ProposalStatus;
  createdAt: string;
  reviewedAt?: string;
  presets: LearnedStylePreset[];
  validationErrors: string[];
}

/** The live published knowledge base — approved presets ready for use. */
export interface KnowledgeBase {
  version: number;
  publishedAt: string;
  presets: LearnedStylePreset[];
}

/** Snapshot used for rollback history. */
export interface KnowledgeBaseVersion extends KnowledgeBase {
  reason: string;
}
