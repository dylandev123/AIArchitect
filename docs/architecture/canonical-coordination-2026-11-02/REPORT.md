# Spatial coordination: derive what relationships determine, report the rest precisely

No paid request, commit, deployment or database access. Retained Terra files were only read. Every proposal beyond the two retained Terra plans is a developer-authored fixture or mock, labelled as such. Numbers: [results.json](results.json).

## 1. Root causes of the 87 findings

The 87 findings were **17 independent decisions** (now 85 findings: see §4), not 87 faults.

| Decision | Findings | Cause |
|---|---:|---|
| Pitched roofs (4 clusters, 9 roofs) | 52 | A gable/hip roof carries a 0.1 m fascia on all four edges. The roof builder cannot trim it to exposed edges, so each pitched roof collides with every same-height neighbour. One relationship per roof, reported once per neighbour pair. |
| Bath walls (4 suites) | 20 | Adding an ensuite beside a suite changed that wall for everything on it: the window now faces the bath, a pier conflict with the bath door, and a screen standing inside the bath (3 findings). One decision per wall. |
| Other walls (6) | 8 | Windows authored on walls that became shared (dining/kitchen, entry/stair hall, gallery/hall, media/bath, suite-1s). |
| Upper floor unconnected | 3 | The stair reaches `upper-landing`, but no door joins the landing to any of the three suites that share its walls. |
| Volume collision, site | 1 + 1 | `media-lounge` against `east-suite-1`; arrival bed against the stair hall. |

Where the software was wrong or blind:
- **3 findings were not conflicts.** A flat roof over a partly covered room is built by the compiler over its exposed remainder only; the diagnosis used the whole room. Removed: `central-gallery/owner-suite`, `entry-hall/upper-west-suite`, `east-private-hall/east-suite-3`.
- **1 failure was invisible.** `entry-stair-door` sits left of the stair flight, which the compiler rejects only at a later stage. The diagnosis now reports it. Terra's plan would have failed there too.

## 2. What the software now derives, and what stays Terra's

Derived when Terra declares the relationship (new `host.side` values, additive; explicit sides behave exactly as before):
- **`shared`** (door/passage to a neighbour): the wall is found from the two rooms' geometry, and the opening is placed within the *shared segment* (start/centre/end of it), which also removes the counter-clockwise alignment trap. It is moved the minimum distance needed to clear a stair flight; if the whole wall lies beside the flight, it says so and does not choose.
- **`exposed`** (window to outside): used when exactly one exterior run is wide enough; refused with every candidate interval when several are.
- Diagnosis only: roofs over partly covered rooms use the exposed remainder; stair clearance; every unreachable room lists the neighbours it shares a wall with (and whether each is reachable); a window on a shared wall lists the exposed runs that exist.

Not derived (the software never declares or guesses): that a connection exists, which facade a window faces when several qualify, roof form, whether a room gets a pitched roof, the arrangement, the site. Where no valid placement exists the finding says why.

Not fixable by derivation: the pitched-roof fascia. It is intrinsic to the shared roof builder; trimming it would change that builder for the whole product. It is handled by contract text, a decision grouping that names every neighbour, and a flat-roof rule for abutting rooms.

## 3. Software changes

- New [coordination.ts](../../../src/lib/villa/canonical/coordination.ts): placement, exposure, stair clearance (pure functions).
- [plan.ts](../../../src/lib/villa/canonical/plan.ts): schema enum widened; compile derives side/offset through it; contract text covers the three known gaps (upper rooms need their own doors; windows/screens only on exposed walls; the pitched fascia rule).
- [diagnose.ts](../../../src/lib/villa/canonical/diagnose.ts): shares the same placement; adds stair check, access candidates, exposed-run hints, partial-roof correction. No check was weakened.
- New [revision/decisions.ts](../../../src/lib/villa/canonical/revision/decisions.ts): groups findings by the relationship causing them, with what is new relative to a baseline; wired into `analysePlan`, plan drawing and the revision request (exposure table plus `relationshipDecisions`).
- [providerCompatibility.test.ts](../../../src/lib/villa/canonical/providerCompatibility.test.ts) updated to document the second intentional wire difference. The prepared (unsent) revision request hash changes; the earlier approved hash no longer applies.

## 4. Evidence it generalizes

| Case | Result |
|---|---|
| Original saved mansion (57 errors), only its 21 door/passage connections re-expressed as `shared` | Opening errors **5 → 1**. The one left (`living-east-window` faces `media-lounge`) is a real decision. |
| Terra's revision plus the 3 missing landing doors declared | Errors **85 → 81**; access failures **3 → 0**; `entry-stair-door` moved clear of the flight. Remaining 81 are all Terra's decisions (roofs 52, walls 27, arrangement, site). |
| Windows blocked by neighbours in Terra's revision (10) | `exposed` would have resolved **4** correctly; **6** are in rooms with no exterior wall wide enough: impossible, not mis-placed. |
| Compact multilevel house (developer fixture), mock adds ensuite + study upstairs, deepens the wing | Authored as relationships: **0 findings, compiles** (81 elements, all rooms reachable). The same intent with guessed edges: **2 findings**, rejected. Doors verified on the shared walls by geometry; accepted by the bounded revision; saved, edited, reloaded, Undo/Redo, recompile reproduces identical elements. |
| 36 combinations (4 sides × 3 placement alignments × 3 door alignments) | Compiled opening lies on the shared wall, within margins, every time. |

Tests: [coordination.test.ts](../../../src/lib/villa/canonical/coordination.test.ts), 72 tests; canonical suite 197 pass; 843 tests across villa, scene API and store pass; typecheck and ESLint clean for these files.

## 5. Does a supported proposal compile more reliably?

Yes, for the classes above: a connection declared as a relationship can no longer be mis-sided, mis-aligned or placed beside a flight, and the diagnosis now agrees with the compiler on stair clearance and partial roofs. **Terra's actual revision still would not compile**: 81 findings remain, and I did not repair it. Compiler stages after the first rejection stay unverified for that plan.

## 6. What remains incomplete

- Pitched roofs on abutting rooms are an unsolved design/builder constraint (52 findings).
- Windows still need a facade decision; a room wrapped on all sides cannot have one.
- Nothing here addresses beauty. Terra's revision still has six identical suites and six identical baths. The representation does not force this: rooms are independent rectangles with free sizes, heights, roofs and placement, and derivation reads only relationships, never modules. The repetition is a design outcome.
- Heuristics: the pitched-neighbour rule, programme matching and weakness thresholds are measurements. Derived positions follow the author's alignment as a preference; a stair move is reported (`movedFrom`) but not yet surfaced in the UI.

## 7. Next experiment

Smallest useful live test: **one Terra revision of the same rejected plan** (about US$0.2, the prior call cost US$0.184), with the new contract, exposure table and relationship decisions, authorized fresh. Evidence supports Terra over a stronger model for now: it understood the weaknesses and its design moves were sound; its failures were coordination classes now derived or precisely reported. Success criterion: it compiles, or fails on a *new* class. If it still repeats identical suites after coordination is clean, that, and not coordination, would justify a separate concept-development step or a stronger planner. Not before.

Reproduce: `npx vitest run src/lib/villa/canonical`; `npx vite-node --config vitest.config.mts scripts/canonical-coordination-offline.ts` (refuses to overwrite).
