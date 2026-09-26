import { describe, expect, it } from "vitest";
import { DEFAULT_HOUSE_CONFIG } from "@/types/house";
import { computeCameraFit } from "../cameraFit";

describe("computeCameraFit", () => {
  it("looks at the house from above and outside it", () => {
    const fit = computeCameraFit(DEFAULT_HOUSE_CONFIG);
    expect(fit.position.y).toBeGreaterThan(fit.target.y);
    expect(fit.position.distanceTo(fit.target)).toBeGreaterThan(Math.max(DEFAULT_HOUSE_CONFIG.width, DEFAULT_HOUSE_CONFIG.depth));
  });

  it("caps how far a sprawling site pushes the camera back", () => {
    const house = computeCameraFit(DEFAULT_HOUSE_CONFIG).position.length();
    const site = computeCameraFit(DEFAULT_HOUSE_CONFIG, { halfWidth: 500, halfDepth: 500 }).position.length();
    expect(site).toBeLessThan(house * 2);
  });

  it("backs off for narrow viewports", () => {
    const wide = computeCameraFit(DEFAULT_HOUSE_CONFIG, undefined, 1.8).position.length();
    const narrow = computeCameraFit(DEFAULT_HOUSE_CONFIG, undefined, 0.6).position.length();
    expect(narrow).toBeGreaterThan(wide);
  });
});
