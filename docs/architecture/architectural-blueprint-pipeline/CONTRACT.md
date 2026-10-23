# Independent V3 architectural blueprint contract

**Current authoring:** new flagged flat-site requests use the plan-first input described at the end of this document. [Design restrictions audit](DESIGN_RESTRICTIONS_AUDIT.md) records the current prompt, optional conceptual-detail collections and remaining capability limits. Earlier complete-blueprint sections describe the downstream/recovery contract, not a second production authoring response.

**Build-first update:** [BUILD_FIRST_REPORT.md](BUILD_FIRST_REPORT.md) supersedes the all-or-nothing behavior described below for the opt-in independent production branch. Strict/offline callers retain their existing default; production can save explicitly labelled, editable drafts with localized defects. Primary architectural checks remain blocking.

20 October 2026, America/St_Lucia. Independent construction contract, with a default-off production authoring branch. It is not a stored project format. See [full-property expansion](FULL_PROPERTY_REPORT.md).

The current [production reliability gate](PRODUCTION_RELIABILITY_REPORT.md) adds plan-only opening/door clipping and identity checks, complete construction-part receipts, abnormal-output rejection, explicit zero SDK transport retries and read-only flag diagnostics. Interior door records construct rectangular partition cutouts without leaves/hardware; archways and door records on unconstructed partitions are refused. Exterior doors belong in facade openings. These acceptance checks apply to the independent blueprint workflow; they do not migrate legacy scenes.

The executable schema is [`v3ArchitecturalBlueprintSchema`](../../../src/lib/v3/architecturalBlueprint.ts). Its discriminator is `format:"v3-architectural-blueprint-1"`. It deliberately differs from the legacy `estatePlan.blueprint` version-1 reference index. Those names are not interchangeable.

## Design authority

| Input | Authoritative decisions | Derived V3 representation |
| --- | --- | --- |
| `concept`, `character`, `requirements`, `program`, `forms`, `considerations` | Creative identity, explicit user constraints, chosen functions, hierarchy, views/privacy intentions | Existing estate-plan semantics; subjective claims stay unverified |
| `site` | Fixed width/depth, north = −Z, flat datum 0, grass ground colour, named boundary access points | Existing flat V3 site and `siteAccess`; no terrain extension |
| `materials` | Unique major finish identities and PBR families | Material values copied into their existing V3 owners, never independently authored again |
| `buildings[].location` | World X/Z, base elevation and yaw in radians | Named architecture and compatible runtime arrays |
| `buildings[].plan` | Rectangle: width/depth. Articulated: placement envelope plus existing operations. Outline: line/arc segments only | Existing `composition.footprint`; outline addressing envelope measured from exact arc extrema without moving its origin |
| `buildings[].storeys` | Stable storey IDs, ordered floor-to-floor heights, major local rectangular functional spaces | Mass height = sum of heights; level count = length; finished-floor elevations = cumulative height + existing 0.26m slab; room host/storey references derive from nesting |
| `buildings[].facade` (including explicit `openings` and optional host-relative `assemblies`) | Explicit openings and wall/segment spans, main-entry reference/canopy depth, facade roles, mass hierarchy, explicit slab/post/beam/railing assemblies and space-height intent | Existing composition semantics; no separately positioned wall objects |
| `buildings[].roof` | One roof identity per mass, supported family, pitch in degrees, overhang, layer thickness and primary finish | Editable explicit V3 roof: origin/yaw/footprint/bearing datum derive from its mass; rise follows existing roof builders |
| `entrances` | Stable entrance ID, host, opening reference and local level | Existing blueprint entrance index; no entrance coordinates |
| `features` | Chosen terrace/courtyard/pool/landscape-zone/canopy dimensions, location, base and primary finish; explicit canopy style; optional terrace guard/open edges | Existing specialized V3 objects and builders |
| `connections` | Named route and owner IDs, use, width, endpoints, optional entrance approach distance, explicitly designed bends and finish | Existing estate spatial route, canonical ribbon, contact normals and selectable owner bounds |
| `verticalCirculation` | Existing host-local stair/lift reservations, levels, type, direction and turn | Existing resolved datums, treads, landings, openings, guards and shafts |
| `zones` | Derived membership envelopes or explicit reserved bounds and clear volumes | Existing zone geometry; reserved constraints are never enlarged automatically |
| `relationships`, `roomAdjacencies`, `partitions`, `doors` | Named physical relationships and actual room boundary/partition/opening decisions | Relationship declarations emitted from the one declaration; existing interior boundary and wall construction |

