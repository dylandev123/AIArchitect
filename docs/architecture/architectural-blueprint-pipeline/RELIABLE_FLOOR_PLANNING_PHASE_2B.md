# Phase 2B — Reliable architectural floor planning

Implemented on 22 October 2026. No live Terra/OpenAI requests, paid generations, additional agents, commits, pushes or deployment. No V2 or advanced-terrain changes. Existing paid responses and projects were not rewritten. The workspace contained substantial earlier work; this report lists only this phase's changes.

## 1. What actually failed in the natural response

The regression fixture is a **byte-for-byte copy** of the latest retained response, not a reconstruction or a hand-corrected version:

- Source: `.v3-debug/plan-evaluations/65036c5f32b6c9b8be56fc6c57886715bb9bd469b2480fe938199f4427eb88ad.response.json`.
- Fixture: `src/lib/v3/__tests__/fixtures/terra-estate-2026-10-22.response.json`.
- SHA-256: `65036c5f32b6c9b8be56fc6c57886715bb9bd469b2480fe938199f4427eb88ad`.
- Original production preparation and save/reload reproduce **3 outside-host, 6 overlap and 8 missing-boundary warnings: 17 total**.

The former authoring contract required independent room centre/width/depth values and a separate adjacency list. These were two independently authored descriptions of the same spatial decision. Neither schema validation nor the prompt's mental walkthrough coupled their numbers. Semantic lowering copied room rectangles; normalization derived runtime building envelopes and retained authoritative room coordinates. Post-generation audits detected problems but deliberately retained them as editable allocations. More elaborate prompting therefore did not provide a mechanism for consistent shared edges.

The room schema represents rectangular, disjoint functional zones. It has no nested/overlapping-zone kind. An open-plan space can be one combined program room, or touching zones with no partition. A room label containing “open”, “gallery” or “double-height” does not establish permission to overlap other rooms or cut an upper slab. All six reported overlaps are separately authored ordinary rooms crossing separately authored circulation galleries; none has an explicit representation permitting overlap.

### Every one of the 17 warnings

Coordinates below are host-local metres. The main villa's north boundary is z = −12, and the galleries occupy z = 3…5.

| # | Warning | Room(s) | Actual cause |
|---:|---|---|---|
| 1 | ROOM_OUTSIDE_HOST | main-living | North edge −17 exceeds shell −12 by 5m. Independently guessed centre/depth. |
| 2 | ROOM_OUTSIDE_HOST | main-family-lounge | Same 5m north overrun. |
| 3 | ROOM_OUTSIDE_HOST | main-master-bedroom | Same 5m north overrun on the upper storey. |
| 4 | ROOM_OVERLAP | main-gallery / main-stair-hall | Hall begins at z=4 inside gallery ending at 5: 6m² overlap. |
| 5 | ROOM_OVERLAP | main-gallery / main-powder | Same 1m strip: 6m² overlap. |
| 6 | ROOM_OVERLAP | main-upper-gallery / main-upper-landing | 1m strip and 3m common x span: 3m² overlap. |
| 7 | ROOM_OVERLAP | main-upper-gallery / main-master-bedroom | Bedroom ends at z=4 inside gallery beginning at 3: 12m² overlap. |
| 8 | ROOM_OVERLAP | main-upper-gallery / main-guest-bedroom | 1m overlap in both axes: 1m² overlap, with ambiguous separation direction. |
| 9 | ROOM_OVERLAP | main-upper-gallery / main-guest-bath | 1m strip: 6m² overlap. |
| 10 | ROOM_ADJACENCY_NO_SHARED_BOUNDARY | main-gallery → main-stair-hall | Overlap #4 is not a shared boundary. |
| 11 | ROOM_ADJACENCY_NO_SHARED_BOUNDARY | main-gallery → main-powder | Overlap #5 is not a shared boundary. |
| 12 | ROOM_ADJACENCY_NO_SHARED_BOUNDARY | main-upper-landing → main-upper-gallery | Overlap #6 is not a shared boundary. |
| 13 | ROOM_ADJACENCY_NO_SHARED_BOUNDARY | main-upper-gallery → main-master-bedroom | Overlap #7 is not a shared boundary. |
| 14 | ROOM_ADJACENCY_NO_SHARED_BOUNDARY | main-upper-gallery → main-guest-bedroom | Overlap #8 is not a shared boundary. |
| 15 | ROOM_ADJACENCY_NO_SHARED_BOUNDARY | main-upper-gallery → main-guest-bath | Overlap #9 is not a shared boundary. |
| 16 | ROOM_ADJACENCY_NO_SHARED_BOUNDARY | wellness-entry → wellness-change | 2m x gap: entry ends at −3, changing starts at −5. Matching z ranges do not create access. |
| 17 | ROOM_ADJACENCY_NO_SHARED_BOUNDARY | wellness-entry → wellness-powder | Symmetric 2m x gap, +3…+5. |

