/** Small versioned descriptor; existing DesignRecipe parameters/material slots/CuratedAsset
 * IDs remain the sources of truth. No new persistence backend or approval dashboard. */
export interface ArchitecturalComponentRecord {
  schemaVersion: 1;
  id: string;
  version: number;
  name: string;
  status: 'experimental' | 'review' | 'approved' | 'rejected';
  /** Local approved capabilities await a deliberate provider-contract rollout. */
  availability?: 'terra' | 'local';
  provenance: { kind: 'procedural' | 'ai-mesh'; source: string };
  reference: { kind: 'builder'; id: string } | { kind: 'asset'; assetId: string; sha256: string };
  coordinates: { units: 'metres'; origin: 'floor-centre'; up: '+y'; front: '+z'; rotation: 'degrees-about-y' };
  dimensions: { width: number; depth: number; height: number };
  parameters: { key: string; min: number; max: number; unit: 'm' | 'degrees' }[];
  connections: { id: string; kind: 'open-entry'; position: [number,number,number]; normal: [number,number,number]; width: number; follows: string }[];
  materials: { slot: string; options: string[] }[];
  validation: { status: 'pending' | 'passed' | 'failed'; checks: string[]; evidence: string[]; limitations: string[] };
}
export function approvedComponents(records: readonly ArchitecturalComponentRecord[]) {
  return records.filter(r=>r.status==='approved' && r.validation.status==='passed');
}
