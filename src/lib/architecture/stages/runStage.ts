import type { z } from "zod";
import { generateText, NoObjectGeneratedError, NoOutputGeneratedError, Output, parsePartialJson, TypeValidationError } from "ai";
import { AI_PROVIDER_OPTIONS, getAiModel } from "@/lib/ai/model";
import { boundedCandidate, fingerprint } from "@/lib/ai/usage/diagnostics";
import { withUsageLogging, type UsageAssessment, type UsageMeta } from "@/lib/ai/usage/track";
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
async function describeGenerationError(error: unknown): Promise<{ message: string; rawValue?: unknown; truncated?: boolean; text?: string }> {
  // No text at all: the model spent the whole output allowance (typically on reasoning) before emitting any.
  // `readOutput` below only lets this through when the finish reason was "length" (or unknown).
  if (NoOutputGeneratedError.isInstance(error)) return { message: error.message, truncated: true };
  if (NoObjectGeneratedError.isInstance(error)) {
    const cause = error.cause;
    const truncated = error.finishReason === "length";
    const truncationNote = truncated ? " (output was cut off at the token limit)" : "";
    if (TypeValidationError.isInstance(cause)) {
      const issues = (cause.cause as { issues?: { path: PropertyKey[]; message: string }[] } | undefined)?.issues;
      const detail = issues?.length ? issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") : cause.message;
      return { message: `${error.message}${truncationNote} ${detail}`, rawValue: cause.value, truncated, text: error.text };
    }
    // "Could not parse the response": the text never became JSON at all — almost always a response cut off
    // mid-object by the output-token limit, occasionally one wrapped in prose or a code fence. Either way most
    // of it is usually fine, so it's recovered here (fixing up unclosed brackets/strings) instead of being
    // discarded outright — a caller's `normalize`/salvage can still use every entry that came through whole.
    const recovered = await recoverJsonText(error.text);
    return { message: `${error.message}${truncationNote}`, text: error.text, ...(recovered ? { rawValue: recovered.value, truncated: truncated || recovered.repaired } : { truncated }) };
  }
  return { message: error instanceof Error ? error.message : String(error) };
}

/**
 * `generateText` resolves normally when the model emitted no text, and only throws `NoOutputGeneratedError`
 * when `.output` is read. With a known finish reason other than "length" (e.g. a content filter) that is not
 * token exhaustion, so it is re-thrown as an ordinary error rather than classified as OUTPUT_TRUNCATED.
 */
function readOutput(response: { output: unknown; finishReason?: string }): unknown {
  try {
    return response.output;
  } catch (error) {
    if (NoOutputGeneratedError.isInstance(error) && response.finishReason !== undefined && response.finishReason !== "length") {
      throw new Error(`No output generated (finish reason: ${response.finishReason}).`);
    }
    throw error;
  }
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
  /** Compact, stage-owned repair errors for a raw value that failed the structural schema. */
  schemaError?: (raw: unknown) => string[];
  /**
   * Runs on every raw response BEFORE our strict schema parse — including the raw value recovered from the
   * SDK's own schema rejection (`NoObjectGeneratedError`). Fixes up an otherwise-usable response — e.g.
   * clamping a harmless out-of-range number or truncating an overlong array — so a structurally sound answer
   * never burns a repair-retry model call. Must be idempotent and must not paper over structural faults: the
   * normalized value still goes through the full schema and `validate`, and their errors drive any retry.
   */
  normalize?: (raw: unknown) => unknown;
  maxAttempts?: number;
  /** Initial output-token allowance. It grows (bounded by `TRUNCATION_GROWTH_CEILING`) only after a response exhausted it. */
  maxOutputTokens?: number;
  /** The owning stage recorded on every usage row; defaults to `stageName` (set it when `stageName` is a per-turn label). */
  usageStage?: string;
}

/**
 * Why a stage failed. OUTPUT_TRUNCATED = the last attempt exhausted its output-token allowance (cut off mid-object,
 * or no text at all) — distinct from a complete response that failed the schema or semantic validation.
 */
