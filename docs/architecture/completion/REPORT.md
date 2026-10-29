# Architectural completion — offline implementation and review

No OpenAI/provider calls, migrations, commits or deployment. Existing unrelated working-tree changes were retained. This work changes only direct-scene completion instructions/auditing and adds offline preparation/evidence.

## Root causes

- The direct-scene schema permits independent renderable parts; passing schema, attachment and support checks proves neither enclosure nor usable circulation. A supported upper slab can still be inaccessible.
- Knowledge already describes vertical circulation, headroom, landings, room relationships, entrance thresholds and complete pools. Retrieval and prose are not a construction obligation or a route solver. Required-kind checks cannot prove that parts connect.
- Prior construction passes emphasized volumes/enclosure/roofs without an explicit stair-before-enclosure responsibility. Automatic stairs/interiors are unsupported, but manually composed treads are possible; that distinction needed emphasis.
- The former vertical audit compared sorted elevations only. Spatially unrelated intermediate plates could suppress the warning. Conversely, ramps/lifts cannot be verified by that inventory.
- Openings use wall-local centre coordinates, whereas sill is measured from wall bottom. Three retained door panels confused these coordinates. Doors do not cut walls; glazed openings do not create passage.
- No room/route semantics, floor void cutting, headroom solver or end-to-end functional acceptance exists. Blank facades and attractive renderings need architectural judgement, not universal validity rules.

## Capabilities versus gaps

| Requirement | Existing capability | Remaining limit |
|---|---|---|
| Room connections and arrival | Unglazed wall openings, entrance panels, threshold plates, add/replace/move/attach | No door swing, clear-route or room topology solver; alternative access requires review |
| Stairs and landings | Individually editable plate/volume treads, landings, supported slabs and guards | No parametric stair/ramp/lift builder, automatic headroom/egress check or automatic floor cuts; split slabs around voids manually |
| Upper continuity | Plates at arbitrary datums, bridges, split levels, parent transforms | No route solver; geometric contact does not establish traversability |
| Facades and glazing | Single opening per wall; split segments for multiple windows; integrated glass, separate fitted panels, screens, piers and reveals | No arbitrary CSG or curved facade solids; blank-wall quality is subjective |
| Roofs and exterior | Flat/gable/hip roofs, supported terraces/loggias, pergola members | No general curved roof or engineering/weatherproofing verification |
| Pools | Rectangular water, basin plates/walls, coping, dry access and stepped solids | No arbitrary basin mesh, hydraulics, equipment or certified infinity-edge behaviour |
| Selected features | Existing knowledge dispositions, stable IDs, required-kind and locality evidence | Necessary evidence only; does not certify completeness |

No new geometry primitive, generation engine, schema migration or mandatory house template was added.

## Minimal implementation

`planning.ts` now makes the seven-step construction checklist canonical within one response, explicitly requiring access to occupied upper levels and preserving intentional voids. Repeated construction guidance in `terra.ts` refers to that checklist; the existing prompt stays below its 20,000-character regression budget.

`completion.ts` adds advisory spatial evidence checks:

- Plate/solid top-contact graph from the lowest explicitly named room floors, including parent rotation/translation; disconnected upper room floors warn about absent vertical-route evidence.
- Separate upper same-level surface groups warn about possible corridor/landing gaps.
- Full shared rectangular boundaries between explicitly identifiable public/service floors warn when a wall/glazing blocks direct passage. Private-room partitions are excluded. Partial/rotated-pair ambiguity is skipped. Unglazed openings at a low sill with adequate approximate width/height suppress this warning; this is deliberately a conservative evidence threshold, not a code check.

`reviewSceneArchitecture` retains existing issues/status and adds structured `findings` with category, code, affected IDs and message. Door fit/centre faults are confirmed technical defects. Circulation, pool and selected-feature evidence gaps are likely incompleteness. Explicit representation/certification limitations are unsupported capabilities. The category contract also supports subjective design concerns; the audit does not invent blanket facade/design failures. Six findings in the original describe three door faults, not six faulty doors. Broad legacy status remains `incomplete` when any issue exists; consumers should use findings categories to distinguish limitations from defects.

