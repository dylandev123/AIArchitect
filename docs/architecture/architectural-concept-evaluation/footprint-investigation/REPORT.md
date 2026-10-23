# FOOTPRINT_INVALID investigation — 22 October 2026

**Status: diagnostic defects fixed; the original geometry failure remains unproven.** The failed `main-estate` response was not retained. The user confirmed no original JSON is available. One live reproduction using the exact supplied brief returned HTTP 200 with a different building, `main-residence`. No further Terra calls were made. This successful response must not be presented as the lost failing geometry or proof that the original failure is fixed.

1. **Root cause and trace**

   The original error originates in `src/lib/v3/footprintDiagnostics.ts:15`: every undefined result from `resolveFootprint` becomes the same generic message. That message's “rectangular construction fallback used” clause describes shared compiler behavior, but is misleading in this evaluator: `src/lib/v3/architecturalConcept.ts:92` preflights and returns failure before accepting any preview. Actual legacy fallback is in `src/lib/v3/footprintConstruction.ts:71` and `src/lib/v3/scene.ts:207`.

   Before this work, the concept API retained only `outputFingerprint` and comma-separated finding codes in its usage record. It neither retained the failed authoring JSON nor returned it. This prevented attribution of the original failure to authored geometry, coordinate conversion, dimensions, validation or unsupported geometry. No evidence justifies choosing one of those causes.

   The complete observed path is:

   | Stage | Implementation | Observed reproduction |
   | --- | --- | --- |
   | Provider JSON parsing | `src/app/api/ai/concept/route.ts:36` | Existing `Output.json`, then `result.output`; unchanged one-call policy. Raw text now captured even on SDK `NoObjectGeneratedError`. |
   | Authoring schema and V3 conversion | `src/lib/v3/architecturalConcept.ts:56` | Building footprint copied directly into `composition.footprint`; no generated operations are removed or rewritten. |
   | Dimensions and position | `src/lib/v3/architecture.ts:38` | `[width,height,depth]`; centre Y is base elevation plus height/2; degrees converted to yaw radians in concept conversion. |
   | Footprint resolution | `src/lib/v3/footprint.ts:28` | Runtime schema, operation IDs, projection frame, interval direction, generated boundary warnings, boundary simplicity, placement-envelope containment, outline wall clearance. There is no production scene normalization in this evaluator. |
   | Compilation/fallback gate | `src/lib/v3/architecturalConcept.ts:92` | Footprint diagnostics run before accepting compilation; an invalid footprint returns no scene. |
   | Remaining concept validation | `src/lib/v3/architecturalConcept.ts:99` | Rotated site bounds, outdoor overlap, mass conflicts/junctions, compiled geometry, roof presence and eaves/site bounds. |

   `resolveFootprint` now optionally reports the exact existing rejection branch and its candidate polygon. Its validation conditions and return behavior are unchanged. The evaluator uses this evidence instead of the generic fallback message.

2. **Specific geometry**

   Original failed `main-estate`: **unknown**, including operations and envelope. The only supported inference from the old message is that the articulated/non-outline branch failed at least one floor's runtime footprint resolution.

   Retained reproduction: `main-residence`, width 46m, depth 32m, heights `[4.2,4]`, base 0.3m, world X/Z `[0,0]`, yaw 0. Runtime dimensions `[46,8.2,32]`; centre `[0,4.4,0]`. Articulated geometry:

   ```json
   {"kind":"articulated","operations":[{"id":"sea-court-recess","floors":"all","type":"recess","facade":"north","start":0.17,"end":0.83,"depth":14}]}
   ```

   Both floors resolve to this clockwise local X/Z polygon (metres):

   ```text
   (-23,-16), (-15.18,-16), (-15.18,-2), (15.18,-2),
   (15.18,-16), (23,-16), (23,16), (-23,16)
   ```

   Calculated bounds `[-23,-16]..[23,16]` exactly match the declared centred envelope. No projection reserve or frame offset is involved. +X is east; +Z south; north is -Z. Facade intervals run west-to-east for north/south, north-to-south for east/west. No scaling, recentering, dimension derivation, deterministic repair or geometry substitution was necessary. The complete response also has two rectangular detached pavilions and four outdoor spaces.

   Original response SHA-256: `1240df546218051f3464c8b1ba8ac6b4795a09d62cd5a3814d0422da49619d50`. The fixture preserves its bytes. Private local original evidence is under `.v3-debug/concept-evaluations/`. Full per-floor trace is in [replay.json](replay.json).

