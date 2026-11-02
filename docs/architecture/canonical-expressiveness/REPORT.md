# Canonical architectural expressiveness

The existing canonical path was extended, without adding a generation engine. **It can now construct varied, connected exterior compositions from rectangular space allocations, including an asymmetric courtyard and a multilevel waterfront study. It remains an experimental subset, not a demonstrated complete luxury-home generator.** All studies here are developer-authored fixtures. No paid model requests were made and no conclusion about improved AI creativity follows from them.

## 1. What the migration preserved, restricted or lost

The initial migration retained the editable scene, project/history container, normal `OperationScene`/`VillaScene` renderer, deterministic placement, shared-wall construction, hosted cuts and doors, profile floors with stair voids, a straight stair, pools, outdoor slabs and ground surfaces. Rectangular allocations could already be arranged into nonrectangular building footprints. They were not restricted to one rectangular whole-house shell. However, requiring complete equal-length shared edges severely constrained unequal wings and room programmes.

| Architectural capability | Existing engine / construction kernel | Initial canonical path | Current canonical path |
|---|---|---|---|
| Connected, unequal wings; L/U footprints | Individual editable walls/slabs; kernel originally full-edge sharing | Equal full shared edges only | Collinear partial boundaries are segmented and shared once; unequal L/U and asymmetric layouts demonstrated |
| Overlapping masses | Scene can display overlapping components; that alone is not valid construction | Occupied-volume overlaps rejected | Still rejected; conceptual masses may contain touching cells and vertically coordinated allocations; no solid-union or hidden wall deletion |
| Polygonal / curved forms | Extrusion profiles, holes and arc profiles in `profileGeometry.ts`; separate retained curved-pavilion capability; kernel can construct strictly convex polygon cells | No canonical footprint/profile intent | Still inaccessible to canonical Generate. No curve is replaced with a box. A future shape contract needs edge identity, hosting and nonconvex circulation rules |
| Multiple levels | Floor profiles, stairs/voids and arbitrary element elevations | Levels and one bounded straight-flight interpretation | Preserved; stepped levels/roofs demonstrated. Unresolved overlapping wall sections across staggered levels explicitly reject |
| Roofs, overhangs, junctions | Existing gable/hip builders, flat slabs, profile roofs and roof-intersection utilities | Flat roofs only | Explicit flat/gable/hip, selected rise, uniform overhang and per-roof finish. Roof sections must have separated bounds. Valleys, unions and custom profiles remain unsupported |
| Glazing and facade depth | Elevated openings, glazing, slats, facade-bay/reveal helpers, materials | One sill-zero cut per edge; outdoor allocation required even for glazing | Multiple horizontally separated cuts per edge, elevated fixed windows with explicit exterior targets, per-space facade finishes and explicit facade-relative slatted screens |
| Balconies / verandas / terraces | Slabs, roof elements and glazing/railing presentation | Outdoor slabs; no guard intent | Roofed outdoor allocations permit verandas/arrival canopies; editable terraces retained. No complete guarded balcony, columns/foundations or engineered cantilever contract |
| Pools / integrated outdoors | Pool helper, water and enclosing solids | Rectangular basin and relative placement | Preserved; pool and veranda composition demonstrated. Collision checks now work in the common building frame after rotation. No curved/infinity pool, hydraulic or drainage contract |
| Distinctive entrances | Hosted openings, entrance panels and assembly helpers | Door in shared room/outdoor edge | Wide/tall selected doors, differentiated arrival allocation and selected canopy roof. No automatic portico, stair or ornamental design invention |
| Substantial estates | Rich scenes within the existing 400-element limit | Bounded cells plus limited openings/roofs | More expressive wing hierarchy, height/roof differentiation, material and facade rhythm. The 400-element scene ceiling and circulation/site constraints remain |

These are **canonical representation and coordination gaps**, not evidence that the renderer cannot draw curves, rails, richer profiles or intersecting-looking forms. Conversely, the renderer displaying an arrangement does not certify wall unions, structural support, navigation or weatherproof roof junctions.

## 2. Changes and ownership

`plan.ts` retains `architectural-plan-1` with additive optional fields so historical plans remain readable; emitted compilation identifies itself as `architectural-plan-1.1`. The shared kernel identifies itself as `semantic-pilot-1.1`. Saved scenes load their retained geometry, without recompilation or automatic conversion.

The planner still selects dimensions, placement relationships, masses, levels, hosts, openings, finishes and roof sections. New intent includes window sill, roof rise/overhang/material, facade material and explicit screen dimensions/stand-off/slat count. The compiler selects no layout, style, replacement footprint, additional room, roof valley or decorative detail.

The kernel splits collinear boundaries at authored room junctions and between selected openings, then emits separately editable walls with one fitted cut each. Opening positions are calculated on the original directed edge, then mapped into the correct segment. Both sides share the same segmentation. Crossing a junction, overlapping openings, insufficient piers or an incompatible target rejects. Fixed glazing never contributes to the access graph. Exterior doors/open passages require a selected outdoor landing allocation; an `exterior` window does not establish outdoor walking access.