These checks are not new executor rejection rules. No proof of successful navigability is returned when a route sequence exists. Label-based floor identification misses unnamed/nonstandard room surfaces; ramps, lifts, headroom, wall intersections and alternate routes need review. Same-level gaps are currently reported for inaccessible upper groups, not every possible corridor defect. Wall blocking checks do not solve whole-building connectivity. Existing pool checks sample edges and are necessary evidence only, not watertight construction certification; unusual rotated/infinity geometries may require manual review.

## Offline results

Reproduce: `npx vite-node --config vitest.config.mts scripts/architectural-completion-offline.ts`.

Seven retained scenes are read-only inputs. SHA-256 hashes and findings are in `offline-audit.json`; the runner asserts their bytes remain unchanged.

| Scene | Confirmed technical findings | New circulation evidence | Pool evidence warnings |
|---|---:|---|---:|
| Latest strict Terra redesign | 6, concerning 3 doors | Missing route to owner/guest floors; separate upper groups; kitchen–salon and kitchen–dining blocked boundaries | 1 |
| Separate three-door repaired candidate | 0 | Same unresolved circulation findings | 1 |
| Compact knowledge example | 0 | None | 0 |
| Caribbean knowledge example | 0 | Living–dining and dining–kitchen blocked direct boundaries | 0 |
| Mediterranean knowledge example | 0 | Living–dining/kitchen blocked direct boundary | 0 |
| Family pool example | 0 | Living–dining and dining–kitchen blocked direct boundaries | 0 |
| Spa pool example | 0 | Living–dining and dining–kitchen blocked direct boundaries | 0 |

The stronger examples are not assumed fully functional ground truth. Their sealed public boundaries warrant review, not rejection; possible exterior/alternate routes are not ruled out. Complete basin examples acquire no pool warnings. None acquires a fabricated upper-storey defect or confirmed technical failure. Synthetic valid connected stairs (including a rotated/translated parent), usable shared openings and private-room partitions acquire no circulation findings; a spatially displaced tread does produce a missing-route warning. Existing scene and knowledge tests remain passing.

Validation: 18 test files / 76 tests passed; `npx tsc --noEmit` passed; ESLint passed on the five changed/added TypeScript source/test/script files. Library test stderr contains intentional conflict/duplicate-write rejection cases. No live route was executed.

`door-repair.UNAPPROVED.json` and its operations reproduce only the existing exact three centre corrections. The runner asserts equality with the previously retained repaired candidate. No stairs, corridors, doors or pool layout were guessed. No original, historical artifact, project or approval state was overwritten.

## Focused completion workflow and usage

Technically viable with the current request and executor. `prepareArchitectureCompletion(current)` validates the selected scene and builds an ordinary `mode: edit`, `editIntent: refine` request containing categorized audit evidence and identity-preservation constraints. It neither imports a provider nor submits a request. No new UI button, automatic call, retry loop or new edit engine is enabled.

A future optional Complete Architecture action can call this preparer only after explicit user initiation, use the current request lifecycle/AI endpoint/atomic executor, and retain a separate UNAPPROVED version. It should compare pre/post categorized audits and changed IDs, review ambiguous routes visually, and never equate fewer warnings with functional certification. Refine allows necessary dependent repairs; a substantial identity change belongs in explicit Redesign.

Additional usage now: **zero calls and zero API tokens**. A future controlled completion is **one ordinary edit request**, not seven calls. Planning estimate for this retained scene: roughly **12k–25k input tokens and 5k–15k output tokens**, varying with retrieved knowledge, scene serialization, audit context and authored geometry. Existing endpoint cap is 30,000 output tokens with `maxRetries: 0`; no automatic follow-up pass is required. These are budgeting estimates, not measured usage or a price quote.

One controlled live completion test would be worthwhile after choosing the ambiguous stair/landing and pool intent. Use the retained repaired candidate, require preservation of massing/roof identity and unrelated site geometry, save separately, and inspect actual paths, thresholds, headroom, floor voids, facade development and basin sections. Compare all known issues before/after and retain unsupported disclosures. Such a test is not authorized or executed by this work. Deterministic evidence establishes readiness to test the workflow, not proof that the model will complete the architecture in one pass.