3. **Why earlier tests passed**

   Earlier coverage used valid hand-authored courtyard/L/pavilion/connected/modest fixtures plus a successful modest writer-house live response. It did not retain or exercise this lost estate response. Passing those tests shows supported examples compile, but cannot establish why a different unknown geometry failed. The new exact-response test covers the successful reproduction; invalid-operation, envelope and self-intersection tests are explicitly synthetic. An exact regression for the original failure is impossible without its response.

4. **Changes made**

   | File | Change |
   | --- | --- |
   | `src/app/api/ai/concept/route.ts` | Capture raw output before local validation and from SDK parse errors; retain validation trace; return evidence on rejection; expose debug-only persistence truthfully. |
   | `src/lib/ai/conceptResponseArtifact.ts` | Immutable hash-addressed raw response/context/validation files; existing secret-redaction/hash utility; safe fallback on read-only hosts. |
   | `src/lib/v3/footprint.ts` | Optional diagnostic callback reports existing rejection branch and candidate polygon without changing acceptance. |
   | `src/lib/v3/conceptFootprintTrace.ts` | Read-only authored geometry, coordinate convention, architecture/runtime arrays, declared envelope, frame and per-floor polygon/bounds/failure evidence. |
   | `src/lib/v3/architecturalConcept.ts` | Include footprint trace; replace the misleading generic concept finding with the resolver's actual branch. |
   | `src/app/api/ai/concept/route.test.ts` | Evidence retention on rejected geometry, incomplete output and SDK parsing errors; no retry. |
   | `src/lib/ai/__tests__/conceptResponseArtifact.test.ts` | Exact raw bytes, immutable earlier artifacts and read-only-host behavior. |
   | `src/lib/v3/__tests__/conceptFootprintTrace.test.ts` | Exact captured reproduction, L/U/H preservation, overlap, self-intersection and envelope diagnosis. |
   | `src/lib/v3/__tests__/fixtures/concept-estate-reproduction-2026-10-22.json` | Exact raw live reproduction, explicitly not the original failed estate. |
   | `scripts/architectural-concept-footprint-evidence.ts` | Offline replay/compile audit and render response generation. |
   | This report, `checks.json`, `generation.json`, `replay.json`, `render-response.json` | Investigation, original live metadata, diagnostics and reproducible evidence. |

   Terra's schema/prompt, geometry contract, production fallback behavior and 2D pipeline were not changed. No new AI fallback was introduced. Extensive pre-existing workspace changes were left intact. Nothing was committed or deployed.

5. **Regression results**

   - Focused geometry run: 59 passed (21 existing concept, 7 new footprint investigation, 19 existing nonrectangular, 12 existing curved).
   - Final focused API/evidence run: 11 passed (9 route, 2 artifact). The malformed JSON case initially exposed an SDK-level evidence loss, which was corrected and rerun successfully.
   - Existing integration regression run: 247 passed across 16 files, including 2D plan endpoints, planning, room development, saved project persistence, production V3/blueprint endpoints, footprint geometry/baselines and junctions.
   - **298 distinct test cases passed** after subtracting the 19 nonrectangular tests present in both runs.
   - TypeScript `npx tsc --noEmit`: passed. ESLint on changed source/test/script files: passed.
   - The existing 2D integration suites require `window.localStorage` under node Vitest. A temporary in-memory browser-storage setup under `/private/tmp` supplied it; no production storage file or existing test configuration was changed.
   - Offline reproduction replay: 60 primitives, 12 roof primitives, zero compiled geometry errors/warnings. L/U/H boundaries remain intact. A positive-area closed self-intersecting outline is still rejected. Overlapping facade operations still reject before a preview can be accepted.

6. **Live generation/render status**

   Exactly one live Terra request to the supplied brief succeeded: model `gpt-5.6-terra`, 2,045 input tokens, 2,676 output tokens, HTTP 200, no findings. Original live metadata is in [generation.json](generation.json).

   After the diagnostic changes, the same retained response was replayed through the actual evaluator UI in Safari using a temporary localhost proxy that served the captured response for concept POSTs. The WebGL view visibly rendered the U-shaped two-storey house, open court, shaped flat roof and detached pavilions. This render made **zero additional provider calls**. It verifies successful rendering of a real Terra response after the changes; it does **not** verify correction of the lost `main-estate` failure.

   The remaining task is to replay a captured failing response, determine its actual branch and only then make the smallest justified geometry/contract change. Future failures now retain the evidence required for that step without regeneration.
