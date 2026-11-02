> **SUPERSEDED, never submitted.** Replaced by ../canonical-redesign-revision-2026-11-02 (brief-derived programme, authorized redesign). Hash 94b18aff… must not be run.

# Second Terra revision: prepared, frozen, NOT submitted

No paid call, commit, deployment or database access. Terra's retained rejected revision (`canonical-plan-revision-2026-11-02/revision-record.json`) was only read; the request's `currentPlan` is byte-equal to its `revised.plan`.

- Frozen request: `request.prepared.NOT-SUBMITTED.json`, 506,172 bytes, SHA-256 `94b18aff315037a3fa952916a9bdd543538ce2835cbb1a3906b19b0b89081418`
- Previously approved request: `d830dac2…4e8a` (superseded; its approval does not carry over)
- Estimate (repository default rates, not an invoice): ~33,200 input tokens; **about US$0.22 expected**, US$0.21 at the previous call's output (11,774), US$0.43 worst case at the 30,000 ceiling. Previous call: US$0.184.
- Comparison with the approved request: `comparison.previous-vs-new.json`

## Changes against the approved request
| Part | Result |
|---|---|
| Model, max tokens, reasoning, strict format, request keys | identical |
| Brief, retained architectural knowledge, context precedence | identical |
| Output schema | one change: `portals[].host.side` enum gains `shared`, `exposed` (the coordination contract). Nothing else |
| System contract | additions only: shared/exposed sides; every upper room needs its own landing door; windows/screens only on exterior walls; pitched roof stays in its cell with boards only on unshared edges; unsupported stacked pitched roof; overhang reach rule. Screens sentence tightened to "never a wall shared with another room" |
| Revision addendum | additions only: relationshipDecisions, dependency rule, "re-read measured.exposure before returning". No sentence removed |
| Context data | `currentPlan` and everything measured from it differs by necessity (it is Terra's revision, not the original). Added: `measured.exposure`, `findings.relationshipDecisions` |
| Image | same renderer; plan drawn is Terra's revision |

## What Terra sees: the 14 decision groups (36 findings)
Four ensuite walls (east/west suites 2 and 3), upper circulation (owner, upper-west and upper-east suites unconnected to `upper-landing`), media-lounge/east-suite-1 overlap, pitched roof on east-suite-3 under the stacked owner suite, arrival bed vs stair hall, and six windows on walls now shared (dining, entry hall, gallery, suite-1 north walls, media lounge). Latent compiler limits: none. `repeated-cells` is the one fired weakness signal (6 identical 9×6 suites, 6 identical 4×6 baths).

## Two things in the frozen request that cut against "freedom to rethink"
1. `requirements.mustRetain` plus the programme gate count Terra's rejected revision as the floor: 12 bedrooms, 16 bathrooms, 4 living, 5 entry. A rethink that reduces those uses is stopped as `programme-not-preserved`. The brief only says "approximately six generous bedroom suites". Suites can still differ in size, form and position.
2. The disposition reads `repair` (one fired signal), and its note says to preserve coherent decisions. It is labelled a measurement, but it leans against redesign.
Neither was altered. Changing either changes the hash.

## Execution (only after approval of the hash above)
```
node scripts/canonical-second-revision-once.mjs --approve-sha 94b18aff315037a3fa952916a9bdd543538ce2835cbb1a3906b19b0b89081418
npx vite-node --config vitest.config.mts scripts/canonical-second-revision-review.ts
# only if the plan compiled (scene.accepted-for-review.json exists), dev server on :3015:
node scripts/canonical-second-revision-capture.mjs
```
The runner refuses other bytes, runs connectivity preflight first, writes an exclusive `call-started.json`, one POST, no retry/fallback/repair. The review replays the response offline. The capture renders the compiled scene unchanged at `/dev/canonical-second-revision` (dev only, 404 until a scene exists), with all APIs blocked, in Arrival/Aerial/Garden/Poolside, and verifies element ids, positions, yaw, no page errors and no context loss.

## Reporting, kept separate
A. Compilation: schema, physical validity, programme, compiler outcome, remaining findings by group (each of the 14 reported resolved / remaining / new).
B. Architectural quality, only from browser renders: suite differentiation, ensuite relationships, window exposure, landing circulation, roof coherence, arrival and elevations. Compiling is not a quality claim; indicators are not beauty scores.

## Verified offline
Review script plumbing exercised in scratch with the old retained response (parses; reports the same 36 errors, "unchanged"). Canonical tests: 218 pass. New files typecheck clean (existing unrelated script errors remain).
