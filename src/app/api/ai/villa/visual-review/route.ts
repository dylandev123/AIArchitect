import { architecturalRequestContext } from '@/lib/villa/scene/knowledgeContext';
import { sceneVisualEvidence } from '@/lib/villa/scene/visualEvidence';
import { validateScene } from '@/lib/villa/scene/model';
import { computeCostUsd } from '@/lib/ai/pricing';
import { generateText, Output } from 'ai';
import { AI_NOT_CONFIGURED_MESSAGE, AI_PROVIDER_OPTIONS, isAiConfigured, getAiModel, getAiModelId } from '@/lib/ai/model';
import { withUsageLogging } from '@/lib/ai/usage/track';
import { reviewInstructions, reviewSchema, visualReviewRequestSchema } from '@/lib/villa/visual-review';
import { validateCompositionPreview } from '@/lib/villa/composition';
export const maxDuration = 180;
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== 'development') return Response.json({ error: 'Development only' }, { status: 404 });
  let providerCalls = 0;
  try {
    const input = visualReviewRequestSchema.parse(await request.json());
    if ('version' in input.current) {
      if (input.current.version === 'architectural-scene-1') validateScene(input.current);
      else validateCompositionPreview(input.current);
    }
    if (!isAiConfigured()) return Response.json({ error: AI_NOT_CONFIGURED_MESSAGE, providerCalls }, { status: 503 });
    const direct = 'version' in input.current && input.current.version === 'architectural-scene-1' ? input.current : undefined;
    const context = direct ? await architecturalRequestContext({mode:'edit',editIntent:'redesign',prompt:input.brief,current:direct}) : undefined;
    const evidence = direct ? sceneVisualEvidence(direct) : undefined;
    const model = getAiModelId();
    providerCalls = 1;
    const result = await withUsageLogging({ projectId: null, requestType: 'scoped_edit', scope: 'world', model, stage: 'villa-visual-review', maxOutputTokens: 1800 }, () => generateText({
      model: getAiModel(), providerOptions: AI_PROVIDER_OPTIONS, system: reviewInstructions(input.current) + (context?.trace.text ?? ''), maxRetries: 0, maxOutputTokens: 1800,
      abortSignal: AbortSignal.any([request.signal, AbortSignal.timeout(120000)]),
      messages: [{ role: 'user', content: [{ type: 'text', text: JSON.stringify({ brief: input.brief, current: input.current, unresolved: input.unresolved, evidence, imageOrder: ['Aerial', 'Arrival', 'Poolside', ...(input.images.length===4?['Facade']:[])], evidencePolicy: 'Scene renders show construction; intended design is not proof. Arrival also covers the main facade; camera occlusion limits conclusions.' }) }, ...input.images.map(image => ({ type: 'image' as const, image })), ...(input.reference ? [{type: 'text' as const,text: `Approved concept: ${input.reference.source}`},{type: 'image' as const,image:input.reference.image}] : [])] }],
      output: Output.object({ schema: reviewSchema }),
    }));
    return Response.json({ costUsd: computeCostUsd(model, { inputTokens: result.totalUsage.inputTokens ?? 0, outputTokens: result.totalUsage.outputTokens ?? 0, cachedInputTokens: result.totalUsage.inputTokenDetails?.cacheReadTokens ?? 0 }), review: result.output, usage: result.totalUsage, model, providerCalls: 1 });
  } catch (error) { return Response.json({ error: providerCalls ? 'Terra visual review failed. Original preserved; no retry was made.' : error instanceof Error ? error.message : 'Invalid review request.', providerCalls }, { status: 400 }); }
}
