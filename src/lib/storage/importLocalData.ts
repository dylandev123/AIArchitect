import { readFile } from "node:fs/promises";
import path from "node:path";
import { appendUsageRecord } from "@/lib/ai/usage/store";
import type { AiUsageRecord } from "@/lib/ai/usage/types";
import { emptySnapshot, mutateLibrary, type LibraryDoc, type LibrarySnapshot } from "@/lib/library/store";

export interface LocalImportResult {
  library: { needs: number; knowledge: number; recipes: number; plans: number; generations: number };
  usage: number;
}

const source = (name: string) => path.join(process.cwd(), ".data", name);

/**
 * Imports the legacy local development files into the currently selected backend.
 * IDs are primary keys in Postgres (and maps in the file backend), so rerunning this
 * is idempotent and preserves every record's existing timestamps, counts, and links.
 */
export async function importLocalData(includeUsage = true): Promise<LocalImportResult> {
  const raw = JSON.parse(await readFile(source("ai-library.json"), "utf8")) as Partial<LibrarySnapshot>;
  const snapshot: LibrarySnapshot = {
    needs: raw.needs ?? [], recipes: raw.recipes ?? [], knowledge: raw.knowledge ?? [], plans: raw.plans ?? [], generations: raw.generations ?? [], capabilities: raw.capabilities ?? emptySnapshot().capabilities, capabilityNeeds: raw.capabilityNeeds ?? [],
  };
  const docs: LibraryDoc[] = [
    ...snapshot.needs.map((data) => ({ kind: "need" as const, data })),
    ...snapshot.knowledge.map((data) => ({ kind: "knowledge" as const, data })),
    ...snapshot.recipes.map((data) => ({ kind: "recipe" as const, data })),
    ...snapshot.plans.map((data) => ({ kind: "plan" as const, data })),
    ...snapshot.generations.map((data) => ({ kind: "generation" as const, data })),
    ...snapshot.capabilities.map((data) => ({ kind: "capability" as const, data })),
    ...snapshot.capabilityNeeds.map((data) => ({ kind: "capabilityNeed" as const, data })),
  ];
  await mutateLibrary(() => ({ put: docs, result: undefined }));

  let usage = 0;
  if (includeUsage) {
    let text = "";
    try {
      text = await readFile(source("ai-usage.jsonl"), "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      await appendUsageRecord(JSON.parse(line) as AiUsageRecord);
      usage++;
    }
  }
  return { library: { needs: snapshot.needs.length, knowledge: snapshot.knowledge.length, recipes: snapshot.recipes.length, plans: snapshot.plans.length, generations: snapshot.generations.length }, usage };
}
