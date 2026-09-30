import { describe, expect, it } from "vitest";
import { routePathAroundMasses } from "../sitePathRouting";
import { insideMass, type MassFootprint } from "../massFootprint";
import { pathCurve } from "@/lib/house/features/paths";
import { buildDeck } from "@/lib/house/features/decks";
import { convexHull, pointInPolygon, roundedRectOutline, translateOutline, type P2 } from "@/lib/house/geometry/mesh";
import { DEFAULT_MATERIALS_CONFIG, type PathConfig } from "@/types/house";

const path = (x1: number, z1: number, x2: number, z2: number, bend = 0): PathConfig => ({ x1, z1, x2, z2, width: 1.4, bend, surface: "gravel" });
const crosses = (segments: PathConfig[], m: MassFootprint) => segments.some((s) => pathCurve(s).some(([x, z]) => insideMass(m, x, z, -0.05)));
const chained = (segments: PathConfig[]) => segments.slice(1).every((s, i) => s.x1 === segments[i].x2 && s.z1 === segments[i].z2);

describe("routePathAroundMasses", () => {
  const house: MassFootprint = { id: "h", cx: 0, cz: 0, width: 20, depth: 10, rotation: 0 };

  it("leaves a path that never enters a mass exactly as authored", () => {
    const clear = path(-5, -8, 5, -12, 3);
    expect(routePathAroundMasses(clear, [house])).toEqual([clear]);
    // A path that starts at a door on the wall and heads away is not "inside".
    expect(routePathAroundMasses(path(0, -5, 0, -15), [house])).toEqual([path(0, -5, 0, -15)]);
  });

  it("carries a through-path round the mass between the same end points", () => {
    const routed = routePathAroundMasses(path(0, -5, 0, 9), [house]);
    expect(routed.length).toBeGreaterThan(1);
    expect(chained(routed)).toBe(true);
    expect([routed[0].x1, routed[0].z1, routed[routed.length - 1].x2, routed[routed.length - 1].z2]).toEqual([0, -5, 0, 9]);
    expect(crosses(routed, house)).toBe(false);
  });

  it("goes round a turned mass in its own frame", () => {
    const turned = { ...house, rotation: 0.6 };
    const routed = routePathAroundMasses(path(-15, 0, 15, 0), [turned]);
    expect(crosses(routed, turned)).toBe(false);
    expect(chained(routed)).toBe(true);
  });

  it("goes round masses too close to pass between as one, never through the neighbour", () => {
    const wing: MassFootprint = { id: "w", cx: -13, cz: 3, width: 6, depth: 6, rotation: 0 };
    const routed = routePathAroundMasses(path(0, -5, -13, 12), [house, wing]);
    expect(crosses(routed, house)).toBe(false);
    expect(crosses(routed, wing)).toBe(false);
  });
});

describe("deck pool cut-out", () => {
  const top = (deck: ReturnType<typeof buildDeck>) => {
    const v = (deck[0] as { vertices: number[] }).vertices, out: P2[] = [];
    for (let i = 0; i < v.length; i += 9) if ([1, 4, 7].every((k) => Math.abs(v[i + k] - 0.1) < 1e-6)) out.push([(v[i] + v[i + 3] + v[i + 6]) / 3, (v[i + 2] + v[i + 5] + v[i + 8]) / 3]);
    return out;
  };

  it("cuts a deck that only partly overlaps the pool, keeping the rest", () => {
    const coping = translateOutline(roundedRectOutline(12.8, 5.8, 1.9), 0, 15.5);
    const deck = buildDeck({ x: 0, z: 14, level: 0, width: 12, depth: 4 }, DEFAULT_MATERIALS_CONFIG, 0, [coping]);
    expect(deck[0].kind).toBe("triMesh");
    const centres = top(deck);
    expect(centres.length).toBeGreaterThan(0);
    expect(centres.filter((c) => pointInPolygon(c, convexHull(coping)))).toEqual([]);
  });

  it("keeps a deck clear of every pool a plain box", () => {
    const far = translateOutline(roundedRectOutline(6, 3, 0), 30, 30);
    expect(buildDeck({ x: 0, z: 14, level: 0, width: 12, depth: 4 }, DEFAULT_MATERIALS_CONFIG, 0, [far])[0].kind).toBe("box");
  });
});
