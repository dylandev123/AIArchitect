"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useAdminStore } from "@/store/useAdminStore";
import type { ModelPricing } from "@/lib/ai/pricing";
import type { Bucket, UsageSummary } from "@/lib/ai/usage/summary";
import type { AiUsageRecord } from "@/lib/ai/usage/types";

interface UsageResponse {
  summary: UsageSummary;
  recent: AiUsageRecord[];
  pricing: Record<string, ModelPricing>;
}

const usd = (n: number | null, digits = 4) => (n === null ? "—" : `$${n.toFixed(digits)}`);
const int = (n: number | null) => (n === null ? "—" : Math.round(n).toLocaleString());
const TYPE_LABEL: Record<string, string> = { generation: "Generation", scoped_edit: "Scoped edit", learn: "Learn" };

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-neutral-100">{value}</p>
      {note && <p className="text-[10px] text-neutral-600">{note}</p>}
    </div>
  );
}

function BucketTable({ title, rows, label = (k: string) => k }: { title: string; rows: Bucket[]; label?: (k: string) => string }) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.03] p-3">
      <p className="mb-2 text-xs font-medium text-neutral-300">{title}</p>
      {rows.length === 0 ? (
        <p className="text-xs text-neutral-600">No data yet.</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase text-neutral-600">
              <th className="pb-1 font-medium">Name</th>
              <th className="pb-1 text-right font-medium">Reqs</th>
              <th className="pb-1 text-right font-medium">Tokens</th>
              <th className="pb-1 text-right font-medium">Spend</th>
            </tr>
          </thead>
          <tbody className="text-neutral-300">
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="max-w-[10rem] truncate py-0.5 pr-2" title={r.key}>{label(r.key)}</td>
                <td className="text-right tabular-nums">{r.requests}</td>
                <td className="text-right tabular-nums">{int(r.totalTokens)}</td>
                <td className="text-right tabular-nums">{usd(r.costUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function UsageTab() {
  const adminEmail = useAdminStore((s) => s.adminEmail);
  const [data, setData] = useState<UsageResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/usage?tz=${new Date().getTimezoneOffset()}`, {
          headers: { "x-admin-email": adminEmail },
          cache: "no-store",
        });
        if (!res.ok) throw new Error(res.status === 401 ? "Unauthorized" : `Request failed (${res.status})`);
        const json = (await res.json()) as UsageResponse;
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load usage.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adminEmail, reloadKey]);

  const refresh = () => {
    setLoading(true);
    setError("");
    setReloadKey((k) => k + 1);
  };

  const s = data?.summary;

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-y-auto pb-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-neutral-500">Provider-reported token usage for every AI call.</p>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-neutral-400 transition hover:bg-white/8 hover:text-neutral-200 disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
      {!data && !error && <p className="text-xs text-neutral-500">Loading…</p>}

      {data && s && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Spend today" value={usd(s.spendToday, 2)} />
            <Stat label="Spend this month" value={usd(s.spendMonth, 2)} />
            <Stat label="Total requests" value={int(s.totalRequests)} />
            <Stat label="Avg cost / request" value={usd(s.avgCostPerRequest)} />
            <Stat label="Avg tokens / request" value={int(s.avgTokensPerRequest)} />
            <Stat label="Success rate" value={s.successRate === null ? "—" : `${(s.successRate * 100).toFixed(1)}%`} />
          </div>

          {s.unpricedRequests > 0 && (
            <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              {s.unpricedRequests} request(s) used a model with no configured price, so their cost is excluded. Add it to
              DEFAULT_PRICING in src/lib/ai/pricing.ts or set AI_PRICING_JSON.
            </p>
          )}

          <div className="grid gap-3 md:grid-cols-3">
            <BucketTable title="Spend by model" rows={s.byModel} />
            <BucketTable title="Spend by request type" rows={s.byRequestType} label={(k) => TYPE_LABEL[k] ?? k} />
            <BucketTable title="Per-project usage" rows={s.byProject} />
          </div>

          <div className="rounded-lg border border-white/8 bg-white/[0.03] p-3">
            <p className="mb-2 text-xs font-medium text-neutral-300">Recent requests</p>
            {data.recent.length === 0 ? (
              <p className="text-xs text-neutral-600">No AI requests logged yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap text-xs">
                  <thead>
                    <tr className="text-left text-[10px] uppercase text-neutral-600">
                      {["Time", "Project", "Type", "Scope", "Model", "In", "Cached", "Out", "Total", "Latency", "Status", "Cost"].map((h) => (
                        <th key={h} className="pb-1 pr-3 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-neutral-300">
                    {data.recent.map((r) => (
                      <tr key={r.id}>
                        <td className="py-0.5 pr-3">{new Date(r.timestamp).toLocaleString()}</td>
                        <td className="max-w-[8rem] truncate pr-3" title={r.projectId ?? ""}>{r.projectId ?? "—"}</td>
                        <td className="pr-3">{TYPE_LABEL[r.requestType] ?? r.requestType}</td>
                        <td className="pr-3">{r.scope}</td>
                        <td className="pr-3">{r.model}</td>
                        <td className="pr-3 tabular-nums">{int(r.inputTokens)}</td>
                        <td className="pr-3 tabular-nums">{int(r.cachedInputTokens)}</td>
                        <td className="pr-3 tabular-nums">{int(r.outputTokens)}</td>
                        <td className="pr-3 tabular-nums">{int(r.totalTokens)}</td>
                        <td className="pr-3 tabular-nums">{(r.latencyMs / 1000).toFixed(1)}s</td>
                        <td className={`pr-3 ${r.success ? "text-emerald-400" : "text-red-400"}`}>
                          {r.success ? "OK" : (r.errorKind ?? "Failed")}
                        </td>
                        <td className="tabular-nums">{usd(r.costUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-white/8 bg-white/[0.03] p-3">
            <p className="mb-2 text-xs font-medium text-neutral-300">Pricing (USD per 1M tokens)</p>
            <table className="w-full text-xs text-neutral-300">
              <thead>
                <tr className="text-left text-[10px] uppercase text-neutral-600">
                  <th className="pb-1 font-medium">Model</th>
                  <th className="pb-1 text-right font-medium">Input</th>
                  <th className="pb-1 text-right font-medium">Cached input</th>
                  <th className="pb-1 text-right font-medium">Output</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.pricing).map(([model, p]) => (
                  <tr key={model}>
                    <td className="py-0.5">{model}</td>
                    <td className="text-right tabular-nums">${p.input}</td>
                    <td className="text-right tabular-nums">${p.cachedInput}</td>
                    <td className="text-right tabular-nums">${p.output}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
