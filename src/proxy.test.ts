import { readdirSync } from 'node:fs';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { afterEach, expect, it, vi } from 'vitest';
import { config, proxy } from './proxy';

afterEach(() => vi.unstubAllEnvs());

it('covers every administrative route, including future nested endpoints', () => {
  const routes = readdirSync(new URL('./app/api/admin/', import.meta.url), { recursive: true })
    .filter((name): name is string => typeof name === 'string' && name.endsWith('route.ts'));
  expect(routes.length).toBeGreaterThan(0);
  for (const route of [...routes.map(name => `/api/admin/${name.slice(0, -8)}`), '/api/admin', '/api/admin/future/nested']) {
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: route }), route).toBe(true);
  }
  expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: '/api/ai/scene' })).toBe(false);
});

it('disables admin requests in production before handlers can access data', () => {
  vi.stubEnv('NODE_ENV', 'production');
  const response = proxy();
  expect(response.status).toBe(404);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(response.headers.get('x-middleware-next')).toBeNull();
});

it('also fails closed on Vercel and preserves local development access', () => {
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('VERCEL', '1');
  expect(proxy().status).toBe(404);
  vi.stubEnv('VERCEL', '');
  expect(proxy().headers.get('x-middleware-next')).toBe('1');
});
