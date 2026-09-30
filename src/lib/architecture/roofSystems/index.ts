export * from "./types";
export { getRoofSystem, listRoofSystems, registerRoofSystem } from "./registry";
export { DEFAULT_ROOF_PITCH_DEG, planRoofSystems, resolveRoofFinish, roofShapeOf, roofSystemForMaterial, type RoofSystemAssignment, type RoofSystemPlan } from "./resolve";
export { STANDING_SEAM_PAN, TILE_MIN_PITCH, tileModuleFor } from "./systems";
export { buildSeamRibs, buildSurfaceMesh, courseLayout, makePlane, planeExtents, planePoint, seamLayout, slopeSpansAt } from "./planes";
