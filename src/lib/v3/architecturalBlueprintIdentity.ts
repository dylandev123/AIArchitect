import type { V3ArchitecturalBlueprint } from './architecturalBlueprint';
import type { V3BlueprintFinding } from './blueprint';

export interface ArchitecturalIdentityDeclaration { id: string; namespace: string; path: string; }
export interface ArchitecturalIdentityChange { path: string; from: string; to: string; reason: string; }

/** Namespaces follow the runtime lookup domains; facade children are host-local. */
export function architecturalIdentityDeclarations(bp: V3ArchitecturalBlueprint): ArchitecturalIdentityDeclaration[] {
  const result: ArchitecturalIdentityDeclaration[] = [];
  const add = (id: string, namespace: string, path: string) => result.push({ id, namespace, path });
  const entries = (values: {id: string}[], namespace: string, path: string) => values.forEach((v, i) => add(v.id, namespace, `${path}.${i}.id`));
  entries(bp.materials, 'material', 'materials');
  bp.buildings.forEach((b, i) => {
    const path = `buildings.${i}`;
    add(b.id, 'object', `${path}.id`); add(b.roof.id, 'object', `${path}.roof.id`);
    b.storeys.forEach((s, j) => {
      add(s.id, 'storey', `${path}.storeys.${j}.id`);
      entries(s.spaces, 'room', `${path}.storeys.${j}.spaces`);
    });
    entries(b.facade.openings ?? [], `${path}:opening`, `${path}.facade.openings`);
    entries(b.facade.assemblies ?? [], `${path}:assembly`, `${path}.facade.assemblies`);
    b.facade.assemblies?.forEach((a, j) => entries(a.parts, `${path}:assembly.${j}:part`, `${path}.facade.assemblies.${j}.parts`));
    if (b.plan.kind === 'outline') entries(b.plan.segments, `${path}:segment`, `${path}.plan.segments`);
    if (b.plan.kind === 'articulated') b.plan.operations.forEach((op, j) => {
      if (op.id) add(op.id, `${path}:operation`, `${path}.plan.operations.${j}.id`);
    });
  });
  entries(bp.features, 'object', 'features');
  bp.connections.forEach((c, i) => add(c.surfaceId, 'route-surface', `connections.${i}.surfaceId`));
  entries(bp.verticalCirculation, 'vertical-circulation', 'verticalCirculation');
  entries(bp.partitions, 'partition', 'partitions'); entries(bp.doors, 'door', 'doors');
  // The estate schema enforces a shared intent domain across these collections.
  for (const key of ['connections', 'entrances', 'requirements', 'program', 'zones', 'forms', 'relationships', 'considerations'] as const)
    entries(bp[key], 'estate-intent', key);
  entries(bp.site.access, 'estate-intent', 'site.access');
  return result;
}

const semanticDomains = new Set(['object', 'storey', 'room', 'vertical-circulation', 'partition', 'door']);

/**
 * surfaceId DECLARES a route's generated owner, whereas surface endpoints reference
 * authored features. Split owner aliases only; never rename architecture or guess
 * the target of an ambiguous objectIds/relationship reference. Transactional/pure.
 */
