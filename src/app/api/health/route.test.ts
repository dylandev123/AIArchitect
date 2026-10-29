import { afterEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ query: vi.fn(), connect: vi.fn(), end: vi.fn() }));
vi.mock('pg', () => ({ Client: class { connect = state.connect; query = state.query; end = state.end; } }));
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.resetModules(); });

it('uses a read-only transaction and exposes no database diagnostics or credentials', async () => {
  vi.stubEnv('DATABASE_URL', 'postgresql://test:private@db.example/neondb');
  vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'verified-commit');
  state.connect.mockResolvedValue(undefined);
  state.end.mockResolvedValue(undefined);
  state.query.mockImplementation(async (sql: string) => ({ rows: sql.includes('count(*)') ? [{ count: 0 }] : [] }));
  const log = vi.spyOn(console, 'info').mockImplementation(() => {});
  const { GET } = await import('./route');
  const response = await GET();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true, commit: 'verified-commit' });
  expect(state.query.mock.calls.map(([sql]) => sql)).toEqual([
    'BEGIN READ ONLY', "SET LOCAL statement_timeout = '5s'",
    "SELECT kind, data FROM library_docs WHERE kind IN ('architecturalKnowledge', 'recipe') LIMIT 5001",
    "SELECT count(*)::int AS count FROM library_docs WHERE kind = 'designLesson'", 'ROLLBACK',
  ]);
  expect(JSON.stringify(log.mock.calls)).not.toContain('private');
  expect(JSON.stringify(log.mock.calls)).not.toContain('db.example');
  await GET();
  expect(state.connect).toHaveBeenCalledTimes(1);
  expect(state.end).toHaveBeenCalledTimes(1);
});

it('reports an unavailable database without leaking errors and still closes the connection', async () => {
  vi.stubEnv('DATABASE_URL', 'postgresql://test:private@db.example/neondb');
  state.connect.mockRejectedValueOnce(Error('private connection details'));
  state.query.mockResolvedValue({ rows: [] });
  state.end.mockResolvedValue(undefined);
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const { GET } = await import('./route');
  const response = await GET();
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain('private');
  expect(JSON.stringify(log.mock.calls)).not.toContain('private');
  expect(state.end).toHaveBeenCalled();
});
