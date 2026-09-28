import { beforeEach, describe, expect, it, vi } from "vitest";
import { lantern } from "@/lib/assets/native/__tests__/fixtures";
import type { AssetSpec } from "@/lib/assets/native/spec";
import type { AssetPlacement } from "../placement";
import type { CuratedAsset } from "@/types/assets";

const data = new Map<string, string>();

beforeEach(() => {
  data.clear();
  vi.resetModules();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  });
});

/** Everything under test, imported fresh so the store, the GLB store and the stage all share one module graph per test. */
async function world() {
  const storage = await import("../glbStorage");
  storage.setGlbStore(storage.createMemoryGlbStore());
  const { useAssetStore } = await import("@/store/useAssetStore");
  const stage = await import("../native/stage");
  const versions = await import("../versions");
  const placement = await import("../placement");
  const retrieval = await import("@/lib/library/retrieval");
  const files = storage.getGlbStore();
  const planned = { id: "lamp-1", name: "Iron Garden Lantern", category: "light" as const, tags: ["outdoor"], style: ["rustic"], contexts: ["garden" as const], generationPrompt: "A lantern" };
  const plan = { id: "plan-1", knowledgeId: "outdoor-lighting" };
  const store = useAssetStore;

  /** Generates, reviews and approves v1 the way the plan panel does. */
  const approveV1 = async (spec: AssetSpec = lantern) => {
    const r = await stage.stageNativeAsset(spec, planned, plan);
    if (!r.ok) throw new Error(r.error);
    store.getState().addToQueue(r.staged.asset);
    store.getState().approve(r.staged.asset.id);
    return store.getState().catalog.find((a) => a.id === r.staged.asset.id)!;
  };
  /** An upgrade candidate for `base`, staged and queued like the Upgrade dialog does. */
  const candidateFor = async (base: CuratedAsset, spec: AssetSpec) => {
    const inputs = stage.upgradeStagingInputs(base);
    if (!inputs) throw new Error("no native lineage");
    const r = await stage.stageNativeAsset(spec, inputs.planned, inputs.plan, undefined, { upgradeOf: base });
    if (!r.ok) throw new Error(r.error);
    store.getState().addToQueue(r.staged.asset);
    return r.staged.asset;
  };
  return { store, files, stage, versions, placement, retrieval, approveV1, candidateFor };
}

const snapshot = <T,>(v: T): T => structuredClone(v);
const bytes = async (files: { get: (id: string) => Promise<ArrayBuffer | null> }, id: string) => {
  const b = await files.get(id);
  return b ? Array.from(new Uint8Array(b)) : null;
};
/** The lantern with a bigger bulb and a brighter light: a visibly different, valid spec. */
const upgraded: AssetSpec = { ...lantern, parts: lantern.parts.map((p) => (p.role === "bulb" ? { ...p, radius: 0.08 } : p)), light: { ...lantern.light!, intensity: 12 } };
const placementOf = (assetId: string): AssetPlacement => ({ featureId: "building-0", assetId, kind: "gazebo", category: "gazebo", x: 0, z: 0, yaw: 0, width: 3, depth: 3 });

