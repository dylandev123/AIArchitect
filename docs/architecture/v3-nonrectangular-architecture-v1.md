# V3 Non-Rectangular Architecture v1

Implemented locally, 2026-10-18. No Terra/OpenAI calls, V2 changes, terrain changes, commit, push or deployment.

## Semantic contract

`building-mass.composition.footprint` is optional:

```json
{"kind":"articulated","operations":[{"id":"garden-cut","type":"notch","corner":"se","width":9,"depth":7}]}
```

Supported shared operations: `notch`, `recess`, `projection`, `entry-recess`, `chamfer`. Each accepts `floors: all | ground | upper` and an optional id. Recesses/projections support open colonnades and post spacing; chamfers support glazed angled walls. No runtime templates or new footprint engine were introduced.

The authored bounding box remains the placement/selection/persistence envelope. Projection allowances are reserved **inside** it: the core rectangle loses the maximum projection depth on each side, then shifts to keep the final constructed outline inside the original envelope. Facade fractions address that core. Other operation dimensions remain metres. This projection convention is explicit in the Terra prompt.

Malformed/overlapping/self-intersecting/degenerate/out-of-envelope operations are diagnosed as `FOOTPRINT_INVALID`. Malformed schema data is omitted during ingestion; invalid geometric intent remains inspectable but uses rectangular construction fallback. No-footprint scenes keep the original branch.

## Construction and facade relationships

- Shared `buildFloorFootprint` resolves each storey. Exact rectangle tiles and triangular chamfer wedges construct slabs; no whole-building box approximation is used.
- Every exterior segment constructs a real wall, opening band, glazed chamfer or colonnade. Walls begin above their slab and end below the top slab, avoiding coplanar slab/wall surfaces.
- Shared `buildMassOpenings` operates in its original compass frame, then the adapter translates its results to the resolved parallel exterior segment.
- An original facade plane takes precedence when it fully contains an opening span. Otherwise an unambiguous recessed/projected plane can receive it. Spans crossing different depths are diagnosed and not placed arbitrarily.
- Compass fractions do not address arbitrary angled doors/windows. `chamfer.glazed` supplies full-height angled glazing. Missing/ambiguous placements produce `FOOTPRINT_FACADE_UNRESOLVED` / `FOOTPRINT_FACADE_AMBIGUOUS`; builder clipping produces `FOOTPRINT_OPENING_CLIPPED`.
- Assemblies and derived entry canopies attach to one resolved exterior segment. Rails follow their slab. Unresolved spans produce `FOOTPRINT_ASSEMBLY_UNRESOLVED`.
- Opening identities retain mass/opening/local-storey ownership; split parts add segment suffixes. Selection remains mass-owned. `setComposition` edits and project persistence retain authored operations, not derived meshes.

## Roof compatibility

| Roof | Articulated top footprint |
| --- | --- |
| Flat | Exact polygon plate, authored thickness and overhang |
| Floating flat | Exact polygon plate and discrete perimeter bearings across the existing 0.45 m gap |
| Terrace | Polygon roof plate; separately authored rooftop terraces retain the existing occupancy/guard workflow |
| Mono-pitch | Shared polygon shed builder, sloping thick plate and wall infill |
| Gable / hip / butterfly | Existing roof construction only when the resolved top footprint is the full rectangle; otherwise `ROOF_FOOTPRINT_UNSUPPORTED` and no substitute roof |

An explicit hosted roof must share its host plan origin, yaw and width/depth. Mismatches are reported as `ROOF_FOOTPRINT_ALIGNMENT_UNSUPPORTED`; the roof is not silently relocated. Overhangs creating invalid outlines are diagnosed. Unsupported roofs keep their authored form. Unlike the design document's suggested flat preview, v1 deliberately leaves unsupported roofs unbuilt so they cannot be mistaken for a supported roof family.

## Relationships and limitations

Circulation checks every traversed floor polygon. Containment tests boundary intersections and intermediate spans, so four corners inside a U do not certify a slab bridging its courtyard. Rooftop terraces and stacked building supports are checked against the actual host outline; unsupported placements are diagnosed. Nonrectangular junctions bypass the rectangular wall-erasure/roof-joining solver and retain authored walls.

Estate door endpoints use the same resolved wall selection. Estate obstacle broad-phase tests remain conservative bounding boxes: a route through a notch is not certified by this milestone. Interior room/partition authoring is still rectangular; arbitrary polygon rooms, curve/arc outlines, fully enclosed polygon holes, explicit angled opening edge IDs, domes/cones and nonrectangular pitched roof intersections remain outside v1. Opening rhythms retain original-facade placement; use explicit spans for setback walls. Floor-scoped projections reserve the same core envelope across storeys.

The safe-revision allowlist already protects footprint changes; regression coverage proves it cannot simplify/remove one. No generic mansion shape, complexity quota, courtyard or wing requirement is added to the prompt. Rectangular architecture remains valid.

## Offline acceptance

`/dev/nonrectangular?fixture=l-residence|u-courtyard|chamfered` renders through production `PrimitiveMesh`, edge finishing, scene lighting/environment, shadows and `PostFx`. Four views per fixture expose roof silhouettes, walls, glazing and floor outlines. The edit button changes only the residence footprint; the detached studio is unchanged.

Screenshots: [parity/nonrectangular](parity/nonrectangular/).

- [L residence overview](parity/nonrectangular/l-residence-overview.jpg), [section](parity/nonrectangular/l-residence-section.jpg), [edited](parity/nonrectangular/l-residence-edited.jpg).
- [U courtyard overview](parity/nonrectangular/u-courtyard-overview.jpg), [section](parity/nonrectangular/u-courtyard-section.jpg).
- [Chamfered shed-roof building](parity/nonrectangular/chamfered-overview.jpg), [section](parity/nonrectangular/chamfered-section.jpg).
- Additional plan/facade views and `capture.json` are in the same directory. Captures block provider requests and record browser errors.

Verification includes nine SHA-256 hashes captured from complete compiled scene JSON **before implementation**: cottage, villa, large house, three saved mansions and three functional mansion variants. All remain byte-identical. Tests also cover actual roof triangle cutouts, recessed/projected glazing positions, explicit roof thickness/ownership, floor-scoped operations, unsupported roofs, containment, junction retention, ingestion, safe revision, editing locality and real project-store save/reload.

Results: **514 tests passed across 51 files**; TypeScript, targeted ESLint and diff checks passed. All 13 WebGL captures completed with zero recorded browser errors or provider requests. Final focused footprint and legacy-hash checks also passed after the last integration adjustments.

Commands:

```sh
npx vitest run src/lib/v3 src/store/__tests__/v3ScenePersistence.test.ts src/app/api/ai/house/__tests__/route.v3.test.ts --maxWorkers=3
npx tsc --noEmit
# ESLint run on all implementation, fixture, capture and persistence files changed by this work.
git diff --check
PLAYWRIGHT_DIR=<existing-playwright-install> node scripts/nonrectangular-capture.mjs
```

Ready for more creative generation **within the articulated v1 vocabulary**. Offline compilation and visual acceptance are verified; live Terra generation quality has not been tested, as requested.
