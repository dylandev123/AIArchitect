# V3 Architectural Completeness v1

Before this milestone, none of the three saved mansions could be moved through above the ground floor. V3 now represents and builds vertical circulation and walkable access openings, audits whether every authored space can be reached, and sends significant gaps to the existing single bounded repair. No Terra/OpenAI request was made, and no V2 or terrain code changed.

## Diagnostic corrections

- **Reflection-named pools.** A pool whose own name declares swimming (swim, lap, resort, plunge, infinity, lagoon) now satisfies a requested pool. The id counts as part of the name. A pure reflecting pool, rill or pond still does not. This removes the false finding on 9646933e ("Long Reflection Resort Pool").
- **Butterfly roofs.** Butterfly is no longer in the list of unsupported roof names. Mansard, gambrel, sawtooth, barrel vault, dome and hyperbolic are still reported.
- **Glazing at shared-wall junctions.** The compiler still removes it, because the face is interior. `deriveV3MassJunctions` now reports each removal as `JUNCTION_OPENING_REMOVED`, with the mass, the opening and whether it was removed or clipped. The report appears as a validation warning and as the advisory `AUTHORED_OPENING_REMOVED`. A glazed door on a shared face becomes an intentional partition, as a solid door already did.
- **No construction change.** All 13 existing fixtures compile byte-identically: the three saved mansions, the butterfly mansion, the dream mansion, three parity houses and five terrain sites. The test suite pins SHA-256 hashes for the three saved mansions.

## Access openings

`glazed-door` is a new V3 opening type: `{id, facade, floors?, start, end, height?, operation?: hinged|sliding, reveal?, serves?}`. `door` also accepts `serves`.

- It is built through the shared builder's door band, so its threshold sits at floor level and it uses the semantic ids. V3 then replaces the solid trim leaf with jambs, a head, a threshold and leaf mullions (one per 1.2 m hinged, or per 2.4 m sliding), and keeps the full-height glass panel.
- The shared V2 builder is unchanged.
- Provider aliases (`sliding-door`, `glass-door`, `french-door`, `door-wall`, and similar) are converted to `glazed-door` during canonicalization.
- Ordinary windows and doors are untouched; a test checks the entry door byte-for-byte.

## Vertical circulation

Circulation is stored in `interior.circulation[]` as `V3Circulation`:

```
{ id, type: stair|lift, hostMassId, fromLevel, toLevel,
  footprint (host-local), stairType?: straight|l-shaped|u-shaped|spiral,
  direction?, turn? }
```

**Levels.** Levels resolve against the host's compiled floor datums. Setting `toLevel` to the host's level count reaches its roof:

| What sits over the footprint | Exit | What the stair arrives in |
|---|---|---|
| A mass stacked on the host | `stacked` | That mass's ground storey |
| A rooftop terrace, or an open flat roof | `roof` | A stair head enclosure, open on the side where the stair arrives |

**Construction.** `applyV3Circulation` is the compiler's final pass. Scenes without circulation come back unchanged. For each usable entry it:
- cuts the floor opening through the host's floor and roof surfaces with a convex prism over the footprint. Surfaces of a stacked mass, a hosted roof-form or a hosted terrace are cut too. It reuses `subtractJunctionVolume`; walls and glazing are never cut.
- builds monolithic treads, with landings for L and U stairs. Risers are at most 0.2 m and treads at least 0.22 m deep. Spiral stairs get a column with timber treads.
- adds glass guards with a top rail around the upper opening, leaving the arrival edge open.
- for lifts, builds shaft walls through every served storey, a closed metal landing door at each served level, and a car. No machinery is invented.

**Never auto-placed.** Problems are diagnosed, never repaired by moving anything:
- a missing footprint (`CIRCULATION_LOCATION_MISSING`)
- a stair that is too steep or too narrow (`CIRCULATION_NOT_USABLE`)
- a footprint outside its host
- an exit onto a pitched roof (`ROOF_EXIT_UNSUPPORTED`)
- an exit that lands partly under a stacked mass

Unusable entries are not built. Circulation findings are never fatal to validation.

**Edits.** Two new operations, `setCirculation` and `removeCirculation`, author or remove circulation. Deleting a host mass prunes its circulation.

## Completeness audit

`auditV3Completeness(scene)` is read-only and never prescribes a layout. It builds an access graph.

**Nodes:**
- the site exterior
- every storey of every mass, and each mass's roof datum
- balconies: facade slabs at an upper floor datum, and `balcony` objects
- rooftop and elevated terraces
- ground-level outdoor surfaces

Slabs raised within a storey are canopies, porticos or lanai roofs, not floors.

**Edges.** Access is never inferred from proximity:
- **Doors.** Only walkable openings (doors and glazed doors) that actually compiled count. At ground level a door may open onto ground in front of a surface. Above ground, the balcony or terrace must abut the facade at the door's floor level. A derived rooftop guard across the facing edge blocks access unless that edge is in `terraceOpenEdges`. A door into another mass is a partition, not exterior access.
- **Junction passages** between storeys at the same floor level. Each one must be proven clear in the compiled geometry by sampling at walking height: a run of at least 0.7 m with no wall or glass panel in the way.
- **Circulation.** Usable entries only: a lift connects every storey it serves, a stair connects its two ends.
- **Connectors.** Authored stair and ramp connectors.
- **Outdoor surfaces.** Contiguous walkable surfaces at one level. Ground-level surfaces also connect to the site exterior.

