import { appendFile, mkdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { databaseHost, isMissingFile, noteStorageError, type StorageInfo } from "@/lib/storage/diagnostics";
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

/** Which backend is live right now. Selection is deterministic: a database URL wins, otherwise the local file. */
export function usageStorageInfo(): StorageInfo {
  const url = usageDatabaseUrl();
  if (url) return { kind: "postgres", location: databaseHost(url), ephemeral: false };
  return { kind: "local-json", location: usageLogPath(), ephemeral: !!process.env.VERCEL && !process.env.AI_USAGE_LOG_PATH };
}

export async function appendUsageRecord(record: AiUsageRecord): Promise<void> {
  try {
    if (usageDatabaseUrl()) return await insertUsageRecordDb(record);
    const file = usageLogPath();
    await mkdir(path.dirname(file), { recursive: true });
    await appendFile(file, JSON.stringify(record) + "\n", "utf8");
  } catch (err) {
    noteStorageError("usage", "write", err);
    throw err;
  }
}

/** Only a log that does not exist yet reads as empty; any other read failure throws instead of posing as zero usage. */
export async function readUsageRecords(): Promise<AiUsageRecord[]> {
  try {
    if (usageDatabaseUrl()) return await readUsageRecordsDb();
    return await readUsageFile();
  } catch (err) {
    noteStorageError("usage", "read", err);
    throw err;
  }
}

async function readUsageFile(): Promise<AiUsageRecord[]> {
  let text: string;
  try {
    text = await readFile(usageLogPath(), "utf8");
  } catch (err) {
    if (isMissingFile(err)) return [];
    throw err;
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