These are 17 observations of 11 geometric conditions; six adjacency warnings repeat the consequences of the six overlaps. Nothing in this diagnosis depends on particular room IDs in production code. The response also describes a compact upper floor but supplies the same rectangular host footprint on both storeys. This phase preserves the supplied shell instead of interpreting prose as permission to redesign it.

## 2. Architectural strategy implemented

**Terra authors organization; V3 develops shared boundaries.** The schema advertised for new generations now requires each storey's `layout` and room IDs/programs, and omits independently guessed room footprints. Existing explicit plans retain their compatibility parser and exact geometry.

A layout contains a bounded, flat node table and one or more functional regions:

- Internal split nodes name a functional zone, an x or z axis, and ordered children with positive relative weights.
- x order means west-to-east; z order means north-to-south. Terra chooses compass orientation, wing organization, proportions and room relationships.
- Leaves refer to one named room each. Circulation galleries, entry halls and stair/landing halls are intentional room leaves. A reserve leaf has an explicit purpose and stays unallocated; it never becomes a corridor or a constructed slab void.
- Optional minimum width/depth and maximum aspect constrain the chosen proportions. The engine reports contradictions instead of searching for a different design.
- One rectangular host can use its whole shell as a region. Articulated and line/arc outline hosts use Terra-chosen, nonoverlapping rectangular functional regions within their actual storey outlines. These can have different boundaries and subdivisions on different storeys. Unallocated perimeter space is permitted.

The deterministic mechanism is **proportional rectangular subdivision**, using existing V3 rectangles and footprint containment. It introduces no CAD engine, site-wide grid, packing search, fixed mansion template, new render format or AI agent. Each split computes a boundary once, shared by both children. Region and leaf containment use the actual host footprint at the correct level, including concavity and ground/upper operations. Contradictory duplicate geometry is diagnosed rather than selecting one authority silently.

Required adjacency must have an actual shared edge of at least 0.8m, with a floating-point seam tolerance only. A 4cm gap is not accepted just because the legacy partition resolver tolerates small edits. For an access connection through a gallery, Terra declares the consecutive room/gallery pairs. The engine neither invents the gallery nor replaces direct-adjacency intent with a guessed route.

Stair/lift location, footprint, host and connected levels remain Terra's fixed decisions. Every connected storey must provide an explicit circulation hall containing the reservation. Repeated regions and subdivisions deliberately stack wet/service rooms and circulation; the engine does not independently align or relocate them. The existing construction code still decides whether deferred stair flight details fit the approved reservation.

A subdivision that meets geometric constraints can still miss an entrance or strand rooms. The existing conceptual access review also runs; affected new layouts remain Drafts with their developed rectangles available for editing. Detailed doors, furniture clearances, privacy, structural alignment and professional architectural judgment remain distinct from this schematic geometry check.

### Infeasible and ambiguous intentions

Development is atomic per storey. If topology, size, containment, shared-edge or vertical constraints fail, supplied explicit preview rectangles remain unchanged. Without previews, missing room geometry stays absent. The complete failed room descriptors and subdivision are retained in `metadata.roomLayoutDrafts`, with `ROOM_LAYOUT_UNRESOLVED` diagnostics. The floor datums and the rest of the property remain editable. No placeholder room is invented.

