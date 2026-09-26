import { appendFile, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { insertUsageRecordDb, readUsageRecordsDb, usageDatabaseUrl } from "./db";
import type { AiUsageRecord } from "./types";

/**
 * Server-only usage store. Uses the Postgres `ai_usage` table when DATABASE_URL / POSTGRES_URL is
 * set (production); otherwise an append-only JSONL file for local dev. Set AI_USAGE_LOG_PATH to
 * relocate the file. On serverless hosts the filesystem is ephemeral, so without a database the
 * history only survives within one instance.
 */
export function usageLogPath(): string {
  if (process.env.AI_USAGE_LOG_PATH) return process.env.AI_USAGE_LOG_PATH;
  return process.env.VERCEL
    ? path.join(tmpdir(), "ai-usage.jsonl")
    : path.join(process.cwd(), ".data", "ai-usage.jsonl");
}

export async function appendUsageRecord(record: AiUsageRecord): Promise<void> {
  if (usageDatabaseUrl()) return insertUsageRecordDb(record);
  const file = usageLogPath();
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, JSON.stringify(record) + "\n", "utf8");
}

export async function readUsageRecords(): Promise<AiUsageRecord[]> {
  if (usageDatabaseUrl()) return readUsageRecordsDb();
  let text: string;
  try {
    text = await readFile(usageLogPath(), "utf8");
  } catch {
    return [];
  }
  const records: AiUsageRecord[] = [];
  for (const line of text.split("\n")) {
    if (!line) continue;
    try {
      records.push(JSON.parse(line) as AiUsageRecord);
    } catch {
      // a torn or corrupt line must not hide the rest of the log
    }
  }
  return records;
}
