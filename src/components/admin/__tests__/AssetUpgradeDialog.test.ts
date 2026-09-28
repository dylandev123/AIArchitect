import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { lantern } from "@/lib/assets/native/__tests__/fixtures";
import type { AssetSpec } from "@/lib/assets/native/spec";

const data = new Map<string, string>();

// The 3D preview needs WebGL; what matters here is which asset it is shown.
vi.mock("../GlbPreview", () => ({ GlbPreview: ({ asset }: { asset: { id: string } }) => createElement("div", { "data-preview": asset.id }) }));

beforeEach(() => {
  data.clear();
  vi.resetModules();
  // Server rendering reads a zustand store's *initial* state, but this test sets up live state in the real asset store. Reading the
  // live state in the hook is what the browser does, so the dialog renders what the store holds. (doMock after each reset, not a
  // hoisted mock: a factory's result would otherwise be shared, and so would the store, between tests.)
  vi.doMock("@/store/useAssetStore", async (original) => {
    const actual = await original<typeof import("@/store/useAssetStore")>();
    const live = Object.assign(((selector: (s: ReturnType<typeof actual.useAssetStore.getState>) => unknown) => selector(actual.useAssetStore.getState())) as unknown as typeof actual.useAssetStore, actual.useAssetStore);
    return { ...actual, useAssetStore: live };
  });
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  });
});

const upgraded: AssetSpec = { ...lantern, parts: lantern.parts.map((p) => (p.role === "bulb" ? { ...p, radius: 0.08 } : p)), light: { ...lantern.light!, intensity: 12 } };

/** The opening tag of the button whose label is `label`. */
const buttonTag = (html: string, label: string) => {
  const at = html.indexOf(label);
  if (at < 0) throw new Error(`no "${label}" in the dialog`);
  const start = html.lastIndexOf("<button", at);
  return html.slice(start, html.indexOf(">", start) + 1);
};

async function setup() {
  const { useAssetStore } = await import("@/store/useAssetStore");
  const { stageNativeAsset, upgradeStagingInputs } = await import("@/lib/assets/native/stage");
  const { AssetUpgradeDialog } = await import("../AssetUpgradeDialog");
  const planned = { id: "lamp-1", name: "Iron Garden Lantern", category: "light" as const, tags: [], style: ["rustic"], contexts: [], generationPrompt: "A lantern" };
  const first = await stageNativeAsset(lantern, planned, { id: "plan-1" });
  if (!first.ok) throw new Error(first.error);
  useAssetStore.getState().addToQueue(first.staged.asset);
  useAssetStore.getState().approve(first.staged.asset.id);
  const v1 = useAssetStore.getState().catalog[0];
  const candidate = async (spec: AssetSpec = upgraded) => {
    const inputs = upgradeStagingInputs(v1)!;
    const r = await stageNativeAsset(spec, inputs.planned, inputs.plan, undefined, { upgradeOf: v1 });
    if (!r.ok) throw new Error(r.error);
    useAssetStore.getState().addToQueue(r.staged.asset);
    return r.staged.asset;
  };
  const render = (baseId: string) => renderToStaticMarkup(createElement(AssetUpgradeDialog, { baseId, onClose: () => {} }));
  return { useAssetStore, v1, candidate, render };
}

describe("the Upgrade dialog", () => {
  it("before a candidate exists: shows the approved version alone, with a way to generate one, and no approval buttons", async () => {
    const { v1, render } = await setup();
    const html = render(v1.id);
    expect(html).toContain("Upgrade Iron Garden Lantern");
    expect(html).toContain("Current · v1");
    expect(html).toContain(`data-preview="${v1.id}"`);
    expect(html).toContain("point · 8 cd · 6 m · #ffcf7a");
    expect(html).toContain("Generate upgrade candidate");
    expect(html).toContain("stays exactly as it is until you review");
    expect(html).not.toContain("New Projects Only");
    expect(html).not.toContain("Make Current");
  });

  it("with a candidate: current and candidate side by side, both previews, both metadata, and the two rollout choices explained", async () => {
    const { v1, candidate, render } = await setup();
    const made = await candidate();
    const html = render(v1.id);
    expect(html).toContain("Current · v1");
    expect(html).toContain("Candidate · v2 on approval");
    expect(html).toContain(`data-preview="${v1.id}"`);
    expect(html).toContain(`data-preview="${made.id}"`);
    expect(html).toContain("point · 8 cd · 6 m · #ffcf7a");
    expect(html).toContain("point · 12 cd · 6 m · #ffcf7a");
    // What changed is marked on the candidate's side.
    expect(html).toMatch(/text-amber-300[^>]*>point · 12 cd/);
    expect(html).not.toMatch(/text-amber-300[^>]*>point · 8 cd/);
    expect(html).toContain("New Projects Only");
    expect(html).toContain("Make Current");
    expect(html).toContain("v1 stays as it is in projects that already use it. New projects get v2.");
    expect(html).toContain("Every project, existing and new, draws v2.");
    expect(html).toContain("Discard candidate");
    expect(html).toContain("Regenerate");
    expect(html).not.toContain("Generate upgrade candidate");
    // Both approval buttons are live.
    expect(buttonTag(html, "New Projects Only")).not.toContain('disabled=""');
    expect(buttonTag(html, "Make Current")).not.toContain('disabled=""');
  });

  it("disables both approvals, and says why, when the version the candidate came from has been replaced", async () => {
    const { useAssetStore, v1, candidate, render } = await setup();
    const a = await candidate();
    const b = await candidate({ ...upgraded, light: { ...lantern.light!, intensity: 20 } });
    expect(useAssetStore.getState().approveUpgrade(a.id, "new-projects")).toBeNull();
    const html = render(v1.id);
    expect(html).toContain("has since been replaced by v2");
    expect(b.upgradeOf).toBe(v1.id);
    expect(buttonTag(html, "New Projects Only")).toContain('disabled=""');
    expect(buttonTag(html, "Make Current")).toContain('disabled=""');
    // Discarding is still possible.
    expect(buttonTag(html, "Discard candidate")).not.toContain('disabled=""');
  });

  it("says so when the approved version it was made from is gone", async () => {
    const { render } = await setup();
    expect(render("no-such-asset")).toContain("no longer in the library");
  });
});