Every coordinate has one role. A placement envelope and an articulated notch are not two independently positioned outlines. Storey heights are not repeated as a building height. An outline has no separately authored width/depth. A roof has no independent placement or envelope. A connection has no path box or duplicated entrance/gate contact. A dry-surface contact is authored once in that surface's local frame. Its graph endpoint and world point are projections.

`surfaceId` is an identity, not geometry. Building/roof/room/storey/partition/door/circulation/object IDs share the scene semantic namespace. The material namespace is separate. Existing estate/index schemas enforce their semantic ID/reference constraints. Generated index records use deterministic `bp-<id>` identities; collisions fail instead of being renamed.

## Capability boundary

This adapter supports independent, unstacked building masses, uniform storey heights within each mass, existing simple clockwise line/arc outlines without holes, articulated operations, one compatible host-derived roof per mass, rectangular functional spaces, existing partition types, host-relative facade assemblies, explicitly solid/slatted canopies, and flat ground estate routes. Neither a second AI call nor an unknown feature name grants a capability.

Roof families: flat, floating-flat, mono-pitch, hip, gable, butterfly and terrace, subject to the existing footprint compatibility rules. Curved/articulated hosts cannot use unsupported hip/gable/butterfly combinations. Pitched families use 1–60 degrees; flat families use 0. Domes and other requested unsupported roof families produce explicit diagnostics. No flattening or substitute roof is constructed.

V3 currently imposes several construction policies. The adapter refuses conflicting design requests instead of changing those policies:

- Courtyards are perimeter rings with fixed `#b8ad98` paving and roughness 0.74, at least 0.14m thick. They are not fully paved rectangles. Custom courtyard finishes need a builder extension.
- Landscape zones construct grass groundcover, at least 0.12m thick, with roughness 0.9 and authored colour. A zone is not authored tree/shrub/equipment geometry. Presentation vegetation is outside this proof.
- Building material means primary wall finish. Glass is specified through facade openings. Pool material means its water finish; coping/shell are existing construction policies.
- Roof finishes that V3 would replace with its composition roof finish, automatic eave trimming, facade reversal, whole-volume double-height erasing multiple storeys, and bay fitting that would narrow explicit rhythm windows fail this adapter's compatibility check.
- Facade openings must be explicit (`[]` means intentionally solid); stairs must specify type/direction and turning stairs their turn. Missing decisions fail before elaboration. Assemblies need nonempty real parts, existing local levels/segments and valid railing slab references/edges. Articulated attachments use the same plan-only wall resolver as construction. Empty assemblies and unsupported attachment planes fail rather than being relocated.
- Assembly slab paint follows the host with existing builder surface policies; posts/beams use existing dark trim and guards existing glass. Bespoke part finishes need a builder/contract extension.
- Canopies require explicit `canopyStyle:"solid"|"slatted"`, plan spans >=1m and height >=2.2m. Solid construction uses two existing front posts; slatted construction uses four posts, headers and derived slat spacing. These are declared construction policies, not inferred architectural equipment. Canopies are not dry route-contact surfaces.
- Rooms define functional spaces, not automatic private walls. Only explicit partitions/doors build interior walls/openings. Unknown partition/door program types fail the input contract rather than invoking generic fallback.
- Finished-floor versus flat route/surface level changes are not resolved into steps/ramps. Horizontal contact is not flush-threshold certification. Pool access equipment is not invented.

Bespoke assemblies/part finishes, complex roof groups/intersections, explicitly hosted/stacked masses, arbitrary site features, curved room boundaries, furniture, engineered structures, complete navigation/egress and detailed planting are outside this slice. Current V3 may support some of these through its regular editor; unsupported *adapter round trips* do not mean the existing object cannot render.

## Actual boundaries

