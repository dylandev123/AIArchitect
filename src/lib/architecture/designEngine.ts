import type { AssetRequest } from "@/types/library";
import type { CompassSide, ProjectScale, RoofType, SiteEnvironment } from "@/types/house";

/** Structured design intent retained with a project. It is deliberately mesh-free: renderer recipes own geometry. */
export interface ArchitecturalDesign {
  version: 1;
  pipeline: readonly ["brief", "concept", "site-analysis", "massing", "space-relationships", "roof-composition", "facade-language", "components", "outdoor-spaces", "landscape", "retrieve-library", "generate-recipes", "generate-assets", "assemble", "learn"];
  concept: {
    name: string; philosophy: string; buildingHierarchy: string[]; visualRhythm: string;
    roofStrategy: string; materialPalette: string[]; circulation: string; zoning: string;
    indoorOutdoor: string; viewStrategy: string; arrivalSequence: string;
  };
  siteAnalysis: { environment: SiteEnvironment; viewDirection: CompassSide; approachSide: CompassSide; terrainResponse: string };
  masses: { id: string; role: "main-living" | "private-wing" | "guest-wing" | "service" | "pavilion"; relationship: string; roof: RoofType }[];
  spaceRelationships: { from: string; to: string; relationship: "direct" | "buffered" | "framed" | "separate" }[];
  roofComposition: { family: string; primary: RoofType; secondary: RoofType; pitch: number; overhang: number; details: string[] };
  facadeLanguage: { base: string; openings: string; shading: string; rhythm: string };
  components: { name: string; required: boolean; dimensions?: { width?: number; height?: number; depth?: number } }[];
  outdoorStrategy: string[];
  landscapeStrategy: string[];
}

const has = (text: string, pattern: RegExp) => pattern.test(text);
const side = (text: string, fallback: CompassSide): CompassSide => has(text, /sunrise|east/i) ? "east" : has(text, /sunset|west/i) ? "west" : fallback;

export function designArchitecture(brief: string, input: { environment: SiteEnvironment; viewDirection: CompassSide; approachSide: CompassSide; scale?: ProjectScale }): ArchitecturalDesign {
  const b = brief.toLowerCase();
  const tropical = has(b, /tropical|caribbean|island|beach|balinese|resort/);
  const courtyard = has(b, /courtyard|compound|privacy/);
  const hillside = input.environment === "hillside" || input.environment === "cliff" || has(b, /hillside|cliff|slope/);
  const balinese = has(b, /balinese/);
  const caribbean = has(b, /caribbean/);
  const name = balinese ? "Balinese Resort" : courtyard ? "Luxury Courtyard Residence" : hillside ? "Contemporary Hillside Residence" : caribbean ? "Minimal Caribbean Villa" : tropical ? "Modern Tropical Estate" : has(b, /waterfront|lake|ocean/) ? "Waterfront Retreat" : "Contemporary Pavilion Residence";
  const primary: RoofType = balinese || caribbean ? "hip" : hillside ? "shed" : courtyard ? "flat" : tropical ? "butterfly" : "flat";
  const secondary: RoofType = primary === "flat" ? "shed" : "flat";
  const palette = balinese ? ["natural teak", "basalt", "warm limestone", "standing seam metal"] : caribbean ? ["white coral render", "natural teak", "black aluminum", "slate"] : tropical ? ["board formed concrete", "travertine", "natural teak", "black aluminum"] : ["charcoal stucco", "limestone", "black aluminum", "corten steel"];
  const components = [
    { name: "6m Sliding Glass Door", required: true, dimensions: { width: 6, height: 2.8 } },
    { name: "Timber Louver Screen", required: tropical || courtyard, dimensions: { width: 2.4, height: 3 } },
    { name: "Corner Glass Window", required: hillside || tropical, dimensions: { width: 3, height: 2.8 } },
    { name: "Modern Tropical Fascia", required: tropical, dimensions: { depth: 0.35 } },
    { name: "Pergola Beam System", required: tropical || courtyard, dimensions: { width: 4, depth: 3, height: 2.8 } },
  ].filter((c) => c.required || c.name === "6m Sliding Glass Door");
  return {
    version: 1,
    pipeline: ["brief", "concept", "site-analysis", "massing", "space-relationships", "roof-composition", "facade-language", "components", "outdoor-spaces", "landscape", "retrieve-library", "generate-recipes", "generate-assets", "assemble", "learn"],
    concept: { name, philosophy: "Climate-aware composition of distinct volumes instead of a decorated box.", buildingHierarchy: ["Main living pavilion", "Private wing", "Outdoor living pavilion"], visualRhythm: "Alternating solid, glazing and shaded screen bays.", roofStrategy: primary === "flat" ? "Layered floating plates with a secondary shed pavilion." : "Primary pitched pavilion roof with lower connecting roofs.", materialPalette: palette, circulation: "Arrival compresses, then releases toward the view through the living pavilion.", zoning: "Public living faces the view; private rooms occupy a quieter wing.", indoorOutdoor: "Deep thresholds, shaded terraces and operable glazing make exterior rooms part of daily life.", viewStrategy: "Frame the primary view from living and terrace spaces; screen service and arrival edges.", arrivalSequence: "Landscape threshold → sheltered entry → framed view reveal." },
    siteAnalysis: { environment: input.environment, viewDirection: side(brief, input.viewDirection), approachSide: input.approachSide, terrainResponse: hillside ? "Step masses with the land and terrace the view side." : "Keep the arrival edge composed and reserve the view side for outdoor living." },
    masses: [
      { id: "living-pavilion", role: "main-living", relationship: "Anchor volume facing the view", roof: primary },
      { id: "private-wing", role: "private-wing", relationship: courtyard ? "Frames a protected courtyard" : "Offsets from living pavilion to create a shaded terrace", roof: secondary },
      { id: "outdoor-pavilion", role: "pavilion", relationship: "Extends living toward pool and view", roof: "flat" },
    ],
    spaceRelationships: [{ from: "living-pavilion", to: "private-wing", relationship: "buffered" }, { from: "living-pavilion", to: "outdoor-pavilion", relationship: "direct" }, { from: "arrival", to: "living-pavilion", relationship: "framed" }],
    roofComposition: { family: primary === "hip" ? "Modern Caribbean / resort hip" : primary === "butterfly" ? "Modern tropical butterfly" : primary === "shed" ? "Hillside shed composition" : "Layered flat roof composition", primary, secondary, pitch: primary === "flat" ? 2 : primary === "hip" ? 28 : 14, overhang: tropical ? 1.4 : 0.75, details: ["continuous fascia", "deep soffits", "integrated gutters", "ridge caps where pitched"] },
    facadeLanguage: { base: palette[0], openings: "Large view-side sliding panels and protected corner glazing.", shading: tropical ? "Timber louvers and deep eaves." : "Recessed openings and slender overhangs.", rhythm: "A deliberate cadence of opaque piers, glazing and screens." },
    components, outdoorStrategy: ["Outdoor living aligns with view-side living pavilion", "Pool and terrace remain private from arrival"], landscapeStrategy: ["Plant a layered arrival threshold", "Frame rather than block primary views"],
  };
}

/** Components are library candidates, never fallback roof meshes. */
export function architecturalAssetRequests(design: ArchitecturalDesign, projectId: string | null): AssetRequest[] {
  return design.components.map((component) => ({ text: component.name, category: "architectural-component", styleTags: design.concept.name.toLowerCase().split(/\s+/).filter((x) => ["modern", "tropical", "caribbean", "balinese", "contemporary"].includes(x)), contextTags: ["facade"], dimensions: component.dimensions, projectId }));
}
