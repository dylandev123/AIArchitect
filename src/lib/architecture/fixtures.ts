import type { ArchitecturalDesignDocument } from "./document";
const pending = { status: "pending" as const };
const base = (brief: string): Omit<ArchitecturalDesignDocument, "massing" | "roofs"> => ({ version: 1, brief, siteStrategy: { environment: "beach", viewDirection: "south", arrivalDirection: "north", terrain: "level" }, facade: pending, architecturalStyle: pending, outdoorPlan: pending, materialStrategy: pending, components: pending, furnishings: pending, metadata: { createdAt: "2026-01-01T00:00:00.000Z", source: "fixture", compiler: "procedural-architecture-v1" } });
export const ARCHITECTURE_FIXTURES: Record<string, ArchitecturalDesignDocument> = {
  modernTropicalCourtyardVilla: { ...base("Modern Tropical Courtyard Villa"), massing: { composition: "u-shaped", masses: [
    { id: "living", name: "Main Living Pavilion", role: "main-living", position: { x: 0, z: 4 }, width: 16, depth: 5, floors: 1, elevation: 0, rotation: 0 },
    { id: "west", name: "West Bedroom Wing", role: "bedroom-wing", position: { x: -5.5, z: -2 }, width: 5, depth: 12, floors: 1, elevation: 0, rotation: 0, relationships: [{ kind: "surrounds-courtyard", target: "living" }] },
    { id: "east", name: "East Guest Wing", role: "guest-pavilion", position: { x: 5.5, z: -2 }, width: 5, depth: 12, floors: 1, elevation: 0, rotation: 0 },
  ] }, roofs: { recipes: [{ id: "living-roof", massId: "living", kind: "floating-flat" }, { id: "west-roof", massId: "west", kind: "mono-pitch" }, { id: "east-roof", massId: "east", kind: "flat" }] } },
  caribbeanPavilionEstate: { ...base("Caribbean Pavilion Estate"), massing: { composition: "pavilion-cluster", masses: [
    { id: "living", name: "Main Living Pavilion", role: "main-living", position: { x: 0, z: 0 }, width: 12, depth: 9, floors: 1, elevation: 0, rotation: 0 },
    { id: "guest", name: "Guest Pavilion", role: "guest-pavilion", position: { x: 15, z: -3 }, width: 7, depth: 7, floors: 1, elevation: 0, rotation: .18, relationships: [{ kind: "separated-from", target: "living", distance: 3 }] },
    { id: "bridge", name: "Covered Connector", role: "connector", position: { x: 7.5, z: -1.5 }, width: 6, depth: 2.5, floors: 1, elevation: 0, rotation: -.18, relationships: [{ kind: "bridge-between", target: "living" }] },
    { id: "garage", name: "Garage", role: "garage", position: { x: -13, z: 2 }, width: 7, depth: 6, floors: 1, elevation: 0, rotation: 0 },
  ] }, roofs: { recipes: [{ id: "living", massId: "living", kind: "pavilion" }, { id: "guest", massId: "guest", kind: "hip" }, { id: "bridge", massId: "bridge", kind: "gable" }, { id: "garage", massId: "garage", kind: "flat" }] } },
  contemporaryHillsideHouse: { ...base("Contemporary Hillside House"), siteStrategy: { environment: "hillside", viewDirection: "south", arrivalDirection: "north", terrain: "stepped" }, massing: { composition: "stepped-terraces", masses: [
    { id: "living", name: "Lower Living Volume", role: "main-living", position: { x: 0, z: 2 }, width: 14, depth: 7, floors: 1, elevation: 0, rotation: 0 },
    { id: "upper", name: "Upper Bedroom Wing", role: "bedroom-wing", position: { x: 5, z: -5 }, width: 10, depth: 5, floors: 1, elevation: 2.2, rotation: .35, relationships: [{ kind: "stepped-above", target: "living", distance: 2.2 }, { kind: "offset-from", target: "living" }] },
    { id: "studio", name: "Detached Studio", role: "guest-pavilion", position: { x: -11, z: -5 }, width: 6, depth: 5, floors: 1, elevation: 1.1, rotation: -.2 },
  ] }, roofs: { recipes: [{ id: "living", massId: "living", kind: "flat" }, { id: "upper", massId: "upper", kind: "shed" }, { id: "studio", massId: "studio", kind: "flat" }] } },
  /** Deterministic, non-AI visual proof that the live compile/render path is active: distinct masses, varied roofs, a courtyard, and a real capability outcome. */
  modernTropicalPavilionHouse: { ...base("Modern Tropical Pavilion House"), massing: { composition: "pavilion-cluster", masses: [
    { id: "living", name: "Main Living Pavilion", role: "main-living", position: { x: 0, z: 4 }, width: 15, depth: 8, floors: 1, elevation: 0, rotation: 0 },
    { id: "bedroom", name: "Bedroom Wing", role: "bedroom-wing", position: { x: -11, z: -4 }, width: 9, depth: 6, floors: 1, elevation: 0, rotation: .3, relationships: [{ kind: "offset-from", target: "living" }] },
    { id: "guest", name: "Detached Guest Pavilion", role: "guest-pavilion", position: { x: 11, z: -3 }, width: 7, depth: 7, floors: 1, elevation: 0, rotation: -.18, relationships: [{ kind: "separated-from", target: "living", distance: 4 }, { kind: "surrounds-courtyard", target: "living" }] },
    { id: "garage", name: "Garage", role: "garage", position: { x: -9, z: 7 }, width: 6, depth: 6, floors: 1, elevation: 0, rotation: 0 },
  ] }, roofs: { recipes: [
    { id: "living-roof", massId: "living", kind: "floating-flat", overhang: 1.3, expression: { verticalGap: .6, supportStyle: "clerestory", clerestoryHeight: .45 } },
    { id: "bedroom-roof", massId: "bedroom", kind: "mono-pitch", overhang: .5 },
    { id: "guest-roof", massId: "guest", kind: "pavilion" },
    { id: "garage-roof", massId: "garage", kind: "flat", overhang: .4 },
  ] }, capabilities: [{ id: "corner-glazing", stage: "fixture", parameters: { massId: "living" } }] },
};
