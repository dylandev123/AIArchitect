import {createHash} from 'node:crypto';
import {SCENE_TEST_MODELS,resolveSceneTestSettings} from '@/lib/ai/sceneTesting';
import {mansionCoordinationFixture,assertFixtureInput} from '@/lib/villa/scene/controlledFixture';
import {reviewSceneArchitecture} from '@/lib/villa/scene/planning';
import { generationDiagnostics } from '@/lib/villa/scene/generationDiagnostics';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { generateText, Output, NoObjectGeneratedError } from 'ai';
import { AI_NOT_CONFIGURED_MESSAGE, getAiModel, getAiModelId, isAiConfigured } from '@/lib/ai/model';
import { redactV3FailureText } from '@/lib/ai/v3FailureArtifact';
import { withUsageLogging } from '@/lib/ai/usage/track';
import { SceneConstructionError, sceneRuntimeOutputSchema, sceneResponseFormatSchema, sceneMessages, sceneRequestSchema, sceneProviderOutputSchema, resolveSceneResult, type SceneRequest } from '@/lib/villa/scene/terra';
import { architecturalRequestContext } from '@/lib/villa/scene/knowledgeContext';
import { validateScene } from '@/lib/villa/scene/model';
export const maxDuration = 180;
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export async function GET(request:Request){
    if(process.env.NODE_ENV!=='development')return json({error:'Not found'},404);
    try{
        if(new URL(request.url).searchParams.get('fixture')==='mansion-coordination'){
            const fixture=await mansionCoordinationFixture();
            return json({input:fixture.input,fingerprint:fixture.fingerprint});
        }
        return json({currentModel:getAiModelId(),models:SCENE_TEST_MODELS,accountAccess:'unverified',verifiedAt:'2026-10-29'});
    }catch(error){return json({error:String(error),providerCalls:0},400);}
}
export async function POST(request: Request) {
    let input: SceneRequest;
    let selection:ReturnType<typeof resolveSceneTestSettings>;
    let fixture:Awaited<ReturnType<typeof mansionCoordinationFixture>>|undefined;
    try {
        input = sceneRequestSchema.parse(await request.json());
        selection=resolveSceneTestSettings(input.testing,getAiModelId());
        if(input.testing?.fixture){fixture=await mansionCoordinationFixture();assertFixtureInput(input,fixture.input);}
        if (input.current)
            validateScene(input.current);
    }
    catch (error) {
        return json({ error: String(error), providerCalls: 0 }, 400);
    }
    if (!isAiConfigured())
        return json({ error: AI_NOT_CONFIGURED_MESSAGE, providerCalls: 0 }, 503);
    if (request.signal.aborted)
        return json({ error: 'Cancelled', providerCalls: 0 }, 499);
    let knowledgeTrace: unknown;
    let knowledgeEvidence: import('@/lib/villa/scene/model').ArchitecturalScene['knowledgeEvidence'];
    let raw: unknown;
    let requestSystem: string | undefined;
    let rawResponse: string | undefined;
    const responseId = randomUUID();
    const messages = fixture?.messages ?? sceneMessages(input);
    let validation:unknown;
    let architecturalQuality:unknown;
    let requestFingerprint:string|undefined;
    function experiment(operations?:number){return {model:selection.model,reasoningEffort:selection.reasoningEffort??null,usage:(providerMetadata as {usage?:unknown}|undefined)?.usage,requestFingerprint,operations,validation,architecturalQuality:architecturalQuality?((architecturalQuality as {status:string}).status):'not-evaluated'};}
    let providerCalls = 0;
    let providerMetadata: unknown;
    let requestSchema: unknown;
    let wire: {requestBody?: string;responseBody:string;status:number} | undefined;
    async function retain(status: string, error?: string) { try {
        await mkdir('.data/scene-responses', { recursive: true, mode: 0o700 });
        await writeFile(`.data/scene-responses/${responseId}.json`, redactV3FailureText(JSON.stringify({ responseId, status, input, knowledge: knowledgeTrace, requestSystem, output: raw, rawResponse, error }, null, 2)), { flag: 'wx', mode: 0o600 });
        if (wire) await writeFile(`.data/scene-responses/${responseId}.wire.json`, JSON.stringify(wire), {flag:'wx',mode:0o600});
        if (rawResponse !== undefined) await writeFile(`.data/scene-responses/${responseId}.provider.txt`, rawResponse, { flag: 'wx', mode: 0o600 });
        await writeFile(`.data/scene-responses/${responseId}.diagnostics.json`, JSON.stringify({responseId, status, providerCalls, providerMetadata, testing:input.testing, requestFingerprint, validation, architecturalQuality, requestSchema, messages, diagnostics: generationDiagnostics(responseId, input, raw, status)}, null, 2), {flag:'wx',mode:0o600});
    }
    catch {
        console.error('Scene response retention failed', responseId);
    } }
    try {
        const context = fixture?.context ?? await architecturalRequestContext(input);
        knowledgeEvidence = context.evidence;
        knowledgeTrace = context.trace;
        requestSystem = context.system;
        requestSchema = await sceneResponseFormatSchema(input);
        const responseFormat=await Output.object({schema:requestSchema as Awaited<ReturnType<typeof sceneResponseFormatSchema>>}).responseFormat;
        requestFingerprint=createHash('sha256').update(JSON.stringify({system:requestSystem,messages,schema:responseFormat})).digest('hex');
        const providerOptions={openai:{strictJsonSchema:input.mode==='generate'||input.editIntent==='redesign'||input.editIntent==='complete',...(selection.reasoningEffort?{reasoningEffort:selection.reasoningEffort}:{})}};
        const result = await withUsageLogging({ projectId: null, requestType: input.mode === 'edit' ? 'scoped_edit' : 'generation', scope: 'world', model: selection.model, stage: 'villa-scene-' + input.mode, maxOutputTokens: 30000 }, async () => { providerCalls++; return generateText({ model: getAiModel(record=>{wire=record;},selection.model), system: requestSystem, messages, output: Output.object({ schema: requestSchema as Awaited<ReturnType<typeof sceneResponseFormatSchema>> }), providerOptions, maxOutputTokens: 30000, maxRetries: 0, abortSignal: AbortSignal.any([request.signal, AbortSignal.timeout(input.testing ? 600000 : 170000)]) }); });
        providerMetadata = {usage:result.totalUsage,finishReason:result.finishReason,response:result.response,model:selection.model,reasoningEffort:selection.reasoningEffort??null};
        knowledgeTrace = {...(knowledgeTrace as object), providerUsage:result.totalUsage, tokenAttribution:'Actual provider totals include system, knowledge, lessons, messages and output schema; isolated knowledge tokens are estimated, not measured.'};
        rawResponse = result.text;
        raw = result.output;
        if (result.finishReason !== 'stop') {
            validation={status:'incomplete'};
            await retain('incomplete');
            return json({ error: 'Incomplete scene; current design preserved.', responseId, providerCalls,experiment:experiment() }, 502);
        }
        // Validate the mode-specific contract even when the provider adapter is mocked.
        const output = sceneRuntimeOutputSchema(input).parse(result.output);
        const resolved = resolveSceneResult(input, output, knowledgeEvidence);
        validation={status:'accepted',warningCount:resolved.architecturalAudit.findings.length};
        architecturalQuality={status:'requires-visual-review',audit:resolved.architecturalAudit};
        await retain('accepted');
        return json({ ...resolved, responseId, providerCalls,experiment:experiment(resolved.operations.length) });
    }
    catch (error) {
        let message = String(error);
        if (NoObjectGeneratedError.isInstance(error)) {
            rawResponse = error.text;
            providerMetadata = {usage:error.usage,finishReason:error.finishReason,response:error.response,model:selection.model,reasoningEffort:selection.reasoningEffort??null};
            // The SDK may reject before result.output is available. Diagnose the
            // original JSON locally; never repair or resubmit this response.
            try {
                raw = JSON.parse(error.text!);
                // A complete operations response may survive SDK rejection of intent.
                // Revalidate locally once; no repair, provider call or geometry changes.
                const candidate = sceneRuntimeOutputSchema(input).safeParse(raw);
                if (candidate.success && error.finishReason === 'stop') {
                    const resolved = resolveSceneResult(input, candidate.data, knowledgeEvidence);
                    validation={status:'accepted-with-warnings',warningCount:resolved.architecturalAudit.findings.length};
                    architecturalQuality={status:'requires-visual-review',audit:resolved.architecturalAudit};
                    await retain('accepted-with-warnings');
                    return json({...resolved, responseId, providerCalls,experiment:experiment(resolved.operations.length)});
                }
                const checked = sceneProviderOutputSchema(input).safeParse(raw);
                if (!checked.success)
                    message = 'Architectural response incomplete: ' + checked.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ');
            } catch (diagnosticError) {
                if (diagnosticError instanceof SceneConstructionError) { error = diagnosticError; message = String(diagnosticError); }
                // Keep SDK diagnostics for malformed/truncated operations.
            }
        }
        validation={status:'rejected',error:message};
        if(error instanceof SceneConstructionError)architecturalQuality={status:'unapproved-rejected-draft',audit:reviewSceneArchitecture(error.recoverableDraft)};
        await retain('rejected', message);
        return json({ error: message, ...(error instanceof SceneConstructionError ? {recoverableDraft:error.recoverableDraft} : {}), responseId, providerCalls,experiment:experiment(raw&&typeof raw==='object'&&'operations' in raw&&Array.isArray(raw.operations)?raw.operations.length:undefined) }, 422);
    }
}
