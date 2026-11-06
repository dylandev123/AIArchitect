# Cache-write accounting fix (2026-11-06)

**Scope:** spending accounting only. The generator, prompts, stage contracts, correction policy, `LIVE_POLICY` and its hash (`ec714f66…`) are unchanged. The existing project, brief and single-use approval stay valid.

## Finding

OpenAI bills GPT-5.6 Terra cache-write input tokens at US$2.50 per million (1.25× plain input). Before this fix the pricing code had no cache-write category: those tokens were priced as plain input.

- **Policy v3 budget (live Studio):** settled calls were charged at the policy rates (US$2.50 input / 0.25 cached / 15 output). Cache-write tokens were charged at US$2.50, which equals the published rate. The v3 budget never under-counted; the earlier readiness note overstated this risk.
- **Historical records (earlier policies, US$2 / 12):** cache-write tokens were recorded at US$2. Total under-count is **US$0.001096** over two Stage 2 calls. See [historical-difference.json](historical-difference.json). The records were not changed.

## Change

- `pricing.ts`: optional `cacheWrite` rate (Terra US$2.50); `computeCostUsd` prices cache-write tokens separately.
- `policy.ts` `settleUsage`: each call settles from the provider's own token categories into two figures:
  - `costMicros`, the budget charge, at per-category rates that are never below the published or the policy rate;
  - `billedMicros`, an estimate of the bill at published rates.
  Token categories that are missing or inconsistent are priced at the highest applicable rate.
- Reservations price all input at the highest input rate across all categories. For v3 this is still US$2.50, so every reservation amount is identical.
- The Studio status reports `billedUsd` alongside `costUsd` (the budget charge) and `heldUsd`.

## Guarantee and tests

`billing.test.ts` checks, for every stage and request size and every mix of plain, cache-read, cache-write and output tokens, that: true bill ≤ billed estimate ≤ budget charge ≤ reservation. A further 2,000 randomized ten-call runs check that, with admission against settled charges, the true bill never exceeds US$1.40. `wire.test.ts` verifies both figures through the real settlement path.