**Findings:**

| Code | When it fires | Severity |
|---|---|---|
| `UNREACHABLE_WING` | A ground mass has no way in | Significant |
| `UNREACHABLE_STOREY` | No usable stair or lift reaches an upper storey | Significant |
| `INACCESSIBLE_BALCONY` | A balcony has no walkable door. If it has a door but its storey is unreachable, the finding is advisory | Significant |
| `INACCESSIBLE_ROOF_TERRACE` | A rooftop or elevated terrace cannot be reached. The message names a gap or guard when one is the cause | Significant |
| `NO_OUTDOOR_LIVING_ACCESS` | A contiguous living area has no door from the house. Significant when it is at least 20 m² and within 6 m of a mass | Significant or advisory |
| `AUTHORED_OPENING_REMOVED` | The compiler drops an authored opening | Advisory |
| `CIRCULATION_INTENT_INCOMPLETE` | Authored circulation cannot be built | Significant |

Glazing is never a doorway, however tall.

## Generation contract and repair

- **Provider contract.** It adds a flat top-level `circulation` array, with a world-space plan centre normalized to host-local. It also adds the `FUNCTIONAL COMPLETENESS` principles to both terrain prompts: multi-storey buildings need circulation, rooftop terraces need access, balconies need doors, and outdoor living needs connections. These are principles, not templates. Room-by-room interiors and furniture are explicitly not required. Malformed entries are omitted with a `CIRCULATION_OMITTED` note.
- **Review.** `reviewV3Architecture` combines the composition review with the significant completeness findings. The route uses it for the one bounded design repair, whose prompt now allows only added access.
- **Revision gate.** `assessV3Revision` accepts:
  - new circulation in a targeted host
  - walkable openings appended to a targeted mass
  - an existing glazing zone converted to a glazed door with the same id, facade, floors and span
  - `terraceOpenEdges` on a targeted terrace
  - a connector to a targeted terrace or outdoor area

  Any other change to masses, roofs, materials or existing openings is rejected, and the valid original scene is kept.

## Findings on the saved mansions

| Mansion | Significant findings |
|---|---|
| 91d583fe | `UNREACHABLE_STOREY` primary-pavilion; `INACCESSIBLE_BALCONY` south-loggia-balcony (glazing only); `NO_OUTDOOR_LIVING_ACCESS` garden-courtyard + pool-terrace |
| 9646933e | `UNREACHABLE_STOREY` upper-bedroom-gallery (stacked); `INACCESSIBLE_BALCONY` south-bedroom-balcony; `INACCESSIBLE_ROOF_TERRACE` guest-sky-terrace (open gap from the gallery, and a guard across that edge); `NO_OUTDOOR_LIVING_ACCESS` south-lanai-terrace |
| f2149916 | `UNREACHABLE_STOREY` pavilion and both wings; `INACCESSIBLE_BALCONY` on both wings; `NO_OUTDOOR_LIVING_ACCESS` pool terrace, lounge deck and fire lounge |

All three mansions also have advisory `AUTHORED_OPENING_REMOVED` findings for junction glazing. 91d583fe has an advisory finding for its sunken lounge, which has no steps down into it.

The offline functional variants (`parity/functionalMansions.ts`) add only stairs, a lift, glazed doors and, in f2149916, wing balconies moved off the shared wall. All three variants have zero significant findings.

## Verification

- `architecturalCompleteness.test.ts`: 26 tests. They cover the diagnostic fixes, the pinned hashes, the audit not mutating scenes, findings on each mansion, functional fixtures passing, untouched masses staying byte-identical, treads inside the footprint with correct risers, the floor opening matching the footprint, stacked and rooftop exits, the lift, glazed-door construction, glazing never counting as access, proximity never counting as access, missing or unusable intent being diagnosed, normalization, and the revision gate.
- Mocked API (`route.v3.test.ts`): a scene without stairs gets exactly one completeness revision, and a reply that only adds the stair is accepted and persisted. Two test scenes were made functionally complete. Two expectations changed from one provider call to one bounded design revision.
- Full suite: 1847 passed, 3 skipped. `tsc --noEmit`, ESLint and `git diff --check` are clean.
- WebGL: `docs/architecture/parity/completeness/`.
  - `workspace-*`: the production `/workspace` viewer, replaying the functional f2149916.
  - The rest come from `/dev/completeness` (production `PrimitiveMesh`, lighting and PostFx, plus a horizontal section cut), captured with `scripts/completeness-capture.mjs`.

## Still unsupported

- Stairs connect only their two end storeys; a single stair has no intermediate landings at a storey it passes. Lifts serve every level.
- Circulation footprints are axis-aligned in the host frame. Stairs between masses are not supported; the stair must sit in the lower mass.
- Exits onto pitched roofs are not supported, and neither are partial floor voids or authored double-height voids beyond `spaceHeight`.
- Masses whose floor datums differ by more than 0.35 m are not joined; each needs its own stair, or split-level steps are needed.
- Door swing, landing door leaves and stair handrails are representational only. Accessibility codes are not checked: there are no rules on ramp gradients, door widths beyond the 0.7 m clear width, or headroom over long runs.
- Rooms, bedrooms and room-level door placement remain optional. Doors sit on the facade, and the dependency on interior partitions is not checked.
