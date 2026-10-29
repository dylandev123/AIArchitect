import { createHash } from 'node:crypto';
import { Client } from 'pg';
import { latestKnowledge } from '@/lib/library/architecture/service';
import type { ArchitecturalKnowledge } from '@/lib/library/architecture/model';
import { legacyRecipeKnowledge } from '@/lib/library/architecture/legacyRecipes';
import type { DesignRecipe } from '@/types/library';
import { retrieveArchitecturalKnowledge } from '@/lib/library/architecture/retrieval';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

let cached: { at: number; result: Promise<boolean> } | undefined;

async function checkStorage() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) return false;
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 5000, query_timeout: 5000 });
  try {
    await client.connect();
    // Bypass application readers: those initialize tables even on reads.
    await client.query('BEGIN READ ONLY');
    await client.query("SET LOCAL statement_timeout = '5s'");
    const { rows } = await client.query("SELECT kind, data FROM library_docs WHERE kind IN ('architecturalKnowledge', 'recipe') LIMIT 5001");
    if (rows.length > 5000) throw Error('Health check row limit');
    const knowledge = latestKnowledge(rows.filter(r => r.kind === 'architecturalKnowledge').map(r => r.data as ArchitecturalKnowledge));
    const recipes = legacyRecipeKnowledge(rows.filter(r => r.kind === 'recipe').map(r => r.data as DesignRecipe));
    const retrieval = retrieveArchitecturalKnowledge([...knowledge, ...recipes], '$25m Caribbean tropical waterfront mansion', 'generate');
    const lessons = await client.query("SELECT count(*)::int AS count FROM library_docs WHERE kind = 'designLesson'");
    const destination = new URL(url);
    const fingerprint = createHash('sha256').update(`${destination.hostname.replace('-pooler.', '.')}|${destination.pathname}`).digest('hex');
    console.info('[storage-health]', JSON.stringify({
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      databaseFingerprint: fingerprint,
      approvedActive: retrieval.metrics.approvedActive,
      recipes: recipes.length,
      selected: retrieval.metrics.selected,
      selectedRecipes: retrieval.selected.filter(r => r.id.startsWith('legacy-recipe-')).length,
      designLessons: lessons.rows[0].count,
    }));
    return retrieval.metrics.approvedActive > 0 && retrieval.metrics.selected > 0;
  } catch {
    console.error('[storage-health] Read-only database verification failed');
    return false;
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    await client.end().catch(() => {});
  }
}

/** Public readiness only; database diagnostics remain in private server logs. */
export async function GET() {
  if (!cached || Date.now() - cached.at > 60_000) cached = { at: Date.now(), result: checkStorage() };
  const ok = await cached.result;
  return Response.json({ ok, commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null }, {
    status: ok ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
