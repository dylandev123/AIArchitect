import { beforeEach, describe, expect, it, vi } from "vitest";

const KEY = "ai-architect-projects";

const data = new Map<string, string>();
let failWrites = false;

function stubBrowser() {
  data.clear();
  failWrites = false;
  const localStorage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (failWrites) throw new Error("QuotaExceededError");
      data.set(k, v);
    },
    removeItem: (k: string) => void data.delete(k),
  };
  vi.stubGlobal("localStorage", localStorage);
  vi.stubGlobal("window", { localStorage, addEventListener: () => {} });
}

async function load() {
  vi.resetModules();
  return (await import("../useProjectStore")).useProjectStore;
}

const stored = () =>
  (JSON.parse(data.get(KEY) ?? "{}").state?.projects ?? []).map((p: { name: string }) => p.name);

describe("deleteProject", () => {
  beforeEach(stubBrowser);

  it("removes projects from state and storage, leaving the rest", async () => {
    const store = await load();
    const [a, b, c] = ["A", "B", "C"].map((n) => store.getState().createProject(n));
    expect(store.getState().deleteProject(a.id)).toBe(true);
    expect(store.getState().deleteProject(c.id)).toBe(true);
    expect(store.getState().projects.map((p) => p.id)).toEqual([b.id]);
    expect(stored()).toEqual(["B"]);
  });

  it("returns false and keeps the project when storage fails", async () => {
    const store = await load();
    const p = store.getState().createProject("Keep me");
    failWrites = true;
    expect(store.getState().deleteProject(p.id)).toBe(false);
    expect(store.getState().projects).toHaveLength(1);
    expect(stored()).toEqual(["Keep me"]);
  });
});

describe("duplicateProject", () => {
  beforeEach(stubBrowser);

  it("creates a new ID with a (Copy) name and leaves the original intact", async () => {
    const store = await load();
    const a = store.getState().createProject("House");
    const copy = store.getState().duplicateProject(a.id)!;
    expect(copy.id).not.toBe(a.id);
    expect(copy.name).toBe("House (Copy)");
    expect(store.getState().projects.map((p) => p.name)).toEqual(["House", "House (Copy)"]);
  });
});

describe("renameProject", () => {
  beforeEach(stubBrowser);

  it("keeps the same ID", async () => {
    const store = await load();
    const a = store.getState().createProject("Old");
    store.getState().renameProject(a.id, "New");
    expect(store.getState().projects.map((p) => [p.id, p.name])).toEqual([[a.id, "New"]]);
  });
});