export type StageErrorCode = "OUTPUT_TRUNCATED" | "VALIDATION_FAILED" | "GENERATION_ERROR" | "INTERNAL_ERROR" | "TIME_BUDGET_EXHAUSTED";

/** Each truncation grows the allowance by this factor... */
export const TRUNCATION_TOKEN_GROWTH = 1.6;
/** ...but never beyond this multiple of the stage's initial allowance, however many attempts it is given. */
export const TRUNCATION_GROWTH_CEILING = 2;
/** The whole repair instruction after token exhaustion: parse/schema detail about a cut-off response is noise. */
export const OUTPUT_TRUNCATED_RETRY_INSTRUCTION = "Your previous response exhausted the output budget before completing the structured result. Return the required object directly and compactly.";

/**
 * `attempts` is the actual number of model calls this stage made (1 = no retry); `durationMs` is their
 * combined wall-clock time. Dev/debug tooling reads these to trace where pipeline time and cost go — never
 * required by rendering. `rawValue` (failure only) is the raw object from the last attempt if one was ever
 * recovered — the model's schema-invalid JSON (via `NoObjectGeneratedError`'s cause), JSON recovered from
 * text that failed to parse, or a value that parsed but failed semantic `validate` — so a caller can salvage
 * individual valid fields field-by-field instead of discarding the whole response. `rawValueTruncated` means
 * that value was cut off (token limit) and had to be closed up, so its LAST element may be incomplete.
 * `repairRequests` is every rejection that was sent back to the model as a repair request (absent when the
 * first attempt was accepted) — the "repair-required" trace of this stage's retry budget.
 */
export type RunStageResult<T> =
  | { ok: true; value: T; attempts: number; durationMs: number; repairRequests?: string[] }
  | { ok: false; errorCode: StageErrorCode; errors: string[]; attempts: number; durationMs: number; rawValue?: unknown; rawValueTruncated?: boolean; repairRequests?: string[] };

type Checked<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[]; issues?: unknown; internalError?: { cause: unknown } };

function internalDiagnostic(stageName: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `INTERNAL_ERROR: ${stageName} validation code threw: ${message}`;
}

/** Normalizes (if the stage has a normalizer) THEN strictly validates: schema first, then semantic `validate`. */
function normalizeAndCheck<T>(input: RunStageInput<T>, raw: unknown): Checked<T> {
  try {
    const parsed = input.schema.safeParse(input.normalize ? input.normalize(raw) : raw);
    if (!parsed.success) {
      const stageErrors = input.schemaError?.(raw) ?? [];
      return { ok: false, errors: stageErrors.length ? stageErrors : [`Response didn't match the expected shape: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`], issues: parsed.error.issues };
    }
    const semanticErrors = input.validate?.(parsed.data) ?? [];
    return semanticErrors.length ? { ok: false, errors: semanticErrors } : { ok: true, value: parsed.data };
  } catch (error) {
    return { ok: false, errors: [internalDiagnostic(input.stageName, error)], internalError: { cause: error } };
  }
}

/** One attempt's verdict: accepted, or rejected with what the next attempt is told and how it is classified. */
type AttemptVerdict<T> =
  | { ok: true; value: T; assessment: UsageAssessment }
  | { ok: false; errorCode: Exclude<StageErrorCode, "TIME_BUDGET_EXHAUSTED">; errors: string[]; truncated: boolean; rawValue?: unknown; rawValueTruncated?: boolean; assessment: UsageAssessment };

const USAGE_KIND: Record<Exclude<StageErrorCode, "TIME_BUDGET_EXHAUSTED">, string> = { OUTPUT_TRUNCATED: "output_truncated", VALIDATION_FAILED: "validation_failed", GENERATION_ERROR: "error", INTERNAL_ERROR: "internal_error" };

