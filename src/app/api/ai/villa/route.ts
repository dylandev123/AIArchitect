import { NextResponse } from 'next/server';
import { generateText, jsonSchema, NoObjectGeneratedError, Output, zodSchema } from 'ai';
import { z } from 'zod';
import { AI_NOT_CONFIGURED_MESSAGE, AI_PROVIDER_OPTIONS, getAiModel, getAiModelId, isAiConfigured } from '@/lib/ai/model';
import { withUsageLogging } from '@/lib/ai/usage/track';
import { classifyPlanFailure } from '@/lib/ai/planFailure';
import { CompositionError, compositionFindings, validateComposition } from '@/lib/villa/composition';
import { resolveVillaResult, villaRequestSchema, villaProviderOutputSchema, villaResultSchema, villaSystemPrompt } from '@/lib/villa/terra';
import { normalizeVillaResponse } from '@/lib/villa/responseMetadata';
import { retainVillaResponse } from '@/lib/villa/responseArtifact';

export const maxDuration = 180;
const MAX_OUTPUT_TOKENS = 6000;
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== 'development') return json({ error: 'Villa playground is development only.' }, 404);
  let input;
  try { input = villaRequestSchema.safeParse(await request.json()); }
  catch { return json({ error: 'Invalid JSON request.', providerCalls: 0 }, 400); }
  if (!input.success) return json({ error: 'Enter a brief and a supported villa configuration.', findings: input.error.issues, providerCalls: 0 }, 400);
  if (input.data.mode === 'edit' && input.data.current && 'version' in input.data.current) {
    try { validateComposition(input.data.current); }
    catch(error) { return json({error:'Current composition is invalid. No provider call was made.',findings:compositionFindings(error),providerCalls:0},400); }
  }
  if (!isAiConfigured()) return json({ error: AI_NOT_CONFIGURED_MESSAGE, providerCalls: 0 }, 503);
  const model = getAiModelId();
  let accepted: ReturnType<typeof resolveVillaResult> | undefined;
  let diagnostics: Awaited<ReturnType<typeof retainVillaResponse>> | undefined;
  try {
    const providerSchema = villaProviderOutputSchema(input.data);
    const localSchema = providerSchema.extend({ unsupported: villaResultSchema.shape.unsupported });
    const result = await withUsageLogging({ projectId: null, requestType: input.data.mode === 'edit' ? 'scoped_edit' : 'generation', scope: 'world',
      model, stage: `villa-playground-${input.data.mode}`, maxOutputTokens: MAX_OUTPUT_TOKENS,
    }, () => generateText({ model: getAiModel(), system: villaSystemPrompt(input.data.mode, input.data.mode === 'generate' || Boolean(input.data.current && 'version' in input.data.current)),
      prompt: input.data.site ? `Fixed user site (authoritative; do not resize): ${JSON.stringify(input.data.site)}\n${input.data.prompt}` : input.data.mode === 'edit' ? `Current villa: ${JSON.stringify(input.data.current)}\nRequested change: ${input.data.prompt}` : input.data.prompt,
      output: Output.object({ name: 'villa_configuration', schema: jsonSchema(zodSchema(providerSchema).jsonSchema, {
        validate: value => {
          const parsed = localSchema.safeParse(normalizeVillaResponse(value, input.data.mode));
          // Preserve raw output for the shared resolver and diagnostics. The wire schema
          // still communicates maxLength; SDK validation tolerates display-copy defects.
          return parsed.success ? { success: true, value } : { success: false, error: parsed.error };
        },
      }) }), providerOptions: AI_PROVIDER_OPTIONS,
      // AI SDK calls onFinish before parseCompleteOutput (including schema failures).
      onFinish: async ({ text }) => { diagnostics = await retainVillaResponse(text); },
      maxOutputTokens: MAX_OUTPUT_TOKENS, maxRetries: 0, abortSignal: AbortSignal.any([request.signal, AbortSignal.timeout(160000)]),
    }), outcome => {
      if (!('result' in outcome)) return {};
      if (outcome.result.finishReason !== 'stop') return { errorKind: 'villa_incomplete' };
      try { accepted = resolveVillaResult(input.data, outcome.result.output); return { errorKind: null }; }
      catch { return { errorKind: 'villa_configuration_invalid' }; }
    });
    if (result.finishReason !== 'stop') return json({ error: 'Terra did not finish this design. Your current villa is preserved. No automatic retry was made.', diagnostics, providerCalls: 1 }, 502);
    accepted ??= resolveVillaResult(input.data, result.output);
    return json({ ...accepted, model, diagnostics, providerCalls: 1, usage: { inputTokens: result.totalUsage.inputTokens, outputTokens: result.totalUsage.outputTokens } });
  } catch (error) {
    if (!diagnostics && NoObjectGeneratedError.isInstance(error) && typeof error.text === 'string') diagnostics = await retainVillaResponse(error.text);
    if (error instanceof CompositionError || error instanceof z.ZodError || NoObjectGeneratedError.isInstance(error)) {
      let findings = compositionFindings(error);
      // The SDK may reject a structured object before our executor sees it. Recover only
      // local contract diagnostics from its retained text, never return raw provider content.
      if (NoObjectGeneratedError.isInstance(error) && error.text) {
        try { resolveVillaResult(input.data, JSON.parse(error.text)); }
        catch (localError) {
          if (localError instanceof CompositionError || localError instanceof z.ZodError) findings = compositionFindings(localError);
        }
      }
      return json({ error: 'Terra returned an unsupported configuration. Your current villa is preserved. No automatic retry was made.', code: 'invalid_configuration', findings, diagnostics, providerCalls: 1 }, 422);
    }
    const failure = classifyPlanFailure(error, 'provider');
    return json({ error: `Terra could not complete this request (${failure.providerCode ?? failure.code}). Your current villa is preserved. No automatic retry was made.`, code: failure.providerCode ?? failure.code, providerCalls: 1 }, 502);
  }
}
