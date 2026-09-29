import type { z } from "zod";
import { generateText, Output } from "ai";
import { AI_PROVIDER_OPTIONS, getAiModel } from "@/lib/ai/model";
import { withUsageLogging, type UsageMeta } from "@/lib/ai/usage/track";
import type { Timings } from "@/lib/ai/timing";

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
  maxAttempts?: number;
  maxOutputTokens?: number;
}

export type RunStageResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

export async function runStage<T>(input: RunStageInput<T>): Promise<RunStageResult<T>> {
  const maxAttempts = input.maxAttempts ?? 2;
  let errors: string[] = [];
  let lastAttemptMs = 0;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const remainingMs = input.remainingBudgetMs - input.timings.elapsed();
    if (attempt > 0 && remainingMs < lastAttemptMs * 1.3) {
      return { ok: false, errors: [...errors, "Ran out of time budget for a repair attempt."] };
    }
    if (remainingMs < 1_000) return { ok: false, errors: [...errors, "Ran out of time budget."] };
    const callStart = performance.now();
    try {
      const { output } = await input.timings.timeAsync(`${input.stageName}#${attempt + 1}`, () =>
        withUsageLogging(input.usageMeta, () =>
          generateText({
            model: getAiModel(),
            maxOutputTokens: input.maxOutputTokens ?? 1200,
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
      // Parsed explicitly rather than trusting the provider/SDK enforced it: a defense-in-depth check, not a
      // duplicate of `output: Output.object({schema})` — it also protects against a test double or provider
      // quirk returning a value that was never actually schema-checked.
      const parsed = input.schema.safeParse(output);
      if (!parsed.success) {
        errors = [`Response didn't match the expected shape: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`];
        continue;
      }
      const semanticErrors = input.validate?.(parsed.data) ?? [];
      if (semanticErrors.length === 0) return { ok: true, value: parsed.data };
      errors = semanticErrors;
    } catch (error) {
      lastAttemptMs = performance.now() - callStart;
      errors = [error instanceof Error ? error.message : String(error)];
    }
  }
  return { ok: false, errors };
}
