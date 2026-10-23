# Paid 2D plan handoff check — 21 October 2026

Historical preparation snapshot. See [the subsequent saved-plan exterior handoff implementation and offline verification](./SAVED_PLAN_EXTERIOR_HANDOFF.md) for current behavior: Terra now owns missing exterior decisions and feature heights, while the saved estate's fixed-plan geometry blockers remain explicit.

**Working-copy preparation: PASS. Full Build in 3D readiness: FAIL.**

Open the actual saved Safari project: [Paid 2D estate — handoff working copy](http://localhost:3000/workspace/66268256-7784-4d7d-8d44-002b6f5303d1).

The original paid-attempt project `561f5a43-1211-4eef-8095-806e187ac005` was still blank. None of the existing browser projects referenced the recovered response hash. The earlier successful demonstration was an isolated test-browser replay, not a saved correction in this profile. Failure artifact `548137db-2bb1-4768-981f-f21d1b4b4cdf` correlates this project to the recovered response.

The exact retained response SHA-256 is `9591e1203eb1b81f33d35fb709c31b14e982bfa002fb75ceb432e3869e2877fd`. Its bytes were verified before import and remain unchanged. The working copy exposes the original-response download. Browser projects were backed up in the existing separate IndexedDB recovery-backup database before adding the copy; all pre-existing project records were verified unchanged during preparation.

Only the previously demonstrated architectural corrections were applied:

- `pool-walk.to`: `{kind:"surface", objectId:"infinity-pool", local:[0,5]}` → `{kind:"surface", objectId:"sea-terrace", local:[0,0]}`.
- `main-entry`: start `.43` → `.432`; end `.57` → `.568`.

Recursive comparison of the original normalized plan and the saved, re-exported plan found exactly those four scalar differences. The 140 × 120 m site, both building locations and footprints, all 19 rooms, seven feature boundaries, stair/lift reservations, other openings, requirements and all other route data were preserved. The guest pavilion remains **24 × 20 m**; the demonstration's unrelated 26 m width test was not imported. The working plan reloaded with byte-identical `houseConfigJson`; its lossless checkout and `sameArchitecturalPlan` comparison passed.

| Requirement | Result | Evidence / remaining action |
| --- | --- | --- |
| Corrections saved in editable project | PASS after this preparation | Separate browser-persisted working copy, ordinary undoable project storage |
| Original projects and response preserved | PASS | Before/after record comparison, source hash, IndexedDB backup |
| Unresolved routes | PASS | Zero withheld objects; `arrival-route`, `guest-walk`, `pool-walk` all drawn |
| Ground entrances | PASS for presence | Both buildings have ground-level entrances; main entry now resolves. `primary-loggia-door` remains invalid on its wall plane. |
| Lossless plan handoff | PASS for save/export | Geometry comparison passes; no construction success is inferred |
| Outdoor-feature heights | FAIL | All seven are omitted; runtime 0.01 m proxies are not authored construction decisions |
| Exterior instructions | FAIL | Roof forms, facade/glazing character and materials, or explicit delegation, are not supplied |
| Build feature enabled | PASS | Read-only running `/api/ai/plan` configuration returns `enabled:true`; ordinary Build review opens |
| Generation confirmation enabled | FAIL / correctly blocked | Actual workspace displays disabled “Confirm Build in 3D · 1 AI call” |
| Full construction readiness | FAIL | Additional plan diagnostics below remain; no exterior candidate was created |

Deferred heights apply to `arrival-drive`, `arrival-garden`, `guest-court`, `sea-terrace`, `infinity-pool`, `pool-garden`, and `service-garden`. Choosing them requires explicit design decisions in the 2D plan before the exterior stage; they were not invented. All feature types are supported rectangular plan types; no unsupported nonrectangular feature construction was found.

The saved diagnostics retain these architectural defects:

- `pool-garden` extends 1 m beyond the northern site boundary (z = −61 m versus −60 m). The construction acceptance policy does not tolerate this site-bounds finding.
- `primary-loggia-door` straddles wall planes; `BLUEPRINT_ENTRANCE_WALL` remains. Presence of other valid ground entrances does not resolve this opening.
- `entry-hall`, `great-room`, and `primary-suite` extend beyond their actual articulated host.
- Room overlaps: `entry-hall`/`powder-room`, `great-room`/`primary-suite`, `media-lounge`/`powder-room`, and `guest-lounge`/`guest-pantry`. Current construction policy can retain these room issues in a Draft; they are not a clean architectural result.
- Roof identities remain reserved for exterior development; missing roof geometry is expected at the 2D stage. Budget and two relationships remain advisory/unverified.

The stair and lift reservations retain their original hosts, levels and rectangles. Stair flight details remain deferred to later exterior development within the same reservation. The full original user brief is absent from the source project's metadata; the recovered architectural concept and requirements are available, and must not be mistaken for a recovered verbatim brief. The final working copy leaves that missing brief unset. A separate metadata-only project version records that provenance clarification; its architectural geometry matches the first reloaded copy exactly.

The saved plan **cannot proceed to successful 3D construction as-is**. Existing client/server revision checks, strict exterior schema and geometry comparisons reject a changed plan and preserve the saved 2D project on failure. They do not establish that a future exterior response can successfully construct this defective plan. Resolving the remaining architectural defects would require additional authorized edits; none were made here.

Evidence is retained locally under `.v3-debug/paid-plan-handoff/`: `inspection.json`, `saved.json`, `reloaded.json`, `final.json`, `verification.json`, and the deterministic `verify.ts` audit. The first reload confirms byte-identical saved geometry; the final metadata clarification preserves it. Verification passed 31 focused plan/recovery tests plus three zero-provider gate tests, TypeScript, focused ESLint and whitespace checks. Existing unrelated working-tree changes were retained.

No live AI/provider call, exterior generation, commit, push or deployment was performed. Temporary localhost inspection/import tooling is removed after use; no production workflow or gate is changed.
