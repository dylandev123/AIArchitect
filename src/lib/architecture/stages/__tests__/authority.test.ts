import { describe, expect, it } from "vitest";
import { ARCHITECTURE_FIXTURES } from "../../fixtures";
import { assertArchitectureReadOnly, architectureAuthorityHash, STAGE_AUTHORITY } from "../authority";

describe("V2 stage authority", () => {
  it("declares site plan and final assembly as architecture read-only", () => {
    expect(STAGE_AUTHORITY["site-plan"].writes).toEqual(["sitePlan"]);
    expect(STAGE_AUTHORITY["final-assembly"].writes).toEqual(["sceneSupport"]);
    const doc = ARCHITECTURE_FIXTURES.modernTropicalPavilionHouse;
    expect(() => assertArchitectureReadOnly("site-plan", doc, structuredClone(doc))).not.toThrow();
    expect(() => assertArchitectureReadOnly("final-assembly", doc, { ...doc, massing: { ...doc.massing, masses: [] } })).toThrow(/outside its write authority/);
    expect(architectureAuthorityHash(doc)).toBe(architectureAuthorityHash(structuredClone(doc)));
  });
});
