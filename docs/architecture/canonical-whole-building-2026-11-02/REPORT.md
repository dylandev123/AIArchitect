# Whole-building spatial coordination on the canonical path (2026-11-02)

Offline only: no paid AI call, no live experiment, no request preparation, no database change, no commit or deployment. Retained responses were read, never written. No new generator: `architecturalPlanSchema` → `compileArchitecturalPlan` → `generateCanonical` remains the only authoring path. Every house below is **developer-authored** and shows mechanics. None is evidence that Terra designs better.

## 1. What was wrong with the design process

The previous step (wing anchors) fixed a symptom. The root cause is in the representation.

- **Rooms were the only unit of placement.** `masses[]` held a role string and no geometry. A "wing" could only be said as a hall with rooms chained to it. Every room was resolved from one anchor, and non-overlap, a constraint over every pair, was never expressed. Collisions were detected after authoring and explained, never prevented.
- **Four resolvers.** The compiler, the diagnosis, the arrangement analysis and the site code each re-resolved placements. That is the duplication earlier audits warned about. There is now one resolver, `layout.ts`.
- **The concept was prose.** `thesis` and `role` were never checked against what was built, so the concept could not persist into construction.
- **A compiler defect rejected valid geometry** (audit item 5). A room 2.4 m deep placed after a 7 m room gives 9.4−7 = 2.4000000000000004. The slab outline normalised to 0.5000000000000003, and the element schema (≤0.5) rejected it. This was found while building the courtyard fixture. It is independent of Terra and would have hit any plan with such dimensions. It is fixed narrowly in `compiler.ts`: noise within 1e-9 of ±0.5 is clamped, and every previously accepted output is byte-identical. The test sweeps 400 random decimal sizes.

## 2. Which prior conclusions held

| Conclusion | Verdict |
|---|---|
| Collisions are between wings, never inside one (19/19) | **Confirmed**, re-measured. Retained proposals: 6, 1 and 9 collisions, all `branch-crossing` or corner overhang. |
| Wing anchoring prevents the class "where used" | **Correct but incomplete.** It anchors a room to a wing's box. The wing's own extent still depended on its seed room, so alignment applied to the seed, not the wing. |
| Retrieved knowledge may seed the corridor/gallery idiom (hypothesis c) | **Refuted for the mansion request.** The retrieved text (18.6 k chars) contains no "gallery", "corridor", "spine" or "central" at all. |
| The contract itself pushes toward hub-and-spoke | **Supported.** A single-root tree with "every room needs a door to the circulation space it hangs from" and connections only at gap 0 makes a high-degree hall the cheapest way to connect many private rooms. All three retained plans have a spine room with 3–4 dependants and chain depth 6. This is measured, but a causal effect on Terra is untested. |
| The revision caution "do not add storeys…" may flatten redesigns | **Plausible, untested.** The sentence was still in effect under the redesign authorization (the redesign went single-storey, all flat). It is now overridden in redesign mode. |
| Software "sometimes rejected valid geometry" | **Confirmed**, see the float defect above. |

## 3. What changed

1. **`layout.ts`: single spatial authority.** `resolveLayout` resolves rooms, whole wings and site items. `plan.ts`, `diagnose.ts`, `arrangement.ts` and the revision analysis all call it. Retained mansions resolve identically (tested).
2. **Wing placement by envelope (optional `masses[].placement`).** A wing's rooms are arranged in its own frame (one local origin), the envelope follows, and the wing is moved rigidly so its envelope has the declared relationship (side, alignment, gap, or `same` stacking) to another wing or space. The author states how wings relate. Envelope extents, corner positions and every room's world position are consequences. Rooms of a placed wing may anchor only inside it, so the cross-wing coupling that caused the collisions cannot be authored. Masses without placement behave exactly as before.
3. **`spatial.ts`: whole-building coordination** (`coordinatePlan`, pure and tolerant). It reports:
   - wing envelopes;
   - every volume overlap across levels, attributed to the placement decision where the two chains meet, with wing-level verified single-edit options;
   - declared constraints, measured;
   - wing-to-wing adjacency and connection;
   - stacking support;
   - the site the arrangement needs;
   - contradictory declarations;
   - `openChoices`, which are conflicts with several valid single edits. These are the author's decision, and software changes nothing.
