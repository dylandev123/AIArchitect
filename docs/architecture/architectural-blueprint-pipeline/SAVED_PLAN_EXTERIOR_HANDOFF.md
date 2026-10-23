# Saved blueprint → Terra exterior → editable V3 — 21 October 2026

The production handoff now delegates missing exterior decisions to Terra by default. Users can open **Build in 3D**, leave optional preferences empty, and confirm the existing one-call exterior generation. Terra receives the complete checkout of the current saved blueprint, its concept and requirements, and the original brief when retained. No second layout, manual exterior specification, or automatic provider retry is introduced.

Terra can supply `features[].height` only where the saved plan omits height. V3 still requires an actual authored value before construction. Explicit heights, feature locations/base elevations/rotations/boundaries, building footprints/storeys, room zones, entrances, stair/lift reservations, route geometry, requirements and identities stay protected. Candidate metadata cannot authorize changing an explicit saved height. The source plan drives the preservation comparison. Completed scenes clear the plan's deferred-height metadata and retain the 2D response hash in `planSourceResponseSha256`.

The ordinary V3 planner/compiler constructs the exterior and saves editable V3 semantics through the existing project version flow. Mocked tests cover construction, undo/redo, material editing, persistence/reload, concurrent-edit rejection and exact plan preservation. The 2D view now highlights **2D Floor Plan** consistently even if an older stored view preference was `finished`.

## Actual saved working project

Inspected the retained export and the ordinary Safari workspace for [66268256-7784-4d7d-8d44-002b6f5303d1](http://localhost:3000/workspace/66268256-7784-4d7d-8d44-002b6f5303d1). Its original response download remains available with SHA-256 `9591e1203eb1b81f33d35fb709c31b14e982bfa002fb75ceb432e3869e2877fd`. The 140 × 120 m site, both building footprints (including the 24 × 20 m guest pavilion), all 19 rooms, seven features and three corrected routes remain unchanged. The original verbatim brief remains absent; the provider prompt explicitly states that fact.

**This specific estate is still not ready for successful construction.** The shared client/server readiness check now names its two fixed-plan construction blockers before obtaining a provider:

| Object | Finding |
| --- | --- |
| `pool-garden` | Extends beyond the fixed site boundary. |
| `main-house / primary-loggia-door` | Opening span does not fit one actual wall segment. |

The actual Build review displays those two findings with a disabled confirmation button. Missing heights and missing exterior preferences no longer block it. Room overlap/outside-host diagnostics also remain; existing policy permits those allocations in a Draft, so correcting the two core blockers alone would not certify a complete architectural result. No footprints, openings, room zones or site dimensions were changed to bypass validation.

## Verification and limits

- **188 focused tests pass across 12 files**, covering the plan route, serialized production provider request, full-property route, plan authoring/recovery, construction fidelity, feature-height delegation and editable persistence. Provider responses and transport are mocked; no live OpenAI calls were made.
- TypeScript and focused ESLint pass. The actual Safari Build review and 2D view were inspected without pressing generation confirmation or saving plan edits.
- `npx vite-node --config vitest.config.mts scripts/saved-plan-exterior-handoff-evidence.ts` audits the retained working-project export and constructs an independent mock exterior with delegated heights. Its output is [SAVED_PLAN_EXTERIOR_HANDOFF_CHECKS.json](./SAVED_PLAN_EXTERIOR_HANDOFF_CHECKS.json). The mock outcome is `complete`; that result is not a construction result for the paid estate.

No credentials were created, rotated, replaced or exposed. No charges, live exterior generation, browser project writes, commit, push or deployment occurred. Offline fixtures prove the handoff machinery; they do not establish live Terra visual quality or a finished 3D version of this saved estate.
