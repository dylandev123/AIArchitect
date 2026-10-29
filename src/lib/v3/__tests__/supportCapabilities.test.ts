import { describe, expect, it } from "vitest";
import { v3HostClassOf, v3SupportCapability, v3TypesWith } from "../capabilities";
import { classifyV3SupportBehavior, v3HasDeterministicSupportPolicy } from "../supportGraph";
import { v3ObjectNeedsSupport } from "../siteHierarchy";
import { v3FollowsTerrain } from "../elevation";
import type { V3SceneObject } from "../scene";

/** The type lists supportGraph/elevation/siteHierarchy hard-coded before reading the capability registry. */
const LEGACY = {
  inert: ["terrain-region", "light", "opening", "glass-panel"],
  walkable: ["slab", "surface", "path", "stair", "ramp"],
  structural: ["building-mass", "volume", "slab", "surface", "terrace", "courtyard", "roof", "roof-form", "canopy", "path", "wall", "beam", "column"],
  edgeHosted: ["railing", "fence"],
  verticalConnector: ["stair", "ramp"],
  deterministic: ["building-mass", "roof-form", "balcony", "canopy", "pool", "fountain", "water-surface", "landscape-zone", "planter"],
  auditExempt: ["terrain-region", "light", "opening", "glass-panel", "roof", "canopy", "wall", "column", "beam"],
  occupiable: ["slab", "surface", "path", "stair", "ramp", "pool"],
  walkingSurface: ["slab", "surface", "stair", "ramp", "roof"],
  groundPad: ["volume", "building-mass", "slab", "surface", "terrace", "courtyard", "pool", "water-surface"],
  padHost: ["volume", "building-mass", "slab", "surface", "terrace", "roof", "roof-form"],
  followsTerrain: ["path", "retaining-wall", "fence"],
  settleable: ["proxy-asset", "native-asset", "gate"],
  requiresHost: ["roof", "roof-form", "balcony", "water-surface"],
};
const object = (type: string): V3SceneObject => ({ id: "x", type, semanticRole: type, label: type, transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }, dimensions: [1, 1, 1], material: { id: "m", color: "#ffffff" } });
const TYPES = [...v3TypesWith(() => true), "deck", "custom-thing"];

describe("support behaviour comes from the capability registry", () => {
  it("matches the legacy type lists for every registered and unregistered type", () => {
    for (const type of TYPES) {
      const behavior = classifyV3SupportBehavior(object(type)), capability = v3SupportCapability(type);
      expect(behavior.requiresSupport, type).toBe(!LEGACY.inert.includes(type));
      expect(behavior.isWalkable, type).toBe(LEGACY.walkable.includes(type));
      expect(behavior.isStructuralSupport, type).toBe(LEGACY.structural.includes(type));
      expect(behavior.isEdgeHosted, type).toBe(LEGACY.edgeHosted.includes(type));
      expect(behavior.isVerticalConnector, type).toBe(LEGACY.verticalConnector.includes(type));
      expect(v3HasDeterministicSupportPolicy(object(type)), type).toBe(LEGACY.deterministic.includes(type));
      expect(v3ObjectNeedsSupport(object(type)), type).toBe(!LEGACY.auditExempt.includes(type));
      expect(v3FollowsTerrain(object(type)), type).toBe(LEGACY.followsTerrain.includes(type));
      for (const flag of ["occupiable", "walkingSurface", "groundPad", "padHost", "settleable", "requiresHost"] as const) expect(!!capability[flag], `${type} ${flag}`).toBe(LEGACY[flag].includes(type));
    }
  });

  it("keeps legacy surface kinds and host classes", () => {
    expect(Object.fromEntries(TYPES.flatMap((type) => v3SupportCapability(type).surfaceKind ? [[type, v3SupportCapability(type).surfaceKind]] : []))).toEqual({ "roof-form": "roof", roof: "roof", slab: "slab", surface: "terrace", path: "terrace", terrace: "terrace", courtyard: "terrace" });
    expect(Object.fromEntries(TYPES.flatMap((type) => v3HostClassOf(type) ? [[type, v3HostClassOf(type)]] : []))).toEqual({ "building-mass": "mass", volume: "mass", slab: "ground", surface: "ground", terrace: "ground", courtyard: "ground", deck: "ground", wall: "wall", pool: "pool" });
    expect(v3FollowsTerrain({ ...object("gate"), metadata: { followsTerrain: true } })).toBe(true);
  });
});
