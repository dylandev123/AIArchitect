import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('saves beyond the browser quota without losing any project or version, including reload, undo, and deletion', async () => {
  vi.resetModules();
  const values = new Map<string, string>();
  const quota = 24000;
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (value.length > quota) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      values.set(key, value);
    },
    removeItem: (key: string) => { values.delete(key); },
  };
  vi.stubGlobal('window', { localStorage: storage, addEventListener: () => {} });
  vi.stubGlobal('localStorage', storage);
  const { useProjectStore, PROJECT_STORAGE_KEY, verifyPersistedProjectMode } = await import('@/store/useProjectStore');
  const store = useProjectStore.getState();
  const existing = store.createProject('Preserved architecture', 'house', 'v3-scene');
  const prior = structuredClone(store.getProject(existing.id));
  const project = store.createProject('New 2D plan', 'house', 'v3-scene');
  const root = JSON.parse(project.houseConfigJson);
  root.v3Scene.metadata.brief = 'A detailed architectural brief. '.repeat(2000);
  const json = JSON.stringify(root);
  store.appendVersion(project.id, 'Generated plan', json);
  const expected = structuredClone(useProjectStore.getState().projects);
  expect(JSON.stringify({ state: { projects: expected }, version: 6 }).length).toBeGreaterThan(quota);
  expect(values.get(PROJECT_STORAGE_KEY)!.length).toBeLessThan(quota);
  expect(verifyPersistedProjectMode(project.id, 'v3-scene').ok).toBe(true);

  vi.resetModules();
  const reloaded = await import('@/store/useProjectStore');
  const saved = reloaded.useProjectStore.getState();
  expect(saved.projects).toEqual(expected);
  expect(saved.getProject(existing.id)).toEqual(prior);
  saved.undo(project.id);
  expect(saved.getProject(project.id)!.houseConfigJson).toBe(project.houseConfigJson);
  saved.redo(project.id);
  expect(saved.getProject(project.id)!.houseConfigJson).toBe(json);
  expect(saved.deleteProject(project.id)).toBe(true);
  await reloaded.useProjectStore.persist.rehydrate();
  expect(reloaded.useProjectStore.getState().projects).toEqual([prior]);
});

it('leaves the previous durable snapshot intact when even compressed storage is unavailable', async () => {
  const { projectStorage, readProjectStorage } = await import('../projectStorage');
  const previous = '{"state":{"projects":[]},"version":6}';
  const error = new DOMException('The quota has been exceeded.', 'QuotaExceededError');
  const storage = { getItem: () => previous, setItem: vi.fn(() => { throw error; }) };
  vi.stubGlobal('window', { localStorage: storage });
  expect(() => projectStorage.setItem('projects', 'new snapshot')).toThrow(error);
  expect(readProjectStorage('projects')).toBe(previous);
});

it('does not disguise permission errors as storage quota errors', async () => {
  const { projectStorage } = await import('../projectStorage');
  const error = new DOMException('Storage is blocked.', 'SecurityError');
  const storage = { getItem: () => null, setItem: vi.fn(() => { throw error; }) };
  vi.stubGlobal('window', { localStorage: storage });
  expect(() => projectStorage.setItem('projects', 'new snapshot')).toThrow(error);
  expect(storage.setItem).toHaveBeenCalledTimes(1);
});
