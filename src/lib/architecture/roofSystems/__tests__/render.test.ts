import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compileArchitecture } from "../../compiler";
import { ROOF_SYSTEM_FIXTURES } from "../fixtures";
import { renderPng } from "./rasterize";

/**
 * Fixture images for review. Rendering always runs (so a fixture that stops compiling or drawing fails here);
 * the PNGs are only written with ROOF_FIXTURE_IMAGES=1, into docs/roof-systems/.
 */
describe("roof system fixture images", () => {
  it.each(Object.keys(ROOF_SYSTEM_FIXTURES))("renders %s", (key) => {
    const { doc, materials } = ROOF_SYSTEM_FIXTURES[key];
    const { model, errors } = compileArchitecture(doc, { materials });
    expect(errors).toEqual([]);
    const image = renderPng(model.primitives);
    expect(image.length).toBeGreaterThan(2000);
    if (process.env.ROOF_FIXTURE_IMAGES) {
      const dir = join(process.cwd(), "docs", "roof-systems");
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${key}.png`), image);
    }
  });
});