async function judgeAttempt<T>(input: RunStageInput<T>, outcome: { result: { output: unknown; finishReason?: string } } | { error: unknown }): Promise<AttemptVerdict<T>> {
  let output: unknown;
  let failure: unknown;
  if ("result" in outcome) {
    try { output = readOutput(outcome.result); } catch (error) { failure = error; }
  } else failure = outcome.error;

  if (failure === undefined) {
    const outputFingerprint = fingerprint(JSON.stringify(output) ?? "undefined");
    // Parsed explicitly rather than trusting the provider/SDK enforced it: a defense-in-depth check, not a
    // duplicate of `output: Output.object({schema})` — it also protects against a test double or provider
    // quirk returning a value that was never actually schema-checked. In practice `generateText` itself
    // already throws `NoObjectGeneratedError` before returning anything schema-invalid, so this rarely fires.
    const checked = normalizeAndCheck(input, output);
    if (checked.ok) return { ok: true, value: checked.value, assessment: { errorKind: null, outputFingerprint } };
    if (checked.internalError) {
      // This is our code, not an invalid model answer. Retrying would submit the same prompt and pay for
      // another response before hitting the same deterministic exception again.
      if (isDev) console.error(`[${input.stageName}] internal validation error`, checked.internalError.cause);
      return { ok: false, errorCode: "INTERNAL_ERROR", errors: checked.errors, truncated: false, rawValue: output, rawValueTruncated: false,
        assessment: { errorKind: USAGE_KIND.INTERNAL_ERROR, outputFingerprint, diagnostic: checked.errors.join("; "), candidate: boundedCandidate(output) } };
    }
    if (isDev) console.debug(`[${input.stageName}] attempt failed validation after normalization`, { rawValue: output, errors: checked.errors, issues: checked.issues });
    return { ok: false, errorCode: "VALIDATION_FAILED", errors: checked.errors, truncated: false, rawValue: output, rawValueTruncated: false,
      assessment: { errorKind: USAGE_KIND.VALIDATION_FAILED, outputFingerprint, diagnostic: checked.errors.join("; "), candidate: boundedCandidate(output) } };
  }

  const described = await describeGenerationError(failure);
  const outputFingerprint = described.text ? fingerprint(described.text) : undefined;
  const raw = described.rawValue !== undefined ? { rawValue: described.rawValue, rawValueTruncated: described.truncated === true } : {};
  if (described.truncated) {
    // A truncated value is never accepted whole, even if it happens to validate: its tail is missing.
    if (isDev) console.debug(`[${input.stageName}] attempt exhausted its output budget`, { message: described.message });
    return { ok: false, errorCode: "OUTPUT_TRUNCATED", errors: [OUTPUT_TRUNCATED_RETRY_INSTRUCTION], truncated: true, ...raw,
      assessment: { errorKind: USAGE_KIND.OUTPUT_TRUNCATED, outputFingerprint, diagnostic: described.message, candidate: boundedCandidate(described.rawValue) } };
  }
  // The SDK rejected the raw value with the strict schema; normalize it before re-validating ourselves. If it
  // still fails, retry with the errors that remain AFTER normalization, never the range slips it already fixed.
  const checked = input.normalize && described.rawValue !== undefined ? normalizeAndCheck(input, described.rawValue) : undefined;
  if (checked?.ok) return { ok: true, value: checked.value, assessment: { errorKind: null, outputFingerprint } };
  const errors = checked ? checked.errors : [described.message];
  if (isDev) console.debug(`[${input.stageName}] attempt threw`, { message: described.message, rawValue: described.rawValue });
  const errorCode = NoObjectGeneratedError.isInstance(failure) ? "VALIDATION_FAILED" : "GENERATION_ERROR";
  return { ok: false, errorCode, errors, truncated: false, ...raw,
    assessment: { errorKind: errorCode === "VALIDATION_FAILED" ? USAGE_KIND.VALIDATION_FAILED : undefined, outputFingerprint, diagnostic: errors.join("; "), candidate: boundedCandidate(described.rawValue) } };
}

