Focused architectural parity implementation

V3 remains the runtime, edit and persistence authority. No Terra/OpenAI requests were made. No production V2 builder was changed. The V2 document adapter exists only in the offline parity fixture; it is never imported by the runtime compiler.

1. Why V2 looked better

V3's explicit `composition.openings` and assemblies already used V2 construction. Its facade presets bypassed that machinery, making one large opening per side regardless of length. `glass-wall` and `window-band` emitted bare panes. `veranda` was an unknown type rendered as a solid box. Pitched roofing discarded V2 edge geometry; mono-pitch roofing was a single surface without thickness or wall closure. These dispatch and construction differences removed the structural rhythm and sheltered outdoor space that make the same masses read as architecture.

2. Ranked gaps and implementation

| Priority | Gap | Classification | Result |
|---|---|---|---|
| 1 | Veranda rendered as solid volume | A/C | Specialized slab, canopy, header and regularly spaced posts using V2 colonnade construction |
| 2 | Facade presets bypass shared openings | C | All presets compile through `buildMassOpenings`; punched/privacy facades gain a length-based opening rhythm |
| 3 | Bare standalone glazing | C | `glass-wall` uses `buildGlazedWallEdge`; `window-band` uses repeated `buildMassOpenings` assemblies |
| 4 | Roof closure and edge silhouette | B/C | Shared shed thickness/infill, gable/hip fascia and ridge/hip caps; terrace roofs gain shared parapets |
| 5 | Cross-mass roof intersections and finish | A/D | Remains: V2 has clearance, roof finish patterns and more complete soffit treatment |
| 6 | Recessed/notched/chamfered footprints | A | Remains: requires a coherent V3 footprint mapping across walls, floors, openings and roofs |

A = missing V3 semantic mapping; B = missing construction capability; C = existing shared builder bypassed; D = material/rendering; E = site/terrain; F = peripheral to architecture. A/C indicates both dispatch and mapping work were required.

3. Feature-by-feature geometry audit

| Feature | Comparison / disposition | Class |
|---|---|---|
| Mass hierarchy | Same living pavilion, lower offset bedroom, small connector | No gap |
| Wing articulation | Authored offsets work; internal footprint projections/notches absent | A |
| Wall runs | Shared segmented wall construction now used by presets and explicit openings | C, addressed |
| Facade segmentation | Repeated punches now replace the old single central punch | C, addressed |
| Punched openings | Wall is omitted in the opening; four hollow frame members surround glass | C, addressed |
| Window bands | Repeated wall/opening/frame assemblies replace a surface plane | C, addressed |
| Full-height glazing | Shared tall glazing with construction head/sill; not literally frameless | C, addressed |
| Corner glazing | Adjacent facade zones work; no dedicated corner/chamfer semantic mapping | A, remains |
| Recessed entrances | Existing reveal recess works; full entry-recess footprint and returns remain absent | A |
| Material zones | Separate authored accent objects work; facade sub-zone mapping and roof finish parity remain | A/D |
| Roof composition | Mixed roof forms work; V3 lacks V2 cross-mass clearance | A/B |
| Overhangs | Authored reach preserved; V2 trims adjoining roofs, V3 does not | A |
| Fascia/parapets | Gable/hip fascia and caps, terrace parapets now shared; flat soffit/detail parity remains | C/D |
| Canopies | Existing canopy retained; veranda canopy now built | C |
| Veranda structure | Open slab/cover/header/post assembly, not a solid proxy | A/C, addressed |
| Columns/posts | Shared colonnade rhythm added; existing column-line unchanged | C |
| Balcony/terrace edges | Existing balcony construction retained; detailed terrace perimeter options remain limited | A |
| Railings | Existing V3 balcony and composition railings retained; not exercised by this ground-floor cottage | A, limited fixture coverage |
| Trim/reveals | Shared glazing frames/reveals and roof trim; richer V2 finish details remain | C/D |
| Indoor/outdoor layering | Veranda opening restores the view through to living glazing | C, addressed |
| Pool/deck relationship | Existing hollow pool and deck subtraction retained and tested | No gap in controlled layer |
| Architectural silhouette | Much closer; roof intersections still distinguish the two paths | A/B |
| Landscape/site | Same V3 terrain, pool/deck, paths, accent and landscape context on both sides | E, controlled rather than independent comparison |

4. Exact mappings and authority

`building-mass` presets → `facadePresetComposition` → `compileV3Composition` → V2 `buildMassOpenings`. Explicit opening and assembly intent retains precedence.

`glass-wall` → V2 `buildGlazedWallEdge`; `window-band` → V2 `buildMassOpenings`; `veranda` → slab + canopy + V2 `buildColonnadePosts`; mono-pitch `roof-form` → `buildPolygonShedRoof`; gable/hip → existing `gableRoofGeometry`/`hipRoofGeometry` plus `edgeBoard`/`lineCap`; terrace `roof-form` → slab + `buildParapetPrimitives`.

Every generated part receives `sourceObjectId`, `semanticRole` and `componentRole`. Shared geometry is transformed once into the authored object's world placement. Hosted roof infill takes the host wall color. Existing generic/proxy resolution remains available for unfamiliar objects. No child becomes an authored object, and no new persistence or active-render authority is introduced.

