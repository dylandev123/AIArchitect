import { assembleGeneratedProject } from "@/lib/ai/generation";
import type { AiGenerationResponse } from "@/lib/ai/siteSchema";
import type { CompassSide } from "@/types/house";

/** The low-cost validation prompt: what the admin runs to see the whole loop. */
export const VILLA_BRIEF =
  "Design a modern Caribbean tropical luxury villa focused on outdoor living. Include a private pool area, covered outdoor dining, outdoor kitchen, pool lounge, fire pit lounge, tropical gardens and a detached garage. Keep interiors simple.";

interface ModelOptions {
  view?: CompassSide;
  approach?: CompassSide;
  environment?: string;
  /** Extra ops the "model" authored (a pool on the wrong wall, say). */
  ops?: unknown[];
  house?: { width: number; depth: number; floors: number; roof: string };
}

/** What the model would return for the villa brief — the smallest well-formed output; every rule then does its work. */
export function modelOutput({ view = "south", approach = "north", environment = "beach", ops = [], house = { width: 22, depth: 14, floors: 2, roof: "flat" } }: ModelOptions = {}): AiGenerationResponse {
  return {
    summary: "A villa.",
    house,
    site: { environment, viewDirection: view, terrainSlope: "flat", approachSide: approach },
    operations: [{ op: "addDoor", value: { wall: approach, level: 0, offset: 5, width: 1.1, height: 2.1 } }, ...ops],
  } as unknown as AiGenerationResponse;
}

/** Assembles the project exactly as the route does (same validation, repair, site plan and collision passes), with no model call. */
export function assembleVilla(options: ModelOptions = {}, brief = VILLA_BRIEF) {
  const result = assembleGeneratedProject(modelOutput(options), [], brief, true);
  if (!result.ok) throw new Error(`fixture failed to assemble: ${result.errors.join("; ")}`);
  return result;
}
