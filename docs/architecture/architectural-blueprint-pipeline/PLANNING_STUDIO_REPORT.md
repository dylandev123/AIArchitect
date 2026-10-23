# Architectural Planning Studio v1

21 October 2026 · Offline implementation and production-browser verification

One saved V3 architectural design now powers **2D Floor Plan ↔ 3D Blueprint ↔ Finished House** in the ordinary project workspace. Switching views changes presentation preferences. It does not call Terra, create a design, append a design version, or persist another scene.

No Terra/OpenAI requests, paid generations, commits, pushes, deployment, environment-flag changes, V2 feature changes, or advanced-terrain changes were performed. Existing uncommitted work and both recovered source blueprints were retained. Browser verification used isolated fixture projects, never the user's saved browser projects.

## 1. Existing V3 capabilities reused

The implementation reuses the independent architectural blueprint contract; its plan-before-construction approval; ordinary V3 scene persistence; canonical named architecture; articulated and line/arc footprints; semantic storeys, rooms, partitions, doors and stairs; host-relative facade assemblies; explicit roof construction; entrance-derived estate routes; construction receipts and Draft acceptance; semantic editor operations; and append-only version history with undo/redo.

The existing production `HouseRenderer`, `PrimitiveMesh`, camera controls, PBR materials, water, vegetation and finished-scene lighting remain responsible for Finished House. There is no alternate finished-property builder.

## 2. Architectural source of truth

During authoring, `v3-architectural-blueprint-1` owns the design decisions once. The existing adapter deterministically lowers those decisions into the **one persisted `V3Scene`**. Its named architecture/composition, interior datums, estate plan, openings and routes become the editable project authority. The independent input document and in-memory approval are not saved as another live model.

The planning views read the same active-source selector as the production renderer, including render-history and failed-preview identity. Noncurrent sources remain read-only. Presentation preferences live in optional `Project.architecturalView`: mode, floor index, drawing scope and cutaway. They contain no geometry. Existing projects need no scene-format migration.

`architecturalPlanning.ts` derives footprints through the existing resolver, rooms through the existing host/storey transforms, and drawing geometry from actual compiled box/triangle primitives. Floors, rooms, entrances and walls are never recreated from a prompt or image. The same stable semantic identities drive selection and editing.

## 3. Design-stage workflow

The existing one-call blueprint prompt now explicitly guides Terra through these inherited stages:

1. Estate master plan: concept, orientation, hierarchy, arrival, privacy, views and outdoor relationships expressed as actual placement and route decisions.
2. Functional floor plans: proportions, circulation, public/private/service relationships, stair reservations, coordinated boundaries and real opening offsets.
3. Architectural massing: develop those footprints into supported volumes and storey heights, retaining the earlier plans.
4. Exterior architecture: reconcile facade rhythm, openings, shade, material bindings, entrance depth and roof compatibility with those same volumes.
5. Construction handoff: reconcile containment, partitions, stairs, entrances, routes, dry outdoor circulation, pool/terrace datums and supported roof forms before returning the single blueprint.

These are conceptual stages inside the existing authoring call, not five model calls or independently generated plans. The existing bounded objective-repair policy and server-owned `AI_V3_ARCHITECTURAL_BLUEPRINT` routing remain unchanged. The workspace switch is available for existing V3 scenes independently of whether a new-generation flag is enabled.

## 4. 2D Floor Plan

The SVG architectural drawing provides estate boundaries, resolved building outlines including curves/notches, room names and dimensions, real wall sections and glazing, actual stair geometry, pool/terrace/landscape/path projections, floor selection, building scope, north indication, measured envelope dimensions, a world-unit graphic scale, zoom, fit and drag-to-pan.

A horizontal section is taken through each selected building floor's constructed primitives. Headers above the cut plane cannot close a door opening. Internal opening markers use the same derived partition-wall openings as construction, including their boundary origin and host rotation. They represent apertures, not fictitious door leaves or swing directions. Dashed room extents distinguish functional allocations from built partitions. Original invalid room extents remain visible in recovered Drafts rather than being silently clipped into a new layout.

The 2D drawing batches paths per primitive and omits the redundant flat terrain tessellation. It neither recompiles the 3D scene for zoom/selection nor changes its architecture. Floors absent from a building do not acquire invented walls or rooms.

## 5. 3D Blueprint

The existing production primitive renderer now has a neutral presentation material and derived edge linework. Geometry and semantic ownership stay the same. Decorative vegetation, photographic material detail and finished-scene atmosphere are suppressed for spatial clarity.

