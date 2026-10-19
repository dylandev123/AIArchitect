# V3 architectural design consistency and generation reliability

19 October 2026. Offline only. This work builds on the recovery addendum in `REPORT.md`; it does not repeat or change the recovered construction implementations. The two raw response fixtures remain unchanged.

## Outcome

New API generations now run a generation-only consistency gate before acceptance and before the existing single repair attempt. Both recovered responses are rejected with actionable findings. Separately authored synthetic corrections of both responses pass this gate and compiled geometry validation, retaining building geometry, roof objects and materials. Saved-scene loading, editing and compilation retain their existing policy.

`consistency-replay.json` contains both diagnostic sets, the exact prioritized repair feedback, and corrected-variant outcomes. Reproduce with:

```sh
CONSISTENCY_REPLAY_OUTPUT=docs/architecture/mansion-failure/consistency-replay.json npx vitest run src/lib/v3/__tests__/designConsistency.test.ts --maxWorkers=2
```

## Evidence and causes

A = generation instructions; B = semantic relationship/addressing; C = geometric validation/acceptance; D = normalization or repair.

| Failure | Evidence and cause | Current disposition |
| --- | --- | --- |
| Three original south sliding doors cross offset planes | Original `southLivingDoor` .12–.42, `southDiningDoor` .58–.88 and `southUpperDoor` .38–.62 cross recess boundaries .39/.61. Existing instructions already prohibited multi-plane doors: chiefly B/C and an authored contract violation, not a missing universal style rule. | Structural failure; diagnostics now include opening ID, level, span and each addressed local wall segment/plane. Terra must choose a single-plane placement or explicitly author a different opening composition. |
| Pool/lawn declared joined across 0.5m | `reflectionPool` south edge 36.5, `sunsetLawn` north edge 37. Existing joined wording was present after recovery. B/C: thematic arrangement was expressed as physical connection. | Blocking repairable relationship, with pairwise distances and 0.05m tolerance. Existing validation also retains its fatal estate-commitment classification. No lawn is moved automatically. |
| Side walks stop short | `guestWalk` x=-29.5…-26.5 versus host edges -33/-23; `wellnessWalk` x=26.5…29.5 versus edges 23/32. Four gaps: 3.5/3.5/3.5/2.5m. A/B/C: graph edges existed, but actual ribbon direction/extents did not fulfill them. | Blocking repairable relationships; route IDs, both object IDs, actual footprint coordinates and measured gaps reach the same repair attempt. |
| Entry walk stops short | End z=-11 versus recessed wall z=-9.6. B/C: envelope contact was mistaken for contact with an articulated building. | Both actual-footprint route distance (1.4m) and resolved door-threshold strips now expose this. Blocking repairable relationship. |
| Meditation court lacks access | `wellnessSouthGlass` is a window, not a door; court near edge z=19 versus pavilion z=18. A/B/C: no authored door or connecting surface; access review formerly ran only after successful objective ingestion. | Included before the objective repair as an advisory design decision, with target IDs, footprints and door guidance. A direct house door is not universally required for every outdoor court; no invented door/path and no universal fatal accessibility rule. |
| Threshold differences | Entry floor .26 versus walk .06; terrace .14; side paths .05. A/B/C: no explicit elevation transition. | Advisory with exact floor/surface elevations; the report does not equate a small step with structural impossibility or certify step-free access. Terra must explicitly design the transition if intended. |
| Ten zone conflicts | arrival: drive/walk/garden; residence: terrace; water: terrace/lawn/south garden; guests: west garden/walk; wellness: east garden. A/C: allocations were not reconciled against objects; previous review warned but accepted them. | Blocking repairable authored commitments. Diagnostics name each zone, allocation bounds and offending object footprint. Reallocation is allowed only for diagnosed zones, preserving membership and intent. |
| South garden beyond site | z=49…67 versus site limit 60. A/C: no generation acceptance gate for all authored object bounds. | Blocking repairable site overrun with offending world points and fixed site bounds. Terra must author a smaller/relocated garden; no clipping or enlargement of the site. |

No remaining listed failure originates from automatic movement or clipping in normalization: these contradictions are in both retained raw responses. Earlier canopy, stair, roof and bearing defects were already recovered and are not reopened here. Existing normalization still reports dropped invalid references/prose material categories; it is not an architectural decision engine. It does not correct these spatial contradictions.

Two additional deterministic audit defects were found while proving corrected variants:

- Joined-group contact previously expanded `dimensions`, but architectural dimensions remained authoritative, so exact touching could still be rejected. It also skipped connectivity when all members happened to have polygonal footprints. The check now measures distance between actual authored polygons (including concave boundaries) and tests joined groups regardless of polygonal form.
- Non-spatial route separation used envelope footprints and a 0.75m proximity tolerance. It now uses actual footprints and a 0.05m connection tolerance. This adds the entry route as the fifth disconnected chain edge and catches sub-metre gaps. Door addressing independently checks the intended opening.

## Exact contract additions

The shared estate prompt, used by V3 generation, now explicitly requires Terra to reconcile its own decisions in the same response:

