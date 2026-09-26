/** USD per 1M tokens. */
export interface ModelPricing {
  input: number;
  cachedInput: number;
  output: number;
}

/**
 * The one place model prices live. Edit here for a permanent change, or set AI_PRICING_JSON
 * (e.g. '{"gpt-x":{"input":1,"cachedInput":0.1,"output":6}}') to add/override models without a code change.
 * Costs are computed when a request is logged, so changing a rate never rewrites past records.
 */
export const DEFAULT_PRICING: Record<string, ModelPricing> = {
  "gpt-5.6-terra": { input: 2, cachedInput: 0.2, output: 12 },
  "gpt-5.6-luna": { input: 0.2, cachedInput: 0.02, output: 1.2 },
};

const isRate = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0;

/** Parses an AI_PRICING_JSON override; malformed input or entries are ignored rather than throwing. */
export function parsePricingOverride(raw: string | undefined): Record<string, ModelPricing> {
  if (!raw?.trim()) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
  const out: Record<string, ModelPricing> = {};
  for (const [model, p] of Object.entries(parsed)) {
    const r = p as Partial<ModelPricing> | null;
    if (r && isRate(r.input) && isRate(r.cachedInput) && isRate(r.output)) {
      out[model] = { input: r.input, cachedInput: r.cachedInput, output: r.output };
    }
  }
  return out;
}

export function getPricingTable(env: string | undefined = process.env.AI_PRICING_JSON): Record<string, ModelPricing> {
  return { ...DEFAULT_PRICING, ...parsePricingOverride(env) };
}

export interface TokenUsage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}

/**
 * Cost in USD, or null when the model has no configured price (so unpriced usage is reported
 * as unknown instead of silently counting as $0). `inputTokens` includes the cached portion,
 * as OpenAI reports it, so cached tokens are billed at the cached rate and only the rest at the full rate.
 */
export function computeCostUsd(
  model: string,
  usage: TokenUsage,
  table: Record<string, ModelPricing> = getPricingTable()
): number | null {
  const price = table[model];
  if (!price) return null;
  const cached = Math.min(Math.max(usage.cachedInputTokens, 0), usage.inputTokens);
  const uncached = usage.inputTokens - cached;
  return (uncached * price.input + cached * price.cachedInput + usage.outputTokens * price.output) / 1_000_000;
}
