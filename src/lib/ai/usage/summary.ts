import type { AiUsageRecord } from "./types";

export interface Bucket {
  key: string;
  requests: number;
  costUsd: number;
  totalTokens: number;
}

export interface UsageSummary {
  spendToday: number;
  spendMonth: number;
  totalRequests: number;
  successRate: number | null;
  avgCostPerRequest: number | null;
  avgTokensPerRequest: number | null;
  /** Requests whose model had no configured price; their cost is unknown and excluded from spend. */
  unpricedRequests: number;
  byModel: Bucket[];
  byRequestType: Bucket[];
  byProject: Bucket[];
}

export const NO_PROJECT = "(no project)";

function bucketBy(records: AiUsageRecord[], keyOf: (r: AiUsageRecord) => string): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const r of records) {
    const key = keyOf(r);
    const b = map.get(key) ?? { key, requests: 0, costUsd: 0, totalTokens: 0 };
    b.requests += 1;
    b.costUsd += r.costUsd ?? 0;
    b.totalTokens += r.totalTokens;
    map.set(key, b);
  }
  return [...map.values()].sort((a, b) => b.costUsd - a.costUsd || b.requests - a.requests);
}

/** "Today" and "this month" are in the viewer's timezone (`tzOffsetMinutes` as from Date#getTimezoneOffset). */
export function summarizeUsage(records: AiUsageRecord[], now: Date = new Date(), tzOffsetMinutes = 0): UsageSummary {
  const shift = (d: Date) => new Date(d.getTime() - tzOffsetMinutes * 60_000);
  const local = shift(now);
  const day = local.toISOString().slice(0, 10);
  const month = local.toISOString().slice(0, 7);

  let spendToday = 0;
  let spendMonth = 0;
  let successes = 0;
  let tokens = 0;
  let pricedCost = 0;
  let priced = 0;
  for (const r of records) {
    const at = shift(new Date(r.timestamp)).toISOString();
    if (r.costUsd !== null) {
      priced += 1;
      pricedCost += r.costUsd;
      if (at.startsWith(month)) spendMonth += r.costUsd;
      if (at.startsWith(day)) spendToday += r.costUsd;
    }
    if (r.success) successes += 1;
    tokens += r.totalTokens;
  }
  const total = records.length;
  return {
    spendToday,
    spendMonth,
    totalRequests: total,
    successRate: total ? successes / total : null,
    avgCostPerRequest: priced ? pricedCost / priced : null,
    avgTokensPerRequest: total ? tokens / total : null,
    unpricedRequests: total - priced,
    byModel: bucketBy(records, (r) => r.model),
    byRequestType: bucketBy(records, (r) => r.requestType),
    byProject: bucketBy(records, (r) => r.projectId ?? NO_PROJECT),
  };
}