The storey inspector exposes the unresolved organization and an explicit **Develop room boundaries** edit. Successful refinement writes ordinary room datums and clears that storey's unresolved intent. Existing room fields remain directly editable. Checkout and save/reload never replay a hidden successful recipe over manual edits. A partial bedroom geometry count cannot establish a whole-building bedroom-count conflict while another relevant floor is unresolved; the obligation remains recorded as unverified.

The exterior request is blocked before provider use while room intentions remain unresolved. Tests verify zero provider calls in that case. Full-property plan-first authoring accepts the same room intentions; an infeasible response exposes its editable planning scene and diagnostics instead of constructing guessed rooms.

## 3. Exact natural-response regression and comparisons

The original response and its normal load/save path **remain unchanged with all 17 warnings**. A separate `proposeRoomCoordination` utility offers a review-only candidate for legacy independent rectangles. It is never called by generation, project loading, persistence or exterior handoff. It uses generic facing-edge constraints, fixed shell contacts, existing usable contacts, circulation guides and reservation containment; no estate or room-name correction table exists.

The candidate resolves eight warnings on unambiguous storeys, changing seven room rectangles. It retains the entire ambiguous upper floor unchanged. The upper guest bedroom overlaps the gallery equally in x and z, and preserving the existing bedroom/landing contact while inserting the gallery collapses its width/depth constraints. Choosing which relationship to discard would be an architectural decision.

| Metric | Original | Separate review candidate |
|---|---:|---:|
| Outside host | 3 | 1 |
| Overlaps | 6 | 4 |
| Adjacencies without shared boundary | 8 | 4 |
| Total room warnings | **17** | **9** |

The retained nine warnings are the upper bedroom overrun, four upper gallery overlaps and their four adjacency consequences. This is intentionally a partial proposal, not a claim that legacy architectural intent can be recovered completely.

| Room | Original x, z, width, depth | Proposed x, z, width, depth |
|---|---|---|
| main-stair-hall | 12, 8, 6, 8 | 12, 8.5, 6, 7 |
| main-powder | −12, 8, 6, 8 | −12, 8.5, 6, 7 |
| main-living | 8, −10, 26, 14 | 8, −7.5, 26, 9 |
| main-family-lounge | −14, −10, 14, 14 | −14, −7.5, 14, 9 |
| wellness-entry | 0, 5, 6, 4 | 0, 5, 8, 4 |
| wellness-change | −7, 5, 4, 4 | −6.5, 5, 5, 4 |
| wellness-powder | 7, 5, 4, 4 | 6.5, 5, 5, 4 |

All other room footprints remain unchanged. Building locations, footprints, storeys, entrance addresses, routes, site features, stair reservation and adjacency intent remain unchanged. Reducing the overrun rooms changes their net areas materially; this is precisely why this legacy proposal requires architectural review and is not an automatic repair. It does not claim to preserve an unknowable original net-area intention.

[Machine comparison and every warning](phase-2b/natural-comparison.json), [separate candidate plan](phase-2b/natural-proposal.plan.json), [ground before](phase-2b/natural-main-villa-0-before.svg), [ground proposal](phase-2b/natural-main-villa-0-proposal.svg), [unchanged upper floor](phase-2b/natural-main-villa-1-proposal.svg), [wellness before](phase-2b/natural-wellness-pavilion-0-before.svg), [wellness proposal](phase-2b/natural-wellness-pavilion-0-proposal.svg).

## 4. Generalized production-flow evidence

The new examples are independent, explicitly hand-authored **offline intentions**, not claimed Terra outputs and not templates used in production:

| Example | Terra-equivalent input intention | Developed result | Room warnings | Exterior/V3 result |
|---|---|---|---:|---|
| Garden home | Public north band 4 parts, cross-gallery 2, private/service south band 4; further room proportions and central south entry | 7 ordinary rooms; living/kitchen 2:1 width; direct shared-edge circulation | 0 | Complete, 19 primitives |
| Listening home | Concave L-shaped line outline; independent north and south regions, courtyard-edge galleries and private suite | 6 rooms fitting the actual concavity; courtyard stays outside | 0 | Complete, 15 primitives |
| Court estate | Three-storey articulated U; private and creative wing halls, bridge galleries, deliberately varied suite proportions; fixed stair/lift; detached ground-only work pavilion | 32 rooms, aligned vertical halls on all three floors, separate one-storey pavilion | 0 | Complete, 122 primitives |

