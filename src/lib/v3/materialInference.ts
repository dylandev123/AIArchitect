import type { V3Material, V3Scene, V3SceneObject } from "./scene";

type V3Surface = NonNullable<V3Material["surface"]>;

/** Types whose own material is genuinely glazing. A "bronze-glass" building mass is a mass, not a pane. */
const GLAZING_TYPES = new Set(["glass-wall", "window-band", "railing-run", "curtain-wall", "glazing"]);

/**
 * Semantic material-id vocabulary → an existing PBR family. Ordered: the first matching family wins, so a
 * "travertine-paver" reads as paving and a "pool-stone" as stone. Only the material id is read; object labels
 * describe the object ("Floating Limestone Roof Plane" in charcoal) and must not override its authored finish.
 */
const VOCABULARY: ReadonlyArray<[V3Surface, RegExp]> = [
  ["water", /\b(pool-?water|water)\b/],
  ["grass", /\b(grass|lawn|turf|planting|garden|meadow|hedge|groundcover)\b/],
  ["paving", /\b(pavers?|paving|pavement|cobbles?|flagstones?|setts|asphalt|tarmac)\b/],
  ["stone", /\b(travertine|limestone|sandstone|marble|granite|basalt|stone|slate|quartzite|terrazzo|coral-stone)\b/],
  ["wood", /\b(teak|timber|wood|wooden|cedar|oak|ipe|walnut|larch|bamboo|cypress|accoya)\b/],
  ["concrete", /\b(concrete|cement|board-formed|in-situ|insitu|precast)\b/],
  ["stucco", /\b(render|rendered|stucco|plaster|lime-?wash|limewash)\b/],
  ["metal", /\b(bronze|metal|steel|alumin(?:i)?um|zinc|copper|corten|brass|iron|titanium)\b/],
];

/** Tokenised so `ivory-render`, `warm_stone` and `DarkTeak` all match on whole words. */
function words(id: string): string {
  return id.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().replace(/[_\s]+/g, "-").replace(/-/g, " ");
}

/**
 * The finish an object's material renders in. An authored `surface` always wins. Otherwise the semantic material
 * id is mapped onto an existing PBR family; glass is only inferred for objects that are themselves glazing.
 * Unknown vocabulary stays undefined (plain authored colour) rather than guessing an unrelated texture.
 */
export function inferV3MaterialSurface(material: V3Material, objectType?: string): V3Material["surface"] {
  if (material.surface) return material.surface;
  const text = words(material.id ?? "");
  if (/\b(glass|glazing|glazed)\b/.test(text)) {
    if (objectType && GLAZING_TYPES.has(objectType)) return "glass";
    // A glass-named non-glazing object (a glazed link mass) keeps any frame vocabulary but never becomes a pane.
  }
  for (const [surface, pattern] of VOCABULARY) if (pattern.test(text)) return surface;
  return undefined;
}

const withSurface = (material: V3Material, objectType?: string): V3Material => {
  if (material.surface) return material;
  const surface = inferV3MaterialSurface(material, objectType);
  return surface ? { ...material, surface } : material;
};

/**
 * Effective (never persisted) scene whose materials carry an explicit render surface. Colours, ids and every
 * explicit surface are kept as authored; only absent surfaces are filled in.
 */
export function withInferredV3Surfaces(scene: V3Scene): V3Scene {
  let changed = false;
  const objects = scene.objects.map((object): V3SceneObject => {
    const material = withSurface(object.material, object.type);
    if (material === object.material) return object;
    changed = true;
    return { ...object, material };
  });
  const groundMaterial = scene.site.groundMaterial && withSurface(scene.site.groundMaterial);
  if (groundMaterial !== scene.site.groundMaterial) changed = true;
  return changed ? { ...scene, site: { ...scene.site, groundMaterial }, objects } : scene;
}
