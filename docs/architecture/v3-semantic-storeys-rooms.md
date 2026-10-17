# V3 semantic storeys and rooms

Status: implemented as authored data, audit and local edit operations. Nothing interior renders.

## Model

`V3Scene.interior?: { storeys: V3Storey[]; rooms: V3Room[] }` (`src/lib/v3/interior.ts`).

```ts
V3Storey { id, hostMassId, index, elevation, height, label, semanticRole }
V3Room   { id, storeyId, hostMassId, program, footprint: { x, z, width, depth }, label, semanticRole }
```

- Storeys and rooms are **datums**, not `scene.objects`. The compiler only walks `scene.objects`, so they cannot
  render, receive support or alter terrain. `compileV3Scene(scene)` is identical with or without `interior`.
- One id namespace: object, storey and room ids must not collide (`DUPLICATE_SEMANTIC_ID`, fatal).
- `program` is open vocabulary, like `semanticRole`.

## Vertical authority

```
host mass base (architecture.baseElevation)
  └─ storey.elevation      (finished floor above host base; storey.height = floor-to-floor)
       └─ room             (no Y field; schema-strict edit ops reject one)
```

`resolveV3Storey` / `resolveV3Room` are the only way to get world elevation. Room footprints are host-local plan
rectangles (centred on the mass, before its `rotationY`); `hostLocalToWorld` uses the compiler's rotation
convention. Moving or rotating the mass moves its rooms without editing them.

## Relationships and dependencies

- Plan adjacency: `scene.relationships` with the new kind `adjacent` (two rooms, same storey, shared boundary
  ≥ 0.3 m — otherwise advisory). Vertical circulation reuses `connects`. Relationships may reference interior ids.
- Dependency registry (`capabilities.ts`): storey → host mass; room → storey + host mass.
  `v3DependencyGraph` / `v3Dependents` cover objects and datums. Nothing depends on a room, so room edits are local.

## Validation

Fatal: invalid ids/footprints/storeys, missing storey host, host not a mass, room without its storey, room/storey
host mismatch. Physical: duplicate storey index, invalid adjacency. Advisory: storey/room outside host, overlapping
storeys or rooms, adjacency without shared boundary. Exterior-only scenes produce no interior issues.

## Edits (runtime only; Terra's edit schema is unchanged)

`setStorey`, `setRoom`, `editRoom`, `removeRoom`. Deleting a host mass cascades its storeys, rooms and their
relationships. No operation ever creates an interior for a scene that has none.

## Compatibility

Older exterior-only V3 scenes have no `interior` and keep none through load, repair and edit. Terra's generation
contract is unchanged; Terra does not author interiors yet.

## Future path (not implemented)

1. **Rooms** (this milestone) — semantic footprints on storeys.
2. **Shared boundaries** — derive boundary segments from `adjacent` pairs and room/host edges.
3. **Partitions** — authored or derived wall datums on shared boundaries, still non-rendering.
4. **Door openings** — semantic openings hosted on partitions/boundaries, referencing two rooms.
5. **Render walls** — a registered interior capability compiles partitions + openings into geometry.
6. **Derived collision** — collision classes derived from rendered walls and openings, never authored.

## Also in this milestone

Support/elevation/site-audit type lists in `supportGraph.ts`, `elevation.ts` and `siteHierarchy.ts` now read
`V3Capability.support` flags. `supportCapabilities.test.ts` pins behaviour to the previous hard-coded lists.
Remaining type-specific code: pool excavation in the terrain sampler, retaining-wall grade audit, the `gate`
`followsTerrain` metadata switch, and the unregistered `deck` ground-host alias.
