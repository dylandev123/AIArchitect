import { describe, expect, it, vi } from "vitest";
import { createModelCache } from "../modelCache";

describe("model cache", () => {
  it("loads each key once however often, and however concurrently, it is requested", async () => {
    const loader = vi.fn(async (key: string) => ({ key }));
    const cache = createModelCache(loader);
    const [a, b] = await Promise.all([cache.load("g1"), cache.load("g1")]);
    const c = await cache.load("g1");
    expect(loader).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(a).toBe(c);
    expect(cache.status("g1")).toBe("ready");
    expect(cache.peek("g1")).toBe(a);
    expect(cache.stats()).toEqual({ loads: 1, hits: 2, failures: 0 });
  });

  it("remembers a failure instead of retrying every render, and reports it once", async () => {
    const onFailed = vi.fn();
    const loader = vi.fn(async () => { throw new Error("corrupt"); });
    const cache = createModelCache(loader, { onFailed });
    expect(await cache.load("bad")).toBeNull();
    expect(await cache.load("bad")).toBeNull();
    expect(loader).toHaveBeenCalledTimes(1);
    expect(onFailed).toHaveBeenCalledTimes(1);
    expect(onFailed).toHaveBeenCalledWith("bad", "corrupt");
    expect(cache.status("bad")).toBe("failed");
    expect(cache.error("bad")).toBe("corrupt");
  });

  it("reloads after invalidation, and ignores a load that was invalidated mid-flight", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let n = 0;
    const cache = createModelCache(async () => { const id = ++n; if (id === 1) await gate; return id; });
    const first = cache.load("k");
    cache.invalidate("k");
    expect(cache.status("k")).toBe("idle");
    const second = await cache.load("k");
    release();
    await first;
    expect(cache.peek("k")).toBe(second);
    expect(cache.status("k")).toBe("ready");
  });

  it("notifies subscribers as status changes", async () => {
    const cache = createModelCache(async () => 1);
    const listener = vi.fn();
    const off = cache.subscribe(listener);
    const v0 = cache.version();
    await cache.load("k");
    expect(cache.version()).toBeGreaterThan(v0);
    expect(listener).toHaveBeenCalled();
    off();
    listener.mockClear();
    cache.invalidate("k");
    expect(listener).not.toHaveBeenCalled();
  });
});