export function normalizeArchitecturalBlueprintIdentities(input: V3ArchitecturalBlueprint): {
  blueprint: V3ArchitecturalBlueprint; changes: ArchitecturalIdentityChange[]; findings: V3BlueprintFinding[];
} {
  const declarations = architecturalIdentityDeclarations(input), findings: V3BlueprintFinding[] = [];
  const groups = new Map<string, ArchitecturalIdentityDeclaration[]>();
  for (const d of declarations.filter(d => d.namespace !== 'route-surface')) {
    const domain = semanticDomains.has(d.namespace) ? 'semantic' : d.namespace;
    const key = `${domain}:${d.id}`, group = groups.get(key) ?? [];
    group.push(d); groups.set(key, group);
  }
  for (const group of groups.values()) if (group.length > 1) findings.push({
    code: 'ARCHITECTURAL_DUPLICATE_ID', severity: 'fatal', targetIds: group.map(d => d.path),
    message: `Identity ${JSON.stringify(group[0].id)} is ambiguous in ${group.map(d => `${d.namespace} at ${d.path}`).join(', ')}. No references were retargeted.`,
  });
  // Gates share the downstream endpoint lookup with semantic objects.
  for (const access of input.site.access) {
    const collision = declarations.filter(d => semanticDomains.has(d.namespace) && d.id === access.id);
    if (collision.length) findings.push({ code: 'ARCHITECTURAL_DUPLICATE_ID', severity: 'fatal', targetIds: [access.id, ...collision.map(d => d.path)], message: `Site access ${access.id} collides with scene semantics; endpoint intent is ambiguous.` });
  }
  const references = [
    ...(['requirements', 'program', 'zones', 'forms', 'considerations'] as const).flatMap(key => input[key].flatMap((entry, i) => entry.objectIds.map((id, j) => ({ id, path: `${key}.${i}.objectIds.${j}` })))),
    ...input.relationships.flatMap((r, i) => [{ id: r.from, path: `relationships.${i}.from` }, { id: r.to, path: `relationships.${i}.to` }]),
    ...input.buildings.flatMap((b, i) => (b.facade.openings ?? []).flatMap((o, j) => 'serves' in o && o.serves ? [{ id: o.serves, path: `buildings.${i}.facade.openings.${j}.serves` }] : [])),
  ];
  const owners = new Map<string, number>();
  for (const c of input.connections) owners.set(c.surfaceId, (owners.get(c.surfaceId) ?? 0) + 1);
  for (const [id, count] of owners) if (count > 1 && !input.features.some(f => f.id === id)) {
    const refs = references.filter(r => r.id === id);
    if (refs.length) findings.push({ code: 'ARCHITECTURAL_IDENTITY_AMBIGUOUS_REFERENCE', severity: 'fatal', targetIds: refs.map(r => r.path), message: `${id} names ${count} route owners and is referenced outside a connection. A unique target must be authored; no reference was guessed.` });
  }
  // A collision with anything other than a named dry feature has no supported alias meaning.
  for (const c of input.connections) {
    const collisions = declarations.filter(d => d.id === c.surfaceId && (semanticDomains.has(d.namespace) || d.path.startsWith('site.access.')));
    if (collisions.length && !input.features.some(f => f.id === c.surfaceId && ['terrace', 'courtyard', 'landscape-zone'].includes(f.type)))
      findings.push({ code: 'ARCHITECTURAL_DUPLICATE_ID', severity: 'fatal', targetIds: [c.id, c.surfaceId, ...collisions.map(d => d.path)], message: `Route owner ${c.surfaceId} collides with architecture or site access. Only a named dry feature alias can be separated locally.` });
  }
  if (findings.length) return { blueprint: structuredClone(input), changes: [], findings };
  const blueprint = structuredClone(input), changes: ArchitecturalIdentityChange[] = [];
  const used = new Set(declarations.map(d => d.id));
  blueprint.connections.forEach((c, i) => {
    const collides = declarations.some(d => d.id === c.surfaceId && d.namespace !== 'route-surface' && (semanticDomains.has(d.namespace) || d.path.startsWith('site.access.')));
    if (!collides && owners.get(c.surfaceId) === 1) return;
    const from = c.surfaceId, stem = `route-${c.id}`.slice(0, 56);
    let to = stem, suffix = 2;
    while (used.has(to)) to = `${stem}-${suffix++}`;
    used.add(to); c.surfaceId = to;
    const reason = 'Separated an exclusive route owner from a reused surface alias; architectural feature references and all route geometry are preserved.';
    changes.push({ path: `connections.${i}.surfaceId`, from, to, reason });
    findings.push({ code: 'ARCHITECTURAL_IDENTITY_NORMALIZED', severity: 'advisory', targetIds: [c.id, from, to], message: `${reason} connections.${i}.surfaceId: ${from} → ${to}.` });
  });
  return { blueprint, changes, findings };
}
