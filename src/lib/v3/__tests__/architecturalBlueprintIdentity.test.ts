import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { architecturalIdentityDeclarations, normalizeArchitecturalBlueprintIdentities } from '../architecturalBlueprintIdentity';
import { planV3ArchitecturalBlueprint, v3ArchitecturalBlueprintSchema } from '../architecturalBlueprint';
import { generateV3FromArchitecturalBlueprint, type V3ArchitecturalAttempt } from '../architecturalBlueprintGeneration';
import { fullPropertyBlueprint } from '../parity/fullPropertyBlueprint';
import * as compiler from '../scene';

const source = readFileSync(new URL('./fixtures/architectural-blueprint-live-2026-10-20.json', import.meta.url), 'utf8').trimEnd();
const live = () => v3ArchitecturalBlueprintSchema.parse(JSON.parse(source));
const withoutOwnerIds = (bp: ReturnType<typeof live>) => ({ ...bp, connections: bp.connections.map(({surfaceId, ...c}) => { void surfaceId; return c; }) });

describe('architectural identity recovery without any provider', () => {
  it('replays the exact live failure and preserves all design and references', async () => {
    expect(createHash('sha256').update(source).digest('hex')).toBe('9733be300b2fbb316ea248201c4af87df86665fb63fb9c6d63012aa49f1af9ed');
    const raw = live(), before = JSON.stringify(raw), normalized = normalizeArchitecturalBlueprintIdentities(raw);
    expect(normalized.changes.map(c => [c.path, c.from, c.to])).toEqual([
      ['connections.0.surfaceId', 'arrival-court', 'route-arrival-drive'],
      ['connections.1.surfaceId', 'arrival-court', 'route-guest-walk'],
      ['connections.2.surfaceId', 'view-terrace', 'route-ocean-terrace-walk'],
      ['connections.3.surfaceId', 'view-terrace', 'route-pool-approach'],
    ]);
    expect(normalized.findings.every(f => f.severity === 'advisory')).toBe(true);
    expect(withoutOwnerIds(normalized.blueprint)).toEqual(withoutOwnerIds(raw));
    expect(JSON.stringify(raw)).toBe(before);
    expect(normalizeArchitecturalBlueprintIdentities(normalized.blueprint)).toMatchObject({ blueprint: normalized.blueprint, changes: [], findings: [] });
    const author = vi.fn(async () => ({ output: raw, finishReason: 'stop' })), attempts: V3ArchitecturalAttempt[] = [];
    const compile = vi.spyOn(compiler, 'compileV3Scene');
    const result = await generateV3FromArchitecturalBlueprint('', author, { allowRepair: false, onAttempt: a => { attempts.push(a); } });
    expect(author).toHaveBeenCalledTimes(1); // the author is the captured JSON, never a model
    expect(compile).toHaveBeenCalled(); compile.mockRestore();
    expect(result).toMatchObject({ok:true,attempts:1,outcome:'draft'});
    expect(result.scene?.objects).toHaveLength(13);
    expect(result.findings.some(f => ['ARCHITECTURAL_DUPLICATE_ID','ARCHITECTURAL_STOREYS_UNSUPPORTED','ARCHITECTURAL_ASSEMBLY_INPUT'].includes(f.code))).toBe(false);
    expect(attempts).toHaveLength(1); expect(attempts[0].rawBlueprint).toEqual(raw);
    if (process.env.ARCHITECTURAL_IDENTITY_RECOVERY_DIR) {
      const dir = process.env.ARCHITECTURAL_IDENTITY_RECOVERY_DIR;
      writeFileSync(`${dir}/normalized-blueprint.json`, JSON.stringify(normalized.blueprint, null, 2)+'\n');
      writeFileSync(`${dir}/replay-proof.json`, JSON.stringify({ offline: true, providerCalls: 0, sourceSha256: createHash('sha256').update(source).digest('hex'), declarations: architecturalIdentityDeclarations(raw), changes: normalized.changes, attempts, result }, null, 2)+'\n');
    }
  });
  it('constructs an otherwise valid estate with colliding route owners, with no repair', async () => {
    const bp = fullPropertyBlueprint(), feature = bp.features.find(f => f.type === 'terrace')!;
    bp.connections.forEach(c => { c.surfaceId = feature.id; });
    const author = vi.fn(async () => ({ output: bp }));
    const result = await generateV3FromArchitecturalBlueprint('', author);
    expect(result.ok, JSON.stringify(result.findings)).toBe(true); expect(author).toHaveBeenCalledTimes(1);
    expect(new Set(result.scene!.objects.map(o => o.id)).size).toBe(result.scene!.objects.length);
    expect(result.scene!.objects.find(o => o.id === feature.id)?.type).toBe('terrace');
    for (const c of bp.connections) {
      const route = result.scene!.estatePlan!.circulation.find(r => r.id === c.id)!;
      expect(route.via).toEqual([`route-${c.id}`]);
      expect(route.spatial!.width).toBe(c.width); expect(route.spatial!.waypoints).toEqual(c.waypoints);
    }
  });
  it('allocates bounded schema-valid names without stealing any authored identity', () => {
    const bp = live(); bp.connections[0].id = 'x'.repeat(64);
    bp.materials[0].id = `route-${'x'.repeat(50)}`;
    const a = normalizeArchitecturalBlueprintIdentities(bp), b = normalizeArchitecturalBlueprintIdentities(bp);
    expect(a).toEqual(b); expect(v3ArchitecturalBlueprintSchema.safeParse(a.blueprint).success).toBe(true);
    expect(a.changes[0].to).toBe(`${bp.materials[0].id}-2`);
  });
  it.each(['room', 'object', 'entrance', 'connection', 'material', 'opening', 'part'] as const)('rejects ambiguous %s declarations before lookup or compilation', kind => {
    const bp = fullPropertyBlueprint();
    if (kind === 'room') bp.buildings[0].storeys[0].spaces.push(structuredClone(bp.buildings[0].storeys[0].spaces[0]));
    if (kind === 'object') bp.features.push(structuredClone(bp.features[0]));
    if (kind === 'entrance') bp.entrances.push(structuredClone(bp.entrances[0]));
    if (kind === 'connection') bp.connections.push(structuredClone(bp.connections[0]));
    if (kind === 'material') bp.materials.push(structuredClone(bp.materials[0]));
    if (kind === 'opening') bp.buildings[0].facade.openings!.push(structuredClone(bp.buildings[0].facade.openings![0]));
    if (kind === 'part') { const assembly = bp.buildings[0].facade.assemblies![0]; assembly.parts.push(structuredClone(assembly.parts[0])); }
    const before = JSON.stringify(bp), result = planV3ArchitecturalBlueprint(bp, { buildFirst: true });
    expect(result.ok).toBe(false); expect(result.approval).toBeUndefined();
    expect(result.findings[0].code).toBe('ARCHITECTURAL_DUPLICATE_ID');
    expect(result.findings[0].message).toContain(' at '); expect(result.findings[0].targetIds.length).toBeGreaterThan(1);
    expect(JSON.stringify(bp)).toBe(before);
  });
  it('allows equal material/object ids and host-local opening ids', () => {
    const bp = fullPropertyBlueprint(); bp.materials[0].id = bp.buildings[0].id;
    bp.buildings[1].facade.openings![0].id = bp.buildings[0].facade.openings![0].id;
    expect(normalizeArchitecturalBlueprintIdentities(bp).findings).toEqual([]);
  });
  it('refuses referenced shared route owners with no feature target atomically', () => {
    const bp = live(); bp.connections.forEach(c => { c.surfaceId = 'shared-owner'; });
    bp.zones[0].objectIds.push('shared-owner');
    const normalized = normalizeArchitecturalBlueprintIdentities(bp);
    expect(normalized.changes).toEqual([]); expect(normalized.blueprint).toEqual(bp);
    expect(normalized.findings.some(f => f.code === 'ARCHITECTURAL_IDENTITY_AMBIGUOUS_REFERENCE')).toBe(true);
  });
  it('never renames a room, building, roof, stair or site access to conceal a collision', () => {
    const bp = live(); bp.connections[0].surfaceId = bp.buildings[0].id;
    const normalized = normalizeArchitecturalBlueprintIdentities(bp);
    expect(normalized.changes).toEqual([]); expect(normalized.blueprint).toEqual(bp);
    expect(normalized.findings[0].severity).toBe('fatal');
  });
  it('diagnoses cross-namespace room/object collisions rather than retargeting relationships', () => {
    const bp = live(); bp.buildings[0].storeys[0].spaces[0].id = bp.features[0].id;
    const result = normalizeArchitecturalBlueprintIdentities(bp);
    expect(result.changes).toEqual([]); expect(result.blueprint).toEqual(bp);
    expect(result.findings[0].message).toContain('room at buildings.0.storeys.0.spaces.0.id');
    expect(result.findings[0].message).toContain('object at features.0.id');
  });
  it('refuses ambiguous serves references to shared route owners', () => {
    const bp = live(); bp.connections.forEach(c => { c.surfaceId = 'shared-owner'; });
    const door = bp.buildings[0].facade.openings![0];
    if (door.type === 'door' || door.type === 'glazed-door') door.serves = 'shared-owner';
    expect(normalizeArchitecturalBlueprintIdentities(bp).findings.some(f => f.code === 'ARCHITECTURAL_IDENTITY_AMBIGUOUS_REFERENCE')).toBe(true);
  });
});
