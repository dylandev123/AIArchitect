# V3 Estate Spatial Realization v1 + Creative Architecture Foundation

## Implemented

The optional estate circulation `spatial` contract carries world-space source/destination access points, optional building opening ids, pedestrian/vehicle/service use, width and authored waypoints. Existing `from`, `to` and `via` ids remain authoritative. Exactly one exclusive path/driveway owner supplies material and selection identity. At compile time the existing `connectionRibbon` construction builds the route; the ordinary owner box is suppressed. Derived connections never enter persistence or the terrain compiler. Legacy plans and scenes without spatial routes follow their existing compilation path.

The physical audit checks endpoint contact, ground door/glazed-door span, threshold elevation, vehicle opening clearance, nonzero route segments, route corridor site bounds, full-width intersection with solid objects and pools, and missing declared program access. Obstacles are tested in their rotated local footprints, not axis-aligned world bounds. Missing destinations, isolated amenities and unsupported elevations are diagnosed. Authored endpoints and bends are never replaced by guessed paths. Physical routes do not rely on relationship edges as proof of access.

## Creative contract

Terra is instructed to develop identity, scale/program, composition, roof character, arrival, outdoor living, landscape and privacy together before detailing objects. Architectural families and amenities are possibilities, not templates. Explicit user constraints take precedence. No random style shuffling, mandatory pool/court list or fixed mansion layout was added.

Optional `estatePlan.architecture` commitments retain stable object references, a requested form, rationale and minimum width/depth/height. Dimensions apply to each referenced object, not an estimated group envelope. These let a grand court, garden or entrance carry meaningful authored size obligations. Circular/curved/polygonal building claims remain unmet commitments, rather than being certified by a rectangular proxy. A limited literal check also catches those building terms in object names and explicit concept/requirement phrases. This is not general natural-language understanding: omitted commitments and more elaborate paraphrases cannot be reliably detected offline.

## Form capability audit and exact bottlenecks

| Form | Current capability / bottleneck |
| --- | --- |
| Rectangular masses | Supported. `architecture.ts:V3ArchitecturalGeometry` and `runtimeGeometryFromArchitecture` express width/depth/height and yaw. |
| Rotated rectangular masses | Supported individually. `scene.ts:compileBuildingMass` transforms rectangular slabs and walls. |
| Joined rectangular masses; L/U arrangements | Supported as multiple authored masses. `junctions.ts:deriveV3MassJunctions` requires upright masses and relative orthogonal yaw for supported junctions. Skew junctions are retained with diagnostics, not solved. The new commitment audit proves contact connectivity, not exact L/U silhouette. |
| Irregular rectangular composition | Supported as multiple deliberately placed masses; not equivalent to an irregular single footprint. |
| Polygonal footprints | Unsupported for building masses. There is no footprint boundary in `V3ArchitecturalGeometry`; normalization maps named dimensions into box runtime arrays. `scene.ts:compileBuildingMass` constructs rectangular floor slabs. Generic extrusion/mesh helpers are not an architectural footprint compiler. |
| Circular/curved buildings | Unsupported. `capabilities.ts` dispatches `building-mass` to the rectangular specialized compiler regardless of a cylinder geometry hint. Generic cylinders do not supply curved slabs, facade openings or roof semantics. |
| Nonrectangular facades | Unsupported. `composition.ts:compileV3Composition` explicitly enumerates four north/south/east/west edges; openings and assemblies reference those edges. |
| Complex roof intersections | Partial only. `junctions.ts` supports orthogonal flat/floating-flat/gable/hip/mono-pitch roof envelopes; `junctionCompiler.ts` clips envelopes and derives intersection details. It does not solve arbitrary curved, skew or multi-surface roof topology. Standalone roof-family support must not be confused with intersection support. |

No new geometry engine was implemented. Unsupported distinctive forms produce `ESTATE_FORM_UNBUILT`; they remain visible and cannot be erased by safe repair. An unsupported form alone does not spend a futile repair attempt.

## Plan-to-scene and safe repair

Scale commitments compare against actual materialized object dimensions. Planned connected forms need touching building masses. Spatial routes need actual door/surface endpoints and collision-free corridors. Declared program buildings and amenities in spatial-route plans require authored access entries. Gardens can use existing allocations and clear-space volumes together with explicit minimum dimensions; this does not certify planting quality. Monumentality and style remain subjective beyond measurable authored evidence.

The existing one-repair bound is unchanged. The preservation guard permits only the diagnosed route's endpoints/waypoints and targeted appended access openings. It protects route ids, use, width, other routes, program, forms, materials, roofs and unrelated building geometry. A successful repair must resolve a finding without introducing a new significant conflict. Unsupported geometry cannot be repaired by restyling or simplifying it. Some missing-access findings intentionally remain unresolved when adding a route would require new authoring authority.

## Offline evidence

`estateSpatial.test.ts` covers authored ribbon construction and owner identity, persistence purity, full-width obstacles, pools, door/elevation mismatch, off-centre facade spans, disconnected program destinations, safe detours versus forbidden restyling, a connected pavilion route, ambiguous owners and degenerate segments. The three saved generated mansions are compiled and compared after serialization; adding a circular commitment preserves their mesh output while reporting the unmet form. A Mediterranean pitched-roof variant demonstrates supported style expression, while a dispersed irregular rectangular composition and disconnected U claim distinguish arrangement from footprint capability. Existing estate-plan and API tests cover legacy plans and the bounded generation flow. Tests are fixtures/mocks only, with no provider calls.

## Remaining limits

Spatial realization v1 is flat-ground only; scenes with authored site hierarchy or natural ground require the existing separate hierarchy workflow and receive an explicit unsupported-route diagnostic. No advanced terrain code was changed. Routes are piecewise linear ribbons, without road junction design, curved sweeps, turn-radius/vehicle swept-path checks, accessibility/code certification or navigation meshes. Full corridor width is checked on straight segments; corner maneuverability is not certified. Solid collision uses upright footprint plus elevation clearance; arbitrary tilted solids and semantic furniture without collision metadata are not fully modeled. Legacy chain routes retain their prior proximity audit. An access entry per destination does not prove that the whole estate forms one globally connected navigation network. Budget, stylistic fidelity, planting quality and aesthetic ambition cannot be verified numerically.

## Recommended next milestone and live generation

The smallest general architectural extension is a persistent, simple polygon footprint on building masses, with stable edge ids shared by slab extrusion, facades/openings, support/collision and roof generation. Begin with upright simple polygons and flat roofs; retain rectangular compatibility. Then add sampled arc boundaries with deliberate curved-facade semantics, and only later generalized roof intersections. Implementing a cylinder proxy would not meet the circular mansion requirement.

A later authorized live generation is justified to measure whether Terra follows the richer contract and authors coherent spatial routes within the existing output budget. It is not justified as proof that curved buildings can now be built: they cannot. No live generation, commit, push or deployment was performed for this work.

## Takeover verification (2026-10-17)

The interrupted full-suite rerun was completed with `vitest run --maxWorkers=2 --testTimeout=60000`. The original run passed 160 files and 1869 tests, with 3 skipped and no failures, so no implementation fix was required. `tsc --noEmit`, ESLint and `git diff --check` passed. No V2 or terrain files are modified. One follow-up gap was closed: outside estate plans, a building mass with a `cylinder`/`extrusion` geometry hint, or with a curved or polygonal form name, now receives an advisory `UNSUPPORTED_ARCHITECTURAL_INTENT` instead of silently compiling as a box. See `v3-nonrectangular-architecture-design.md` for the freedom audit and the footprint design.
