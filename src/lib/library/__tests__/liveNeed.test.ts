import { describe, expect, it } from "vitest";
import { resolveLiveNeed } from "../liveNeed";
import type { Need, ReportAssetNeed } from "@/types/library";

const historical: ReportAssetNeed = {
  id: "old-id",
  name: "Tropical Modern Pergola",
  spaces: [],
  components: [],
  isNew: true,
  requestedCount: 1,
};

const live: Need = {
  id: "new-id",
  title: "Modern Tropical Pergola",
  category: "pergola",
  styleTags: ["modern", "tropical"],
  contextTags: [],
  requestedCount: 1,
  firstRequested: "2026-09-28T00:00:00.000Z",
  lastRequested: "2026-09-28T00:00:00.000Z",
  projectRefs: [],
  phrasings: ["Tropical Modern Pergola"],
  status: "needed",
};

describe("resolveLiveNeed", () => {
  it("uses the current ID for the same semantic Need when a historical report ID differs", () => {
    const resolved = resolveLiveNeed(historical, [live]);

    expect(historical.id).toBe("old-id");
    expect(resolved?.id).toBe("new-id");
    expect(resolved?.id).not.toBe(historical.id);
  });
});
