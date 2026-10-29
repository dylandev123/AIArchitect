import { listDesignLessonSummaries } from '@/lib/villa/design-learning-store';
import { learningContext } from '@/lib/villa/design-learning';
import { randomUUID } from 'node:crypto';
import { beginVillaRequest, finishVillaRequest, readVillaRequest } from '@/lib/villa/requestArtifact';
import { VILLA_PROVIDER_TIMEOUT_MS } from '@/lib/villa/requestLifecycle';
import { assembleAutomaticComponents, automaticCreationInstructions, creationBudget } from '@/lib/villa/creation/automatic';
import { listCandidates } from '@/lib/villa/creation/store';
import { computeCostUsd } from '@/lib/ai/pricing';
import { VILLA_LIMITS } from '@/lib/villa/limits';
import { NextResponse } from 'next/server';
import { generateText, jsonSchema, NoObjectGeneratedError, Output, zodSchema } from 'ai';
import { z } from 'zod';
import { AI_NOT_CONFIGURED_MESSAGE, AI_PROVIDER_OPTIONS, getAiModel, getAiModelId, isAiConfigured } from '@/lib/ai/model';
import { withUsageLogging } from '@/lib/ai/usage/track';
import { classifyPlanFailure } from '@/lib/ai/planFailure';
import { CompositionError, compositionFindings, validateCompositionPreview } from '@/lib/villa/composition';
import { resolveVillaResult, villaRequestSchema, villaProviderOutputSchema, villaResultSchema, villaSystemPrompt } from '@/lib/villa/terra';
import { normalizeVillaResponse } from '@/lib/villa/responseMetadata';
import { retainVillaGeneration, retainVillaResponse } from '@/lib/villa/responseArtifact';

