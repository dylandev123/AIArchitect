import { readdirSync } from 'node:fs';
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { NextRequest } from 'next/server';
import { afterEach, expect, it, vi } from 'vitest';
import { config, proxy } from './proxy';

afterEach(() => vi.unstubAllEnvs());

const req = (path: string) => new NextRequest(`http://localhost${path}`);

it('covers every administrative route, including future nested endpoints', () => {
  const routes = readdirSync(new URL('./app/api/admin/', import.meta.url), { recursive: true })
    .filter((name): name is string => typeof name === 'string' && name.endsWith('route.ts'));
  expect(routes.length).toBeGreaterThan(0);
  for (const route of [...routes.map(name => `/api/admin/${name.slice(0, -8)}`), '/api/admin', '/api/admin/future/nested']) {
    expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: route }), route).toBe(true);
  }
  expect(unstable_doesMiddlewareMatch({ config, nextConfig: {}, url: '/api/ai/scene' })).toBe(true);
});

it('disables admin requests in production before handlers can access data', () => {
  vi.stubEnv('NODE_ENV', 'production');
  const response = proxy(req('/api/admin/usage'));
  expect(response.status).toBe(404);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(response.headers.get('x-middleware-next')).toBeNull();
});

it('also blocks legacy admin routes on Vercel and local development', () => {
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('VERCEL', '1');
  expect(proxy(req('/api/admin/usage')).status).toBe(404);
  vi.stubEnv('VERCEL', '');
  expect(proxy(req('/api/admin/usage')).status).toBe(404);
});

it('lets only the email login check through in production', () => {
  vi.stubEnv('NODE_ENV', 'production');
  expect(proxy(req('/api/admin/check')).headers.get('x-middleware-next')).toBe('1');
  expect(proxy(req('/api/admin/library')).status).toBe(404);
});

it("blocks paid AI execution even with a spoofed admin header", () => {
 const request=new NextRequest("http://localhost/api/ai/scene",{headers:{"x-admin-email":"dylandevaux3@gmail.com"}});
 expect(proxy(request).status).toBe(403);
 expect(proxy(req("/api/ai/future-paid-route")).status).toBe(403);
});

it('keeps public AI routes blocked unless LEGACY_AI_ROUTES is explicitly enabled', () => {
  vi.stubEnv('NODE_ENV', 'production');
  expect(proxy(req('/api/ai/scene')).status).toBe(403);
  vi.stubEnv('LEGACY_AI_ROUTES', 'enabled');
  expect(proxy(req('/api/ai/scene')).headers.get('x-middleware-next')).toBe('1');
  expect(proxy(req('/api/admin/usage')).status).toBe(404);
});
