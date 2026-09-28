import type { AssetRequest, ReportAsset } from "@/types/library";
import { COMPONENTS, componentDef, type ComponentDef } from "@/lib/outdoor/components";
import { spaceName, type OutdoorSpace, type OutdoorSpaceKind } from "@/lib/outdoor/spaces";
import { findAssets, type AssetIndexEntry } from "./retrieval";

/**
 * Asset matching for outdoor spaces. Retrieval elsewhere is by *family* ("is there an approved gazebo?"); a space wants specific
 * objects ("a dining table", "a sun lounger"), so a family hit is not enough: one approved chair must not satisfy a table. An
 * approved asset supplies a component when it is in the component's family, its name or tags say it is that object, and its
 * style is compatible with the project. Whatever no asset supplies becomes an Asset Need with its parent space attached.
 */

const wording = (a: AssetIndexEntry): string => `${a.name ?? ""} ${(a.tags ?? []).join(" ")}`.trim();

/** The approved asset that stands in for a component, or undefined. An entry with no name or tags (an older client) matches on family alone. */
export function matchComponent(library: readonly AssetIndexEntry[], def: ComponentDef, styles: readonly string[]): AssetIndexEntry | undefined {
  const named = library.filter((a) => {
    if (a.family !== def.category) return false;
    const text = wording(a);
    return text === "" || def.match.test(text);
  });
  const [best] = findAssets(named, { category: def.category, styleTags: [...styles], contextTags: [], dimensions: undefined }, 1);
  return best?.item;
}

export interface SpaceAssetResult {
  /** Approved assets that supply a component a space wants. */
  supplied: { space: OutdoorSpaceKind; component: string; asset: AssetIndexEntry }[];
  /** Components no approved asset supplies, as requests carrying their parent space. */
  requests: AssetRequest[];
  /** Per space: which components are supplied and which missing. */
  bySpace: Map<OutdoorSpaceKind, { supplied: string[]; missing: string[] }>;
}

/** Every component of every space the design contains (or the brief asked for), matched against the library. */
export function resolveSpaceAssets(spaces: readonly OutdoorSpace[], library: readonly AssetIndexEntry[], ctx: { styles: readonly string[]; projectId: string | null }): SpaceAssetResult {
  const supplied: SpaceAssetResult["supplied"] = [];
  const requests: AssetRequest[] = [];
  const bySpace: SpaceAssetResult["bySpace"] = new Map();
  for (const space of spaces) {
    if (!space.realized && !space.requested) continue;
    const mine = { supplied: [] as string[], missing: [] as string[] };
    for (const key of [...space.components.required, ...space.components.preferred]) {
      const def = componentDef(key);
      if (!def) continue;
      const asset = matchComponent(library, def, ctx.styles);
      if (asset) {
        supplied.push({ space: space.kind, component: key, asset });
        mine.supplied.push(key);
        continue;
      }
      mine.missing.push(key);
      requests.push({ text: def.name, category: def.category, styleTags: [...ctx.styles], contextTags: [...def.contexts], projectId: ctx.projectId, spaces: [spaceName(space.kind)], components: [key] });
    }
    bySpace.set(space.kind, mine);
  }
  return { supplied, requests, bySpace };
}

/** The report's asset rows: what the library supplied, and whether it reached the design. Only assets wired to a feature are applied. */
export function reportAssets(
  result: SpaceAssetResult,
  attached: readonly { index: number; assetId: string; request: AssetRequest }[],
  library: readonly AssetIndexEntry[],
  spaces: readonly OutdoorSpace[]
): ReportAsset[] {
  const rows: ReportAsset[] = [];
  const nameOf = (id: string) => library.find((a) => a.id === id)?.name ?? id;
  // Assets attached to a project feature (a gazebo, an outdoor bar): these are the ones actually drawn in the design.
  const home: Record<string, OutdoorSpaceKind[]> = {
    gazebo: ["outdoor-dining", "quiet-retreat", "fire-pit-lounge", "main-outdoor-living"],
    "outdoor-bar": ["pool-bar", "outdoor-kitchen", "pool-lounge"],
  };
  for (const a of attached) {
    const category = a.request.category;
    const kinds = home[category] ?? [];
    const space = spaces.find((s) => kinds.includes(s.kind) && s.realized) ?? spaces.find((s) => kinds.includes(s.kind));
    rows.push({ id: a.assetId, name: nameOf(a.assetId), family: category, component: category, space: space ? spaceName(space.kind) : "site", feature: `building ${a.index + 1}`, applied: true, note: `Attached to building ${a.index + 1}; the library model draws in place of the procedural ${category}.` });
  }
  for (const s of result.supplied) {
    const def = COMPONENTS[s.component];
    rows.push({
      id: s.asset.id,
      name: s.asset.name ?? s.asset.id,
      family: s.asset.family ?? def?.category ?? "",
      component: s.component,
      space: spaceName(s.space),
      applied: false,
      note: `Retrieved for ${def?.name ?? s.component}; the generator has no placement slot for ${s.asset.family ?? "these"} assets yet, so the procedural scenery draws.`,
    });
  }
  return rows;
}
