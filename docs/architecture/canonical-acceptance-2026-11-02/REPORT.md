# Canonical acceptance test: one Terra generation (2026-11-02)

One paid POST, frozen request SHA-256 `f16409a5…0dec`, HTTP 200, response `completed`. No retry, fallback, repair, commit, deployment or database write. Plan retained unmodified.

**Result: the plan did not compile.** No scene, no renders. Cost est. US$0.114 (5,771 in / 8,541 out incl. 3,940 reasoning), local estimate.

- Compiler error: `arrival-court: height is required` — an outdoor, unroofed landing in a single-level plan was authored with `height: null`.
- Independent offline diagnosis ([diagnosis.json](diagnosis.json), [drawing](diagnosis/authored-arrangement.DIAGNOSTIC.png)) shows two more model-authored errors the compiler had not yet reached: `guest-wing-entry` joins guest-hall and dining-room which share no wall (guest wing floats unconnected), and the lawn reserve lies 7.75 m outside the declared 90×70 m site (arrangement needs 54×85.5 m).
- Wing system: 3 wings (2 placed relative to the primary), 0 collisions, 1 `separate` constraint declared and satisfied (3.0 m measured).
- Files: [proposal.exact.txt](proposal.exact.txt), [provider-response.exact.json](provider-response.exact.json), [normalized plan](proposal.normalized.json), [coordination.json](coordination.json), [compile-result.json](compile-result.json), [estimated-cost.json](estimated-cost.json).