export const maxDuration = 180;
const MAX_OUTPUT_TOKENS = VILLA_LIMITS.outputTokens;
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
/** Read-only recovery. This endpoint never invokes a provider. */
export async function GET(request: Request) {
  if (process.env.NODE_ENV !== 'development') return json({ error: 'Villa playground is development only.' }, 404);
  try {
    const record = await readVillaRequest(new URL(request.url).searchParams.get('requestId') ?? '');
    if (!record) return json({ error: 'No retained request found. No provider call was made.' }, 404);
    if (record.state === 'completed') return json(record.body, record.status);
    return json({ state: 'pending', startedAt: record.startedAt, error: 'No completed response is available yet. The request may still be running or the server may have stopped. No automatic retry was made.' }, 202);
  } catch { return json({ error: 'Request recovery storage is unavailable. No provider call was made.' }, 503); }
}
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== 'development') return json({ error: 'Villa playground is development only.' }, 404);
  let input;
  try { input = villaRequestSchema.safeParse(await request.json()); }
  catch { return json({ error: 'Invalid JSON request.', providerCalls: 0 }, 400); }
  if (!input.success) return json({ error: 'Enter a brief and a supported villa configuration.', findings: input.error.issues, providerCalls: 0 }, 400);
  if (input.data.mode === 'edit' && input.data.current && 'version' in input.data.current) {
    try { validateCompositionPreview(input.data.current); }
    catch(error) { return json({error:'Current composition is invalid. No provider call was made.',findings:compositionFindings(error),providerCalls:0},400); }
  }
  if (!isAiConfigured()) return json({ error: AI_NOT_CONFIGURED_MESSAGE, providerCalls: 0 }, 503);
  if (request.signal.aborted) return json({ error: 'Request cancelled before provider dispatch. No provider call was made.', code: 'client_cancelled', providerCalls: 0 }, 499);
  const model = getAiModelId();
  const suppliedId = request.headers.get('X-Villa-Request-ID');
  if (suppliedId && !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(suppliedId)) return json({ error: 'Invalid request ID.', providerCalls: 0 }, 400);
  const requestId = suppliedId ?? randomUUID();
  const startedAt = Date.now();
  try {
    if (!await beginVillaRequest(requestId, { model, mode: input.data.mode, providerTimeoutMs: VILLA_PROVIDER_TIMEOUT_MS, processId: process.pid, processStartedAt: new Date(Date.now() - process.uptime() * 1000).toISOString() })) {
      return GET(new Request(`http://localhost/api/ai/villa?requestId=${requestId}`));
    }
  } catch { return json({ error: 'Recovery storage unavailable. No provider call was made.', providerCalls: 0 }, 503); }
  // Browser navigation/disconnection must not discard a paid result. The provider remains bounded.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException('Terra provider deadline exceeded', 'TimeoutError')), VILLA_PROVIDER_TIMEOUT_MS);
  let providerCompleted = false;
  let completedUsage: unknown;
  let providerRequestId: string | undefined;
  const respond = async (body: object, status = 200) => {
    const payload = { ...body, requestId, recoveryRetained: true };
    try { await finishVillaRequest(requestId, status, payload, { elapsedMs: Date.now() - startedAt, clientDisconnected: request.signal.aborted, providerCompleted, providerRequestId, usage: completedUsage, usageKnown: completedUsage !== undefined }); }
    catch { return json({ ...payload, recoveryRetained: false }, status); }
    return json({ ...payload, recoveryRetained: true }, status);
  };
  let providerCalls=0;
  let diagnostics: Awaited<ReturnType<typeof retainVillaResponse>> | undefined;
  try {
    const budget = creationBudget();
    const records = input.data.mode==='generate' ? await listCandidates().catch(() => []) : [];
    const lessons = input.data.mode==='generate' ? learningContext(await listDesignLessonSummaries().catch(()=>[]),input.data.prompt) : '';
    const providerSchema = villaProviderOutputSchema(input.data);
    const localSchema = providerSchema.extend({ unsupported: villaResultSchema.shape.unsupported });
    providerCalls=1;
    const result = await withUsageLogging({ projectId: null, requestType: input.data.mode === 'edit' ? 'scoped_edit' : 'generation', scope: 'world',
      model, operationId: requestId, stage: `villa-playground-${input.data.mode}`, maxOutputTokens: MAX_OUTPUT_TOKENS,
    }, () => generateText({ model: getAiModel(), system: lessons + villaSystemPrompt(input.data.mode, input.data.mode === 'generate' || Boolean(input.data.current && 'version' in input.data.current)) + (input.data.mode==='generate' ? '\n'+automaticCreationInstructions(records,budget.maxNewComponents) : '\nPreserve createdComponents snapshots. You may adjust their placement or remove them by ID; do not create new components during edits.'),
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
      onFinish: async ({ text, totalUsage, response }) => {
        providerCompleted = true; completedUsage = totalUsage;
        const upstreamId = response.headers?.['x-request-id'];
        providerRequestId = upstreamId && /^[\w-]{1,160}$/.test(upstreamId) ? upstreamId : undefined;
        clearTimeout(timer);
        diagnostics = await retainVillaResponse(text);
        await retainVillaGeneration({requestId,model,providerCalls,diagnostics,providerRequestId,stages:['provider-completed'],usage:totalUsage,elapsedMs:Date.now()-startedAt,clientDisconnected:request.signal.aborted});
      },
      maxOutputTokens: MAX_OUTPUT_TOKENS, maxRetries: 0, abortSignal: controller.signal,
    }), outcome => {
      if (!('result' in outcome)) return {};
      if (outcome.result.finishReason !== 'stop') return { errorKind: 'villa_incomplete' };
      try { resolveVillaResult(input.data, outcome.result.output); return { errorKind: null }; }
      catch { return { errorKind: 'villa_configuration_invalid' }; }
    });
    if (result.finishReason !== 'stop') {
      await retainVillaGeneration({requestId,elapsedMs:Date.now()-startedAt,clientDisconnected:request.signal.aborted,providerCompleted,providerRequestId,model,providerCalls,diagnostics,stages:['provider-incomplete'],usage:result.totalUsage});
      return respond({ error: 'Terra did not finish this design. Your current villa is preserved. No automatic retry was made.', diagnostics, providerCalls }, 502);
    }
    const assembled = await assembleAutomaticComponents(input.data, result.output, budget.maxNewComponents);
    const assembledDiagnostics=assembled.config && 'version' in assembled.config && assembled.config.createdComponents?.length
      ? await retainVillaResponse(JSON.stringify({changes:assembled.config,summary:assembled.summary,unsupported:assembled.unsupported})) : undefined;
    const generation=await retainVillaGeneration({requestId,elapsedMs:Date.now()-startedAt,clientDisconnected:request.signal.aborted,providerCompleted,providerRequestId,model,providerCalls,budget,diagnostics,assembledDiagnostics,stages:[diagnostics?.retained?'provider-response-retained':'response-retention-unavailable','configuration-validated',...assembled.componentStages],usage:result.totalUsage});
    return respond({ ...assembled, generation, assembledDiagnostics, generationBudget:budget, costUsd: computeCostUsd(model, { inputTokens: result.totalUsage.inputTokens ?? 0, outputTokens: result.totalUsage.outputTokens ?? 0, cachedInputTokens: result.totalUsage.inputTokenDetails?.cacheReadTokens ?? 0 }), model, diagnostics, providerCalls: 1, usage: { inputTokens: result.totalUsage.inputTokens, outputTokens: result.totalUsage.outputTokens } });
  } catch (error) {
    if (!diagnostics && NoObjectGeneratedError.isInstance(error) && typeof error.text === 'string') diagnostics = await retainVillaResponse(error.text);
    const failure = classifyPlanFailure(error, 'provider');
    const configurationFailure = error instanceof CompositionError || error instanceof z.ZodError || NoObjectGeneratedError.isInstance(error);
    const failureCode = controller.signal.aborted ? 'provider_timeout' : configurationFailure ? 'invalid_configuration' : providerCompleted ? 'server_processing_error' : failure.providerCode ?? failure.code;
    await retainVillaGeneration({requestId,elapsedMs:Date.now()-startedAt,clientDisconnected:request.signal.aborted,providerCompleted,providerRequestId:providerRequestId ?? failure.requestId,model,providerCalls,diagnostics,stages:['generation-rejected'],failure:{name:error instanceof Error?error.name:'unknown',code:failureCode,status:failure.status},usage:completedUsage,usageKnown:completedUsage!==undefined,...(configurationFailure ? {findings:compositionFindings(error)} : {})});
    if (controller.signal.aborted) return respond({ error: 'Terra exceeded its 160-second provider deadline. Your current villa is preserved. Usage may already have been incurred. No automatic retry was made.', code: 'provider_timeout', diagnostics, providerCalls }, 504);
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
      return respond({ error: 'Terra returned an unsupported configuration. Your current villa is preserved. No automatic retry was made.', code: 'invalid_configuration', findings, diagnostics, providerCalls }, 422);
    }
    if (providerCompleted) return respond({ error: 'The server could not finish processing the retained Terra response. Your current villa is preserved. No automatic retry was made.', code: 'server_processing_error', diagnostics, providerCalls }, 500);
    return respond({ error: `Terra could not complete this request (${failure.providerCode ?? failure.code}). Your current villa is preserved. No automatic retry was made.`, code: failure.providerCode ?? failure.code, diagnostics, providerCalls }, 502);
  } finally { clearTimeout(timer); }
}
