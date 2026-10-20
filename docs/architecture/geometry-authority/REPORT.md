# V3 Blueprint Geometry Authority & Functional Integrity v1

20 October 2026, America/St_Lucia. **NO-GO for another paid generation.** The zone authority contract and known unusable-stair acceptance gap are addressed; both recovered estates retain independent architectural contradictions. No provider requests, paid generations, commits, pushes, deployment, saved-project writes, V2 changes or advanced-terrain changes were made. API tests mock `generateText`; browser verification blocks AI endpoints. Existing uncommitted work was retained.

## 1. Exact causes

- Zones required a second independently authored rectangle despite existing measurable object footprints. Blueprint entries were references, not another source of rectangles.
- Construction rejected undersized stairs and omitted their treads, but preliminary blueprint reachability treated reservations as access. Generation consistency kept the completeness finding advisory. The API could retain an unusable initial scene after an unsuccessful optional revision and return 200.
- Hosted terrace decks compile as `patio`; stair openings cut only `floor` and `roof` surfaces, leaving the deck across the stair.
- Spiral negative-side exits described a diagonal (`-half` to `+half`) instead of a constant edge, so the guard remained across the exit. Exit direction also advanced clockwise for left-turn flights.
- An old synthetic three-storey fixture assumed a single undersized 0→2 stair could stop at level 1. A different synthetic sky-stair exit lay beyond its terrace. These are fixture deficiencies, not fabricated defects in the recovered responses.

## 2. Implemented authority and blueprint integration

Estate-plan version remains 1. Zones gain optional `allocationMode`:

```json
{"id":"family-domain","purpose":"Residence and gardens","objectIds":["residence","garden-walk"],"allocationMode":"derived"}
```

`derived` forbids `allocation`. `resolveV3ZoneGeometry` returns a nonpersistent measurement of actual footprints on every building storey and full canonical route ribbons. Named architecture is materialized before measurement. Hierarchy route owners reuse production ribbon triangles. Moving objects changes the next measurement. Membership may overlap; an envelope does not fill its empty interior with occupied geometry.

`reserved` requires the existing world-space allocation rectangle. An omitted mode preserves legacy reservations. Missing reservation coordinates and competing derived-plus-authored coordinates fail schema validation. Member containment/site checks remain. `clearSpace` independently reserves an empty volume, even in a derived zone, with occupancy and site checks. Neither boundary is silently resized or moved.

Blueprint entries keep the same object, opening, route, circulation and requirement IDs. No duplicate scene or geometry engine was added. Provider instructions prefer derived groups and require explicit reservations only for architectural boundaries. Zone measurement and validation reuse existing footprint/route calculations.

## 3. Physical stair usability

The existing resolver supplies host, level counts/datums, rise/going/width, supported straight/L/U/spiral configurations, traversed footprints, stacked destinations and roof exits. The functional audit adds actual frame-derived entry/exit positions and constructed tread/landing centres; approach support inside the real destination floor; agreement with explicit storey elevations; and actual floor support at both landings.

Conservative body/headroom probes inspect production triangles, including cut slabs, roofs, decks, objects, guards and real partition doors/headers. Segment intersections catch thin barriers between sampled treads. Missing treads and blocked/misplaced openings fail. Placement boxes are not used as proof of internal blockage.

Confirmed failures block new-generation consistency and physically invalid inspectable blueprints are not frozen. Completeness grants stair edges only for usable access. Stairs connect their endpoints; lifts retain intermediate stops. Saved-scene structural validation stays lenient. Existing construction now cuts hosted terrace surfaces through the authored opening and leaves the correct spiral guard edge open for either turn. It chooses no stair location or architectural footprint.

This is bounded physical verification, not building-code certification or complete navigation simulation. It does not certify every point of a continuously swept body, fire egress, accessibility, room-to-room routing, custom platforms or design quality. Missing intent and uncertain outdoor transition/design concerns remain advisory.

## 4. Repair safety

No provider call or orchestration stage was added. The existing one objective follow-up receives the stair/allocation findings alongside other independent failures. Only a diagnosed stair's footprint/location, stairType, direction or turn may change. ID, host, circulation type, labels/role and valid intended levels stay protected; a diagnosed invalid level range alone permits level correction. Other stairs, requirements, materials, building geometry and unrelated circulation remain protected. Deleting a stair or dropping requirements is rejected.

A diagnosed reservation may be explicitly redrawn within the existing repair scope, preserving mode, membership and commitments. A repair cannot convert a reservation to derived mode to hide a conflict. Derived measurements are never repair fields. All candidates still pass acceptance and preservation checks.

