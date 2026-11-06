import { z } from 'zod';
import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { AI_NOT_CONFIGURED_MESSAGE, getAiModelId, isAiConfigured } from '@/lib/ai/model';
import { resolveSceneTestSettings } from '@/lib/ai/sceneTesting';
import { architecturalPlanSchema, compileArchitecturalPlan } from '@/lib/villa/canonical/plan';
import { rejectedGeneration } from '@/lib/villa/canonical/rejection';
import { aiSdkRevisionSubmit, authorizeRevisionExperiment, reviseCanonicalPlan, sceneFromAcceptedRevision } from '@/lib/villa/canonical/revision/revise';
export const maxDuration = 180;
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/** One optional, user-authorized architectural revision of a plan the compiler rejected.
 * Every check that can refuse the request runs before any provider call; there is then exactly one call, no retry and no repair.
 * The original plan is returned unchanged beside the model's revision, which is judged by the same analysis and compiler as the original. */
const requestSchema = z.object({
    brief: z.string().min(1).max(12000),
    plan: z.unknown(),
    authorization: z.object({
        /** Literal consent to one paid model call; anything else is refused before the plan is read. */
        confirmPaidCall: z.literal(true),
        authorizedBy: z.string().trim().min(1).max(120),
        scope: z.enum(['repair-only', 'redesign-permitted']),
        /** sha256 of JSON.stringify(plan): consent is for this exact plan, not whichever one is on screen later. */
        planSha256: z.string().regex(/^[0-9a-f]{64}$/),
    }).strict(),
}).strict();

export async function POST(request: Request) {
    let input: z.infer<typeof requestSchema>;
    try { input = requestSchema.parse(await request.json()); }
    catch (error) { return json({ error: 'A revision needs the brief, the rejected plan and explicit authorization of one paid model call. ' + String(error).slice(0, 300), providerCalls: 0 }, 403); }
    if (createHash('sha256').update(JSON.stringify(input.plan)).digest('hex') !== input.authorization.planSha256)
        return json({ error: 'The authorization is for a different plan than the one submitted. Nothing was sent.', providerCalls: 0 }, 409);
    const parsed = architecturalPlanSchema.safeParse(input.plan);
    if (!parsed.success)
        return json({ error: 'The plan does not satisfy the architectural-plan-1 contract, so there is nothing to revise. ' + parsed.error.issues.slice(0, 6).map(i => `${i.path.join('.')}: ${i.message}`).join('; '), providerCalls: 0 }, 422);
    try { compileArchitecturalPlan(parsed.data); return json({ error: 'This plan compiles; there is no rejection to revise.', providerCalls: 0 }, 409); }
    catch { /* rejected, as expected: this is the only plan this endpoint revises */ }
    if (!isAiConfigured()) return json({ error: AI_NOT_CONFIGURED_MESSAGE, providerCalls: 0 }, 503);
    if (request.signal.aborted) return json({ error: 'Cancelled', providerCalls: 0 }, 499);

    const { authorization } = input, selection = resolveSceneTestSettings(undefined, getAiModelId());
    const grant = authorizeRevisionExperiment({
        experimentId: `rejected-${authorization.planSha256.slice(0, 12)}`, authorizedBy: authorization.authorizedBy, scope: authorization.scope,
        ...(authorization.scope === 'redesign-permitted' ? { directive: 'redesign' as const } : {}),
    });
    // The picture needs a native renderer; the measured tables carry the same evidence, so none is sent here.
    // The quality gate applies only when the user authorized a redesign: a repair is judged on physical validity, programme and scope.
    const record = await reviseCanonicalPlan({
        authorization: grant, brief: input.brief, plan: input.plan, model: selection.model, image: false,
        qualityGate: authorization.scope === 'redesign-permitted',
        submit: aiSdkRevisionSubmit({ model: selection.model, reasoningEffort: selection.reasoningEffort, signal: request.signal }),
    });
    const providerCalls = record.provenance.providerCalls;
    // A revised plan that is still refused keeps its own rejection (findings, root causes, drawing) beside the untouched original.
    let revisedRejected: ReturnType<typeof rejectedGeneration> | undefined, compiled: ReturnType<typeof sceneFromAcceptedRevision> | undefined;
    if (record.revised) {
        if (record.accepted) {
            try { compiled = sceneFromAcceptedRevision(record); }
            catch (error) { revisedRejected = rejectedGeneration({ plan: record.revised.plan, error, brief: input.brief, limitations: record.revised.limitations }); }
        } else {
            try { compileArchitecturalPlan(record.revised.plan); }
            catch (error) { revisedRejected = rejectedGeneration({ plan: record.revised.plan, error, brief: input.brief, limitations: record.revised.limitations }); }
        }
    }
    return json({
        providerCalls, accepted: record.accepted && !!compiled,
        // Physical validity and architectural quality are separate verdicts about the same revision.
        physicalValidity: {
            valid: !record.assessment.stopReasons.includes('physically-invalid') && !!record.revised,
            originalErrors: record.analysis.errorCount, revisedErrors: record.assessment.revisedErrorCount ?? null,
            remainingCauses: record.assessment.remainingCauses, newCauses: record.assessment.newCauses,
        },
        architecturalQuality: { gating: authorization.scope === 'redesign-permitted', before: record.assessment.before ?? null, after: record.assessment.after ?? null, dimensions: record.assessment.dimensions ?? [] },
        record, revisedRejected,
        ...(compiled ? { scene: compiled.scene, operations: compiled.operations, architecturalPlan: record.revised!.plan } : {}),
        error: record.accepted ? undefined : record.assessment.statement,
    }, 200);
}
