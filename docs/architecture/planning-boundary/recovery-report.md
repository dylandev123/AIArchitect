# Retained Terra mansion recovery — 27 October 2026

Recovered **437d25b1-ff69-462c-ab34-a8deb7861c67**, the latest retained failed generation. No OpenAI calls or retries were made. The source remains unchanged in `.data/scene-responses/`; SHA-256: `7283c674231249995785d9236603c243c480e9881955c669fc8308f6af42b30e`. The replay asserts its bytes remain identical. The original brief was retained as `[REDACTED]`, so requested amenities beyond the response's own intent cannot be independently confirmed.

[Recovered importable scene](recovered.scene.json) · [complete audit](audit.json) · [browser evidence](browser-checks.json) · [aerial](aerial-view.png) · [entrance](entrance-view.png) · [poolside](poolside-view.png) · [visible warnings](warnings.png)

## Exact original failures

The replay reproduced the original error string exactly, including all nine findings, before changing the acceptance boundary. `originalPlanAudit` preserves the same findings afterward.

| Original failure | Cause and actual evidence |
| --- | --- |
| Great salon: `salon-gallery-wall` missing/wrong kind | Reversed reference. Actual shared wall is `gallery-salon-wall`; it has a physical opening. No replacement wall was generated. |
| Dining: `dining-salon-wall` missing/wrong kind | Reversed reference. Actual shared wall is `salon-dining-wall`. |
| Kitchen: `kitchen-dining-wall` missing/wrong kind | Reversed reference. Actual shared wall is `dining-kitchen-wall`. |
| Terrace: 636 m² versus 320 m² | 320 is only the south deck. The four disjoint deck plates are 320 + 160 + 78 + 78 = 636 m². Together with 84 m² water they occupy the described 40 × 18 m court. No duplicate deck area explains this mismatch. |
| Pool: `pool-water` missing/wrong kind | The ID exists and its actual kind is `water`, not `plate`. The old floor-only lookup rejected valid water evidence. This does **not** establish a complete constructed pool. |
| Pool: 0 m² versus 84 m² | Same lookup excluded water. Actual surface dimensions are 14 × 6 m, yielding 84 m², separate from walking surfaces. |
| Interior: 1,024 m² versus 1,320 m² | The seven distinct, non-overlapping interior plates measure 120 + 252 + 140 + 168 + 288 + 160 + 192 = 1,320 m². Their individual planned areas also sum to 1,320. The headline total and scale rationale are wrong. This is gross floor-surface evidence, not certified net/enclosed area. |
| Entrance commitment: `west-gallery-wall` wrong kind | The commitment includes both an actual entrance and its host wall. The old label check allowed only `entrance`, incorrectly treating associated evidence as invalid construction. |
| Primary-volume commitment: `salon-roof` wrong kind | The roof exists. The old primary-volume label allowed plates/walls/volumes but excluded roofs. The salon roof is the highest actual roof plane. |

## Independent geometry and actual defects

The unchanged operations produce **50 elements**: 11 plates, 24 walls, seven roofs, four explicit glazing panels, two screens, one entrance and one water surface. All slabs have the same 0.20 m walking datum. Existing schema, opening-fit, attachment and geometric relationship validation pass; the independent relationship audit returns no hard issues. The original enclosure/roof perimeter sampler also passes when supplied with actual construction evidence instead of wrong plan references. These checks are schematic geometric checks, not engineering or walkability certification.

Real defects were retained and surfaced, not repaired:

- Water and four coping walls exist, but no basin bottom exists. The pool is incomplete.
- The entrance centre is local Y=0 instead of -0.20 relative to its host wall, lifting its base above the walking surface.
- Explicit north salon/dining/kitchen and south primary glazing reuse sill-like values as parent-local centre coordinates. Expected local Y values are -0.075, 0.025, 0.275 and 0.025; actual values are 0.35, 0.45, 1.0 and 0.5. They overlap their opening heads/frames rather than fitting the cuts.
- Those four hosts already render glass because their openings are marked `glazed`. Explicit panels duplicate glazing evidence as well as being misaligned.
- The narrative overstates direct gallery access: only the salon and primary suite directly adjoin the gallery. Other rooms connect through intervening rooms. The pool-facing openings have raised sills and glazing; a usable pool access door is not evidenced. Bathroom, dressing and service-room layouts are not modelled. No navigability or complete-suite claim is justified.

No missing wall, roof, room, pool component or approach was fabricated. No physical floor overlap was found in this response. Separate regression coverage ensures duplicate/overlapping physical floor surfaces flag a warning and withhold a summed usable-area total.

## Validation boundary

Scene geometry is authoritative. The application retains original intent inside an optional scene metadata field; legacy scenes load without it. Warnings and a measured element inventory are recalculated from the current scene after edits, undo and reload. Original plan discrepancies remain visible in the expanded architectural warning panel; original intent is inspectable. Invalid or absent intent cannot veto valid operations. SDK rejection caused by metadata can be recovered locally only from a complete, stopped JSON response with independently valid scene operations; no provider retry occurs.

Hard validation still blocks malformed dimensions/coordinates/kinds, duplicate IDs, missing/cyclic attachments, invalid wall openings, unsupported roof/component parameters, invalid operations/stable-ID changes, new unsupported floor/railing relationships, facade-axis faults and elevated-only generation. Transactions remain atomic and stale-response protections remain intact. A schema/attachment-valid candidate that fails construction relationships is returned as a **recoverable draft**, with precise errors and a download action; it does not replace the current house. Schema-invalid responses remain retained as raw provider artifacts rather than being labelled renderable drafts. Existing lossless load and incremental repair behavior remain unchanged.

New Terra authoring uses concise spatial intent and intended-space descriptions instead of redundant per-room measurement and ID ledgers. Geometry supplies kinds, per-element floor/water measurements and walking datums. Legacy detailed plans remain supported as review evidence. The contract retains ambitious scale, hierarchy, arrival, circulation, enclosure, roofs and honest completeness disclosure without imposing a fixed house template.

## Verification and visual judgment

73 focused tests pass across 14 files, including exact retained replay, all nine original findings, wrong/missing/malformed intent, the lean intent contract, independent geometry checks, overlap accounting, construction-draft recovery, production route behavior, legacy scenes and persistence. TypeScript and targeted ESLint checks pass.

The offline browser blocks external traffic and intercepts every AI endpoint. It verifies exact recovered geometry, visible original warnings, inspector editing with unrelated parts preserved, undo, redo, persisted save/reload, and atomic rejection of a floating-floor edit. Provider calls: **0**. Existing user projects/current house were not replaced; browser verification used an isolated session. Import `recovered.scene.json` to open the recovery in a chosen project.

Actual aerial, entrance and poolside captures show a coherent but weakly articulated single-storey residence. The taller salon and lower gallery read, but most roofs merge into a large rectangular expanse. The entrance is a small door in a long blank wall with no convincing approach or ceremonial threshold. The terrace and pool read clearly; they are not a developed loggia or finished pool. **Renderable and recoverable: yes. Visually convincing as a completed $25m mansion: no.** These shortcomings are now available for architectural judgment instead of being hidden behind an accounting rejection.

No engine replacement, migration, commit or deployment was performed.
