import { describe, expect, it } from "vitest";
import { BLANK_HOUSE_JSON } from "@/types/house";
import { BLANK_V3_SCENE } from "../scene";
import { projectModeAuthority, projectModeBadgeLabel, resolveProjectGenerationMode } from "../projectMode";

describe("durable project generation authority", () => {
  it("uses the persisted root for the development badge", () => {
    expect(projectModeBadgeLabel({ houseConfigJson: JSON.stringify(BLANK_V3_SCENE) })).toBe("V3 SCENE");
    expect(projectModeBadgeLabel({ houseConfigJson: BLANK_HOUSE_JSON })).toBe("V2 ARCHITECTURAL");
  });

  it("does not let a V3 record flag convert an old V2 root", () => {
    const project = { generationMode: "v3-scene" as const, houseConfigJson: BLANK_HOUSE_JSON };
    expect(resolveProjectGenerationMode(project)).toBe("v2-architectural");
    expect(projectModeAuthority(project)).toMatchObject({ persistedMode: "v2-architectural", recordMode: "v3-scene", agrees: false });
  });
});