Roof undersides meet selected wall tops; selected rises, eaves and finishes use existing roof builders or profile slabs. Roof/roof bounds, roof/occupied-volume intrusion, roof/floor intersections and site bounds are checked. These checks intentionally reject uncertain close junctions rather than trim geometry. Screens derive transforms from an exposed facade, check dimensions, shared interior boundaries, passable openings and construction intersections, and reuse the existing slat renderer. Every emitted element has source provenance. Shared-wall finish follows the host-side allocation; adjacent rooms do not yet have independent finishes on opposite faces of one wall.

A bounded circulation defect found by the waterfront study is now rejected: a left-side threshold cannot cross the selected straight flight/void while relying on its right-side bypass. This is a specific unsupported-route check, not a general navigation solver. A separate check rejects duplicate vertical wall portions caused by mismatched multilevel shared-envelope heights; the compiler does not guess a new wall junction.

The existing profile geometry builder, element schema/validation, semantic construction kernel, straight-stair helper, gable/hip builders, slat/opening renderer, terrain and water presentation, project store, persistence and Undo/Redo were reused. No mansion template, alternate executor, new scene kind or new renderer was added. Ground landscape skins receive a 2cm construction offset to avoid coplanarity with terrain; planting is still absent.

## 3. Offline whole-composition evidence

| Developer fixture | Editable elements | Sampled physical check groups | Relationship findings | Scope demonstrated |
|---|---:|---:|---:|---|
| Compact family | 44 | 36 | 0 | Stacked rooms, real stair/void, garden access, elevated living window and separate timber screen |
| Waterfront | 67 | 47 | 0 | 4.2m ground storey, upper gallery/suite, unequal wings, coordinated stepped roofs, broad entrance/canopy, veranda, multiple elevated windows, bronze screen and lap pool |
| Asymmetric courtyard | 32 | 18 | 0 | Unequal wings attached along partial edges, connected courtyard, shared gallery, hip roof with overhang above separate flat wing roofs and ground bed |

Each fixture compiles deterministically, retains its exact plan, has provenance for every component and round-trips through scene validation/JSON. Sampled actual floor, threshold, landing, tread and head-clearance probes have zero failures. Pitched roof meshes use the same builders as the renderer; slat probes/drawings use the actual slat boxes. Fixed-window probes are excluded from walking routes. These are bounded geometric checks, not structural, code, drainage, full circulation or aesthetic certification. Roof junction rejection uses conservative envelopes even where the underlying renderer can show more complicated intersections.

| Fixture | Arrival | Aerial | Garden | Poolside | Plans and section |
|---|---|---|---|---|---|
| Compact | [View](compact.arrival.png) | [View](compact.aerial.png) | [View](compact.garden.png) | [View](compact.poolside.png) | [Ground](compact.plan-ground.png), [Upper](compact.plan-upper.png), [Section](compact.section.png) |
| Waterfront | [View](waterfront.arrival.png) | [View](waterfront.aerial.png) | [View](waterfront.garden.png) | [View](waterfront.poolside.png) | [Ground](waterfront.plan-ground.png), [Upper](waterfront.plan-upper.png), [Section](waterfront.section.png) |
| Courtyard | [View](courtyard.arrival.png) | [View](courtyard.aerial.png) | [View](courtyard.garden.png) | [View](courtyard.poolside.png) | [Ground](courtyard.plan-ground.png), [Section](courtyard.section.png) |

Plans/sections are mesh-plane intersections, not substitute intent diagrams. The browser harness renders unaltered compiler output through the existing scene components, checks exact element IDs/local positions/yaw, captures mesh bounds, and exercises actual project-store Undo/Redo after an explicit fixture plan change. It saves locally, performs a full-page reload and restores saved geometry without recompiling. All APIs and non-local page requests are blocked. Browser results and scene/plan/evidence JSON are retained here. The developer viewer now supplies the water ID to the existing Poolside/Garden cameras.

These studies are visually basic. They demonstrate varied composition and construction vocabulary, not beautiful completed estates. Broad blank surfaces, unplanted surroundings, basic doors, absent fit-out and the existing terrain/material presentation remain visible. The waterfront fixture has a pool on flat terrain; it does not model a coastline, sea, grading or marine engineering. The same compiler accepts the compact flat-roof composition, contemporary stepped waterfront composition and courtyard with a hip-roof gallery without a style switch or fixed layout template.

## 4. Live boundary and smallest next step

Normal Generate remains `/api/ai/scene` → one canonical proposal → this compiler → existing scene rendering → assessment. It now receives the extended schema and guidance. A mocked provider-boundary test returns the waterfront plan through the real canonical function and verifies its compiled scene, retained plan and zero repair budget. No second model-authored operations stage or fallback was introduced. Legacy author retirement and saved-project readers remain intact.