4. **Declared constraints (optional `constraints[]`).** `separate` (minimum clear distance), `adjoin` (minimum shared wall) and `enclose` (share of a court's perimeter bounded by rooms). The concept's relationships become checkable data that persists with the scene. A violated declaration rejects the plan with the measurement, the implicated placements and verified edits. If no single edit works, the message names the placements to reconsider.
5. **Reachable from the canonical workflow.** The schema and instructions expose wing placement and constraints. `compileArchitecturalPlan` enforces violated constraints and appends wing-level explanations to compiler overlaps. `generateCanonical` returns `coordination`. The revision request carries a `spatial` block. Collision grouping in revision analysis now follows wing nodes.
6. **Prompt wording (small, evidence-driven).** Removed the presupposed "circulation space it hangs from". Wings may be entered directly, from a link wing or across an outdoor landing. The redesign authorization now states that storeys, symmetry and wings are free choices. Nothing requires or discourages them.

Not built: automatic rearrangement, a terrain or roof engine, a two-stage generator, or an early stair-fit check (the compiler still refuses misfit stairs). A wing envelope is a bounding rectangle, so an L-shaped wing cannot be tucked into; use room anchors there.

## 4. Division of responsibility

| The AI decides | Software computes or verifies |
|---|---|
| Parti, wings, their relation, hierarchy, levels | Rigid wing frames, envelopes, every room's position |
| Room sizes and uses, privacy and adjacency intent (as constraints) | Overlaps across all levels, constraint measurements, wing adjacency, stacking, site need |
| Which wing yields when options exist | The options, each re-verified, and what each would create |
| Whether to keep or drop a conflicting declaration | Rejection, with the placements that produce the conflict |

## 5. Does it prevent the demonstrated collision classes? (stress sweeps, not base rates for any model)

| Class / sweep | Room-by-room placement | Wing placement |
|---|---|---|
| Spine parti corner overhang, 2000 size sets | 1943 arrangements collide | **0** cross-wing collisions |
| Wings on opposite sides of a core (E+W, 1000) | 184 collide | **0** |
| Wings on opposite sides (N+S, 1000) | 645 collide (1122 overlaps) | **0** |
| Wings on all four sides (2000) | 1627 collide (4010 overlaps) | 308 collide (394 overlaps), **all** wing corner claims |

- Prevented by construction: cross-wing branch-crossing, same-side cross-chain collisions and the seed-versus-envelope alignment error, wherever wings are related as wings.
- Not prevented, but detected, classified and explained: two wings on adjacent sides of one host that both overhang its corner. Which wing yields is architectural, so it is reported as an open choice with verified wing-level edits.
- Still entirely the model's job: sizes inside a wing, doors and roofs for each wing.

## 6. Expressiveness

Improved. Wing relationships (shared wall, link wing, court between wings, stacked over, detached across an outdoor path), declared privacy and enclosure, and multi-level wings are now expressible directly. Nothing is forced: no symmetry, level count, wing count or template. Restricted only in one place: a room of a placed wing cannot anchor outside its wing, and the wing envelope includes its outdoor rooms. Put terraces and forecourts in wings of their own when interior walls must align.

## 7. Arrangements that compile (real compiler, [evidence.json](evidence.json), [diagrams/](diagrams/))

| Arrangement | Wings | Levels | Elements | Diagnosis errors | Physical failures | Notes |
|---|---:|---:|---:|---:|---:|---|
| Compact family home | 4 | 1 | 54 | 0 | 0 | |
| Asymmetric multilevel | 6 | 2 | 71 | 0 | 0 | bedroom wing stacked over living wing, studio across an outdoor walk |
| Courtyard | 6 | 1 | 78 | 0 | 0 | `enclose 0.9` declared, measured 1.0 |
| Multi-wing estate | 8 | 2 | 106 | 0 | 0 | privacy 18 m, two adjoin constraints, link wing, detached spa path |

All four are deterministic and individually editable. They pass save/reload, an element edit, and project Undo/Redo, and they cross the strict provider wire with nulls. The plan, including wings and constraints, persists in the scene. Footprint fill (0.29–0.77) and mirror share (0.22–1.0) differ widely. These are measurements, not beauty ratings.

Competing and impossible cases (all in evidence.json and the tests):
- privacy 40 m demanded where the arrangement gives 19 m: rejected with options;
- 34 m privacy on a 62×70 m site: the only single edits create `site:fit` and adjoin failures, so the competition is named;
- separate and adjoin declared on one pair: contradictory declarations;
- a court declared enclosed after its range is shortened: rejected;
- wing cycle, two local origins and cross-wing room anchors: rejected;
- two long wings on adjacent sides: an open choice with verified wing-level edits;
- stacking two wings on one level: rejected. The reported message is the downstream "share no wall" door error, because portal derivation runs before the overlap report. The overlap is in `coordination.collisions`. Reordering the messages would be a worthwhile improvement.

## 8. Unsupported or unresolved

- Whether Terra uses wing placement well is **untested**; this task made no model call. The earlier warning stands: numeric variety is not beauty.
- Stairs still require the author to align lower and upper cells. A cross-wing stair needs aligned footprints, and a stair-fit coordinator is not built.
- Constraints are plan distances and wall lengths, not sight lines or acoustics.
- Envelopes are rectangles. Roofs, terrain, curved or non-rectangular outlines remain unsupported (unchanged).
- Detached pavilions need an outdoor path wing for access. Software never infers a connection.
- The estate fixture exposed a heuristic limit in `physicalEvidence`: a door on the same wall as a stair foot makes its route check fail. I moved the door and did not weaken the check.

## 9. Verification

| Check | Result |
|---|---|
| Canonical tests (before) | 250 pass, baseline |
| Canonical tests (after) | 289 pass, including 39 coordination tests and 5 wire tests; 3 existing tests edited: wording of one resolution message, and the provider-wire diff now also reverts the additive optional fields |
| `src/lib/villa` + `src/app/api/ai` | 1198 pass, 0 fail |
| Full suite | **349 files / 3683 tests pass**, 2 files and 3 tests skipped (pre-existing skips), 0 fail |
| Typecheck, ESLint (canonical + script), `next build` | all pass |
| Build warning | The NFT warning traces to `src/app/dev/physical-programme/page.tsx`, unrelated to this change |

Reproduce:
```
npx vitest run src/lib/villa/canonical
npx vite-node --config vitest.config.mts scripts/canonical-coordination-offline.ts
```

## 10. Before the next real generation

1. Approve a new request: instructions and schema changed, so prepared requests (`*.NOT-SUBMITTED.json`) no longer match their hashes.
2. Run the pre-registered experiment from the concept-first report: same briefs, model, effort and ceiling, zero retries, N ≥ 5 per cell. The control is the previous instructions. Measure the share of plans using wing placement and constraints, hard-gate pass rate, collision classes and `compositionOf` spread. Human blind comparison is the only judge of beauty.
3. Consider a stair-fit coordinator and the message-order fix before spending.
