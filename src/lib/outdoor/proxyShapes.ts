/**
 * The small, reusable vocabulary procedural proxies are drawn from while no approved GLB exists for a standalone
 * object. A proxy is deliberately a handful of boxes/cylinders: recognizable silhouette, no textures, no fetches.
 * Every shape is authored around local x/z zero and stands on its local y=0 plane — the same local-bounds
 * contract the placer persists (`[-w/2, 0, -d/2] .. [w/2, h, d/2]`), so a later GLB can take the same placement.
 */
export const PROXY_SHAPES = ["post-frame", "counter", "bench", "fire-pit", "sculpture"] as const;
export type ProxyShape = (typeof PROXY_SHAPES)[number];
/** How a post-frame is topped: a solid flat roof (gazebo, cabana), open slats (pergola), or a thin canopy. */
export type ProxyCanopy = "solid" | "slatted" | "canopy";

export interface ProxyPart {
  /** Stable within one proxy, so tests and the renderer can name what they draw. */
  name: string;
  shape: "box" | "cylinder";
  /** Local centre of the part. */
  position: [number, number, number];
  /** box: [x, y, z] size. cylinder: [radiusTop, height, radiusBottom]. */
  size: [number, number, number];
  color: string;
}

const POST = "#4a3d33", TIMBER = "#7a634f", ROOF = "#5b5752", STONE = "#8d8a84", COUNTER = "#cfc9be", SEAT = "#8a6c52", METAL = "#3b3b3d";

export function proxyParts(shape: ProxyShape, dims: { width: number; depth: number; height: number }, canopy: ProxyCanopy = "solid"): ProxyPart[] {
  const { width: w, depth: d, height: h } = dims;
  switch (shape) {
    case "post-frame": {
      const post = Math.min(.16, Math.max(.08, Math.min(w, d) * .04));
      const beam = Math.min(.2, h * .07);
      const top = h - (canopy === "slatted" ? beam : .14);
      const parts: ProxyPart[] = [-1, 1].flatMap((sx) => [-1, 1].map((sz): ProxyPart => ({
        name: `post-${sx < 0 ? "w" : "e"}${sz < 0 ? "n" : "s"}`, shape: "box",
        position: [sx * (w / 2 - post / 2), top / 2, sz * (d / 2 - post / 2)], size: [post, top, post], color: POST,
      })));
      // Perimeter beams tie the posts together at the eave.
      parts.push(
        { name: "beam-n", shape: "box", position: [0, top - beam / 2, -(d / 2 - post / 2)], size: [w, beam, post], color: TIMBER },
        { name: "beam-s", shape: "box", position: [0, top - beam / 2, d / 2 - post / 2], size: [w, beam, post], color: TIMBER },
        { name: "beam-w", shape: "box", position: [-(w / 2 - post / 2), top - beam / 2, 0], size: [post, beam, d], color: TIMBER },
        { name: "beam-e", shape: "box", position: [w / 2 - post / 2, top - beam / 2, 0], size: [post, beam, d], color: TIMBER },
      );
      if (canopy === "slatted") {
        const count = Math.max(4, Math.round(w / .45));
        for (let i = 0; i < count; i++) {
          const x = -w / 2 + post + (w - 2 * post) * (i + .5) / count;
          parts.push({ name: `slat-${i}`, shape: "box", position: [x, h - beam / 2, 0], size: [.06, beam, d + .2], color: TIMBER });
        }
      } else {
        const slab = canopy === "canopy" ? .05 : .14;
        const over = canopy === "canopy" ? 0 : .15;
        parts.push({ name: "roof", shape: "box", position: [0, h - slab / 2, 0], size: [w + over * 2, slab, d + over * 2], color: canopy === "canopy" ? "#e4ddcd" : ROOF });
      }
      return parts;
    }
    case "counter": {
      const top = .05;
      return [
        { name: "base", shape: "box", position: [0, (h - top) / 2, 0], size: [w, h - top, d * .92], color: STONE },
        { name: "countertop", shape: "box", position: [0, h - top / 2, 0], size: [w + .04, top, d], color: COUNTER },
      ];
    }
    case "bench": {
      const seatY = Math.min(.46, h * .55), seat = .06;
      const parts: ProxyPart[] = [
        { name: "seat", shape: "box", position: [0, seatY - seat / 2, 0], size: [w, seat, d * .8], color: SEAT },
        { name: "back", shape: "box", position: [0, (seatY + h) / 2, d / 2 - .04], size: [w, h - seatY, .06], color: SEAT },
      ];
      for (const sx of [-1, 1]) parts.push({ name: `support-${sx < 0 ? "w" : "e"}`, shape: "box", position: [sx * (w / 2 - .06), (seatY - seat) / 2, 0], size: [.08, seatY - seat, d * .75], color: METAL });
      return parts;
    }
    case "fire-pit": {
      const r = Math.min(w, d) / 2;
      return [
        { name: "base", shape: "cylinder", position: [0, h / 2, 0], size: [r, h, r], color: STONE },
        { name: "bowl", shape: "cylinder", position: [0, h - .01, 0], size: [r * .72, .02, r * .72], color: "#2a2422" },
      ];
    }
    case "sculpture": {
      const plinth = Math.min(.5, h * .3);
      return [
        { name: "plinth", shape: "box", position: [0, plinth / 2, 0], size: [w, plinth, d], color: STONE },
        { name: "form", shape: "cylinder", position: [0, plinth + (h - plinth) / 2, 0], size: [Math.min(w, d) * .18, h - plinth, Math.min(w, d) * .32], color: "#9c7b5a" },
      ];
    }
  }
}