Standalone glazing does not automatically cut a separately authored host mass. Use that mass's `composition.openings` for a true host opening. General cross-object opening subtraction, structural corner glazing and footprint articulation should be one separate semantic-construction task rather than ad hoc cuts.

5. Matched fixture and metrics

`src/lib/v3/parity/cottage.ts` defines one 12-object cottage intent. V2 architecture uses the actual `compileArchitecture` path, including its own hosted veranda assembly. V3 uses the semantic compiler. Site/amenity context is explicitly shared to isolate architectural differences. Cameras, scale and directional/ambient light are matched in the viewer. Exterior colors are matched where supported; V2 roof finish/trim and V3 implicit roof materials differ and remain visible.

The baseline V3 primitive capture was saved before production changes. The V2 reference adapter was corrected during review to construct its veranda independently and match the preset opening count. Both before/after files use that same corrected V2 reference; no pre-pass V3 geometry was regenerated using the new compiler.

| Diagnostic | V2 reference (both) | V3 before | V3 after |
|---|---:|---:|---:|
| Authored semantic intent objects | 12 | 12 | 12 |
| Compiled primitives | 178 | 137 | 177 |
| Wall segments | 55 | 48 | 57 |
| Facade openings / glazing panes | 15 | 12 | 15 |
| Roof components | 17 | 4 | 14 |
| Requested rectangular overhang area, m² | 86.26 | 86.26 | 86.26 |
| Compiled roof envelope excess area, m² | 23.02 | 86.26 | 86.26 |
| Material color/surface combinations | 16 | 14 | 14 |
| Veranda components | 8 | 1 | 8 |
| Railing/edge components | 4 | 0 | 7 |
| Pool components | 10 | 10 | 10 |
| Fallback-rendered authored objects | 0 | 1 | 0 |
| Proxy primitives | 0 | 0 | 0 |

Counts are diagnostics, not quality gates. A V2 roof mesh may contain many seams/edges, so primitive counts are not complexity-equivalent. Opening counts use transparent window-category panes, not a Boolean aperture analysis. Material combinations are not spatial material regions. Roof envelope excess measures compiled axis-aligned plan bounds minus each mass rectangle, not polygon-union coverage; it is appropriate to this unrotated fixture only. The large overhang difference exposes V2 clearance trimming and must not be interpreted as V3 superiority.

6. Visual loop and stopping condition

Reviewed front and entry geometry renders before and after construction changes, then reviewed the corrected independent V2 veranda and matched opening reference. The veranda changed from a solid obstruction to a covered open room; bedroom facade rhythm now matches; pitched roofs gain closure and visible edge structure. Remaining roof intersections, standing-seam finish and material differences are clearly visible.

V3 now approaches V2 in the fixture's massing, facade and indoor/outdoor composition. This is **partial geometry parity**, not full product visual sign-off. Stop condition B applies: coordinated footprint articulation, hosted opening subtraction and cross-mass roof clearance warrant a separate major task. Copying V2 runtime authority is unnecessary.

Artifacts: `parity/before-front.png`, `parity/before-entry.png`, `parity/after-front.png`, `parity/after-entry.png`, and corresponding model/metric JSON captures. The CPU renderer uses a real z-buffer, matched orthographic cameras and Lambert lighting, with glass opaque blue for geometry inspection. It does not simulate product PBR, shadows or transparency. Browser UI inspection was blocked because Computer Use permissions were unavailable.

The isolated interactive Three.js viewer uses real transparent materials and synchronized orbit cameras, and never writes project state:

```sh
PARITY_CAPTURE=after npx vitest run src/lib/v3/__tests__/parityFixture.test.ts
node scripts/parity-static.mjs after
node scripts/parity-review.mjs after
python3 -m http.server 8766 --bind 127.0.0.1 --directory /tmp/cottage-parity
```

Open `http://127.0.0.1:8766`. Substitute `before` in the viewer command for the saved baseline. The fixture is DEV/test tooling, not a production route.

7. Editability and validation

Tests widen the bedroom, enlarge living glazing via authored composition, change the independent roof material, extend the veranda, lengthen the pool and create a gazebo proxy. Each operation changes authored state, recompiles owned children, and produces identical geometry after JSON persistence/reload. The original fixture remains unchanged. Gazebo edit result: one expected fallback/proxy; baseline cottage: zero. Existing storage, active-source, render-identity and selection tests also pass.

Final full suite: 1,493 passed and 3 skipped across 136 test files (134 passed, 2 skipped). TypeScript, lint and `git diff --check` passed. Production build was attempted; it failed fetching Geist and Geist Mono from Google Fonts because the environment could not establish the connection. No unrelated V2 mock failures were changed.

8. Recommendation

One live expressive-cottage generation is worth spending as a bounded evaluation of whether authored intent reaches these builders, after reviewing the fixture in the product's WebGL renderer. It is not a substitute for the remaining roof/footprint task, and no live generation was run here.

Keep V3 semantic intent → shared deterministic construction → persistent editable V3 world as the recommended production architecture. The architectural direction is sound; this pass does not claim complete V2 visual equivalence or unconditional release readiness.