```ts
const planning = planV3ArchitecturalBlueprint(rawBlueprint);
if (!planning.approval) return planning.findings;
// No compileV3Scene has run yet. No objects/model were returned to the caller.
const built = constructV3ArchitecturalBlueprint(planning.approval);
if (!built.ok) return built.findings; // no scene/model on failure
// Save through the existing V3 project root, with built.scene only.
```

Planning parses strictly, resolves supported semantics, checks complete major-space/storey declarations, materials, IDs, references, real footprints, room containment, roof compatibility, routes and physical constraints available in plan geometry. Existing spatial audits run with construction evidence disabled: they cannot invoke full scene compilation or claim a compiled passage. Static stair reservation/usability/approach checks remain. Compiler override policies are checked without constructing the detailed scene. An immutable private semantic snapshot and the existing blueprint decision comparison are captured behind an in-memory approval handle.

Construction uses existing production ingestion, detailed validation/design consistency, compiled geometry checking and `compileV3Scene`. The normal compiled access/stair evidence stays enabled here. Any semantic mutation by ingestion, unsupported effective compiler override, missing architectural component or missing designated entrance rejects construction. The adapter adds no renderer, mesh engine, migration or provider. The separate production orchestration below consumes the existing bounded request budget. Preliminary approval is deliberately not a certificate that all future detailed physical checks will pass.

## Persistence and editing

Only the ordinary `V3Scene` is stored. The independent input document and approval are not attached to its metadata or estate plan. Audit fixtures and reports are evidence, not live project authority. Runtime transforms, route-owner bounds and explicit roof placement produced by lowering are ordinary V3 compatibility projections at that boundary.

`reviseV3ArchitecturalBlueprint(currentScene, baseApproval, nextBlueprint)` validates a new design and computes a three-way semantic change using stable identities. Unchanged local material/window edits and unrelated added objects survive. Concurrent edits of the same changed coordinate/value fail atomically. Deleted edited elements and colliding newly added IDs also require explicit reconciliation. The merged scene must pass the existing full construction gate; the input scene is never mutated.

After reload, `checkoutV3ArchitecturalBlueprint(currentScene)` reconstructs an editable independent document from current supported V3 semantics. It compares the projection back to the scene before returning it. Missing room programs, legacy independent roof envelopes, unsupported assemblies, extra architecture or other data loss cause an explicit refusal. No existing scene is migrated, simplified or erased. The ordinary V3 editor remains available.

Ordinary V3 scene edits keep their existing semantics. An explicit user move of an independently editable V3 roof is a new scene decision; an old input document is not a hidden master that overwrites it later. This slice does not retrofit automatic roof-following into every legacy `editArchitecture` operation. A blueprint replan updates its derived roof/routes together; a current scene outside the supported host-derived contract cannot be silently checked out. Subsequent UI integration must make this distinction visible.

## Production authoring branch, disabled by default

Author one complete `v3-architectural-blueprint-1` document. Resolve concept, program, site strategy, footprints, storeys, major functional spaces, circulation, entrances, roof intent, outdoor composition, materials and explicit constraints in that document. Choose the style, scale, building composition and amenities from the brief; there is no required mansion layout, pool, luxury checklist or fixed template. Empty collections are appropriate only for components intentionally absent. Distinguish user requirements from design choices. Do not return `objects`, runtime transforms, meshes, independent roof coordinates, repeated path-owner boxes or another scene. Use the executable schema and supported V3 semantics. Report capability gaps instead of silently simplifying an explicit requested form. The application validates the document before detailed construction. No second geometric authorship is requested.

The production V3 generation route now selects `architecturalBlueprintGeneration.ts` only when the server flag `AI_V3_ARCHITECTURAL_BLUEPRINT=1` and terrain mode is flat. No flag or environment file was changed. This branch supersedes the old reference-index flag for that request. Advanced-site generation, edits and normal legacy generation retain their existing route. The actual blueprint-only prompt transmits the JSON schema in JSON mode and uses the same 10,000 output-token cap; schema refinements still run locally. No blueprint is sent alongside a second detailed scene.