describe("upgrading v1 makes a v2 candidate without touching v1", () => {
  it("numbers v1 when it is approved, not when it is generated", async () => {
    const w = await world();
    const staged = await w.stage.stageNativeAsset(lantern, { id: "lamp-1", name: "L", category: "light", tags: [], style: [], contexts: [], generationPrompt: "p" }, { id: "plan-1" });
    if (!staged.ok) throw new Error(staged.error);
    expect(staged.staged.asset.version).toBeUndefined();
    expect(staged.staged.asset.stableAssetId).toBe("native:lamp-1");
    w.store.getState().addToQueue(staged.staged.asset);
    w.store.getState().approve(staged.staged.asset.id);
    expect(w.store.getState().catalog[0]).toMatchObject({ version: 1, status: "approved", stableAssetId: "native:lamp-1" });
  });

  it("creates the candidate under the same stableAssetId, with no version, its own file, and the approved version exactly as it was", async () => {
    const w = await world();
    const v1 = await w.approveV1();
    const before = snapshot(w.store.getState().catalog);
    const v1Bytes = await bytes(w.files, v1.id);
    expect(v1Bytes).not.toBeNull();

    const candidate = await w.candidateFor(v1, upgraded);

    expect(candidate.stableAssetId).toBe(v1.stableAssetId);
    expect(candidate.upgradeOf).toBe(v1.id);
    expect(candidate.id).not.toBe(v1.id);
    expect(candidate.version).toBeUndefined();
    expect(candidate.status).toBe("pending");
    expect(candidate.name).toBe(v1.name);
    expect(candidate.family).toBe(v1.family);
    expect(candidate.knowledgeIds).toEqual(v1.knowledgeIds);
    expect(candidate.sourceSpec?.light?.intensity).toBe(12);
    expect(candidate.sourceSlug).not.toBe(v1.sourceSlug);
    expect(candidate.validation?.passed).toBe(true);
    // Its file is its own; v1's file is byte-for-byte what it was.
    expect(await bytes(w.files, candidate.id)).not.toEqual(v1Bytes);
    expect(await bytes(w.files, v1.id)).toEqual(v1Bytes);
    // Nothing in the library changed, and the candidate is in the queue.
    expect(w.store.getState().catalog).toEqual(before);
    expect(w.store.getState().queue.map((a) => a.id)).toEqual([candidate.id]);
    expect(w.versions.findPendingUpgrade(w.store.getState().queue, v1.stableAssetId!)?.id).toBe(candidate.id);
  });

  it("cannot be approved with a bare Approve: only through a rollout choice, so v1 stays put until review", async () => {
    const w = await world();
    const v1 = await w.approveV1();
    const before = snapshot(w.store.getState().catalog);
    const candidate = await w.candidateFor(v1, upgraded);
    const { approvalBlocker } = await import("@/store/useAssetStore");
    expect(approvalBlocker(candidate)).toMatch(/upgrade candidate/);
    w.store.getState().approve(candidate.id);
    expect(w.store.getState().catalog).toEqual(before);
    expect(w.store.getState().queue).toHaveLength(1);
  });

  it("New Projects Only: v2 is approved as version 2, v1 is kept and only marked superseded, new projects get v2, existing ones keep v1", async () => {
    const w = await world();
    const v1 = await w.approveV1();
    const v1Before = snapshot(v1);
    const v1Bytes = await bytes(w.files, v1.id);
    const candidate = await w.candidateFor(v1, upgraded);

    expect(w.store.getState().approveUpgrade(candidate.id, "new-projects")).toBeNull();

    const { catalog, queue } = w.store.getState();
    expect(queue).toEqual([]);
    expect(catalog.map((a) => [a.id, a.version])).toEqual([[v1.id, 1], [candidate.id, 2]]);
    const [oldV1, v2] = catalog;
    expect(v2).toMatchObject({ status: "approved", version: 2, upgradeOf: v1.id, stableAssetId: v1.stableAssetId });
    expect(v2.supersededBy).toBeUndefined();
    // v1 is unchanged apart from being marked superseded.
    const { supersededBy, ...rest } = oldV1;
    expect(rest).toEqual(v1Before);
    expect(supersededBy).toMatchObject({ id: candidate.id, version: 2, rollout: "new-projects" });
    expect(await bytes(w.files, v1.id)).toEqual(v1Bytes);
    expect(oldV1.status).toBe("approved");

    // New projects are offered only v2...
    expect(w.retrieval.toAssetIndex(catalog).map((a) => a.id)).toEqual([candidate.id]);
    // ...and a project already using v1 still draws v1.
    expect(w.placement.usablePlacements([placementOf(v1.id)], catalog).map((p) => p.assetId)).toEqual([v1.id]);
    expect(w.versions.currentVersion(catalog, v1.stableAssetId!)?.id).toBe(candidate.id);
    expect(w.versions.nextVersion(catalog, v1.stableAssetId!)).toBe(3);
  });

  it("Make Current: existing projects follow to v2 too, and v1 is still in the library", async () => {
    const w = await world();
    const v1 = await w.approveV1();
    const candidate = await w.candidateFor(v1, upgraded);
    expect(w.store.getState().approveUpgrade(candidate.id, "all-projects")).toBeNull();
    const { catalog } = w.store.getState();
    expect(catalog.find((a) => a.id === v1.id)?.supersededBy).toMatchObject({ rollout: "all-projects", version: 2 });
    expect(w.placement.usablePlacements([placementOf(v1.id)], catalog).map((p) => p.assetId)).toEqual([candidate.id]);
    expect(w.retrieval.toAssetIndex(catalog).map((a) => a.id)).toEqual([candidate.id]);
    expect(catalog.some((a) => a.id === v1.id)).toBe(true);
    expect(await bytes(w.files, v1.id)).not.toBeNull();
  });

  it("chains: v3 supersedes v2, and each rollout applies where it was chosen", async () => {
    const w = await world();
    const v1 = await w.approveV1();
    const v2 = await w.candidateFor(v1, upgraded);
    w.store.getState().approveUpgrade(v2.id, "new-projects");
    const v2Approved = w.store.getState().catalog.find((a) => a.id === v2.id)!;
    const v3 = await w.candidateFor(v2Approved, { ...upgraded, parts: upgraded.parts.map((p) => (p.role === "cap" ? { ...p, height: 0.14 } : p)) });
    w.store.getState().approveUpgrade(v3.id, "all-projects");
    const { catalog } = w.store.getState();
    expect(catalog.map((a) => a.version)).toEqual([1, 2, 3]);
    // v1 was kept by "new projects only": it stays v1. v2 was replaced with "make current": its projects move to v3.
    expect(w.placement.usablePlacements([placementOf(v1.id)], catalog)[0].assetId).toBe(v1.id);
    expect(w.placement.usablePlacements([placementOf(v2.id)], catalog)[0].assetId).toBe(v3.id);
    expect(w.retrieval.toAssetIndex(catalog).map((a) => a.id)).toEqual([v3.id]);
  });

  it("removing the newest version gives the older one back", async () => {
    const w = await world();
    const v1 = await w.approveV1();
    const v2 = await w.candidateFor(v1, upgraded);
    w.store.getState().approveUpgrade(v2.id, "all-projects");
    w.store.getState().removeFromCatalog(v2.id);
    const { catalog } = w.store.getState();
    expect(catalog.map((a) => a.id)).toEqual([v1.id]);
    expect(catalog[0].supersededBy).toBeUndefined();
    expect(w.retrieval.toAssetIndex(catalog).map((a) => a.id)).toEqual([v1.id]);
    expect(w.placement.usablePlacements([placementOf(v1.id)], catalog)[0].assetId).toBe(v1.id);
    expect(await bytes(w.files, v2.id)).toBeNull();
    expect(await bytes(w.files, v1.id)).not.toBeNull();
    expect(w.versions.nextVersion(catalog, v1.stableAssetId!)).toBe(2);
  });

  it("discarding a candidate deletes only its file and leaves v1 alone", async () => {
    const w = await world();
    const v1 = await w.approveV1();
    const before = snapshot(w.store.getState().catalog);
    const candidate = await w.candidateFor(v1, upgraded);
    w.store.getState().reject(candidate.id);
    await new Promise((r) => setTimeout(r, 0));
    expect(w.store.getState().queue).toEqual([]);
    expect(w.store.getState().catalog).toEqual(before);
    expect(await bytes(w.files, candidate.id)).toBeNull();
    expect(await bytes(w.files, v1.id)).not.toBeNull();
    expect(w.versions.nextVersion(w.store.getState().catalog, v1.stableAssetId!)).toBe(2);
  });

  it("refuses a stale candidate: once v1 has been replaced, an upgrade made from it must be redone", async () => {
    const w = await world();
    const v1 = await w.approveV1();
    const a = await w.candidateFor(v1, upgraded);
    const b = await w.candidateFor(v1, { ...upgraded, light: { ...lantern.light!, intensity: 20 } });
    expect(w.store.getState().approveUpgrade(a.id, "new-projects")).toBeNull();
    const after = snapshot(w.store.getState().catalog);
    const refused = w.store.getState().approveUpgrade(b.id, "new-projects");
    expect(refused).toMatch(/has since been replaced by v2/);
    expect(w.store.getState().catalog).toEqual(after);
    expect(w.store.getState().queue.map((q) => q.id)).toEqual([b.id]);
  });

  it("refuses a candidate whose GLB failed validation", async () => {
    const w = await world();
    const v1 = await w.approveV1();
    const candidate = await w.candidateFor(v1, upgraded);
    w.store.getState().updateAssetMeta(candidate.id, { validation: { checkedAt: "", passed: false, errors: ["broken"], warnings: [] } });
    expect(w.store.getState().approveUpgrade(candidate.id, "all-projects")).toMatch(/GLB validation/);
    expect(w.store.getState().catalog).toHaveLength(1);
  });

  it("does not count a superseded version as more coverage, but keeps a planned asset's v1 link intact", async () => {
    const w = await world();
    const v1 = await w.approveV1();
    const v2 = await w.candidateFor(v1, upgraded);
    w.store.getState().approveUpgrade(v2.id, "new-projects");
    const { catalog } = w.store.getState();
    const { knowledgeProgress } = await import("@/lib/library/knowledge/knowledge");
    const progress = knowledgeProgress({ id: "unlisted-need", assetIds: [v1.id, v2.id], recipeIds: [] }, { assets: catalog, recipes: [] });
    expect(progress.assetIds).toEqual([v2.id]);
    const { planStats } = await import("@/lib/library/plans");
    const plan = { assets: [{ id: "lamp-1", assetId: v1.id, approved: true, generated: true }] } as never;
    expect(planStats([plan], catalog).approved).toBe(1);
  });
});

