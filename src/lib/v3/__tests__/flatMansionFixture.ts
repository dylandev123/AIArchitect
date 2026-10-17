export const material = { id: "stone", color: "#b0a090", surface: "stone" };
export const object = (id: string, type: string, x: number, z: number, baseElevation: number, width: number, depth: number, height: number, extra = {}) => ({ id, type, semanticRole: type, label: id, geometryKind: "box", architecture: { x, z, baseElevation, width, depth, height }, material, ...extra });
export const flatMansion = () => ({
  version: 3, site: { width: 160, depth: 160 }, relationships: [], objects: [
    object("main-house", "building-mass", 0, 0, 0, 20, 16, 9, { levels: 3, roofForm: "hip", pitch: 20, facadePreset: "punched" }),
    object("upper-wing", "building-mass", 0, 0, 9, 12, 10, 3, { hostId: "main-house", levels: 1 }),
    object("balcony", "balcony", 0, 9, 6, 10, 2, .3, { hostId: "main-house" }),
    object("roof-terrace", "terrace", 6, 0, 9, 6, 8, .2, { hostId: "main-house" }),
    object("garden-pool", "pool", 30, 0, -1.4, 10, 6, 1.5),
    object("pool-deck", "terrace", 30, 0, 0, 16, 12, .15),
    object("garden", "landscape-zone", -30, 0, 0, 14, 12, .1),
    object("driveway", "driveway", 0, 32, 0, 6, 25, .1),
  ],
});

