# Offline diagnosis of the saved Terra mansion proposal (2026-11-02)

No paid call, commit, deployment or database change. The saved response was never modified (`proposal.normalized.json`, SHA-256 recorded in [findings.json](findings.json)).

## Verdict
**Do not recover this proposal. Improve how the next one is designed.** The plan has at least 57 independent construction errors, and recovering it means moving rooms, shrinking the site, re-keying openings and removing roof eaves: new architectural decisions, not software repair. Even with every error fixed it would be a one-storey, 1,316 m² block of orthogonal boxes with a single flat roof type. See §4.

## 1. Complete failure inventory
A new read-only pass, `diagnosePlan` ([diagnose.ts](../../../src/lib/villa/canonical/diagnose.ts)), re-derives each fact from the authored placements and reports every independent error together. It does not weaken or replace compilation, and does not claim later compiler stages ran. Cross-check: on the three occupied-volume overlaps its geometry equals the compiler's exactly (test). Labelled drawing: [authored-arrangement.DIAGNOSTIC.png](authored-arrangement.DIAGNOSTIC.png) (diagnostic only, not accepted geometry).

| # | Issue | Count | Cause class | Status |
|---|---|---|---|---|
| 1 | Lawn anchored to the pool (`missing site anchor`) | 1 | **Contract too restrictive** (anchoring a lawn to a pool is reasonable) | **Fixed** |
| 2 | Lawn lies 10.7 m outside the 90×75 m site. The site is centred on the *room cells*, so pool and lawn beyond the building fall off it | 1 | Terra mistake, enabled by an **unstated contract fact** | Instruction clarified |
| 3 | `kitchen/west-suite-1` (6×6 m), `pantry/west-suite-1`, `pantry/west-suite-2` overlap | 3 | **Terra mistake**; compiler correct | Message improved only |
| 4 | Portal `start/end` on north/west walls point the wrong way: `kitchen-pantry-door`, `kitchen-laundry-door`, `west-hall-suite-1-door`, `west-hall-suite-3-door` fall outside the shared wall | 4 | **Confusing contract**: portal edges run counter-clockwise, placement alignment runs low→high, and the instruction never said so | **Documented** |
| 5 | `living-east-window` is half on the wall shared with `media-lounge` | 1 | Terra mistake | none |
| 6 | Screens on the living wall (shared with media-lounge) and on `west-suite-1/2` (standing in kitchen/pantry) | 4 | 1 Terra mistake; 2 are consequences of #3 | none |
| 7 | Roof eaves: 15 pairs of roofs with 0.3–0.8 m overhangs overlap at the same height; 29 eaves project into a taller neighbour. All 21 abutting rooms carry overhangs | 44 | **Terra ignored an explicit rule** (separated roof sections) **and** a **missing deterministic capability** (eaves only on exposed perimeter) | Not built (see §3) |
| – | Compiler defects | 0 | – | – |

Observations (not errors): one level; every roof flat; 9 of 18 interiors have no window, including the 21 m gallery, kitchen and both private halls; no separate bathroom or dressing spaces (ensuites exist only as prose in the suite `use`); no stair, upper terrace, courtyard or roof deck.

Not examined or not replicated: junction splitting, staggered-wall checks, stairs (none), screen/roof construction bounds, and anything after the first compiler failure. Absence of a finding is not evidence the plan would compile.

## 2. Why the rooms overlap (not moved, not resized)
Placement is relative, so two chains were authored independently: the gallery/suite-wing chain and the living/dining/kitchen chain. The wing hall runs z −21..0 with west suites at x −10..−3; the dining room (x −14..−4) ends at z −21, and the kitchen was placed *north* of it, into z −21..−15 and under the suite wing. The model never saw absolute coordinates, so it could not see that two chains met. The compiler message now states each room's extent and the shared rectangle (`kitchen spans x -14..-4, z -21..-15 …; they share x -10..-4, z -21..-15`).

## 3. Corrections made (each tested on a different arrangement)
1. **Typed site anchors.** A pool or landscape item may be anchored to a space *or another pool/landscape item*. Ids are already unique across all entity types, so a reference is unambiguous; chains resolve recursively; self reference, cycles and unknown ids are rejected by name; site bounds and allocation-overlap checks are unchanged. Tests: lawn beyond a pool in a two-level house, a two-step chain on the multilevel waterfront arrangement, cycle/self/unknown, out-of-site, id collision (`siteAnchors.test.ts`).
2. **Contract clarity (instruction text only):** the site is centred on the room cells and must contain pool and lawn; portal alignment direction is stated. The direction convention is proven by a compile-and-diagnose test on a different arrangement (`diagnose.test.ts`).
3. **Overlap message** names extents and the shared rectangle.
4. **`diagnosePlan`** plus 14 tests, including no false positives on four compiler-accepted arrangements.

With (1) the saved plan now passes the anchor and stops at the three overlaps, as the compiler's fail-fast first stage ([output](compiler-as-saved-after-anchor-support.txt)).

**Deliberately not built:** per-edge roof eaves. Eaves on abutting rooms need partial-edge shared-boundary logic and junction rules with taller neighbours; it is the roof-junction subsystem you ruled out, and it would not address the overlaps, openings or design.

## 4. Would it be a convincing US$25 million estate if corrected?
No. The intent text promises a "courtyard estate" with a "tall central gallery". The authored geometry is a compact rectilinear block (about 33×44 m): a 6 m wide, 21 m long unlit spine flanked by identical 7×7 m suites in a row of three each side, a living/dining/terrace row at the end and a tiny forecourt, in one storey under uniform flat roofs. Gallery height is 4.2 m against 3.6 m suites, the "double-height" entry 4.5 m: no real section. There is no courtyard, no level change, one roof form, six identical bedroom cells, and the pool, terrace and lawn sit in a line on the south axis. It is the same class as the earlier 776 m² and 952 m² attempts (hall with matching wings), only larger. Area is not ambition.

## 5. Greatest remaining limitation
Evidence from three mansion calls: all three failed on **spatial consistency the model cannot see** (stacked heights, now a disjoint kitchen block and site fit), and the one that was syntactically richest was not architecturally distinctive.

Ranked: (1) **bounded plan revision with complete diagnostics** is missing; spatial placement is the proximate failure, and the compiler's one-error-at-a-time output hides the rest. (2) Architectural creativity is genuinely limited but is not yet measurable, because no plan has survived long enough to be rendered. (3) Construction capabilities (eaves, courtyards, double height) matter only after (1).

**Recommendation (smallest generalizable improvement):** add one bounded plan-revision step: after a rejected or flagged plan, give the planner the *complete* `diagnosePlan` findings plus a derived absolute-extent table of its own rooms, and let it return a revised plan once (a single stated revision budget, deterministic validation after, no silent edits). `diagnosePlan` is already the input it needs; the same step becomes user-driven plan editing, which the product also lacks. Measure creativity on the first plan that compiles, not before. This is a separate, paid-call feature and needs your go-ahead.

## 6. Verification
Active suite 321 files / 3,131 tests pass; retired suite 350 pass; no new type errors in `src/`; ESLint clean. The frozen-request test now checks the consumed request's integrity instead of equality with the live handler, because the instructions have moved on: **any new live call needs a fresh preparation** (two instruction edits above). No such call was made.
