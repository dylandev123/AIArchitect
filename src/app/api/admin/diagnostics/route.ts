import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/auth";
import { readUsageRecords, usageLogPath, usageStorageInfo } from "@/lib/ai/usage/store";
import { libraryFilePath, libraryStorageInfo, readLibrary } from "@/lib/library/store";
import { recentStorageErrors } from "@/lib/storage/diagnostics";

export const dynamic = "force-dynamic";

interface LocalFile {
  path: string;
  bytes: number;
  modified: string;
  records: number | null;
  /** Whether the storage selected right now reads this file. */
  inUse: boolean;
}

const errorText = (err: unknown) => (err instanceof Error ? `${err.name}: ${err.message}`.slice(0, 200) : "unknown error");

async function describeFile(file: string, count: (text: string) => number, inUse: boolean): Promise<LocalFile | null> {
  try {
    const [info, text] = await Promise.all([stat(file), readFile(file, "utf8")]);
    let records: number | null = null;
    try {
      records = count(text);
    } catch {
      // unparseable: reported as an unknown count rather than hidden
    }
    return { path: file, bytes: info.size, modified: info.mtime.toISOString(), records, inUse };
  } catch {
    return null;
  }
}

const libraryCount = (text: string) => {
  const d = JSON.parse(text) as Record<string, unknown[] | undefined>;
  return (["needs", "recipes", "knowledge", "plans"] as const).reduce((sum, k) => sum + (d[k]?.length ?? 0), 0);
};
const usageCount = (text: string) => text.split("\n").filter(Boolean).length;

/**
 * Admin-only: which storage each domain is using right now, how much it holds, the local files that exist on disk (so data an
 * inactive backend is not reading is visible), and the latest storage errors. A read failure is reported as a failure, never as zero.
 */
export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const usageStorage = usageStorageInfo();
  const libraryStorage = libraryStorageInfo();

  const usage = await readUsageRecords().then(
    (r) => ({ records: r.length as number | null, error: null as string | null }),
    (err) => ({ records: null, error: errorText(err) })
  );
  const library = await readLibrary().then(
    (l) => ({ needs: l.needs.length as number | null, knowledge: l.knowledge.length as number | null, recipes: l.recipes.length as number | null, plans: l.plans.length as number | null, error: null as string | null }),
    (err) => ({ needs: null, knowledge: null, recipes: null, plans: null, error: errorText(err) })
  );

  const usagePath = usageLogPath();
  const libraryPath = libraryFilePath();
  const defaults = { usage: path.join(process.cwd(), ".data", "ai-usage.jsonl"), library: path.join(process.cwd(), ".data", "ai-library.json") };
  const candidates: [string, (t: string) => number, boolean][] = [
    [usagePath, usageCount, usageStorage.kind === "local-json"],
    [libraryPath, libraryCount, libraryStorage.kind === "local-json"],
  ];
  if (defaults.usage !== usagePath) candidates.push([defaults.usage, usageCount, false]);
  if (defaults.library !== libraryPath) candidates.push([defaults.library, libraryCount, false]);
  const localFiles = (await Promise.all(candidates.map(([f, c, inUse]) => describeFile(f, c, inUse)))).filter((f): f is LocalFile => f !== null);

  return NextResponse.json({
    cwd: process.cwd(),
    usage: { storage: usageStorage, ...usage },
    library: { storage: libraryStorage, ...library },
    localFiles,
    errors: recentStorageErrors(),
  });
}
