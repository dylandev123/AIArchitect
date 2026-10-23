# Architectural estate expressiveness — 21 October 2026

**PASS for ambitious offline representability and geometry-preserving construction. Ready for a new ambitious 2D evaluation within the limits below. Terra's live architectural quality remains unmeasured; no generation was run.**

Open the [read-only local comparison](http://localhost:3000/dev/estate-expressiveness). It uses the production `ArchitecturalFloorPlan` component and production `PrimitiveMesh` renderer. The references are independent technical examples, never provider templates, fallback designs or replacements for the paid estate.

**1. Why the saved estate looks basic**

The saved response itself chose the simple composition. Its main house is a 58 × 34 m articulated rectangle with a small entrance recess and loggia; its guest pavilion is rectangular. All seven outdoor boundaries are rectangular. The room allocations are rectangular, and the three connections use straight segments. Normalization did not turn richer authored curves into these rectangles.

The preceding prompt already asked for a spatial idea and a composition review. Those instructions did not produce a strong architectural result in this retained response. They also lacked an operational floor-planning method and clear examples of usable expressive geometry. The compact advertised schema omitted `roomAdjacencies`, although compatible legacy documents could supply them.

There was also a genuine technical mismatch: the plan schema and 2D renderer accepted line/arc outdoor boundaries, but the Build preflight rejected **every** nonrectangular feature. The pool, courtyard and landscape builders still constructed rectangles. An unknown type named “fountain” could be drawn as a reservation but could not construct a fountain. Route authoring offered only polylines; writing “curved driveway” in a label could not produce an analytic curve.

**2. Production capability trace and before/after status**

| Architecture | Before this work | Current production path / limits |
| --- | --- | --- |
| Curved arrival approach | Named endpoints and straight waypoint segments only. A dense polyline could approximate a curve. | Optional exact line/arc `connections[].path` persists into `estatePlan.circulation[].spatial.path`, resolves from the same endpoints, and drives 2D drawing, collision probes and the 3D ribbon. Invalid continuity, endpoint drift, competing waypoints/approaches and too-tight radii are rejected. |
| Circular motor court/plaza | Circular feature boundary could be drawn/saved in 2D; construction was blocked. | Circular driveway/terrace boundaries construct as real meshes. A separate water basin cuts out the intersecting paving, producing an island without a rectangular filler. |
| Circular fountain | An unknown feature reservation; no specialized construction. | `fountain` constructs a basin floor, hollow shell, coping, water plane and a central jet. Its local origin must fit inside the basin. Fountain water is excluded from dry route destinations and treated as an obstacle. |
| Curved/polygonal pools, terraces, landscape zones, paved paths and courtyard perimeters | Existing line/arc footprints supported in 2D, rejected at 3D handoff. | The existing V3 footprint resolver, triangulation and extrusion utilities now construct their actual boundaries. Nonfolding basin/perimeter insets are checked before construction. Landscape presentation planting respects an explicit boundary. |
| L/U/H buildings | Already possible through notches/recesses or a concave outline; largely underused in the paid response. | Preserved, demonstrated with a two-storey U and H. These are geometric arrangements, not magic shape names. |
| Multiple wings / connected volumes | Existing building array, explicit relationships, datums and V3 junction construction. | Demonstrated with an H residence touching a lower library wing. Ground-only volumes no longer incorrectly appear in upper-floor 2D drawings. Overlapping outline/curved volume unions remain unsupported. |
| Meaningful conceptual room boundaries | Rectangular host-local room zones, shared-boundary derivation, optional legacy adjacency ledger. Room errors could remain in a Draft. | Compact authoring now exposes same-storey adjacency intent. Instructions require a circulation skeleton, useful shared edges, room proportions, suite sub-zones, public/private/service separation, stair approaches and aligned landings. Rooms remain conceptual rectangles; no polygon partition engine was added. |
| Multiple storeys | Already supported with authored heights, room/storey identities and stair/lift reservations. | Verified across save/reload and construction, including clear floor-specific drawing and unchanged room/stack geometry. Stair reservation alone still does not certify its flight; the mock exterior chooses usable flight details inside the fixed reservation. |
| Covered terraces / integrated pools | Rectangular canopies and terraces; pool deck cuts assumed rectangular water. | Nonrectangular terrace/pool boundaries and their actual cutouts are supported. Existing rectangular canopies and host facade assemblies supply cover. Nonrectangular canopies remain blocked explicitly. |

The actual chain is `v3PlanAuthoringSchema` → `expandPlanAuthoring` → `v3ArchitecturalPlanSchema` → `preparePlanEvaluation` / existing blueprint lowering → V3 semantic fields → `deriveArchitecturalPlan` → `ArchitecturalFloorPlan`. Exterior development uses `checkoutPlanEvaluation` and `elaborateV3ArchitecturalPlan`, then the existing blueprint planning/construction/acceptance functions. `sameArchitecturalPlan` protects both exact feature boundaries and the new route path segments.

The extension is confined to V3. `siteFeatureConstruction.ts` is a component builder using existing footprint/mesh utilities, not another architecture engine or persisted layout. Old scenes without the new shaped features retain their prior construction; the nine existing V3 compilation hashes pass unchanged.

**3. Architectural composition and floor-plan intelligence**

The shared initial design process now asks Terra to choose what makes an ambitious brief exceptional and embody that choice in actual geometry. Arrival sequence, mass hierarchy, courtyard relationships, privacy, view framing and shaded outdoor living are possible strategies. No fountain, wing count, shape quota, style or fixed luxury template is mandatory.

Floor organization now precedes room packing: draw the entrance, galleries/corridors, stairs and landings; distinguish public, family, guest and service paths; keep ordinary access out of private bedrooms and kitchen work areas; connect kitchen/pantry/dining; split suites into useful zones; check room proportions, host containment and actual shared boundaries. Align landings and wet/service zones between floors and choose deliberately which volumes have upper storeys. Adjacency text does not claim a built door. Existing protected-plan instructions still govern later exterior development and bounded repairs.

The renderer now distinguishes driveway surfaces, labels amenities and fountain symbols, identifies stair/lift reservations on relevant floors, and uses room labels for entrances. Curved paths serialize to micrometre precision for stable Node/Safari hydration; authoritative numeric geometry is untouched. Drawings no longer fill shaped courtyard centres or pool cutouts with paving. These changes improve truthful reading of authored geometry; they do not make the old paid design more ambitious.

**4. Offline demonstrations and evidence**

| Reference | Actual 2D output | Production construction result |
| --- | --- | --- |
| Before: retained paid composition, including only its already documented local preflight corrections | [Estate](estate-expressiveness/before-paid-estate.png), [ground floor](estate-expressiveness/before-paid-ground.png) | Comparison only; original source bytes and saved estate are not edited. |
| Sea Court: formal circular fountain court, curved gate approach, rotated concave garden, two-storey U, independent guest pavilion, shaped pool/terrace and covered outdoor living | [Estate](estate-expressiveness/formal-arrival-master.png), [ground](estate-expressiveness/formal-arrival-ground.png), [upper](estate-expressiveness/formal-arrival-upper.png) | `complete`; zero blockers; 45 room zones, 10 features; exact plan preservation and lossless reload. |
| Garden Wings: two-storey H with galleries, stair/lift bridge, planted courtyard perimeter and connected single-storey library | [Estate](estate-expressiveness/articulated-wings-master.png), [ground](estate-expressiveness/articulated-wings-ground.png), [upper](estate-expressiveness/articulated-wings-upper.png) | `complete`; zero blockers; 23 room zones, 4 features; exact plan preservation. The low library is absent on the upper drawing. |

These PNG/SVG drawings come from server-rendering the **actual production React component**, not a separate illustration. The local browser comparison was also inspected in Safari; the formal arrival reference was viewed with the production 3D mesh renderer. Both reference layouts were verified through the actual production route and SDK parser using mocked transport, including compact authoring and subsequent exterior development. No network socket or live provider was used by those tests.

[Machine-readable checks](estate-expressiveness/checks.json) and the adjacent plan/constructed-scene JSON files preserve the examples. Reproduce with `./node_modules/.bin/vite-node --config vitest.config.mts scripts/estate-expressiveness-evidence.ts`. The evidence script has no network or browser-storage operations. PNG previews are rasterizations of the SVG exports.

Tests independently check the circular basin area, absence of paving through fountain water, required shell/jet parts, lost-part rejection, real room containment/shared adjacencies, exact saved path segments, radius samples, curve failure cases, upper-floor visibility, garden planting containment, authoritative-plan drift rejection and construction receipts. Existing route tests verify no automatic provider calls for blocked plans. **186 focused tests pass across 15 files**, including 37 production route/SDK tests. The nine byte-identity V3 geometry baselines, TypeScript and focused ESLint pass.

**5. Architectural freedom that remains limited**

- Room regions, derived room boundaries and detailed partition contracts remain rectangular. Curved/polygonal room partitions, split-level room layouts and explicit per-room rotations require a separate coherent extension.
- A single building outline has no holes or splines. Courtyard arrangements must use supported recesses or connected volumes; arbitrary overlapping curved volumes cannot be Boolean-unioned.
- Nonrectangular canopies, detailed site-edge railings and arbitrary sculptural fountain equipment are not supported by this extension. Fountain jets have a deterministic component design, not an authored hydraulic system.
- Tight concavities/narrow necks that fold a basin/perimeter inset are rejected. Curves are preserved analytically in semantics and tessellated for rendering/construction at the existing V3 sampling tolerance.
- Advanced terrain, surveyed sea/wind/site conditions, cost verification, structural engineering and construction documents were not changed or certified. New references exercise the flat-site production blueprint path.
- The plan/exterior split still defers detailed interior walls/doors. An adjacency ledger is conceptual functional intent, not a complete certified access graph. Existing Draft tolerance can retain room-allocation defects; this work does not disguise those as good architecture.

**6. Readiness and protection of existing work**

The system can now represent and hand off a materially more ambitious estate than the saved response demonstrated. A new 2D request can use formal arrival design, circular amenities, sculpted landscape boundaries, articulated wings and deliberate multi-storey planning without the user specifying each element. The next live output still needs architectural review; synthetic examples prove capability and preservation, not Terra's design judgment or a $15 million cost estimate.

The paid response fixture and original response artifact were not rewritten. No saved estate geometry was changed. No live Terra/OpenAI calls, charges, commits, pushes, deployment, V2 edits or advanced-terrain edits occurred. Existing unrelated working-tree changes were retained.
