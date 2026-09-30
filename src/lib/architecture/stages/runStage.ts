import type { z } from "zod";
import { generateText, NoObjectGeneratedError, Output, parsePartialJson, TypeValidationError } from "ai";
import { AI_PROVIDER_OPTIONS, getAiModel } from "@/lib/ai/model";
import { withUsageLogging, type UsageMeta } from "@/lib/ai/usage/track";
import type { Timings } from "@/lib/ai/timing";

const isDev = process.env.NODE_ENV !== "production";

/**
 * `generateText` with `Output.object` validates the model's JSON against the schema internally and throws
 * `NoObjectGeneratedError` *before* ever returning — so "the model produced JSON that failed the schema"
 * (by far the most common failure here) never reaches our own `schema.safeParse` below, it lands here. Its
 * `cause` is a `TypeValidationError` carrying the actual zod issues (which field, why) and — critically —
 * the raw value the model produced, so a caller can salvage whichever fields did validate instead of
 * discarding the whole response. Without unwrapping this, `error.message` is just the generic
 * "No object generated: response did not match schema." with no field-level detail at all, so a repair
 * retry has nothing to correct and reliably fails the same way twice.
 */
async function describeGenerationError(error: unknown): Promise<{ message: string; rawValue?: unknown; truncated?: boolean }> {
  if (NoObjectGeneratedError.isInstance(error)) {
    const cause = error.cause;
    const truncated = error.finishReason === "length";
    const truncationNote = truncated ? " (output was cut off at the token limit)" : "";
    if (TypeValidationError.isInstance(cause)) {
      const issues = (cause.cause as { issues?: { path: PropertyKey[]; message: string }[] } | undefined)?.issues;
      const detail = issues?.length ? issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") : cause.message;
      return { message: `${error.message}${truncationNote} ${detail}`, rawValue: cause.value, truncated };
    }
    // "Could not parse the response": the text never became JSON at all — almost always a response cut off
    // mid-object by the output-token limit, occasionally one wrapped in prose or a code fence. Either way most
    // of it is usually fine, so it's recovered here (fixing up unclosed brackets/strings) instead of being
    // discarded outright — a caller's `normalize`/salvage can still use every entry that came through whole.
    const recovered = await recoverJsonText(error.text);
    return { message: `${error.message}${truncationNote}`, ...(recovered ? { rawValue: recovered.value, truncated: truncated || recovered.repaired } : { truncated }) };
  }
  return { message: error instanceof Error ? error.message : String(error) };
}