1. Compute door spans against wall planes/recess returns; author separate doors itself when intended.
2. Terminate paths at the actual intended door or surface; use `serves` and spatial `openingId` where applicable; author bends.
3. Distinguish joined construction from thematic axes; physically joined objects must touch within 0.05m.
4. Compute surface tops and door floor datums, explicitly designing necessary landings/steps/ramps.
5. Fit every referenced physical footprint, including rotated geometry, within its zone allocation.
6. Keep objects and allocations within the authored site, preserving user-defined dimensions.
7. Do not rely on normalization to clip doors, move objects, close gaps or invent architecture.

The prompt explicitly says these are functional requirements, not mandatory doors, paths, amenities, styles, roofs or compositions. The synthetic original retains its wide north glazing, bridging assemblies, footprint and overhanging floating roof; it is not flattened to the captured repair's reduced design.

## Acceptance and repair boundaries

`designConsistency.ts` is a read-only audit. The API enables it using `requireDesignConsistency:true` in `ingestV3GenerationOutput`. Legacy/offline callers and persisted scene validation keep their historical policy. Fatal malformed prerequisites stop unsafe further analysis. Independent estate/access findings are collected even when supported footprint compilation has errors.

- **Structural:** unbuildable or ambiguous authored construction. Original has three such door findings; captured repair has none.
- **Repairable:** explicit geometric contradictions block new acceptance, despite being renderable. Both responses have 22 diagnostic entries here: some entry/side-access problems are independently reported by route and door checks, so this is not 22 distinct physical defects.
- **Advisory:** thresholds, inferred outdoor-access concerns and unverifiable budget/style/shape metadata. These do not become fatal merely because they are numerous. Original has 10 advisory entries (including outdoor access affected by omitted doors); captured repair has 11.

The bounded objective attempt receives structural and repairable findings first, then useful threshold/outdoor-access advisories. The former 16-item truncation is removed, so later estate conflicts are not hidden behind early failures. Generic metadata observations are omitted from this repair feedback. Long curved-footprint evidence is summarized to coordinate bounds rather than thousands of sampled vertices.

The guard permits diagnosed path extent/position corrections, diagnosed zone allocation changes (membership and intent protected), and diagnosed non-building joined-member/site-overrun corrections. Buildings and roofs are excluded from those general geometry permissions. Existing diagnosed technical roof/assembly repairs remain available. Door repairs are restricted to addressing fields; a door-span error does not authorize changing height, operation or unrelated openings. All candidates must pass ingestion again. Material changes, object deletion, removal of commitments, unrelated form changes and new architecture remain protected.

**Safely repairable means a narrowly scoped Terra-authored candidate can be reviewed and accepted, not that a deterministic repair may invent it.** Choosing which wall hosts a door, where a path runs, whether to extend the lawn, how to redraw allocations, or how to bridge an elevation difference remains Terra's decision. More extensive changes, such as subdividing one opening into new IDs, remain outside the conservative objective-repair guard and require explicit authorship outside that automatic repair path. No additional provider call was introduced.

## Synthetic decisions and rendering verification

The `corrected()` helper in `designConsistency.test.ts` makes explicit test-author decisions, never applied by production code:

- Put the three south doors on individually buildable spans (.12–.38, .62–.88, .40–.60).
- Widen guest path to 10m and wellness path to 9m centered x=27.5, connecting the existing doors without moving pavilions.
- Extend entry path to z=-9.6 (center -14.8, depth 10.4).
- Match tested path/terrace top surfaces to .26m.
- Extend the lawn north to 36.5, retain its south edge 57; move south garden to center z=51 so it ends at 60.
- Explicitly change the wellness south window into a ground sliding door and extend meditation court to z=18 at height .26.
- Redraw each allocation to contain its actual members within the same site.

These are intentionally focused geometric proofs, not a recommended estate redesign or a claim that these broad paths are the best aesthetic choice. Both synthetic variants pass without changing the building envelopes, roof objects or materials. They also eliminate the tested threshold and outdoor-access findings. The original/captured-response records and historical replay/screenshots are untouched.

Inspected retained before images: attempt-0 overview and attempt-1 plan; after images: attempt-0 overview/recess and attempt-1 arrival/roof/pavilions. They show the recovered roof/glazing/portico and the remaining disconnected access. New tests compare compiled models with and without the generation gate for exact equality, verify corrected compilation, and retain the stair. Full-suite compatibility and nine saved footprint-baseline fixtures cover supported construction and persistence. No new WebGL capture was made; this change does not alter renderer or construction output, and existing production-renderer screenshots remain the visual evidence.

## Validation and next generation

Final checks: **167 test files passed, 2 skipped; 1,954 tests passed, 3 skipped**. Focused consistency/estate suites: **29/29**. TypeScript (`npx tsc --noEmit`), ESLint (`npm run lint`, zero warnings), and `git diff --check` passed. Results are recorded in `consistency-checks.json`.

A controlled live generation is justified **after these checks pass**, as an evaluation of the stronger contract and the same one-repair budget. It is not a promise that Terra will make every required decision in one attempt, nor a certification of engineering, accessibility or luxury quality. The recovered responses themselves remain rejected and should not be relabeled successful. No live call was made in this task.

No V2 or terrain implementation changes, commits, pushes or deployment. Prior uncommitted work was preserved.