## 5. Recovered mansion results

[replay.json](replay.json) records all four untouched responses, hashes, original reservation conflicts, physical stair results and remaining diagnostics. A separately labeled counterfactual changes only zone semantics and removes repeated rectangles. It chooses no object, stair, route or boundary correction. The repair guard rejects blanket reclassification as an automatic repair.

| Recovered response | Legacy reservation/member conflicts retained | Explicit derived counterfactual | Accepted original / counterfactual |
| --- | ---: | ---: | --- |
| Canopy initial | 10 | 0 | No / No |
| Canopy historical repair | 10 | 0 | No / No |
| Cloister initial | 7 | 0 | No / No |
| Cloister historical repair | 2 | 0 | No / No |

These **29 conflicts are avoidable if the groups are intentionally authored as descriptive envelopes**. Their historical intended meaning is unknown, so production retains all 29 under legacy reservation semantics. Explicit garden/courtyard fixtures continue to report real containment, occupancy and site conflicts.

The recovered authored stairs pass the scoped checks. The known unusable stair from the prior audit is the separate 0.4 × 0.5 m adversarial reservation, not an established recovered-stair defect. It now fails before approval; the mocked API returns 422 after its one unsuccessful repair. A separately authored corrected stair passes, including the same one-follow-up API path. No correction is injected into recovered responses.

## 6. Remaining contradictions

Canopy, both responses: five actual door/route gaps of 1.4–3.5 m, the disconnected `arch-water-garden` joined claim, and `southGarden` extending to z=67 beyond fixed z=60. Initial Canopy additionally has three doors spanning recess wall planes. Route and door-contact findings are duplicate evidence for the same five access decisions.

Cloister, both responses: the driveway references `siteNorth` without an explicit site-access identity; full-width guest/wellness approaches intersect pavilion walls. Initial Cloister also puts `palmGarden` beyond the site. Blueprint site bounds and authored overrun describe the same garden defect. Derived grouping resolves none of these architectural decisions.

## 7. Regression, screenshots and preservation

Focused fixtures cover complex/curved footprints, bent canonical ribbons and overlapping membership, hierarchy ribbons, reserved garden/courtyard space, straight/L/U/spiral stairs, both turns/all directions with rotated hosts, blocked approaches, partition doors/headers, unsupported landings, mismatched storeys, intact/misplaced slabs, hosted-deck openings, blueprint approval and narrowly scoped repair. Mocked API tests prove rejection after failed repair and acceptance of an independently authored valid stair correction.

[Eight WebGL captures](webgl/capture.json) use production PrimitiveMesh, edge finishing, environment, sun/shadows and PostFx: straight, L, U, right/left spiral, roof deck, blocked approach and tiny stair. Each has a real WebGL context. There are zero browser errors and zero attempted provider requests. Close section views were inspected as construction evidence, not an architectural-quality certification.

Recovered fixture bytes and saved-project fixture files remain unchanged. Eight of nine compilation baselines remain identical, including every saved-scene baseline. [baseline-change.json](baseline-change.json) records the sole intentional synthetic functional change: the sky-stair landing moves 0.85 m inward by explicit test authorship and its hosted terrace gains the actual opening. The synthetic conventional valid fixture now authors separate single-storey stairs; the impossible long flight is not grandfathered as valid.

Final verification: **218 focused tests passed; 2,105 full-suite tests passed, 3 skipped; 176 files (174 with executed tests, 2 with only skipped tests).** TypeScript, ESLint with zero warnings, git diff whitespace and new-source whitespace checks pass. Counts/checks are in [checks.json](checks.json), [focused-tests.json](focused-tests.json) and [full-tests.json](full-tests.json).

```sh
NATIVE_LIVE_QA=0 TEST_DATABASE_URL= GEOMETRY_AUTHORITY_REPLAY=docs/architecture/geometry-authority/replay.json npx vitest run src/lib/v3/__tests__/geometryAuthority.test.ts
NATIVE_LIVE_QA=0 TEST_DATABASE_URL= npx vitest run --maxWorkers=2
npx tsc --noEmit
npm run lint -- --max-warnings=0
git diff --check
# Existing local DEV server and existing Playwright installation; AI requests blocked:
PLAYWRIGHT_DIR=<existing-installation> node scripts/geometry-authority-capture.mjs
```

## 8. GO / NO-GO

**NO-GO for another paid generation.** The targeted contract and physical-acceptance fixes have offline proofs. Neither recovered estate is valid, and the design decisions needed to resolve remaining routes, site boundaries and joined claims have not been supplied. No additional paid evaluation is authorized or needed to complete this milestone.
