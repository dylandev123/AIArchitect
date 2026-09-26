/** Accumulates named wall-clock durations (ms) for one request; a stage timed twice adds up. */
export interface Timings {
  /** Runs `fn`, adding its duration to `stage` even if it throws. */
  time<T>(stage: string, fn: () => T): T;
  /** Same as `time` for an async `fn`. */
  timeAsync<T>(stage: string, fn: () => Promise<T>): Promise<T>;
  /** Milliseconds since the timer started. */
  elapsed(): number;
  /** Stage durations in ms, rounded. */
  snapshot(): Record<string, number>;
}

export function createTimings(): Timings {
  const start = performance.now();
  const stages = new Map<string, number>();
  const add = (stage: string, t0: number) => stages.set(stage, (stages.get(stage) ?? 0) + performance.now() - t0);
  return {
    time(stage, fn) {
      const t0 = performance.now();
      try {
        return fn();
      } finally {
        add(stage, t0);
      }
    },
    async timeAsync(stage, fn) {
      const t0 = performance.now();
      try {
        return await fn();
      } finally {
        add(stage, t0);
      }
    },
    elapsed: () => performance.now() - start,
    snapshot: () => Object.fromEntries([...stages].map(([k, v]) => [k, Math.round(v)])),
  };
}

/** One structured line per request, greppable in the host's logs. */
export function logTimings(label: string, timings: Timings, extra: Record<string, unknown> = {}) {
  console.info(`[AI timing] ${label}`, JSON.stringify({ ...extra, totalMs: Math.round(timings.elapsed()), stagesMs: timings.snapshot() }));
}