export async function runStage<T>(input: RunStageInput<T>): Promise<RunStageResult<T>> {
  const maxAttempts = input.maxAttempts ?? 2;
  let errors: string[] = [];
  let errorCode: StageErrorCode = "GENERATION_ERROR";
  const repairRequests: string[] = [];
  const repairs = () => (repairRequests.length ? { repairRequests: [...repairRequests] } : {});
  let rawValue: unknown;
  let rawValueTruncated = false;
  // Grows only after a response exhausted the limit (a retry at the same budget would just be cut off again),
  // and never past TRUNCATION_GROWTH_CEILING × the initial allowance: bounded however many attempts a stage has.
  const initialMaxOutputTokens = input.maxOutputTokens ?? 1200;
  const maxOutputTokensCeiling = Math.round(initialMaxOutputTokens * TRUNCATION_GROWTH_CEILING);
  let maxOutputTokens = initialMaxOutputTokens;
  let lastAllowance = maxOutputTokens;
  let retryReason: string | null = null;
  let lastAttemptMs = 0;
  let totalMs = 0;
  let attempts = 0;
  // A truncated attempt's `errors` is the retry instruction meant for the model; the stage's failure reason names the cause instead.
  const failed = (extra: string[] = [], code: StageErrorCode = errorCode): RunStageResult<T> => ({
    ok: false, errorCode: code,
    errors: [...(code === "OUTPUT_TRUNCATED" ? [`OUTPUT_TRUNCATED: ${input.usageStage ?? input.stageName} exhausted its output budget (${attempts} attempt(s), last allowance ${lastAllowance} tokens).`] : errors), ...extra],
    attempts, durationMs: totalMs, rawValue, rawValueTruncated, ...repairs(),
  });
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const remainingMs = input.remainingBudgetMs - input.timings.elapsed();
    if (attempt > 0 && remainingMs < lastAttemptMs * 1.3) return failed(["Ran out of time budget for a repair attempt."]);
    if (remainingMs < 1_000) return failed(["Ran out of time budget."], attempt === 0 ? "TIME_BUDGET_EXHAUSTED" : errorCode);
    if (attempt > 0) repairRequests.push(...errors);
    const message = input.buildMessage(errors);
    const usageMeta: UsageMeta = {
      ...input.usageMeta,
      stage: input.usageStage ?? input.stageName,
      ...(input.usageStage && input.usageStage !== input.stageName ? { stageCall: input.stageName } : {}),
      retryNumber: attempt, retryReason, maxOutputTokens,
      promptFingerprint: fingerprint(`${input.system}\n\n${message}`),
    };
    lastAllowance = maxOutputTokens;
    let verdict: Promise<AttemptVerdict<T>> | undefined;
    // Memoized: the usage record and the retry decision share one judgement of the same response.
    const judge = (outcome: Parameters<typeof judgeAttempt<T>>[1]) => (verdict ??= judgeAttempt(input, outcome));
    const callStart = performance.now();
    attempts++;
    let judged: AttemptVerdict<T>;
    try {
      const response = await input.timings.timeAsync(`${input.stageName}#${attempt + 1}`, () =>
        withUsageLogging(usageMeta, () =>
          generateText({
            model: getAiModel(),
            maxOutputTokens,
            system: input.system,
            messages: [{ role: "user", content: message }],
            output: Output.object({ schema: input.schema }),
            providerOptions: AI_PROVIDER_OPTIONS,
            abortSignal: AbortSignal.timeout(Math.max(Math.floor(remainingMs), 1_000)),
            maxRetries: 1,
          }),
          async (outcome) => (await judge(outcome)).assessment,
        )
      );
      judged = await judge({ result: response });
    } catch (error) {
      // A throwing normalize/validate left a rejected memo: judge that error itself, as an ordinary retryable failure.
      judged = await judge({ error }).catch(() => judgeAttempt(input, { error }));
    }
    lastAttemptMs = performance.now() - callStart;
    totalMs += lastAttemptMs;
    if (judged.ok) return { ok: true, value: judged.value, attempts, durationMs: totalMs, ...repairs() };
    errors = judged.errors;
    errorCode = judged.errorCode;
    retryReason = USAGE_KIND[judged.errorCode];
    if ("rawValue" in judged && judged.rawValue !== undefined) { rawValue = judged.rawValue; rawValueTruncated = judged.rawValueTruncated === true; }
    if (judged.errorCode === "INTERNAL_ERROR") return failed();
    if (judged.truncated) maxOutputTokens = Math.min(Math.round(maxOutputTokens * TRUNCATION_TOKEN_GROWTH), maxOutputTokensCeiling);
  }
  return failed();
}
