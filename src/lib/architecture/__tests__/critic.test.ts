import { describe, expect, it } from "vitest";
import { ARCHITECTURE_CRITERIA } from "@/types/library";
import { designArchitecture } from "../designEngine";
import { reviewCapabilityRequests, scoreArchitecture, WEAK_REVIEW_SCORE } from "../critic";

const site = { environment: "suburban" as const, viewDirection: "south" as const, approachSide: "north" as const };
const emptyJson = JSON.stringify({});

describe("scoreArchitecture", () => {
  it("scores every criterion once, in range, and averages them into the overall score", () => {
    const design = designArchitecture("A quiet modern retreat", site);
    const result = scoreArchitecture(design, emptyJson, "A quiet modern retreat");
    expect(result.criteria).toHaveLength(ARCHITECTURE_CRITERIA.length);
    expect(new Set(result.criteria.map((c) => c.criterion)).size).toBe(ARCHITECTURE_CRITERIA.length);
    for (const c of result.criteria) expect(c.score).toBeGreaterThanOrEqual(0);
    for (const c of result.criteria) expect(c.score).toBeLessThanOrEqual(1);
    const average = result.criteria.reduce((sum, c) => sum + c.score, 0) / result.criteria.length;
    expect(result.overallScore).toBeCloseTo(average, 1);
  });

  it("partitions criteria into weaknesses and strengths that never overlap, one recommendation per weakness", () => {
    const design = designArchitecture("A quiet modern retreat", site);
    const result = scoreArchitecture(design, emptyJson, "A quiet modern retreat");
    for (const w of result.weaknesses) expect(result.strengths).not.toContain(w);
    expect(result.weaknesses.every((w) => result.criteria.find((c) => c.criterion === w)!.score < WEAK_REVIEW_SCORE)).toBe(true);
    expect(result.recommendations.map((r) => r.criterion).sort()).toEqual([...result.weaknesses].sort());
    for (const r of result.recommendations) expect(r.recommendedStrategy.length).toBeGreaterThan(0);
  });

  it("scores privacy weak for a design with no courtyard, and strong once the brief asks for one", () => {
    const plain = scoreArchitecture(designArchitecture("A quiet modern retreat", site), emptyJson, "A quiet modern retreat");
    const courtyard = scoreArchitecture(designArchitecture("A private courtyard compound", site), emptyJson, "A private courtyard compound");
    expect(plain.criteria.find((c) => c.criterion === "privacy")!.score).toBeLessThan(WEAK_REVIEW_SCORE);
    expect(plain.weaknesses).toContain("privacy");
    expect(courtyard.criteria.find((c) => c.criterion === "privacy")!.score).toBeGreaterThanOrEqual(WEAK_REVIEW_SCORE);
    expect(courtyard.weaknesses).not.toContain("privacy");
    // Weak privacy names the fix, and the fix is a capability the engine actually knows about.
    const rec = plain.recommendations.find((r) => r.criterion === "privacy");
    expect(rec).toMatchObject({ recommendedStrategy: "Courtyard Composition", missingCapability: "courtyard-composition" });
  });

  it("scores originality weak when the concept falls back to the generic name, and strong once it resolves a named concept", () => {
    const generic = scoreArchitecture(designArchitecture("A quiet modern retreat", site), emptyJson, "A quiet modern retreat");
    const named = scoreArchitecture(designArchitecture("A private courtyard compound", site), emptyJson, "A private courtyard compound");
    expect(generic.weaknesses).toContain("originality");
    expect(named.weaknesses).not.toContain("originality");
    // Originality has no known geometric fix, only a strategy recommendation.
    expect(generic.recommendations.find((r) => r.criterion === "originality")?.missingCapability).toBeUndefined();
  });
});

describe("reviewCapabilityRequests", () => {
  it("turns only the recommendations that name a capability into capability requests on the architecture-review stage", () => {
    const result = scoreArchitecture(designArchitecture("A quiet modern retreat", site), emptyJson, "A quiet modern retreat");
    const requests = reviewCapabilityRequests(result);
    expect(requests.length).toBe(result.recommendations.filter((r) => r.missingCapability).length);
    for (const req of requests) {
      expect(req.stage).toBe("architecture-review");
      expect(result.recommendations.some((r) => r.missingCapability === req.operation && r.issue === req.desiredBehaviour)).toBe(true);
    }
  });
});
