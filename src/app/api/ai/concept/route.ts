import { NextResponse } from 'next/server';
import { generateText, NoObjectGeneratedError, Output } from 'ai';
import { z } from 'zod';
import { AI_NOT_CONFIGURED_MESSAGE, AI_PROVIDER_OPTIONS, getAiModel, getAiModelId, isAiConfigured } from '@/lib/ai/model';
import { withUsageLogging } from '@/lib/ai/usage/track';
import { classifyPlanFailure } from '@/lib/ai/planFailure';
import type { PlanResponseEvidence } from '@/lib/ai/planResponseArtifact';
import { retainConceptResponse, retainConceptValidation } from '@/lib/ai/conceptResponseArtifact';
import { computeCostUsd } from '@/lib/ai/pricing';
import { architecturalConceptPrompt, conceptEvaluationEnabled, prepareArchitecturalConcept, type ConceptResult } from '@/lib/v3/architecturalConcept';
import { compactMassingEnabled, compactMassingPrompt, prepareCompactMassing } from '@/lib/v3/compactMassing';

export const maxDuration = 300;
const MAX_OUTPUT_TOKENS = 8000;
const requestSchema = z.object({ prompt: z.string().trim().min(1).max(12000), language: z.literal('compact').optional() }).strict();
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET() {
  if (!conceptEvaluationEnabled()) return json({ error: 'Architectural concept evaluation is disabled.' }, 403);
  return json({ enabled: true, model: getAiModelId(), maxProviderCalls: 1, maxOutputTokens: MAX_OUTPUT_TOKENS, persistence: 'debug-evidence-only' });
}

export async function POST(request: Request) {
  if (!conceptEvaluationEnabled()) return json({ error: 'Architectural concept evaluation is disabled.' }, 403);
  let input;
  try { input = requestSchema.safeParse(await request.json()); } catch { return json({ error: 'Invalid JSON request.' }, 400); }
  if (!input.success) return json({ error: 'Enter a concept prompt (1–12,000 characters); optional language must be compact.' }, 400);
  const compact = input.data.language === 'compact';
  if (compact && !compactMassingEnabled()) return json({ error: 'Compact massing evaluation is disabled.' }, 403);
  const prepare = compact ? prepareCompactMassing : prepareArchitecturalConcept;
  if (!isAiConfigured()) return json({ error: AI_NOT_CONFIGURED_MESSAGE }, 503);
  let prepared: ConceptResult | undefined;
  let responseEvidence: PlanResponseEvidence | undefined;
  let phase: 'provider' | 'parsing' | 'validation' = 'provider';
  try {
    const model = getAiModelId();
    const result = await withUsageLogging({
      projectId: null, requestType: 'generation', scope: 'world', model, generationMode: 'v3-scene',
      stage: compact ? 'v3-compact-massing-evaluation' : 'v3-concept-evaluation', maxOutputTokens: MAX_OUTPUT_TOKENS,
    }, () => generateText({
      model: getAiModel(), system: compact ? compactMassingPrompt() : architecturalConceptPrompt(), prompt: input.data.prompt,
      output: Output.json({ name: 'v3_architectural_concept' }), providerOptions: AI_PROVIDER_OPTIONS,
      maxOutputTokens: MAX_OUTPUT_TOKENS, maxRetries: 0, abortSignal: AbortSignal.timeout(270000),
    }), async outcome => {
      if (!('result' in outcome)) {
        if (NoObjectGeneratedError.isInstance(outcome.error) && outcome.error.text !== undefined) {
          phase = 'parsing';
          responseEvidence = await retainConceptResponse(outcome.error.text, { prompt: input.data.prompt, model, finishReason: outcome.error.finishReason });
          return { outputFingerprint: responseEvidence.sha256 };
        }
        return {};
      }
      const { result } = outcome;
      responseEvidence = await retainConceptResponse(result.text, { prompt: input.data.prompt, model, finishReason: result.finishReason });
      if (result.finishReason !== 'stop') return { errorKind: 'concept_incomplete', diagnostic: result.finishReason };
      phase = 'parsing';
      const output = result.output;
      phase = 'validation';
      prepared = prepare(output);
      await retainConceptValidation(responseEvidence.sha256, { ok: prepared.ok, findings: prepared.findings, footprintTrace: prepared.footprintTrace });
      return { errorKind: prepared.ok ? null : 'concept_geometry', diagnostic: prepared.findings.map(f => f.code).join(','), outputFingerprint: responseEvidence.sha256 };
    });
    if (result.finishReason !== 'stop') return json({ error: 'Terra did not complete the concept. No preview was accepted; no automatic retry was made.', finishReason: result.finishReason, responseEvidence, providerCalls: 1 }, 502);
    prepared ??= prepare(result.output);
    if (!prepared.ok) return json({ error: 'Concept validation failed. No substitute geometry was accepted.', findings: prepared.findings, footprintTrace: prepared.footprintTrace, responseEvidence, providerCalls: 1 }, 422);
    const usage = result.totalUsage;
    prepared.scene.metadata = { ...prepared.scene.metadata, authoringLanguage: compact ? 'terra-massing-1' : 'v3-architectural-concept-1', brief: input.data.prompt, generatedAt: new Date().toISOString(), model,
      usage: { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, totalTokens: usage.totalTokens, attempts: 1, repair: false,
        estimatedCost: computeCostUsd(model, { inputTokens: usage.inputTokens ?? 0, outputTokens: usage.outputTokens ?? 0, cachedInputTokens: usage.inputTokenDetails?.cacheReadTokens ?? 0 }) ?? undefined } };
    return json({ scene: prepared.scene, findings: prepared.findings, footprintTrace: prepared.footprintTrace, responseFingerprint: responseEvidence?.sha256, providerCalls: 1, model, finishReason: result.finishReason });
  } catch (error) {
    const failure = classifyPlanFailure(error, phase);
    if (responseEvidence) await retainConceptValidation(responseEvidence.sha256, { phase, failure });
    return json({ error: `Concept generation failed: ${failure.message} No automatic retry was made.`, failure, responseEvidence, providerCalls: 1 }, 502);
  }
}