The cutaway hides roof-category geometry and clips each building and its interior parts at the selected storey's own world datum. Buildings with different floor heights use separate clipping planes. Turning the cutaway off exposes the full neutral architectural model and roofs. An estate drawing selection with cutaway uses the ground-floor section; turn cutaway off for whole-estate massing.

The Canvas/Three scene is retained, and the keyed production house renderer remains mounted across presentation-lighting changes. The browser verification compares actual mounted mesh positions, rotations, vertex arrays and instance identity across neutral and finished views, excluding intentionally hidden roofs and water's presentation-specific mesh.

## 6. Finished House integration

Finished House uses the existing production branch, with its roofs, detailed facade parts, authored materials, pools, supported amenities, landscaping presentation and complete property. No finished-house renderer, ground compiler or terrain policy was replaced. Reopening a project restores its last workspace mode and floor.

## 7. Synchronized editing

Clicking a floor-plan building, room, partition or internal opening selects its existing semantic identity. The ordinary Advanced Properties inspector now exposes room extent numbers and a storey inspector. Supported edits append existing project versions; view preferences do not.

Room edits reuse `editRoom`; partitions and openings derive again from their authoritative boundaries. Existing door offset/width and facade-opening inspectors remain available. Geometry that cannot satisfy the current construction/Draft rules is refused with an error and the saved scene retained. A room-extent change is not advertised as arbitrary wall dragging.

For tracked architectural scenes, building placement edits use lossless checkout and the existing blueprint revision/three-way merge. The location is changed once; the host roof, room transforms and entrance-derived routes inherit it. Storey-height editing uses that same supported replan path, updating mass height, cumulative floor elevations, partitions and roof datum together. Unsupported or lossy round trips fail explicitly; existing scene/JSON editing remains available. Roof/profile edits retain the existing V3 capability boundary.

Production-browser checks cover numeric room edits, undo, redo, persisted reload, storey-height replanning and coordinated building/roof movement. Unit/store checks also compare the resulting 2D projections to the existing 3D datums. No CAD drag handles are implied or enabled.

## 8. Architectural planning improvements and coherence

The recovered estates' main limitation was underdeveloped authored composition, compounded by local contradictions and contract limits—not wholesale disappearance of an exceptional design. The new prompt addresses actual geometry, circulation, proportions, material assignments, climate response and outdoor datums. It explicitly explains metre-valued door offsets and pool rim = base + height, and distinguishes authored assemblies from luxury prose.

The existing preconstruction gate still checks IDs/references, actual footprint containment, room/partition coordination, entrances, stair relationships, route access/collisions, site allocations and supported roofs. Existing deterministic derivation resolves roof placement, floor datums, entrance contacts and route envelopes. No new aesthetic rejection threshold or autonomous architectural redesign was introduced. Draft/Complete/Cannot Construct classification and object diagnostics remain intact.

This does not certify full room-to-room navigation, egress, construction value or architectural excellence. It also cannot establish improved future Terra quality without later natural-model evaluation.

## 9. Offline demonstration and screenshots

Both recovered originals were replayed unchanged through the current offline plan/construction path. Both remain editable Drafts. Their source-byte SHA-256 values are:

- 20 October: `f489d79d6830a9787ae173fdd012a459b36edbc93b638219f94bc454dbb1e394`
- 21 October: `b78f82e1b55e0ce9e78b01e40f2a4b0ed8d4841ac3e86f1b6b96923887fb94bb`

The separate `planningStudioBlueprint()` demonstration develops the existing offline Crescent Lantern capability fixture. It adds a deeper upper loggia, distinct garden/arrival rooms, an actual sheltered-arrival terrace and route, and a coordinated private upper gallery with dressing/bath access, partitions and doors. It is not a recovered blueprint edit, production template, or natural Terra success. The property constructs as Complete under the supported software contract.

All screenshots below use the ordinary production workspace and renderer with the same saved fixture scene in each row. They were captured and visually inspected; additional roof-toggle and post-edit views are in the capture manifest.

