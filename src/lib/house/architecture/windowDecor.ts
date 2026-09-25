import type { HouseConfig, WindowConfig } from "@/types/house";
import type { HousePrimitive } from "../types";
import { FLOOR_THICKNESS, FRAME_BORDER, LEVEL_HEIGHT } from "../constants";
import { box, shade, wallFrame, type Paint } from "./parts";
import type { WindowDecor } from "./profiles";

/**
 * Style-specific extras around a window opening: heavy timber surrounds on a cabin, louvred shutters on a
 * Caribbean villa. Part of the same `window-<n>-…` group, so it moves and deletes with the window.
 */
export function buildWindowDecor(decor: WindowDecor, config: WindowConfig, house: HouseConfig, index: number, trim: Paint): HousePrimitive[] {
  if (decor === "none") return [];
  const f = wallFrame(house, config.wall);
  const id = `window-${index}`;
  const label = `Window ${index + 1}`;
  const bottom = config.level * LEVEL_HEIGHT + FLOOR_THICKNESS + config.sill;
  const midY = bottom + config.height / 2;
  const u0 = config.offset;
  const u1 = config.offset + config.width;
  const uMid = (u0 + u1) / 2;
  const out: HousePrimitive[] = [];

  if (decor === "timber-surround") {
    const jamb = 0.14;
    out.push(
      box(`${id}-header`, "window", `${label} Timber Header`, f.at(uMid, bottom + config.height + FRAME_BORDER + 0.09, 0.09), f.size(config.width + FRAME_BORDER * 2 + 0.36, 0.18, 0.18), trim),
      box(`${id}-jamb-a`, "window", `${label} Timber Jamb`, f.at(u0 - FRAME_BORDER - jamb / 2, midY, 0.07), f.size(jamb, config.height + FRAME_BORDER * 2, 0.14), trim),
      box(`${id}-jamb-b`, "window", `${label} Timber Jamb`, f.at(u1 + FRAME_BORDER + jamb / 2, midY, 0.07), f.size(jamb, config.height + FRAME_BORDER * 2, 0.14), trim),
      box(`${id}-mullion`, "window", `${label} Mullion`, f.at(uMid, midY, 0.14), f.size(0.05, config.height, 0.05), trim)
    );
    return out;
  }

  // Shutters: a pair of louvred panels, each half the window's width, hung either side of the frame.
  const panelW = Math.max(0.3, config.width / 2);
  const panelH = config.height + FRAME_BORDER * 2;
  const slat = { color: shade(trim.color, 0.82), roughness: trim.roughness, metalness: trim.metalness };
  for (const [side, u] of [["a", u0 - FRAME_BORDER - 0.03 - panelW / 2], ["b", u1 + FRAME_BORDER + 0.03 + panelW / 2]] as const) {
    out.push(box(`${id}-shutter-${side}`, "window", `${label} Shutter`, f.at(u, midY, 0.03), f.size(panelW, panelH, 0.05), trim));
    const slats = Math.max(3, Math.round(panelH / 0.22));
    for (let s = 0; s < slats; s++) {
      out.push(box(`${id}-shutter-${side}-slat-${s}`, "window", `${label} Shutter Louvre`, f.at(u, bottom - FRAME_BORDER + (panelH * (s + 0.5)) / slats, 0.065), f.size(panelW - 0.1, 0.03, 0.03), slat));
    }
  }
  return out;
}
