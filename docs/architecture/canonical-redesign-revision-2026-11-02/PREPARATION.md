# Second Terra revision, final freeze (NOT submitted)

No paid call, commit, deployment or database access. Starting point: Terra's retained rejected revision, read only (record SHA-256 prefix `5d0f0491…` unchanged; `currentPlan` byte-equal to its `revised.plan`).

- **Frozen request:** `request.prepared.NOT-SUBMITTED.json`, 508,885 bytes, SHA-256 `1de8e0b187f59364730aebe8af6a501b8871d6dff52acecb134c164cadf28759`
- Supersedes `123e60b9…` (kept in `../canonical-redesign-revision-SUPERSEDED-123e60b9`) and `94b18aff…`. Neither was submitted; the runner points only here.
- **Estimate** (repository default rates, not an invoice): ~33,900 input tokens; **about US$0.22 expected** (US$0.209 at the previous output of 11,774; US$0.43 worst case at the 30,000 ceiling). Previous call US$0.184.

## The final programme correction
"approximately six generous bedroom suites" now means: target 6, accept 5 to 7, reject fewer than 5 suites or more than 7 sleeping rooms.
- A **suite** is sleeping accommodation with private bathroom facilities. Facilities may be a bath space joined to the room by a door or passage (any name, found by id or use; each bath serves one room), or declared by the room's own use (for example "with ensuite"). Room names are not prescribed.
- The maximum counts every sleeping room, so a room without a bath cannot be added to exceed seven, and the failed plan's nine suites would be rejected as too many. Only rooms with facilities count toward the minimum.
- A brief that says "bedrooms" (not "suites") needs no private-bath test; an exact number remains a minimum with no maximum.
- Unchanged: at least 2 living/entertainment spaces, 2 terraces, 1 entrance, 1 service, 1 pool; bathrooms, kitchen and dining are not required. The failed plan's counts are shown for information only (9 suites, 9 sleeping rooms, 16 baths); the earlier crude "12 bedrooms" figure is not shown.
- Tests (`programmeRedesign.test.ts`, 14): 5, 6 and 7 suites pass; 4 and 8 fail naming the brief phrase; a bath as a renamed connected space passes; a bath declared within the room passes; bedrooms without baths and one bath serving two rooms do not count; a seventh suite plus an eighth bathless room fails; the failed plan is too many; other missing accommodation still fails.

## Differences
Against the previous freeze `123e60b9…`: system text (contract, knowledge, precedence, addendum, redesign block), output schema, plan image, starting plan, measurements, findings, disposition (`redesign`, measured `repair` retained), model and settings are **identical**. Only `requirements` changed: `derivedRequirements` (bedrooms gain target 6, maximum 7, suite definition), `currentPlanCounts` (bedroomSuites/sleepingRooms in place of the crude bedroom count) and its note. Full comparison, including against the approved `d830dac2…`: `comparison.json`.
The REDESIGN authorization, and the sentence cautioning against adding storeys for their own sake, remain.
Unchanged: `gpt-5.6-terra`, 30,000 output ceiling, provider-default reasoning, strict schema, original brief, one call, zero retries, no fallback.

## Execution (only after you approve this hash)
```
node scripts/canonical-second-revision-once.mjs --approve-sha 1de8e0b187f59364730aebe8af6a501b8871d6dff52acecb134c164cadf28759
npx vite-node --config vitest.config.mts scripts/canonical-second-revision-review.ts
node scripts/canonical-second-revision-capture.mjs   # only if scene.accepted-for-review.json exists; dev server on :3015
```
Reporting stays split: compilation and gates first; architectural quality only from browser renders (Arrival, Aerial, Garden, Poolside).
