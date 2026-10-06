import { generateHouseFromJson, type HouseGenerationResult } from "./generateHouse";
import { isV3ProjectRoot } from "@/lib/v3/scene";
import { validateV3Scene } from "@/lib/v3/validation";

/**
 * Validator for the project JSON editor, selected by the document's root. A V3 root (`generationMode: "v3-scene"`)
 * is a scene, not a legacy house, so it is checked by the V3 validator and never asked for a `house` object.
 * Every other root goes through the unchanged legacy path.
 */
export function validateProjectJson(text: string): HouseGenerationResult {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return generateHouseFromJson(text); }
  if (!isV3ProjectRoot(raw)) return generateHouseFromJson(text);
  // Lenient, as at generation: only structural defects are errors; physical imperfections are warnings.
  const { errors, warnings } = validateV3Scene(raw.v3Scene, { lenient: true });
  return { model: null, config: null, site: null, errors, warnings };
}
