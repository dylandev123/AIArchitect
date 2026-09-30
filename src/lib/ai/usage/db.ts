import { Pool } from "pg";
import type { AiRequestType, AiScope, AiUsageRecord } from "./types";

/** Vercel Marketplace Postgres (Neon) sets one or both of these. */
export function usageDatabaseUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || undefined;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS ai_usage (
  id                  uuid PRIMARY KEY,
  created_at          timestamptz NOT NULL,
  project_id          text,
  request_type        text NOT NULL,
  scope               text NOT NULL,
  model               text NOT NULL,
  input_tokens        integer NOT NULL DEFAULT 0,
  cached_input_tokens integer NOT NULL DEFAULT 0,
  output_tokens       integer NOT NULL DEFAULT 0,
  total_tokens        integer NOT NULL DEFAULT 0,
  latency_ms          integer NOT NULL DEFAULT 0,
  success             boolean NOT NULL,
  estimated_cost_usd  double precision,
  priced              boolean NOT NULL,
  error_category      text
);
ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS stage text;
ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS asset_id text;
ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS plan_id text;
ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS prompt_fingerprint text;
ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS retry_number integer;
ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS retry_reason text;
ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS operation_id text;
ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS parent_usage_id uuid;
ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS provider_request_id text;
ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS max_output_tokens integer;
ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS resulting_asset_hash text;
ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS stage_call text;
ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS finish_reason text;
ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS diagnostic text;
ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS output_fingerprint text;
ALTER TABLE ai_usage ADD COLUMN IF NOT EXISTS candidate text;
CREATE INDEX IF NOT EXISTS ai_usage_created_at_idx ON ai_usage (created_at);
CREATE INDEX IF NOT EXISTS ai_usage_project_id_idx ON ai_usage (project_id);
CREATE INDEX IF NOT EXISTS ai_usage_model_idx ON ai_usage (model);
CREATE INDEX IF NOT EXISTS ai_usage_request_type_idx ON ai_usage (request_type);
`;

const globalForPool = globalThis as unknown as {
  __aiUsagePool?: { url: string; pool: Pool; ready?: Promise<void> };
};

function pool() {
  const url = usageDatabaseUrl()!;
  const cached = globalForPool.__aiUsagePool;
  if (cached && cached.url === url) return cached;
  void cached?.pool.end().catch(() => {});
  const p = new Pool({ connectionString: url, max: 3, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 5_000, query_timeout: 5_000 });
  // An idle-client error must not crash the process; the next query reports its own failure.
  p.on("error", () => {});
  return (globalForPool.__aiUsagePool = { url, pool: p });
}

/** Creates the table and indexes once per process (idempotent), retrying after a failure. */
async function ready() {
  const entry = pool();
  entry.ready ??= entry.pool.query(SCHEMA).then(
    () => undefined,
    (err) => {
      entry.ready = undefined;
      throw err;
    }
  );
  await entry.ready;
  return entry.pool;
}

export async function insertUsageRecordDb(r: AiUsageRecord): Promise<void> {
  const db = await ready();
  await db.query(
    `INSERT INTO ai_usage (id, created_at, project_id, request_type, scope, model, input_tokens,
       cached_input_tokens, output_tokens, total_tokens, latency_ms, success, estimated_cost_usd, priced, error_category,
       stage, asset_id, plan_id, prompt_fingerprint, retry_number, retry_reason, operation_id, parent_usage_id, provider_request_id, max_output_tokens, resulting_asset_hash,
       stage_call, finish_reason, diagnostic, output_fingerprint, candidate)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31)
     ON CONFLICT (id) DO NOTHING`,
    [
      r.id,
      r.timestamp,
      r.projectId,
      r.requestType,
      r.scope,
      r.model,
      r.inputTokens,
      r.cachedInputTokens,
      r.outputTokens,
      r.totalTokens,
      r.latencyMs,
      r.success,
      r.costUsd,
      r.costUsd !== null,
      r.errorKind,
      r.stage ?? null, r.assetId ?? null, r.planId ?? null, r.promptFingerprint ?? null, r.retryNumber ?? 0, r.retryReason ?? null,
      r.operationId ?? null, r.parentUsageId ?? null, r.providerRequestId ?? null, r.maxOutputTokens ?? null, r.resultingAssetHash ?? null,
      r.stageCall ?? null, r.finishReason ?? null, r.diagnostic ?? null, r.outputFingerprint ?? null, r.candidate ?? null,
    ]
  );
}

interface Row {
  id: string;
  created_at: Date;
  project_id: string | null;
  request_type: string;
  scope: string;
  model: string;
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  latency_ms: number;
  success: boolean;
  estimated_cost_usd: number | null;
  priced: boolean;
  error_category: string | null;
  stage: string | null; asset_id: string | null; plan_id: string | null; prompt_fingerprint: string | null; retry_number: number | null; retry_reason: string | null; operation_id: string | null; parent_usage_id: string | null; provider_request_id: string | null; max_output_tokens: number | null; resulting_asset_hash: string | null;
  stage_call?: string | null; finish_reason?: string | null; diagnostic?: string | null; output_fingerprint?: string | null; candidate?: string | null;
}

/** Oldest first, like the JSONL log, so the summary and "recent" slicing behave identically. */
export async function readUsageRecordsDb(): Promise<AiUsageRecord[]> {
  const db = await ready();
  const { rows } = await db.query<Row>("SELECT * FROM ai_usage ORDER BY created_at ASC, id ASC");
  return rows.map((r) => ({
    id: r.id,
    timestamp: r.created_at.toISOString(),
    projectId: r.project_id,
    requestType: r.request_type as AiRequestType,
    scope: r.scope as AiScope,
    model: r.model,
    inputTokens: r.input_tokens,
    cachedInputTokens: r.cached_input_tokens,
    outputTokens: r.output_tokens,
    totalTokens: r.total_tokens,
    latencyMs: r.latency_ms,
    success: r.success,
    errorKind: r.error_category,
    costUsd: r.priced ? r.estimated_cost_usd : null,
    stage: r.stage ?? undefined, assetId: r.asset_id, planId: r.plan_id, promptFingerprint: r.prompt_fingerprint ?? undefined,
    retryNumber: r.retry_number ?? undefined, retryReason: r.retry_reason, operationId: r.operation_id ?? undefined,
    parentUsageId: r.parent_usage_id, providerRequestId: r.provider_request_id, maxOutputTokens: r.max_output_tokens ?? undefined, resultingAssetHash: r.resulting_asset_hash,
    ...(r.stage_call ? { stageCall: r.stage_call } : {}), ...(r.finish_reason ? { finishReason: r.finish_reason } : {}), ...(r.diagnostic ? { diagnostic: r.diagnostic } : {}),
    ...(r.output_fingerprint ? { outputFingerprint: r.output_fingerprint } : {}), ...(r.candidate ? { candidate: r.candidate } : {}),
  }));
}