| Design | Master plan | Ground floor | Upper floor | 3D Blueprint | Finished House |
| --- | --- | --- | --- | --- | --- |
| Recovered 20 October | [Plan](planning-studio/2026-10-20-master-plan.jpg) | [Ground](planning-studio/2026-10-20-ground-floor.jpg) | [Upper](planning-studio/2026-10-20-upper-floor.jpg) | [Blueprint](planning-studio/2026-10-20-blueprint.jpg) | [Finished](planning-studio/2026-10-20-finished.jpg) |
| Recovered 21 October | [Plan](planning-studio/2026-10-21-master-plan.jpg) | [Ground](planning-studio/2026-10-21-ground-floor.jpg) | [Upper](planning-studio/2026-10-21-upper-floor.jpg) | [Blueprint](planning-studio/2026-10-21-blueprint.jpg) | [Finished](planning-studio/2026-10-21-finished.jpg) |
| Hand-authored Lantern Garden | [Plan](planning-studio/improved-master-plan.jpg) | [Ground](planning-studio/improved-ground-floor.jpg) | [Upper](planning-studio/improved-upper-floor.jpg) | [Blueprint](planning-studio/improved-blueprint.jpg) | [Finished](planning-studio/improved-finished.jpg) |

[Capture manifest and geometry-identity checks](planning-studio/capture.json) · [Validation record](PLANNING_STUDIO_CHECKS.json)

## 10. Remaining unsupported planning capabilities

Arbitrary CAD wall/vertex dragging, curved functional room boundaries, per-storey changing outlines in this adapter, complex intersecting roof groups, arbitrary stacked-mass round trips, door leaves/swing/hardware, automatic threshold steps/ramps, engineered infinity-pool edges, authored planting/species layouts, bespoke facade-part finishes, furniture/equipment and comprehensive egress/navigation remain outside this milestone. Existing supported editor features are not erased by an unsupported blueprint round trip.

The 2D view is a metrically coordinated inspection/editor view, not a permit-ready CAD export. Curves follow the same production tessellation as V3. Building dimension strings describe their world-axis envelope; room dimensions are their authored local dimensions. Whole-estate framing can be distant; existing house/zoom/orbit camera controls provide closer inspection. Performance evidence covers these fixtures, not an arbitrary maximum-size estate benchmark.

## 11. Tests and performance

Final result: **2,342 tests passed, 3 skipped, zero failures across 193 files**. Seven focused studio tests pass. TypeScript, zero-warning ESLint, production build and whitespace checks pass. The final production browser run captures **24 screenshots**, with zero browser errors and zero provider-route requests. Shared mounted geometry is identical across views for 315, 208 and 192 meshes respectively; mesh instances and the Three scene are retained.

Offline projection derivation on the three fixtures measured approximately **0.4–3.2 ms**, with scene compilation **11.6–25.9 ms** on this machine. These are single-run measurements. Browser switches measured approximately 58–707 ms including automation and material changes; see the manifest for the actual final measurements.

See the validation record for exact commands/results, fixture timings and source hashes. The final suite uses two workers to avoid resource-contention timeouts observed when the initial unrestricted run overlapped the production build. No timeout thresholds or construction assertions were relaxed.

TypeScript, ESLint with zero warnings, the production build and `git diff --check` were run. The ordinary build initially failed to fetch the existing Google Geist fonts under restricted network access; rerunning with network access passed without changing font code or dependencies. ESLint initially traversed an archived Next build under `.v3-debug`; that generated evidence directory is now explicitly ignored while all application, script and test source remains linted.

2D projections memoize by source/floor and batch SVG paths. The hidden 3D Canvas pauses its frame loop in floor-plan mode. The browser proves no provider requests and no design/history changes on switches. Recorded browser switch times include automation/event dispatch and material work, not a guaranteed frame-rate metric. Offline projection timings measure geometry derivation only; they exclude React paint and GPU work.

## 12. Recommended next milestone

Review the offline references at architectural and human-height camera scales, then add an advisory design-quality review that identifies specific unsupported claims and unresolved spatial relationships without mandating a style or object count. Improve floor-plan allocation and private-space coherence as demonstrated by the plan view. Extend the contract only for a demonstrated visual obstruction, with structured planting and material bindings strong candidates.

After that offline review, propose an explicitly authorized, bounded natural-model comparison across varied briefs, with architecture judged separately from acceptance status and rendering. Retain exact requests/responses and all three synchronized views for evaluation.

## 13. Further paid generation: NO-GO

The synchronized studio and deterministic construction foundation are demonstrated offline. Reliable production of extraordinary architectural designs by the revised Terra prompt remains unmeasured. The hand-authored example establishes capability, not the probability of a good generated result. Further paid generation should remain gated until the offline quality review and a concrete evaluation budget are separately approved.
