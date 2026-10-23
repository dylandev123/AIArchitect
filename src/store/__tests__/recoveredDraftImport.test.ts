import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
const backup = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/lib/storage/recoveryBackup", () => ({ backupProjectsBeforeRecovery: backup }));

afterEach(() => vi.unstubAllGlobals());

it("adds the saved second-live Draft atomically, preserves old projects and source, and reopens edits", async () => {
  const data = new Map<string, string>();
  const localStorage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
  vi.stubGlobal("localStorage", localStorage);
  vi.stubGlobal("window", { localStorage, addEventListener: () => {} });
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("AI/network forbidden"); }));
  vi.resetModules();
  const { useProjectStore, PROJECT_STORAGE_KEY } = await import("../useProjectStore");
  const old = useProjectStore.getState().createProject("Existing work");
  const before = data.get(PROJECT_STORAGE_KEY)!;
  const originalBlueprint = readFileSync("src/lib/v3/__tests__/fixtures/architectural-blueprint-live-2026-10-21.json", "utf8").trimEnd();
  const { constructV3ArchitecturalBlueprint, planV3ArchitecturalBlueprint } = await import("@/lib/v3/architecturalBlueprint");
  const built = constructV3ArchitecturalBlueprint(planV3ArchitecturalBlueprint(JSON.parse(originalBlueprint), { buildFirst: true }).approval!);
  const input = { name: "Recovered Draft", sha256: "b78f82e1b55e0ce9e78b01e40f2a4b0ed8d4841ac3e86f1b6b96923887fb94bb", originalBlueprint,
    houseConfigJson: JSON.stringify({ version: 3, generationMode: "v3-scene", v3Scene: built.scene }) };
  const imported = await useProjectStore.getState().importRecoveredDraft(input);
  expect(useProjectStore.getState().getProject(old.id)).toEqual(old);
  expect(backup).toHaveBeenCalledWith(before, input.sha256);
  const saved = JSON.parse(data.get(PROJECT_STORAGE_KEY)!).state.projects.find((p: { id: string }) => p.id === imported.id);
  expect(saved.versions[0].houseConfigJson).toBe(saved.houseConfigJson);
  expect(JSON.parse(saved.houseConfigJson).v3Scene.objects).toEqual(built.scene!.objects);
  expect(JSON.parse(saved.houseConfigJson).v3Scene.metadata.architecturalValidation.status).toBe("draft");
  expect(saved.recoverySource.originalBlueprint).toBe(originalBlueprint);
  useProjectStore.getState().renameProject(imported.id, "My edited recovered estate");
  vi.resetModules();
  const reopened = (await import("../useProjectStore")).useProjectStore;
  expect((await reopened.getState().importRecoveredDraft(input)).name).toBe("My edited recovered estate");
  expect(reopened.getState().projects).toHaveLength(2);
  const snapshot = data.get(PROJECT_STORAGE_KEY);
  await expect(reopened.getState().importRecoveredDraft({ ...input, sha256: "a".repeat(64), houseConfigJson: "{}" })).rejects.toThrow();
  expect(data.get(PROJECT_STORAGE_KEY)).toBe(snapshot);
  expect(fetch).not.toHaveBeenCalled();
}, 20000);
