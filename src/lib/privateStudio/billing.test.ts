/** Category-aware settlement: cache-write tokens are priced correctly and the US$1.40 ceiling holds for every usage mix (offline). */
import {expect, it} from 'vitest';
import {computeCostUsd, DEFAULT_PRICING} from '@/lib/ai/pricing';
import {LIVE_POLICY, POLICY_HASH, budgetRates, maxInputRate, officialRates, reservationMicros, settleUsage, stageOutputTokens} from './policy';

const P = LIVE_POLICY, STAGES = [1, 2, 3, 4, 5] as const;
const usage = (input: number, read: number, write: number, output: number) => ({inputTokens: input, outputTokens: output, inputTokenDetails: {noCacheTokens: input - read - write, cacheReadTokens: read, cacheWriteTokens: write}});
/** What OpenAI bills at its published GPT-5.6 Terra rates (US$2 / 0.20 cached / 2.50 cache write / 12 output per M). */
const trueBill = (input: number, read: number, write: number, output: number) => (input - read - write) * 2 + read * .2 + write * 2.5 + output * 12;

it('keeps the approved policy, its hash and every reservation amount unchanged', () => {
  expect(POLICY_HASH).toBe('ec714f66c0c9316d36893162bec25f847059ac6dce72f522029e10c98a039b70');
  expect(DEFAULT_PRICING[P.model]).toEqual({input: 2, cachedInput: .2, output: 12, cacheWrite: 2.5});
  expect(maxInputRate(P)).toBe(2.5);
  // Same arithmetic as before the fix: (bytes + margin) x 2.50 + stage cap x 15.
  for (const stage of STAGES) for (const bytes of [1, 19066, P.maxWireBytes]) expect(reservationMicros(P, bytes, stage)).toBe(Math.ceil((bytes + P.inputTokenMargin) * 2.5 + stageOutputTokens(P, stage) * 15));
});

it('prices each reported category at its own rate: billed estimate at published rates, budget charge never below it', () => {
  const s = settleUsage(P, usage(10_000, 2_000, 3_000, 1_000))!;
  expect(s.billedMicros).toBe(Math.ceil(5_000 * 2 + 2_000 * .2 + 3_000 * 2.5 + 1_000 * 12));
  expect(s.chargeMicros).toBe(Math.ceil(5_000 * 2.5 + 2_000 * .25 + 3_000 * 2.5 + 1_000 * 15));
  // The historical underestimate: cache-write tokens priced at the plain US$2 input rate.
  expect(Math.ceil(computeCostUsd(P.model, {inputTokens: 1048, cachedInputTokens: 0, outputTokens: 1339}, {[P.model]: {input: 2, cachedInput: .2, output: 12}})! * 1e6)).toBe(18164);
  expect(settleUsage(P, usage(1048, 0, 1045, 1339))!.billedMicros).toBe(Math.ceil(3 * 2 + 1045 * 2.5 + 1339 * 12));
  expect(computeCostUsd(P.model, {inputTokens: 1048, cachedInputTokens: 0, cacheWriteInputTokens: 1045, outputTokens: 1339})).toBeCloseTo((3 * 2 + 1045 * 2.5 + 1339 * 12) / 1e6, 12);
});

it('for every mix of plain, cached, cache-write and output tokens: true bill <= estimate <= charge <= reservation', () => {
  const f = [0, .1, .25, .5, .75, .9, 1];
  for (const stage of STAGES) for (const bytes of [1, 4000, 19066, P.maxWireBytes]) {
    const r = reservationMicros(P, bytes, stage), maxIn = bytes + P.inputTokenMargin, maxOut = stageOutputTokens(P, stage);
    for (const fin of f) for (const fr of f) for (const fw of f) for (const fout of f) {
      const input = Math.floor(maxIn * fin), read = Math.floor(input * fr), write = Math.floor((input - read) * fw), output = Math.floor(maxOut * fout);
      const s = settleUsage(P, usage(input, read, write, output))!;
      expect(trueBill(input, read, write, output)).toBeLessThanOrEqual(s.billedMicros);
      expect(s.billedMicros).toBeLessThanOrEqual(s.chargeMicros);
      expect(s.chargeMicros).toBeLessThanOrEqual(r);
    }
  }
});

it('never under-prices a missing or inconsistent cache split', () => {
  const worst = (input: number, output: number) => Math.ceil(input * maxInputRate(P) + output * 15);
  expect(settleUsage(P, {inputTokens: 4000, outputTokens: 500})!.chargeMicros).toBe(worst(4000, 500));
  // Reported cache read, unreported cache write: read at the cached rate, the rest at the highest non-cached rate.
  expect(settleUsage(P, {inputTokens: 4000, outputTokens: 500, inputTokenDetails: {cacheReadTokens: 100}})!.chargeMicros).toBe(Math.ceil(100 * .25 + 3900 * 2.5 + 500 * 15));
  expect(settleUsage(P, {inputTokens: 4000, outputTokens: 500, inputTokenDetails: {cacheReadTokens: 100}})!.billedMicros).toBe(Math.ceil(100 * .2 + 3900 * 2.5 + 500 * 12));
  expect(settleUsage(P, usage(4000, 3000, 3000, 500))!.chargeMicros).toBe(worst(4000, 500));
  expect(settleUsage(P, {inputTokens: 4000, outputTokens: 500, inputTokenDetails: {cacheReadTokens: -1, cacheWriteTokens: 0}})!.chargeMicros).toBe(worst(4000, 500));
  // Billed estimate in that case uses the highest published input rate (cache write, US$2.50).
  expect(settleUsage(P, {inputTokens: 4000, outputTokens: 500})!.billedMicros).toBe(Math.ceil(4000 * 2.5 + 500 * 12));
  for (const bad of [undefined, {}, {inputTokens: 10}, {outputTokens: 10}, {inputTokens: NaN, outputTokens: 1}, {inputTokens: -1, outputTokens: 1}]) expect(settleUsage(P, bad)).toBeUndefined();
});

it('across a full ten-call run with any usage mix, admission against settled charges keeps the true bill within US$1.40', () => {
  let seed = 7;
  const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  for (let trial = 0; trial < 2000; trial++) {
    let charged = 0, billed = 0;
    for (let i = 0; i < 10; i++) {
      const stage = STAGES[i % 5], bytes = Math.floor(1000 + rand() * (P.maxWireBytes - 1000)), r = reservationMicros(P, bytes, stage);
      if (charged + r > P.maxCostMicros) break; // the service refuses; nothing is sent
      const maxIn = bytes + P.inputTokenMargin, input = Math.floor(maxIn * rand()), read = Math.floor(input * rand()), write = Math.floor((input - read) * rand()), output = Math.floor(stageOutputTokens(P, stage) * rand());
      charged += settleUsage(P, usage(input, read, write, output))!.chargeMicros;
      billed += trueBill(input, read, write, output);
    }
    expect(billed).toBeLessThanOrEqual(charged);
    expect(charged).toBeLessThanOrEqual(P.maxCostMicros);
  }
});

it('budget rates follow published prices upward if they ever exceed the conservative policy rates', () => {
  const o = officialRates(P), b = budgetRates(P);
  for (const k of ['input', 'cachedInput', 'cacheWrite', 'output'] as const) expect(b[k]).toBeGreaterThanOrEqual(o[k]);
  expect(b).toEqual({input: 2.5, cachedInput: .25, cacheWrite: 2.5, output: 15});
});