All required adjacency pairs are independently checked against their resulting boundaries. Every room is checked against the actual host at its level. Successful development preserves every supplied building outline, placement, storey count, room identity, required relationship, opening and circulation reservation. Parameterized dimensions and rotation exercise nine unrelated proportions of the compact control. A separate regression verifies upper-only articulated setbacks against upper room regions while leaving the ground rooms unchanged.

The production `POST /api/ai/plan` handlers use the real model factory, SDK, prompts, JSON parsing and plan/exterior adapters with **transport replaced entirely in memory**. They retain the raw response, pass rooms through saved-scene checkout, develop the exterior and construct V3 geometry. `sameArchitecturalPlan` remains true; construction-fidelity findings are empty. Another test exercises the one-response full-property path. No provider socket is opened.

The actual Zustand project store is tested with isolated storage: new version commits, direct room geometry edits, rehydration, unresolved intent retention and explicit refinement. A sentinel existing project is unchanged. SVG evidence uses the real `ArchitecturalFloorPlan` component rather than a replacement drawing implementation.

The isolated optimized Next.js production build uses no copied `.env` files or saved projects, local cached fonts and an external-transport guard. Browser verification uses a fresh Chrome profile and local fixtures, blocks external requests and all API writes, mounts finished WebGL construction, edits a room in the actual inspector and verifies reload, and refines a failed room intention in the storey inspector. API provider parsing is tested separately with the in-memory transport described above.

[Pipeline checks](phase-2b/checks.json), [production browser checks and captures](phase-2b/ui/checks.json), [garden floor](phase-2b/garden-home-garden-floor.svg), [concave floor](phase-2b/listening-home-listening-floor.svg), [estate upper floor](phase-2b/three-storey-estate-court-floor-1.svg).

## 5. Files changed by this phase

| File | Change |
|---|---|
| `src/lib/v3/roomLayout.ts` | New disposable zone/subdivision schema, constrained development, atomic Draft handling and exact access seam predicate. |
| `src/lib/v3/roomCoordination.ts` | Separate, explicit legacy boundary proposal with change receipts and ambiguity diagnostics. |
| `src/lib/v3/architecturalPlanAuthoring.ts` | Advertised relationship-first schema; legacy-compatible parsing; consume intentions into existing room geometry. |
| `src/lib/v3/architecturalDesignGuidance.ts` | Instructions for functional hierarchy, ordered proportions, open-plan representation and deliberate circulation. |
| `src/lib/v3/architecturalPlanEvaluation.ts` | New authoring prompt, intent development, retained Drafts, lossless checkout and explicit draft-refinement action. |
| `src/lib/v3/architecturalPlanFirst.ts` | Unresolved plan storeys may have absent room geometry; shared shell projection; pre-provider construction blockers. Complete construction still requires rooms. |
| `src/lib/v3/architecturalBlueprintGeneration.ts` | Same relationship-first room contract for full-property generation; preserve failed planning scene. Existing full-property ledgers remain required on its advertised wire. |
| `src/lib/v3/architecturalBlueprint.ts` | Plan-only checkout permits unresolved empty room collections; complete blueprint checkout remains strict. |
| `src/lib/v3/blueprint.ts` | Export existing actual-storey rectangle containment for reuse. |
| `src/lib/v3/interior.ts` | ROOM_OUTSIDE_HOST now checks the actual articulated outline as well as the host envelope. |
| `src/lib/v3/estatePlan.ts` | Do not misreport a partial bedroom count as a verified whole-building contradiction. |
| `src/components/workspace/inspector/ArchitecturalDatumInspector.tsx` | Editable failed room organization and explicit develop action. Ordinary room geometry inputs remain authoritative. |
| `src/lib/v3/parity/roomPlanning.ts` | Independent offline controls only; not imported by production authoring. |
| `src/lib/v3/__tests__/roomPlanning.test.ts` | Natural-response regression, geometry/relationship invariants, ambiguity and failure coverage. |
| `src/app/api/ai/plan/route.roomPlanning.test.ts` | Actual production handlers/SDK with in-memory provider transport, exact response retention and no-call blockers. |
| `src/store/__tests__/roomPlanningPersistence.test.ts` | Actual isolated persistence, room edits, Draft refinement and existing-project preservation. |
| `src/lib/v3/__tests__/fixtures/terra-estate-2026-10-22.response.json` | Exact paid response copy. |
| `scripts/room-planning-evidence.ts`, `scripts/room-planning-capture.mjs` | Reproducible offline evidence and isolated production browser checks. |
| This report and `phase-2b/` | New comparisons, plans, drawings, test results and preservation proof. |

