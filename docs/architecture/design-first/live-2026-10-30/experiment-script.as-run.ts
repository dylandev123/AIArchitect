/* eslint-disable @typescript-eslint/no-explicit-any -- match pg's overloaded query interception. */
/** Authorized two-call experiment; architectural review must release stage two. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadEnvConfig } from '@next/env';
import { Pool, Client } from 'pg';
import { withDesignCheckpoint, designProposalHash, type DesignCheckpointReview } from '../src/lib/villa/scene/designCheckpoint';
import { getAiModelId } from '../src/lib/ai/model';
import { sceneRequestSchema } from '../src/lib/villa/scene/terra';
import { getPricingTable, computeCostUsd } from '../src/lib/ai/pricing';

assert(process.argv.includes('--execute-authorized-experiment'), 'Explicit experiment execution flag required.');
const dir = 'docs/architecture/design-first/live-2026-10-30';
assert(!existsSync(dir), 'Experiment already started; never resubmit.');
loadEnvConfig(process.cwd());
assert(process.env.OPENAI_API_KEY?.trim(), 'Existing API configuration unavailable.');
assert.equal(getAiModelId(), 'gpt-5.6-terra', 'Model changed; stop.');
const input = sceneRequestSchema.parse(JSON.parse(readFileSync('docs/architecture/design-first/experiment.request.json', 'utf8')));
assert.equal(input.mode, 'generate');
assert(!input.testing && !input.current && !input.reference, 'Use original independent mansion brief only.');
mkdirSync(dir, { recursive: true, mode: 0o700 });
const save = (name: string, value: unknown) => writeFileSync(`${dir}/${name}`, typeof value === 'string' ? value : JSON.stringify(value, null, 2), { flag: 'wx', mode: 0o600 });
const hash = (text: string | Buffer) => createHash('sha256').update(text).digest('hex');
function files(root: string): string[] { return readdirSync(root, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(`${root}/${e.name}`) : [`${root}/${e.name}`]); }
const historicalRoots = ['docs/architecture/complete-mansion-2026-10-30', 'docs/architecture/generation-quality', 'docs/architecture/terra-estate-diagnosis'];
const historicalHashes = Object.fromEntries(historicalRoots.flatMap(files).map(path => [path, hash(readFileSync(path))]));
save('historical-hashes.before.json', historicalHashes);
save('source-hashes.json', Object.fromEntries([...files('src'), 'scripts/design-first-experiment.ts', 'package-lock.json'].map(path => [path, hash(readFileSync(path))])));
save('request.json', input);
save('authorization.json', { startedAt: new Date().toISOString(), userAuthorization: 'ONE controlled design-first mansion experiment; max two GPT-5.6 Terra calls; construction conditional on seven-criterion pass.', model: getAiModelId(), maxPaidCalls: 2, maxRetries: 0, reasoning: 'provider-default', maxOutputTokensPerStage: 30000, execution: 'Local direct invocation of existing route; no hosting time limit or HTTP proxy. Existing per-stage abort limits remain.', databasePolicy: 'SELECT only; server read-only sessions; usage intercepted locally.' });
const dbEvents: unknown[] = [];
let usageRecords = 0;
let environmentFailed = false;
process.env.PGOPTIONS = '-c default_transaction_read_only=on';
process.env.AI_USAGE_LOG_PATH = `${process.cwd()}/${dir}/usage.jsonl`;
for (const prototype of [Pool.prototype, Client.prototype]) {
    const original = prototype.query;
    (prototype as any).query = function (...args: any[]) {
        const sql = typeof args[0] === 'string' ? args[0] : args[0]?.text;
        assert.equal(typeof sql, 'string');
        if (/^\s*CREATE TABLE/i.test(sql)) { dbEvents.push({ suppressed: 'initializer DDL', sha256: hash(sql) }); return Promise.resolve({ rows: [], rowCount: 0 }); }
        if (/^\s*INSERT INTO ai_usage\b/i.test(sql)) { save(`usage-record-${++usageRecords}.json`, args[1]); dbEvents.push({ redirected: 'usage to experiment evidence' }); return Promise.resolve({ rows: [], rowCount: 0 }); }
        assert(/^\s*SELECT\b/i.test(sql) && !sql.includes(';'), 'Database mutation or multi-statement blocked.');
        assert(!environmentFailed, 'Execution already failed; no further database reads.');
        dbEvents.push({ read: sql });
        return (original as any).apply(this, args).catch((error: Error) => { environmentFailed = true; throw error; });
    };
}
let paidCalls = 0;
let checkpointPassed = false;
const nativeFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
    assert(!environmentFailed, 'Prior execution failure; no provider request allowed.');
    assert.equal(String(url instanceof Request ? url.url : url), 'https://api.openai.com/v1/responses');
    const body = String(init?.body), wire = JSON.parse(body);
    assert.equal(wire.model, 'gpt-5.6-terra');
    assert.equal(wire.max_output_tokens, 30000);
    assert.equal(wire.text.format.strict, true);
    assert.equal(wire.reasoning?.effort, undefined);
    assert(paidCalls < 2, 'Third provider request forbidden.');
    if (paidCalls === 1) assert(checkpointPassed, 'Construction requires an approved exact-hash checkpoint.');
    const stage = paidCalls === 0 ? 'design' : 'construction';
    assert.equal(Object.hasOwn(wire.text.format.schema.properties, 'operations'), stage === 'construction');
    save(`${stage}.provider-request.exact.json`, body);
    save(`${stage}.call-started.json`, { at: new Date().toISOString(), requestHash: hash(body), ordinal: ++paidCalls });
    console.log(JSON.stringify({ stage, paidCallStarted: paidCalls }));
    try {
        const response = await nativeFetch(url, { ...init, redirect: 'error' });
        const exact = await response.clone().text();
        save(`${stage}.provider-response.exact.json`, exact);
        save(`${stage}.provider-http.json`, { status: response.status, requestId: response.headers.get('x-request-id'), endedAt: new Date().toISOString() });
        if (!response.ok) environmentFailed = true;
        return response;
    } catch (error) {
        environmentFailed = true;
        save(`${stage}.transport-error.json`, { type: error instanceof Error ? error.name : 'unknown', note: 'Stop; no retry. Provider may have received the request.' });
        throw error;
    }
};
try {
    const { POST } = await import('../src/app/api/ai/scene/route');
    const response = await withDesignCheckpoint(async proposal => {
        assert(!environmentFailed);
        const proposalHash = designProposalHash(proposal);
        save('proposal.json', proposal);
        save('checkpoint.pending.json', { proposalHash, status: 'AWAITING_ARCHITECTURAL_REVIEW', paidCalls, constructionAllowed: false });
        console.log(JSON.stringify({ checkpoint: 'WAITING', proposalHash, paidCalls }));
        // Keep this same route invocation alive. No proposal regeneration/replay.
        const deadline = Date.now() + 30 * 60 * 1000;
        while (!existsSync(`${dir}/checkpoint.review.json`)) {
            assert(Date.now() < deadline, 'Checkpoint review deadline exceeded; stop.');
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        const review = JSON.parse(readFileSync(`${dir}/checkpoint.review.json`, 'utf8')) as DesignCheckpointReview;
        // Existing checkpoint performs the authoritative seven-criterion gate.
        assert.equal(review.proposalHash, proposalHash);
        checkpointPassed = Object.values(review.criteria).length === 7 && Object.values(review.criteria).every(c => c.verdict === 'pass' && c.evidence.trim().length > 0) && !!review.conclusion.trim();
        return review;
    }, () => POST(new Request('http://localhost/api/ai/scene', { method: 'POST', body: JSON.stringify(input) })));
    const body = await response.json();
    save('route-response.json', body);
    if (body.responseId) for (const suffix of ['.json', '.wire.json', '.diagnostics.json', '.provider.txt']) {
        const path = `.data/scene-responses/${body.responseId}${suffix}`;
        if (existsSync(path)) save(`retained${suffix}`, readFileSync(path, 'utf8'));
    }
    if (body.scene) save('scene.json', body.scene);
    if (body.recoverableDraft) save('draft.REJECTED.json', body.recoverableDraft);
    save('result.json', { status: response.status, paidCalls, checkpointPassed, environmentFailed, responseId: body.responseId, error: body.error, dbEvents });
    console.log(JSON.stringify({ finished: true, status: response.status, paidCalls, checkpointPassed, accepted: !!body.scene, error: body.error }));
} catch (error) {
    save('execution-error.json', { type: error instanceof Error ? error.name : 'unknown', message: String(error), paidCalls, dbEvents });
    console.log(JSON.stringify({ stopped: true, paidCalls, error: String(error) }));
} finally {
    globalThis.fetch = nativeFetch;
    const stages = ['design', 'construction'].flatMap(stage => {
        const path = `${dir}/${stage}.provider-response.exact.json`;
        if (!existsSync(path)) return [];
        try {
            const wire = JSON.parse(readFileSync(path, 'utf8')), u = wire.usage;
            const rates = getPricingTable()['gpt-5.6-terra'];
            const cost = u ? computeCostUsd('gpt-5.6-terra', { inputTokens: u.input_tokens, cachedInputTokens: u.input_tokens_details?.cached_tokens ?? 0, outputTokens: u.output_tokens }) : null;
            return [{ stage, providerId: wire.id, model: wire.model, status: wire.status, usage: u ?? null, ratesUsdPerMillion: rates, estimatedCostUsd: cost }];
        } catch { return [{ stage, usage: null, estimatedCostUsd: null }]; }
    });
    save('usage-and-cost.json', { paidCalls, stages, estimatedTotalUsd: stages.every(s => s.estimatedCostUsd !== null) ? stages.reduce((sum, s) => sum + s.estimatedCostUsd!, 0) : null, source: 'Repository configured pricing, estimate only; provider token counts. Cache-write premium not included; not invoice reconciliation.' });
    const changed = Object.entries(historicalHashes).filter(([path, digest]) => hash(readFileSync(path)) !== digest).map(([path]) => path);
    save('preservation.json', { checkedFiles: Object.keys(historicalHashes).length, changed, previousEvidenceUnchanged: changed.length === 0 });
}
process.exit(0);