Normal Generate is therefore no longer limited to equal-edge cells, flat roofs and sill-zero glazing. **It still uses rectangular space allocations and remains an experimental exterior subset. It cannot promise a complete luxury exterior for an arbitrary mansion brief.** Curved/polygonal footprints, occupied-volume unions, roof valleys, comprehensive facade reveal systems, engineered balconies/guards, general stairs/circulation, grading, planting, engineering and interiors remain unsupported. Unknown authoring fields/unsupported enum values return path-specific contract findings; geometry conflicts return named entities and decisions. No design is silently simplified after rejection. Brief omission by the AI still requires independent programme and rendered review; schema support does not guarantee that the planner chooses good architecture or includes everything requested.

The smallest next live step is a separately authorized **single canonical mansion planning request within the demonstrated scope**, with a brief explicitly selecting connected unequal rectangular wings, coordinated levels, separated flat/hip roof sections, multiple glazing bays, screens, arrival/veranda and rectangular pool. Retain the unmodified plan, compiler version, geometry, provenance and all four views, then accept/reject the candidate after physical and visual review. A failure must retain its findings without an operations fallback or unapproved paid retry. This task makes no paid request.

## 5. Architectural revision contract (live implementation deferred)

Automatic repair remains **zero passes**. The development lifecycle harness proves scene history/persistence using explicit full fixture recompilation; it is not a production plan editor, manual-conflict resolver or AI repair loop.

The minimum safe revision transaction needs:

1. The retained plan hash, compiler version and current scene/version hash, plus review findings bound to source entities.
2. An explicit finite set of changed plan entity IDs, revised architectural intent and reasons. Geometry arrays/operations cannot become a parallel authority. Missing design decisions return to the planner/user.
3. A fresh deterministic compile, physical checks and a component/provenance diff. Recompiling the plan is safer initially than pretending dependency changes are local: global centering, shared boundaries, opening segmentation, heights, roof envelopes and access can affect other components.
4. The existing pilot revision-conflict principle: compare current geometry with the previous generated snapshot, preserve unrelated/manual components and refuse changed dependencies or ID collisions unless an explicit detach/override policy exists. Canonical plan metadata and geometry must commit atomically.
5. Identical review cameras and a new four-view review. Reject newly unsupported intent, physical regression, lost programme, unchanged failure, capture failure or stale concurrent revision. Keep the previous accepted history entry intact.
6. Only after that transaction is proven, an explicit budget of one revision initially (never more than two), with no retry on failure or exhausted budget. A revision may change architecture only through the canonical plan.

This contract requires additional architectural decisions and concurrency/manual-edit policy. Live revision is deferred rather than introducing an unbounded repair loop.

## Verification and preservation

**99 tests pass across 13 files.** Focused ESLint and TypeScript checking of application source plus the new offline scripts pass. The tests cover canonical and mocked provider contracts, the three compositions, rotated roofs/windows/site allocation, preservation, historical project storage/modes, semantic rendering, retained V2 compiler and review. Negative checks cover overlapping openings, junction crossings, nonzero door sills, missing pitched-roof decisions, intersecting roof sections, staggered wall overlaps, obstructing screens, unknown curve fields and stair/void route conflicts. Existing partial-edge rejection and accepted-but-obstructed-stair tests were updated to verify the newly supported boundary and newly rejected route respectively; the remaining preservation/negative checks remain.

Repository-wide `npm run typecheck` still reports the pre-existing broken imports/types in `docs/architecture/design-first/live-2026-10-30/experiment-script.as-run.ts` and duplicate property in `scripts/sol-planning-comparison-review.ts`. Those unrelated evidence files were not changed. No repository-wide passing test claim is made.

No paid model calls, production database changes, credential changes, commits, deployments, historical-project conversions or deletion of existing work occurred. Existing uncommitted work was preserved. Additive fields allow historical flat plans without new roof/screen selections; historical scenes remain authoritative saved geometry.

Offline reproduction:

```sh
npx vite-node --config vitest.config.mts scripts/canonical-expressiveness-offline.ts
npx vite-node --config vitest.config.mts scripts/canonical-expressiveness-drawings.ts --canonical
npx vitest run src/lib/villa/canonical src/lib/villa/experimental/semantic-building/compiler.test.ts src/lib/villa/experimental/semantic-building/generation.test.ts src/lib/villa/scene/generationReview.test.ts src/lib/v3/__tests__/projectMode.test.ts src/lib/storage/__tests__/projectStorage.test.ts src/lib/storage/__tests__/persistence.test.ts src/components/scene/semanticRendering.test.ts src/lib/architecture/compiler.test.ts
node scripts/canonical-expressiveness-capture.mjs
```

Capture requires the local development server on port 3015, Chrome and `playwright-core` (override its path with `PLAYWRIGHT_CORE_PATH`). All browser changes are in an isolated test context. Run `npx tsc --noEmit -p docs/architecture/canonical-expressiveness/tsconfig.verify.json` for source, generated Next types and the new offline scripts, excluding the unrelated evidence errors. Exact source/artifact hashes and verification outcomes are recorded in [verification.json](verification.json).