/** Parses possibly-truncated or prose-wrapped JSON text; `repaired` = brackets/strings had to be closed, i.e. the tail of the value is missing. */
async function recoverJsonText(text: string | undefined): Promise<{ value: unknown; repaired: boolean } | undefined> {
  if (!text) return undefined;
  const start = text.indexOf("{");
  if (start === -1) return undefined;
  const { value, state } = await parsePartialJson(text.slice(start).replace(/```\s*$/, ""));
  if (value === undefined || (state !== "successful-parse" && state !== "repaired-parse")) return undefined;
  return { value, repaired: state === "repaired-parse" };
}

/**
 * One bounded, schema-validated model call for one pipeline stage, with the same repair-retry shape
 * `generateInitialDesign` already uses for the legacy single-call path: attempt → validate → feed
 * errors back as a new message → retry once. Every stage call shares this so the budget/backoff logic
 * is written once, not five times.
 */
export interface RunStageInput<T> {
  stageName: string;
  system: string;
  /** Builds the user message for one attempt; `previousErrors` is empty on the first attempt. */
  buildMessage: (previousErrors: readonly string[]) => string;
  schema: z.ZodType<T>;
  timings: Timings;
  /** Remaining ms in the whole generation's budget, checked before each attempt. */
  remainingBudgetMs: number;
  usageMeta: UsageMeta;
  /** Extra semantic checks beyond the schema; returning any errors triggers a repair retry. */
  validate?: (value: T) => string[];
  /**
   * Runs on every raw response BEFORE our strict schema parse — including the raw value recovered from the
   * SDK's own schema rejection (`NoObjectGeneratedError`). Fixes up an otherwise-usable response — e.g.
   * clamping a harmless out-of-range number or truncating an overlong array — so a structurally sound answer
   * never burns a repair-retry model call. Must be idempotent and must not paper over structural faults: the
   * normalized value still goes through the full schema and `validate`, and their errors drive any retry.
   */
  normalize?: (raw: unknown) => unknown;
  maxAttempts?: number;
  maxOutputTokens?: number;
}

/**
 * `attempts` is the actual number of model calls this stage made (1 = no retry); `durationMs` is their
 * combined wall-clock time. Dev/debug tooling reads these to trace where pipeline time and cost go — never
 * required by rendering. `rawValue` (failure only) is the raw object from the last attempt if one was ever
 * recovered — the model's schema-invalid JSON (via `NoObjectGeneratedError`'s cause), JSON recovered from
 * text that failed to parse, or a value that parsed but failed semantic `validate` — so a caller can salvage
 * individual valid fields field-by-field instead of discarding the whole response. `rawValueTruncated` means
 * that value was cut off (token limit) and had to be closed up, so its LAST element may be incomplete.
 */
export type RunStageResult<T> =
  | { ok: true; value: T; attempts: number; durationMs: number }
  | { ok: false; errors: string[]; attempts: number; durationMs: number; rawValue?: unknown; rawValueTruncated?: boolean };

type Checked<T> = { ok: true; value: T } | { ok: false; errors: string[]; issues?: unknown };

/** Normalizes (if the stage has a normalizer) THEN strictly validates: schema first, then semantic `validate`. */
function normalizeAndCheck<T>(input: RunStageInput<T>, raw: unknown): Checked<T> {
  const parsed = input.schema.safeParse(input.normalize ? input.normalize(raw) : raw);
  if (!parsed.success) return { ok: false, errors: [`Response didn't match the expected shape: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`], issues: parsed.error.issues };
  const semanticErrors = input.validate?.(parsed.data) ?? [];
  return semanticErrors.length ? { ok: false, errors: semanticErrors } : { ok: true, value: parsed.data };
}

export async function runStage<T>(input: RunStageInput<T>): Promise<RunStageResult<T>> {
  const maxAttempts = input.maxAttempts ?? 2;
  let errors: string[] = [];
  let rawValue: unknown;
  let rawValueTruncated = false;
  // Grows only after a response was cut off at the limit: a repair retry at the same budget would just be cut off again.
  let maxOutputTokens = input.maxOutputTokens ?? 1200;
  let lastAttemptMs = 0;
  let totalMs = 0;
  let attempts = 0;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const remainingMs = input.remainingBudgetMs - input.timings.elapsed();
    if (attempt > 0 && remainingMs < lastAttemptMs * 1.3) {
      return { ok: false, errors: [...errors, "Ran out of time budget for a repair attempt."], attempts, durationMs: totalMs, rawValue, rawValueTruncated };
    }
    if (remainingMs < 1_000) return { ok: false, errors: [...errors, "Ran out of time budget."], attempts, durationMs: totalMs, rawValue, rawValueTruncated };
    const callStart = performance.now();
    attempts++;
    try {
      const { output } = await input.timings.timeAsync(`${input.stageName}#${attempt + 1}`, () =>
        withUsageLogging(input.usageMeta, () =>
          generateText({
            model: getAiModel(),
            maxOutputTokens,
            system: input.system,
            messages: [{ role: "user", content: input.buildMessage(errors) }],
            output: Output.object({ schema: input.schema }),
            providerOptions: AI_PROVIDER_OPTIONS,
            abortSignal: AbortSignal.timeout(Math.max(Math.floor(remainingMs), 1_000)),
            maxRetries: 1,
          })
        )
      );
      lastAttemptMs = performance.now() - callStart;
      totalMs += lastAttemptMs;
      // Parsed explicitly rather than trusting the provider/SDK enforced it: a defense-in-depth check, not a
      // duplicate of `output: Output.object({schema})` — it also protects against a test double or provider
      // quirk returning a value that was never actually schema-checked. In practice `generateText` itself
      // already throws `NoObjectGeneratedError` (caught below) before returning anything schema-invalid, so
      // this branch rarely fires against the real provider.
      const checked = normalizeAndCheck(input, output);
      if (checked.ok) return { ok: true, value: checked.value, attempts, durationMs: totalMs };
      rawValue = output;
      rawValueTruncated = false;
      errors = checked.errors;
      if (isDev) console.debug(`[${input.stageName}] attempt ${attempt + 1} failed validation after normalization`, { rawValue, errors, issues: checked.issues });
    } catch (error) {
      lastAttemptMs = performance.now() - callStart;
      totalMs += lastAttemptMs;
      const described = await describeGenerationError(error);
      // A truncated value is never accepted whole, even if it happens to validate: its tail is missing.
      // The SDK rejected the raw value with the strict schema; normalize it before re-validating ourselves. If it
      // still fails, retry with the errors that remain AFTER normalization, never the range slips it already fixed.
      const checked = input.normalize && described.rawValue !== undefined && !described.truncated ? normalizeAndCheck(input, described.rawValue) : undefined;
      if (checked?.ok) return { ok: true, value: checked.value, attempts, durationMs: totalMs };
      errors = described.truncated ? [`${described.message} Keep the response compact: omit optional fields you don't need.`] : checked ? checked.errors : [described.message];
      if (described.truncated) maxOutputTokens = Math.round(maxOutputTokens * 1.6);
      if (described.rawValue !== undefined) { rawValue = described.rawValue; rawValueTruncated = described.truncated === true; }
      if (isDev) console.debug(`[${input.stageName}] attempt ${attempt + 1} threw`, { message: described.message, rawValue: described.rawValue });
    }
  }
  return { ok: false, errors, attempts, durationMs: totalMs, rawValue, rawValueTruncated };
}