## 6. Tests, remaining limitations and expected outcome

The verification artifact records precise run scope and commands. The full repository run reports **2,508 passed, 3 failed, 3 skipped**. Its failures match the three already documented before this phase: `productionRouteDiagnostics`, `supportCapabilities` (fountain capability) and `terraFreedomAudit` (specialized/generic counts). Those unrelated tests were not rewritten. The final focused run additionally includes the latest upper-storey setback regression and final fixture refinements; see [focused results](phase-2b/focused-tests.json). TypeScript, scoped ESLint, whitespace checks, optimized production build, geometry evidence and final isolated browser verification are recorded in [verification](phase-2b/verification.json).

All **238 pre-existing debug/response and fixture files** in the starting inventory are byte-identical. No existing browser projects were accessed; browser work used a fresh test profile. [Preservation proof](phase-2b/preservation.json).

Remaining limits:

- This is a hierarchical rectangular room developer, not arbitrary polygonal room planning. Non-slicing room arrangements may require multiple explicitly chosen regions or direct editing. Curved perimeter remainder can stay unallocated; no curved partitions, polygonal room cutouts, outline holes or new slab-void capability was added.
- Terra must still choose a coherent topology, suitable regions and proportions. The engine does not optimize away a contradictory design, infer circulation from empty strips, choose a better floor plan, relocate a stair or fix a prose/footprint contradiction.
- Proportional weights are relative spans. Minimum dimensions/aspect are validation constraints; they are not an optimization objective that silently reallocates other rooms.
- Shared-edge access is schematic. Detailed walls/doors, furniture, travel distances, daylight, privacy, accessibility, structure, services and cost remain architectural/construction work. Stair flight fit is still verified downstream.
- Legacy explicit rectangles retain their exact geometry and diagnostics. The exact paid estate is not automatically cured; the separate proposal intentionally retains nine ambiguous upper-floor warnings.
- Failed-intent editing currently uses the existing advanced JSON-oriented inspector workflow. There is no new graphical zone-tree editor or general constraint-solving UI.
- Subdivision tables add authoring structure and output tokens. The existing generation token/call budgets were not increased. No fresh natural Terra response was generated, so model adherence and architectural quality under the revised contract remain unmeasured.

**New Terra generations are expected to produce more coherent room geometry** because the advertised schema now asks for architectural organization and derives common coordinates once, instead of asking the model to guess every rectangle independently. The offline evidence proves deterministic development and downstream preservation for valid intentions, and editable Draft behavior for contradictions. It does not prove fresh model creativity or guarantee that every proposed architectural organization is feasible.

Reproduce without a live model:

```sh
npx vite-node --config vitest.config.mts scripts/room-planning-evidence.ts
npx vitest run --maxWorkers=2 src/lib/v3/__tests__/roomPlanning.test.ts src/app/api/ai/plan/route.roomPlanning.test.ts src/store/__tests__/roomPlanningPersistence.test.ts
npx tsc --noEmit
```

The browser script requires an isolated local production build, Playwright-compatible module and Chromium executable. It creates fresh test storage and must not be repurposed to modify existing user storage. No live provider call is needed for any evidence in this report.
