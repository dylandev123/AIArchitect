# Canonical retrieval boundary and partial roof coverage (2026-11-02)

Offline only: no paid call, commit, deployment, database write or credential use. Nothing here shows the software produces premium houses; only a later live result can.

## 1. Retrieval boundary

**Defect (demonstrated):** the frozen request for the first corrected mansion contained 63 hits of retired direct-scene wording in the retrieved material: per-record `capabilities` ("Translate selected ideas into actual supported scene operations…"), per-record `construction.operations` / `requiredKinds`, `sources` notes citing `scene/terra.ts`, and the concept-guidance sentence "Exterior scope defers interior fit-out". The canonical contract forbids operations and requires planned rooms.

**Change (request boundary only):** `architecturalRequestContext(input,{canonical:true})`, passed by `generateCanonical`, now sends each selected record as `id, version, category, when, title, combinations, placement, principles` only, with any sentence that instructs scene operations removed (`library/architecture/canonicalKnowledge.ts`). The same sentence filter is applied to the concept guidance and lessons. The retrieval header names the architectural-plan-1 contract instead of the "scene construction contract". Stored records, approvals, versions, evidence and ranking are untouched; the default (operations-author) context is unchanged.

**Selection is not changed by the filter.** The budget is still measured on the original chunk size, so exactly the same nine records are chosen as in the prior live request (the first draft of this change freed budget and admitted three extra records, including a pavilion recipe; that was caught and removed).

**Exact provider-facing request:** built by the real `generateCanonical` path, the SDK's own HTTP serialisation, and the retained 334-record approved library snapshot, with a stubbed transport. Result: 0 retired-phrase hits (previous request: 63), retrieved material 9,081 characters (was 18,646), same brief bytes, strict-valid schema, 26,517-byte body. Design knowledge (`when`, `placement`, `principles`, `combinations`, `DESIGN AUTHORITY`) is present. The only remaining mentions of "scene operations" are the planner contract ("Never return scene operations") and the precedence clause telling the planner to disregard such wording. A control assertion confirms the unfiltered path for the same brief does contain the retired wording, so the check is meaningful. Tests: `requestBoundary.test.ts`.

Not claimed: the snapshot is a retained copy, not a fresh database read. Its selection equals the prior live selection record for record.

## 2. Partial roof coverage

**Case analysis of the retained mansion** (`foyer` 75% covered, `arrival-court` 38%, `living` 63%, `waterfront-veranda` 13%), all authored as flat roofs. The kernel already holds the exact footprints above them; deriving the open remainder is convex polygon subtraction. This is small and general, so it was implemented. A roof is now laid only over the exposed remainder, as editable flat profile slabs (`<space>-roof`, then `<space>-roof-2`…), underside at the wall top, provenance recorded. Nothing is trimmed from, or moved on, the authored rooms.

**Still rejected (deliberately):**
- A roof on a fully covered space (`gallery`, `guest-suite-1` in the retained mansion: the floor above is its cover).
- A partly covered space with no roof (incomplete overhead enclosure).
- A pitched (gable/hip) roof over a partial cover. Preserving its type would need a lean-to or valley junction against the taller wall: a roof-junction subsystem, not built. Message names the reason and the remedies (flat roof, or upper rooms wholly over/clear).
- An overhang on the exposed remainder (it would run into the storey above).
- A remainder narrower than the 0.18 m wall (a sliver that cannot carry a roof).
- Any volume overlap, and any stair whose flight lies under a derived roof.

**Tests** (`partialRoof.test.ts`, 14): geometry primitives; compact (half covered, one slab, area exactly the open half); asymmetric (corner covered, L-shaped remainder as two slabs, total area = footprint − covered area); multilevel (third storey over part of the middle storey, only the open strip is roofed; lowest-datum cover rule on three levels); no derived roof over the upper room; determinism and provenance; a roofed stair-lower room; and each rejection above. `verticalAuthority.test.ts` was updated: the roofless-partial rejection stays; the four partial-roof findings are gone.

**Planner instruction:** one sentence changed ("a space only partly covered … is not expressible, so split it") to say such a space takes a roof entry and the compiler roofs its remainder (flat only, no overhang). Without this the model would keep being told to avoid what is now supported.

## 3. Retained mansion replay (`retained-mansion-replay.txt`)

Still rejected, correctly: six occupied-volume overlaps (model-authored heights 4.2/3.9 m under a 3.6 m rise) and the two fully covered roofs. The four partial-roof findings no longer appear. On an *altered diagnostic copy* (heights omitted, two contradictory roofs removed, not a Terra output) the roof stage passes and compilation next stops at an unrelated opening finding (`upper-suite-4-bath/suite-4-north-window: overlapping openings or insufficient pier`). Later plan-level checks (roof bounds, screens, site) were not reached for that copy, so it is not shown that the proposal would compile.

## 4. Regression

`npm run test:active`: 319 files / 3,112 passed, 0 failed (3 skipped). `test:retired`: 21 files / 350 passed. ESLint clean on changed files; no new `src/` type errors (existing errors are in `scripts/` and `docs/`). One test that pinned the superseded unsubmitted preparation byte for byte was changed to check only strictness and the frozen brief; that file is retained, not rewritten.

## 5. Prepared next controlled mansion test (NOT SUBMITTED)

[Exact request](provider-request.prepared.NOT-SUBMITTED.json) · [verification](verification.json). Same frozen brief as the two earlier attempts (so the comparison isolates the compiler and prompt changes), same model `gpt-5.6-terra`, 30,000 maximum output tokens, provider-default reasoning, zero retries, one POST only, SHA-256 `8a61d11a154e629013f358bd3489ed217b11cdbb3bc7ac0cc56ee3e783bdab49`. `requestBoundary.test.ts` fails if the handler's serialised request ever drifts from this file.

Estimate at the rates verified on 2 Nov 2026 ($2/M input, $12/M output): roughly 6–7k input tokens; the last accepted call used 9.5k output, giving about **$0.13**; at the full 30k ceiling about **$0.37**. Not an invoice or cap. **No call is made until you confirm.**

Evaluation when run: judge architectural ambition, compiler fidelity and rendered quality separately. Capture unchanged arrival/aerial/garden/poolside views, measure occupied floor union and mass/level hierarchy, and compare against the 776 m² and 952 m² attempts, which are boxes with matching wings. Failures are investigated offline without repair calls.

Known risks to expect, not fixed here: retrieval still selects the `infinity-pool` record although the brief excludes that amenity (unchanged from the prior request); the model may repeat the explicit-height contradictions even though omitting heights is now documented; and a pitched roof over a partly covered space will be refused.
