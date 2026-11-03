# Architectural knowledge → structured decisions → constructed building (2026-11-03)

Offline only. No paid model call, no new mansion experiment, no commit/push/deployment, no database write. `architectural-plan-1` remains the sole generation authority. Every house here is a **developer-authored fixture** that tests what the software can carry; none is Terra output and nothing here shows Terra designs better. Evidence: [knowledge-audit.json](knowledge-audit.json), [fidelity-summary.json](fidelity-summary.json), 20 captures (`*-{arrival,aerial,garden,poolside}.png`, `browser-result.json`).

## 1. Are the 334 records sufficient and useful?
Not as architectural intelligence. Count is not the problem.
- **No whole-house strategy existed.** 273 are labelled "recipe", but each is one feature in one or two sentences (average 439 characters across when/combinations/placement/principles). Only 20 are `composition`, and those are one-liners ("Step secondary roofs below the main gathering volume…").
- **Relationships are mostly absent.** Of 334 records, 80 mention none of roof / facade / entrance / landscape / hierarchy / circulation, 143 mention one, and only 48 mention three or more (1 mentions all six). In 235 of the 301 curated records, the `combinations` field, which should hold the relationships, is one of 16 palette sentences copied across 10–15 records each ("Unify ivory wall planes with timber recesses…").
- **Real reasoning exists, but terse.** Each curated record carries a one-line failure clause ("Avoid equal boxes with no hierarchy"). That is genuine design reasoning, not marketing prose, but it is one clause, unconnected to any other record.
- **Outdated or contradictory.** 279 records still carry direct-scene `capabilities`/operations wording (already stripped at the canonical request boundary). Four roof recipes (Lantern, Mono-Pitch, Floating Ridge, Split-Plane Canopy) rest on roof forms the compiler cannot build (it builds flat, gable, hip). No record contradicts another; several recommend geometry the contract lacks (planting, lanterns).

## 2. Does retrieval give Terra a complete strategy?
No. Traced on the frozen mansion brief: nine records, **7.5k of an 18k-character allowance sent**. The allowance was counted on each record's original text, including the `capabilities`/`sources`/`construction` fields the canonical filter strips before sending, so `composition-hierarchy` and `pavilion-cluster-order` were dropped as "retrieval budget" while three of twelve slots sat empty. The only composition record delivered was `estate-composition`: "Give secondary volumes a programme and subordinate them to the residence." Terra received nine fragments, one per category, with no organising idea tying them together.

## 3. Does the knowledge connect to the composition system?
No. The words `tier`, `roofSpan`, `facades`, `entrance` and `heightStep` appear only in the `COMPOSITION FIRST` instruction paragraph (the mechanics). The knowledge says "subordinate", "step roofs", "pavilion links" but never says how to declare them. The disconnect sits at **idea → plan**: below it the chain holds (plan → compiler is enforced; compiler → renderer verified by the earlier composition work and again below). Above it, concept lives in `thesis` and `masses[].role` as free prose.

## 4. What is genuinely missing
Whole-house organising ideas (partis) expressed in the decisions the contract can carry, with the contract's limits stated. Not more facts, not more mansions, not a bigger prompt.

## 5. What was implemented
| Change | Why |
|---|---|
| Canonical retrieval counts the allowance on the text actually sent (`retrieval.ts`) | Fixes the demonstrated waste. The mansion brief now receives 12 records (was 9), 11.5k of 18k chars. |
| Five whole-house strategies in `strategies.ts` (waterfront central pavilion, tropical pavilion court, courtyard residence, hillside stepped levels, compact two-volume) | Each states the ten parts you listed: when, concept, massing/hierarchy, organisation and circulation, section, roof and facade, indoor-outdoor, materials and climate, **expression in canonical fields** (`construction.supports`), **what is not expressible** (`construction.unsupported`). |
| One reserved strategy slot, canonical Generate only; strategies never offered to the retired operations path | A parti shapes every other decision, so it must not lose a slot to single-feature records. |
| Canonical chunk sends `expression` and `limits` for strategies only; one header sentence says a `strategy-` record is an organising idea to adapt or decline | Delivers the mapping and limits without changing other records. |
| Canonical retrieval drops the four recipes resting on unbuildable roof forms | They invited a declaration the compiler would reject or silently drop. |
| `fidelity.ts`: measures the built house against the declared concept | See §7. |
| Three new fixtures, dev page, build/capture/audit scripts, 34 tests | Verification. |

**Deliberate non-additions.** No "contemporary luxury villa" strategy: that is a design language over a parti, and the five partis plus existing envelope/material records carry it. Retrieval confirms it: that brief and "Design a house." select no strategy. No rewrite of the 334, no new engine, no schema change, and the knowledge store keeps its existing records and approvals.

**Provenance.** Strategies ship as code seeds (not a database write), each source note starts `DEVELOPER-AUTHORED`: not a documented precedent, not reviewed by a practising architect, expression verified only by compiling a fixture. Deploying them to the production library is a separate, unapproved step.

**Pinned inventory changed.** Five existing tests pin library size; they now read 315 seeds / 339 approved (+5). `requestBoundary.test.ts` asserted the canonical path selects exactly what the unfiltered path selects. That equality was the defect, so it now asserts more records fit and that exactly one strategy is reserved. `route.knowledge.test.ts` retrieves strategies via the canonical path, the only one that offers them.

