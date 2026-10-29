# Terra plan-to-construction coordination

## Findings from the retained Calypsonian House

The immutable retained response is in `../25m-mansion-recovery/original.response.json` (SHA-256 c1613800abe2efaa2bb5f200f8c807bc345df7bebd3eed9965f5436b8a44c9e5). This study starts from its two-railing-only recovery, not a fresh model response. No provider calls were made.

| Finding | Cause and responsibility |
| --- | --- |
| Upper-floor overlaps | Owner occupies X -8..2, guest 2..8, both Z -6..6. Retreat occupies X -5.5..5.5, Z 0..8 at the same walking datum 3.6 m. Terra allocated the rooms independently instead of partitioning one floor. The existing plan audit already detects this. |
| Incomplete enclosure | Retreat extends to Z 8 while principal roof ends at 6.7; its north strip lacks overhead coverage. IDs in prose do not establish spatial enclosure. This is an authored layout error, not missing renderer geometry. |
| Double-height and program claims | Upper suite plates cover the entire salon footprint; a six-metre exterior volume does not make the room double height. The response promises three suites and service accommodation without corresponding distinct modeled rooms. |
| Weak arrival and façades | Large continuous arrival walls, a single small central entrance and limited secondary openings leave the landward elevations unresolved. Existing wall openings, split walls, screens, piers and roof primitives can express much more depth; no new engine is required. |
| Roof dominance and luxury quality | Broad timber roof surfaces and limited façade hierarchy overwhelm the thin opening composition. Budget rhetoric and a floor-area declaration cannot establish architectural quality. Scale is spatial volume, proportion, circulation and craft as well as area. |
| Railings 0.40 m too low | Deck top is 3.55+.10=3.65. Rail base was 3.8-.55=3.25. Correct centre is 4.20. Centre-based coordinates were explicit but repeatedly calculating independent elevations is error prone. Local parenting previously supplied only a transform, with no surface placement helper. |
| Commitment-kind errors | Terra grouped canopy/wall/door IDs into an entrance commitment, and water/roof IDs into terrace evidence. The existing audit expects primary kinds. This is partly an instructional ambiguity, now explained explicitly without weakening the audit. |

## Targeted changes

`planning.ts` now instructs Terra to allocate non-overlapping upper extents before building, state walking datums and vertical dimensions, resolve real perimeter/roof coverage and adjacent rooms, reconcile area with geometry, and avoid unsupported program or double-height claims. It specifies primary commitment kinds and asks for an entrance sequence, actual façade cuts, coordinated openings, corner returns and subordinate roofs. No template, layout engine, minimum element count or new validation framework was introduced.

`model.ts` adds only `place-on {id,support,offset:[x,z],rotation?}`. It resolves bottom-on-top placement into existing parent/local coordinates. The offset and yaw are relative to the support, so translation and yaw edits propagate through the existing scene graph, including ancestor transforms. It accepts horizontal plates, volumes and flat roofs; it rejects unsupported hosts, pitched roofs, cycles and the pavilion's different origin. Existing relationship validation still checks the completed transaction. It is deliberately a placement operation, not a live constraint: after changing either height, reseat in the same transaction. Saved scenes contain ordinary elements, so existing undo and persistence formats continue to work. Roofs on walls still use explicit derived elevations.

## Offline corrected study

Run `npx vite-node --config vitest.config.mts scripts/coordinate-25m-mansion.ts`.

This is a hand-authored regression study, not Terra output and not a completed $25m redesign. The retained source is unchanged. The corrected study uses 65 elements within the same overall site bounds; two duplicate shared partitions are removed. Full-height lower salon walls are shortened to meet the upper slab rather than overlap the upper enclosure. The upper footprint becomes two 10 m deep suites and a 16×2 m shared retreat/gallery, instead of three overlapping plates. Its enclosure is aligned under the central roof. The roof underside is coordinated to the upper wall tops, the roof edges become lighter, and three arrival walls receive actual glazed cuts. The entrance opening is widened in its existing wall. Both rails are seated from their decks with `place-on`.

Measured allocated enclosed floor evidence becomes 656 m², compared with the original raw 744 m² sum (which double counted overlap) and the declared 792 m². This is a capacity correction, not an equal-area design. `audit.json` retains before/after issues; the corrected plan passes the existing audit. Outdoor pool surface evidence still includes the basin and is not verified walkable court area. Visual inspection also exposed coplanar upper and full-height salon walls, producing surface interference; the study separates these lower/upper enclosures and shares partitions instead of duplicating them. The planning instructions now explicitly require one physical wall per shared boundary. The audit does not certify circulation, continuous enclosure, habitability, structural design or luxury quality. Stairs, service accommodation, suite bathrooms, detailed joinery and a fully developed portal remain unresolved. Prompt effectiveness requires a future provider evaluation; offline results establish deterministic contract behavior only.

## Verification

All 44 tests across scene and direct-scene persistence suites pass. `npx tsc --noEmit` passes. Coverage includes the exact retained recovery, corrected plan replay, scoped changes, support-relative offsets, support move/yaw, resize plus reseating, bad hosts, cycles, relationship rejection and serialization. Browser evidence is produced by `node scripts/plan-to-construction-capture.mjs` using a fresh temporary Chrome context with AI endpoints and external requests blocked. Before/after Arrival, Garden, Poolside and Aerial use matching preset cameras and viewport dimensions. `browser-checks.json` records rendered IDs, mesh count, geometry finiteness, errors and workspace edit/undo/redo/reload checks.

| Matched view | Retained recovery | Coordinated study |
| --- | --- | --- |
| Arrival | [Before](before-arrival.png) | [After](after-arrival.png) |
| Garden | [Before](before-garden.png) | [After](after-garden.png) |
| Poolside | [Before](before-poolside.png) | [After](after-poolside.png) |
| Aerial | [Before](before-aerial.png) | [After](after-aerial.png) |

Final browser run: all 65 IDs rendered, 319 meshes, no nonfinite geometry, no browser errors and zero AI requests. Targeted editing, undo, redo, reload and undo after reload passed in the normal workspace. Visual review confirms the coplanar upper-wall interference is removed; entrance and façade richness remain deliberately limited in this contract study.
