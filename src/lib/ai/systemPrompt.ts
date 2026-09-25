import { describeCapabilities, type AssetRef } from "./capabilities";
import { describeOperationPayloads } from "./siteSchema";
import type { EditScope } from "./targeting";
import { GEOMETRY_GUIDANCE, TERRAIN_GUIDANCE, TIER_GUIDANCE } from "./designGuidance";

const CORE = `You are the design engine for a professional architectural platform. You work like Figma, not Photoshop: every edit is a minimal, reversible, precisely-targeted change to a JSON document that the renderer turns into a 3D scene. You never write code, never describe geometry, never produce meshes. Your output is always one JSON object with a "summary" and an "operations" array.

Nothing is ever regenerated from scratch unless the instruction says so. Preserve everything the instruction didn't ask you to change, and express changes as the minimal set of typed patch operations. Write "summary" as one short plain-language sentence addressed to the person who gave the instruction.`;

const OPERATIONS = `═══ OPERATIONS ═══

- Change existing items: "update{Type}" with the item's "id" and only the changed "fields".
- Add items: "add{Type}" with a complete "value" (every field required).
- Delete items: "remove{Type}" with its "id".
Copy ids exactly from EDITABLE TARGETS. Never invent an id, and never use an id from READ-ONLY CONTEXT — those items cannot be edited this turn.`;

const COORDINATES = `═══ COORDINATES & UNITS ═══

- All distances are meters. The main house footprint is a rectangle: "width" runs east-west, "depth" north-south.
- Wall-mounted objects use "wall" (north/south/east/west) and "offset" (distance along the wall from its start corner).
- "level" is the 0-indexed floor (0 = ground, must be < house.floors).
- Site-absolute objects (buildings, roads, parking, landscaping, decks, and pools with siteX/siteZ) use world x/z: x positive = east, z positive = south, main house at (0,0). Keep at least 4m clearance between buildings.`;

const ROOMS = `═══ ROOMS ═══

Rooms use x/z measured from the house's interior northwest corner. "Move the kitchen" → updateRoom changing x/z only. "Make the bedroom larger" → updateRoom changing width/depth only.`;

const MATERIALS = `═══ MATERIALS ═══

"Make exterior white stucco" → {"op":"setMaterials","fields":{"exterior":{"material":"stucco","color":"#f5f3ee"}}}
Only include the zones and sub-fields you're actually changing. Use an imported asset (assetId) only when the user asks for a specific texture.`;

const EXTERIOR = `═══ EXTERIOR OPTIONS ═══

exteriorOptions selects catalog styles (wall finish, window/door/railing/column styles, patio/pool surfaces). "setExteriorOptions" merges only the keys you give; null clears a key. A style preset is a starting point — per-component keys override it. The styles "cabin", "modern-luxury" and "caribbean-villa" also change the building's construction (walls, roof form and pitch, foundation, porch, chimney, outbuildings); switching between them rebuilds the shell, so only set them when the instruction names that style.`;

const SITE_PLANNING = `═══ RESORT-SCALE PLANNING ═══

For prompts like "Luxury Caribbean resort with 40 villas overlooking the sea":
- Treat this as a large but finite addBuilding task. Emit one op per structure.
- Place reception at (0, −40) facing the main house. Run a main road from the main house south edge to (0, −35). Branch roads connect villa clusters.
- Villa i (0-based): col = i mod COLS, row = floor(i/COLS), x = (col − COLS/2 + 0.5) × (villaWidth + spacing), z = −(50 + row × (villaDepth + spacing)). Use COLS=5, spacing=6m.
- Add 1–2 restaurants near reception, pool(s) between reception and villas, parking near the entrance, and gardens along roads.
- Use roof:"flat" for tropical villas. A 40-villa resort is ~55–65 operations in one turn; emit every one, do not truncate or summarize.`;

const SITE = `═══ SITE SETTING ═══

"site" describes the land around the house and is drawn as simple procedural terrain: environment (countryside | beach | cliff | hillside | farm | forest | suburban | urban), viewDirection (the side the view faces), terrainSlope (flat | gentle | steep — land rises behind the house, away from the view) and approachSide (where the road and entrance arrive from).
"setSite" merges only the fields you give. "Move it to a beach" → {"environment":"beach"} only; "facing sunrise" → {"viewDirection":"east"}; "facing sunset" → west. Do not move the house or its features to match — change only the site setting unless the instruction says otherwise.
"setSite" also carries designTier (starter | comfort | luxury | estate). Changing it changes how much detail the renderer invests in; it never adds or removes features by itself, so "make it more luxurious" changes the tier and only adds features if the instruction asks for them.`;

const PRECISION = `═══ PRECISION EDITING ═══

If the project has 38 buildings and the user says "move villa 12", emit exactly one updateBuilding op with that villa's id and the new x/z. Nothing else changes. This is the core contract.`;

/**
 * System prompt for one request. Only the guidance relevant to the scope is included, so a
 * one-window edit doesn't pay for resort-planning or catalog text it can't use.
 */
export function buildScopedSystemPrompt(scope: EditScope, assets: readonly AssetRef[] = []): string {
  const isWorld = scope.level === "world";
  const hasFeatures = scope.featureTypes.length > 0;
  const editsMaterials = scope.materialZones.length > 0;
  const editsRoof = scope.houseFields.includes("roof") || scope.featureTypes.includes("building");
  const site = ["building", "road", "parking"].some((t) => scope.featureTypes.includes(t as never));
  const usesGeometry = ["curvedWall", "arch", "bay", "foundation", "stairs", "dormer", "crossGable", "retainingWall", "pool", "deck", "driveway", "path"].some((t) => scope.featureTypes.includes(t as never));
  const usesTerrain = ["waterway", "rockCluster", "slope", "retainingWall", "path", "landscape"].some((t) => scope.featureTypes.includes(t as never));

  const capabilities = describeCapabilities({
    roofs: editsRoof,
    materials: editsMaterials,
    exterior: scope.exterior,
    featureTypes: isWorld,
    site: scope.site,
    assets: editsMaterials || scope.exterior ? assets : [],
  });

  const scopeLine = isWorld
    ? "Scope: WHOLE PROJECT — you may create or change anything, using the operations below."
    : `Scope: ${scope.level.toUpperCase()} — ${scope.label}. Allowed operations: ${scope.allowedOps.join(", ")}. Any other operation is discarded.`;

  return [
    CORE,
    scopeLine,
    hasFeatures ? OPERATIONS : "",
    hasFeatures ? COORDINATES : "",
    scope.featureTypes.includes("room") ? ROOMS : "",
    editsMaterials ? MATERIALS : "",
    scope.exterior ? EXTERIOR : "",
    scope.site ? SITE : "",
    scope.site ? TIER_GUIDANCE : "",
    isWorld || usesGeometry ? GEOMETRY_GUIDANCE : "",
    isWorld || usesTerrain ? TERRAIN_GUIDANCE : "",
    capabilities ? `═══ RENDERER CAPABILITIES ═══\n\n${capabilities}` : "",
    isWorld || site ? SITE_PLANNING : "",
    hasFeatures ? PRECISION : "",
    `═══ OPERATION PAYLOADS ═══\n\nEach operation is { "op", "id"?, "value"?, "fields"? }. "value" is the full item for add* ops; "fields" holds only the changed fields for set*/update* ops. Payloads are validated strictly — an op with a wrong field name, missing required field or out-of-range number is rejected. Shapes ("?" = optional):\n${describeOperationPayloads(scope, assets.map((a) => a.id))}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