## 6. Verified offline
Per strategy (5 fixtures; two reuse existing developer fixtures): relevant record selected for a representative brief; expression and limits delivered with no retired wording; composition compiles; built tops respect the hierarchy; one roof element per declared span; facade bays present; entrance porch roofed; physical evidence clean; access reachable; roof resize leaves a valid scene (components stay editable); rendered element IDs, positions and yaw match the compiled scene in all 20 browser captures, 0 page errors, `/api` blocked.
Selection: 5 of 5 strategy briefs receive their strategy exactly once; 2 of 2 non-strategy briefs receive none; a compact brief is not offered the estate strategy.
**Full suite: 3,772 passed, 3 skipped, 0 failed** (3,733 before). `tsc`: no errors in `src/` (the same 12 pre-existing errors in `scripts/`/`docs/`). ESLint clean on changed code. Running the existing suite rewrites two tracked docs JSON files (`canonical-schema-compatibility/*.mock-response.json`); I restored them.

## 7. Concept-to-construction fidelity
Three layers, kept apart. **Enforced at compile time (already existed):** tier order measured in built heights, a volume's roof covers that volume, entrance door → roofed porch that is the arrival space; a violation rejects the plan. **Measured, never gating, no score (new, `fidelity.ts`):** per volume, interior area, share, built top, centre offset, roof elements and forms, overhang, openings by type; entrance porch size, roofing, door vs room height, owning volume; and four claims found in the thesis and wing roles (central, court, shade, entrance), each paired with its measurement. **Not measurable:** proportion, silhouette, material richness, whether an entrance reads as dramatic, facade depth beyond eaves/porch/placement, landscape character.

Your example, as a fixture ("dominant central living pavilion, two subordinate accommodation wings, a dramatic entrance and deep shaded facades"): pavilion 240 m² of 480, top 6.2 m against 3.8 m for each 120 m² wing, centre offset 0, one gable roof per wing, hip with 1 m overhang over the pavilion, 12×4 m roofed porch on the primary volume with a 3.8 m door in a 6 m room; all three claims supported. The same rooms with the composition removed report "No composition is declared": the thesis becomes unverifiable prose and the entrance claim has nothing behind it. A thesis claiming a "central" pavilion on the courtyard fixture is flagged (primary at 0.39 of the way to the corner, threshold 0.35). Fixtures that betray their claim are rejected, not built (declared 3 m step against a 2.4 m built step; an open court against an `enclose` constraint; equal day/night heights).
**Heuristic thresholds** (0.35 centre offset, 50% enclosure, overhang ≥ 0.5 m) are stated in the code and in each observation; they report, they do not decide.
**What numbers miss:** in the waterfront arrival capture the 6 m pavilion barely reads as dominant over the 3.6 m wings; measured height difference is real but visual hierarchy is weaker than the numbers suggest. That is exactly the judgement a person must make.

## 8. Still unsupported
Roofs over L/U unions or mixed-height rooms; valleys; recessed or projecting facade planes; glazed doors (they render as solid leaves); columns, arcades, arches; planting; grading or a sloping site (hillside is a stepped section on flat ground); a pitched roof over a room partly under an upper room. Concept claims beyond four phrases are not parsed. The composition field is **optional**: a plan that omits it compiles, and the concept stays unverifiable prose. Not changed here (it is a contract change).
Noted, untouched: `infinity-pool` is still retrieved for a brief asking only a rectangular pool; legacy planting recipes remain; fidelity is not wired into Generate.

## 9. What still stands between AI Architect and extraordinary homes
1. **The process, not the library.** Terra authors the whole plan in one pass from advisory prose in a bounded context, then software accepts or rejects. Nothing iterates on the concept (strategy → declaration → measured fidelity → targeted revision) before the plan is final, and an omitted `composition` costs nothing.
2. **The expressive ceiling.** Even a perfectly declared composition renders as a clean massing study: no facade depth, glazed doors, planting or grading. Better decisions will show up weakly until those exist.
3. **Unproven model compliance.** Whether Terra uses a strategy, declares a composition and expresses it faithfully has not been tested; this work improved the inputs and the measurement, not the model.
I would not add more records: each additional instruction competes with the contract paragraph and the strategy for attention, and 5 strategies plus one reserved slot is already a larger concept-to-plan signal than the previous nine fragments.

## 10. Single most valuable next step
One approved, controlled live generation of the frozen mansion brief against this request, evaluated only by `conceptFidelity` and unchanged renders: does Terra declare a composition, pick the waterfront strategy, and does the built house evidence its own thesis? If it omits `composition`, the data justifies making it required for estate-scale briefs; if it declares it but fails the fidelity claims, the next fix is a bounded revision step, not more knowledge.

Reproduce: `npx vite-node --config vitest.config.mts scripts/knowledge-audit.ts`, `…scripts/canonical-strategies-build.ts`, `npx vitest run src/lib/villa/canonical/strategies.test.ts`, then with the local dev server on 3015 `node scripts/canonical-strategies-capture.mjs`.
