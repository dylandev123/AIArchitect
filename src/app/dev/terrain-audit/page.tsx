import { notFound } from 'next/navigation';
import { TERRAIN_FIXTURES, type TerrainFixtureName } from '@/lib/v3/parity/terrain';
import { ingestV3GenerationOutput } from '@/lib/v3/ingestion';
import capturedMansion from '@/lib/v3/__tests__/fixtures/cliffside-mansion-attempt-0.json';
import { TerrainAuditViewer } from './viewer';

export default async function Page({ searchParams }: { searchParams: Promise<{ fixture?: string }> }) {
  if (process.env.NODE_ENV !== 'development') notFound();
  const { fixture } = await searchParams;
  // The captured live cliffside response, replayed offline through the production ingestion boundary.
  if (fixture === 'captured-mansion') {
    const ingested = ingestV3GenerationOutput(structuredClone(capturedMansion));
    return <TerrainAuditViewer fixture="captured-mansion" scene={ingested.scene} lift={ingested.scene.site.naturalGround?.elevation ?? 0} accepted={ingested.ok} />;
  }
  return <TerrainAuditViewer fixture={fixture && fixture in TERRAIN_FIXTURES ? fixture as TerrainFixtureName : 'flat'} />;
}