The happy path makes one authoring call. The same one objective follow-up may correct only a diagnosed stair footprint/type/direction/turn or diagnosed route waypoints. IDs, hosts, served levels, entrance references, widths/use, requirements and every other decision are preserved by a local comparison. Missing design, unsupported forms, malformed/incomplete JSON, output truncation and unrepairable construction failure return no saveable scene and do not start another creative stage. An explicit known unsupported roof request is rejected before spending a provider call; this vocabulary check is deliberately limited. A repaired response must pass the whole planning/construction gate again. There is no third call, separate elaboration call, optional aesthetic revision or detailed-scene fallback in this branch.

Only mocked provider requests were executed. Natural-model authorship and general brief satisfaction remain unproven; the existing brief feature review covers a finite vocabulary, some checks remain advisory, and independent requirement review is still needed before broad provider testing.

## Architectural Planning Studio presentation

The ordinary V3 workspace exposes 2D Floor Plan, 3D Blueprint and Finished House over the same active `V3Scene`. The 2D drawing projects actual compiled geometry and resolved room/storey datums; the neutral 3D view reuses production primitives with presentation materials and per-host cutaways. Optional project-level `architecturalView` preferences contain no design geometry and do not append versions. Supported storey-height/building-placement edits reuse lossless checkout and architectural revision; unsupported round trips retain the saved scene and report the refusal. See [Planning Studio report](PLANNING_STUDIO_REPORT.md) for offline evidence, limitations and the paid-generation recommendation.

## 21 October 2026 follow-up: authoritative plan-first production input

New flat generations behind the same architectural-blueprint flag now require `v3-plan-first-1`: a separately parsable `v3-architectural-plan-1` plan followed by host-relative exterior decisions. Exterior input cannot declare placements, footprints, storeys, room extents or route geometry. The existing `v3-architectural-blueprint-1` adapter remains the deterministic downstream handoff and offline recovery contract.

The plan-only gate, massing compilation and exterior construction run in that order through the existing V3 compiler. Canonical named geometry, footprints, interior datums and estate relationships remain the persisted plan authority; no duplicate mutable scene/plan is saved. See [PLAN_FIRST_REPORT.md](PLAN_FIRST_REPORT.md), [stage/geometry proof](plan-first/proof.json) and [production-workspace evidence](plan-first/capture.json). One buffered author response remains distinct from a live human review/AI feedback cycle; no additional creative call is introduced.

## 21 October 2026: composition-first authoring and optional detail

The actual production prompt now prioritizes site composition, the coordinated footprint/room plan, and development of that same geometry. It removes “simple 2D” and duplicate stage guidance. No style, house template, object-count target or amenity is required. Claims about climate, arrival, outdoor space and character should be supported by real geometry rather than additional prose fields.

In `v3-architectural-plan-1`, omitted `forms`, `considerations`, `relationships`, `roomAdjacencies` and `zones` default to empty arrays. In exterior, omitted `partitions`/`doors` default to empty arrays. The transmitted JSON schema uses input mode, so these omissions are permitted on the actual author wire. Explicit values remain strictly validated; an authored reservation, malformed collection, unsupported part or contradictory relationship is never discarded by a default. Requirements and building program remain required. Empty detailed-interior arrays mean no private walls/cutouts have been designed; construction does not infer them.

Prefer derived zone membership where no independent reservation is intended. Main room zones, meaningful entrance addresses and usable vertical reservations remain part of the initial plan. Room/stair rectangle descriptions now state that x/z are host-local centres in metres. V3 continues deriving wall/floor geometry, floor datums, roof placement, route endpoint coordinates and selectable owner bounds.

An explicit entrance approach denotes a vehicle drop-off consistently for rectangular, articulated and line/arc hosts; it no longer requires a vehicle-width front door solely because the footprint is nonrectangular. Direct vehicle entry without an approach still requires full vehicle clearance. Wall contacts, widths, route collisions and all other essential audits remain active.

The 10,000 output-token cap, single initial provider response, at most one objective stair/waypoint repair, zero SDK transport retries, plan-authority checks and Draft acceptance policy remain unchanged. No additional provider call, construction engine, scene format, saved-project migration or paid evaluation is introduced. See [the audit and matching offline production comparisons](DESIGN_RESTRICTIONS_AUDIT.md).