describe("who can be upgraded, and what the review shows", () => {
  it("only an approved, validated, current native asset can", async () => {
    const w = await world();
    const v1 = await w.approveV1();
    expect(w.versions.canUpgrade(v1)).toBe(true);
    expect(w.versions.canUpgrade({ ...v1, sourceSpec: undefined })).toBe(false);
    expect(w.versions.canUpgrade({ ...v1, stableAssetId: undefined })).toBe(false);
    expect(w.versions.canUpgrade({ ...v1, status: "pending" })).toBe(false);
    expect(w.versions.canUpgrade({ ...v1, validation: { checkedAt: "", passed: false, errors: [], warnings: [] } })).toBe(false);
    const candidate = await w.candidateFor(v1, upgraded);
    expect(w.versions.canUpgrade(candidate)).toBe(false);
    w.store.getState().approveUpgrade(candidate.id, "new-projects");
    const [old, current] = w.store.getState().catalog;
    expect(w.versions.canUpgrade(old)).toBe(false);
    expect(w.versions.canUpgrade(current)).toBe(true);
  });

  it("has no native lineage to stage from for a plain upload", async () => {
    const w = await world();
    const v1 = await w.approveV1();
    expect(w.stage.upgradeStagingInputs({ ...v1, stableAssetId: undefined })).toBeNull();
  });

  it("lays out comparable facts for both sides, and the light is one of them", async () => {
    const w = await world();
    const v1 = await w.approveV1();
    const candidate = await w.candidateFor(v1, upgraded);
    const next = w.versions.nextVersion(w.store.getState().catalog, v1.stableAssetId!);
    const current = w.versions.describeAsset(v1);
    const proposed = w.versions.describeAsset(candidate, next);
    expect(current.version).toBe("v1");
    expect(proposed.version).toBe("v2 on approval");
    expect(current.validation).toBe("passed");
    expect(current.light).toBe("point · 8 cd · 6 m · #ffcf7a");
    expect(proposed.light).toBe("point · 12 cd · 6 m · #ffcf7a");
    expect(current.triangles).not.toBe("—");
    expect(current.generator).toMatch(/^native-/);
    expect(current.family).toBe("lamp");
  });
});
