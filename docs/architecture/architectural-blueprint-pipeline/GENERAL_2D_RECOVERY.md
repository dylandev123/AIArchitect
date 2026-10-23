# General 2D planning recovery — October 21, 2026

A single localized planning defect can no longer prevent a coherent house or estate from appearing as an editable 2D draft. The paid response `9591e120…2877fd` (the `pool-walk` plan) now displays unchanged, with no manual retargeting. Nothing here calls Terra/OpenAI, and V2 and terrain code are untouched.

## What rejected the paid plan

`prepareV3ArchitecturalPlan` returned at its **first** fatal finding, with no scene at all. `pool-walk` was the first of several independent, local defects in that response; fixing it alone would only have exposed the next. With `pool-walk` removed the same plan still failed on:

- `arrival-route` and `guest-walk`: `main-entry` spans 0.43–0.57 (8.12 m) of an 8 m entry recess, so the entrance has no single wall address and both routes lose their endpoint.
- `pool-garden`: a lawn that overhangs the site by 1 m.

## Mechanism

`src/lib/v3/planRecovery.ts` + the recovery loop in `prepareV3ArchitecturalPlan(raw, {recover:true})` (used only by the 2D plan path; the 3D blueprint path keeps the strict behaviour).

1. Lower only what is representable, then audit.
2. A defect confined to one **connection, site feature or room adjacency** *withholds that object*. Its authored value is kept verbatim in `scene.metadata.planUnresolved` (kind, id, raw value, diagnostics). It is not drawn, retargeted, shortened or deleted.
3. Findings that merely point at a withheld object (relationships, requirements, access chains) are downgraded to advisory; they are explained by it, not second defects.
4. A walkway endpoint is re-addressed only when its **authored world contact point lies on exactly one dry surface** and not in water. The point never moves and an advisory `PLAN_ENDPOINT_RESEATED` records the change. Zero candidates (including the paid plan's `pool-walk`) or more than one (`PLAN_ENDPOINT_AMBIGUOUS`) leave the route unresolved.
5. `checkoutPlanEvaluation` puts the withheld objects back into the editable plan JSON, so a later edit corrects them with the ordinary save/undo/redo path. Saving always rewrites `planUnresolved`.
6. The original Terra response is never modified: it remains in `.v3-debug/plan-evaluations/<sha>.response.json`, in browser storage and in the download link. The normalized draft is a separate scene.
7. Build in 3D stays closed (client and `/api/ai/plan`, with zero provider calls) while anything is unresolved or a building has no ground entrance.

## Classification (plan stage)

| Class | Defects | Result |
| --- | --- | --- |
| **Core-blocking** | Schema failure; duplicate/ambiguous identity; building footprint invalid or outside the site; independent buildings overlapping; any finding not listed below | Whole plan rejected, response retained, no scene |
| **Unresolved object (withheld, kept verbatim)** | Route with unknown entrance/site access/feature; endpoint in water or on a non-dry or unsupported feature; contact outside its surface; ambiguous dry destination; route crossing a building or pool; route whose entrance wall address or gate cannot be derived; feature with an invalid own boundary; room adjacency across storeys | Everything else drawn; diagnostic + editor access |
| **Draft-tolerable (drawn as authored)** | Room outside/overlapping within a valid building; entrance wall address crossing wall planes; feature overhanging the site; building with no ground entrance; destination with no route; site gate off its boundary; opening clipping/overlap and the pre-existing construction exceptions | Drawn with a diagnostic |
| **Advisory** | Roof identities deferred, unverified relationships/budget, reseat notes | Listed only |

## Real paid plan

`preparePlanEvaluation` now returns `ok:true`: 2 buildings, 19 rooms (13 ground, 6 upper), all 7 outdoor features, 0 drawn routes and exactly three unresolved routes, each with a cause:

- `pool-walk`: ends at `infinity-pool` local `[0,5]`, a pool edge no authored dry surface contains (the terrace starts 3 m away). Not retargeted.
- `arrival-route`, `guest-walk`: `main-entry` straddles its recess. The door is kept as authored; the diagnostic names it.

Browser proof (optimized `next build --webpack` + `next start`, isolated copy, offline transport, one mocked call, zero external requests): HTTP 422 became 200; Planning Studio shows the estate, ground and upper plans; editing the guest pavilion saves, undoes, redoes and reloads byte-identically with all three still unresolved; the author then retargets `pool-walk` to `sea-terrace` (2 left) and fits `main-entry` inside its recess (0 left, all three routes drawn). Evidence: [proof.json](general-2d-recovery/proof.json), [provider.jsonl](general-2d-recovery/provider.jsonl), screenshots [1](general-2d-recovery/1-estate-master-plan-with-unresolved-diagnostics.jpg), [1b](general-2d-recovery/1b-estate-master-plan-panel-hidden.jpg), [ground](general-2d-recovery/2-ground-floor-plan.jpg), [upper](general-2d-recovery/3-upper-floor-plan.jpg), [edited/reloaded](general-2d-recovery/4-edited-and-reloaded.jpg), [pool-walk corrected](general-2d-recovery/5-pool-walk-corrected.jpg), [all resolved](general-2d-recovery/6-all-routes-resolved.jpg).

## Generalization tests

[planRecovery.test.ts](../../../src/lib/v3/__tests__/planRecovery.test.ts) uses an unrelated cottage/studio estate: valid multi-building estate, walkway in water, unambiguous reseat, ambiguous dry destination, minor room conflict, localized entrance mismatch, route through a building, unknown entrance, off-boundary gate, invalid feature boundary (plus dependents), cross-storey adjacency, overhanging feature, missing entrance, four core-blocking cases, closed Build gate, and save/undo/redo/reload/correction. [paidPlanReplay.test.ts](../../../src/lib/v3/__tests__/paidPlanReplay.test.ts) replays the real response. Three existing tests that asserted "reject" now assert "withhold" (`plannedSiteGeometry`, `architecturalPlanAuthoring`, plan route); strict mode is still asserted to reject.

## Verification

Full suite 2,443 passed, 3 skipped, 0 failed (201 files); TypeScript, ESLint (whole repo) and `git diff --check` clean; optimized production build passed in an isolated copy with mocked fonts. Under a fully parallel run three timing-sensitive suites timed out once at 5 s; all pass alone and in the final full run.

Limits: validity here means supported geometry, not architectural quality. Stair/vertical-reservation defects, building footprint defects and unresolved identity remain blocking; they are not localized to something this stage can withhold without hiding architecture.
