import type { DeckShape, PoolShape } from "@/types/house";
import { ellipseOutline, growOutline, kidneyOutline, roundedRectOutline, type P2 } from "./mesh";

/** Outline of a pool basin centred on the origin, grown by `inflate` metres each side (for the surrounding coping). */
export function poolOutline(shape: PoolShape, width: number, depth: number, inflate = 0): P2[] {
  switch (shape) {
    case "rounded":
      return roundedRectOutline(width + inflate * 2, depth + inflate * 2, Math.min(width, depth) * 0.3 + inflate);
    case "oval":
      return ellipseOutline(width + inflate * 2, depth + inflate * 2);
    case "kidney":
      return growOutline(kidneyOutline(width, depth), inflate);
    case "rectangle":
      return roundedRectOutline(width + inflate * 2, depth + inflate * 2, 0);
  }
}

/** Outline of a deck platform centred on the origin. "arc" bows its +z edge outward like a terrace facing a view. */
export function deckOutline(shape: DeckShape, width: number, depth: number): P2[] {
  switch (shape) {
    case "rounded":
      return roundedRectOutline(width, depth, Math.min(width, depth) * 0.25);
    case "oval":
      return ellipseOutline(width, depth);
    case "arc": {
      const hw = width / 2;
      const hd = depth / 2;
      const bow = depth * 0.22;
      const out: P2[] = [[-hw, -hd], [hw, -hd]];
      const steps = 14;
      for (let i = 0; i <= steps; i++) out.push([hw - (width * i) / steps, hd - bow + bow * Math.sin((Math.PI * i) / steps)]);
      return out;
    }
    case "rectangle":
      return roundedRectOutline(width, depth, 0);
  }
}
