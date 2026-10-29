# Terra visual intelligence and architectural learning

Implemented as extensions to the existing direct-scene reviewer, operation executor, reviewed-design records and architectural knowledge brain. No new agent, construction engine, knowledge database, migration, commit or deployment. **Zero OpenAI calls.** Existing keys/configuration were not read or changed. No retained original, project, response or real approved knowledge was overwritten.

## Actual constructed scene → review

`SceneReview` renders the active `ArchitecturalScene` through the existing `ReviewPreview` / `OperationScene`, captures nonblank 640 × 360 PNGs and supplies four views: aerial, arrival, poolside and main facade. Poolside framing now uses the actual rendered water element's world position, including parent transforms. Camera direction remains a heuristic; it is not a visibility guarantee.

The existing `/api/ai/villa/visual-review` endpoint receives those images, original/supplied brief, editable scene, intended architectural plan, selected knowledge evidence, deterministic geometry and architectural warnings, and relevant knowledge from `architecturalRequestContext`. The prompt explicitly distinguishes intended decisions from constructed elements and optional concept references. Legacy three-view reviews still work.

The direct-scene review contract addresses composition, proportions, style, property ambition, entrance, roof hierarchy, facade depth/rhythm, outdoor relationships and completeness. It asks for visible evidence and stable IDs, permits no-change conclusions, and rejects element counts as a quality measure. These are implemented review instructions, **not evidence that a model has successfully exercised this judgment**.

## Review → editable correction → comparison

A review proposes one correction with up to 12 `element:<id>` references and a Refine or Redesign intent. The existing `/api/ai/scene` request constructs the transaction. `stageSceneReviewEdit` replays it through `resolveSceneResult` and the existing operation/geometry validators. Refine can change existing geometry; Redesign can coordinate scoped replacements, removals and explicitly declared new IDs. Out-of-scope operations, terrain changes, unscoped affected descendants and no-change transactions are blocked. Necessary dependent IDs must fit the same explicit scope.

The UI preserves the original, renders the candidate with the same before cameras, reports changed IDs and warning differences, and requires human approval or rejection. Acceptance uses the existing version/Undo mechanism. It never loops back into another review. Existing baseline/brief/reference checks prevent stale proposals from being applied.

One unchecked-by-default authorization grants one paid review and at most one revision. No retries, scheduled learning calls or normal-Generate visual calls were added. The revision endpoint retains its existing 30,000 output-token bound; review is bounded to 1,800 output tokens.

## Reusable lesson and approval

Existing immutable reviewed-design records retain both scenes, comparable images/cameras, feedback, verdict and mock/Terra provenance. Direct-scene records additionally retain executable operations, scoped IDs, weaknesses, proposed correction and edit intent. Saving verifies that those operations reproduce the revised elements and terrain.

An optional human-written transferable lesson contains title, applicable context, original problem, root cause if established, correction, rationale, exceptions, confidence and retrieval tags. The full source record contains the before/after evidence and operations; derived evidence labels distinguish geometric warning reduction, human comparison and unverified architectural success. This task does not invent automatic model-derived generalizations.

A transferable lesson becomes an **experience with status `proposed` in the existing architectural library**, referencing the immutable reviewed-design record. Human acceptance of one revision does not approve a general principle. Mock corrections cannot propose knowledge. Direct-scene correction summaries cannot bypass knowledge approval through legacy lesson retrieval.

Authorized reviewers use the existing architectural-knowledge admin workflow (`/api/admin/library/architecture`) to examine evidence and update the same record using `expectedVersion`, approval review and verified provenance. Rejections remain explicitly labelled failures rather than successful examples. Stable normalized-title IDs detect repeated proposals. Conflicting/repeated submissions retain their full evidence and return `needs-consolidation`; they never replace an existing approval. Reviewers consolidate or supersede entries through the existing revision workflow. Different wording of the same lesson and semantic contradictions still require human review; this is not an automatic semantic deduplicator.

Normal Generate already calls `architecturalRequestContext` → `generationKnowledge`. Approved relevant experiences enter that exact retrieval path, with existing relevance, context, diversity, token budgets, supersession and provenance. Proposed/retired/superseded lessons stay out. This supplies transferable guidance rather than copying a previous scene. Retrieval is not model retraining.

## Offline demonstration and architectural measurements

`browser-evidence.json` records actual browser transport and comparison. Every provider route was fulfilled locally with deterministic fixtures; external requests were blocked. The workflow captured **16 real renderer images across two retained houses**, while making **zero provider calls and zero real lesson writes**. Their source SHA-256 hashes remain unchanged. `*-request-evidence.json` labels the feedback as simulated. Gallery images come from rendered geometry, not image generation.

| Retained case | Architectural circumstances | Correction and measured result | What remains unproven |
| --- | --- | --- | --- |
| $25m contemporary waterfront redesign | Dominant high main roof, upper private enclosures, lower secondary roofs | Existing retained diagnostic transaction moves three door panels into their actual wall openings. Nine door-fit/sill/centre audit warnings disappear; no relationship warnings are introduced. | Main roof and overall composition are unchanged. Upper circulation, pool and other construction limitations remain. No demonstrated stylistic or luxury-quality gain. |
| $10m Caribbean beach house | Single-storey broad residence, subordinate hip-roof wing, shaded terrace and detached pavilion | Developer-authored resize/move of `pool-terrace` removes its water-plane intersection. One geometric obstruction is resolved; no relationship warnings are introduced; other elements are unchanged. | Removed slab area was not replaced with a designed accessible route or pool-surround composition. No demonstrated improvement in residential ambition, enclosure completeness or distinctiveness. |

The $10m terrace changes from 18 × 8 m at Z=-9 to 18 × 4.5 m at Z=-7.25; its south edge moves from -13 to -9.5, clear of the pool's water footprint starting at Z=-10. Its area decreases from 144 to 81 m². This deliberately bounded diagnostic proves collision correction, **not a finished architectural redesign**.

These are architecturally different retained compositions; exact historical briefs are incompletely retained/redacted. Diagnostic brief descriptions are explicitly labelled, and exact brief resemblance cannot be scored. `evidence.json` also inventories compact-modern and Mediterranean developer-authored studies as contrasting construction evidence. They are not represented as independent Terra successes or automatically promoted.

A temporary-store integration test writes and reopens a proposed lesson through the real existing storage functions, verifies exclusion from normal Generate, simulates authorized approval in that temporary store, and verifies normal request assembly retrieves it. It then checks duplicate/conflicting submission retention, optimistic concurrency and approved supersession. Temporary files are removed. **No simulated approval was written into the real knowledge brain.**

Additional tests exercise supported roof resizing and coordinated Redesign replacement/addition. Those tests prove editable capability, not successful visual architectural judgment.

Verification: 36 tests across seven focused suites passed, including the existing scene-knowledge boundary and retained door-repair audits. TypeScript checking passed. Changed implementation files pass ESLint. Scripts: `scripts/visual-learning-capture.mjs` and `scripts/visual-learning-evidence.ts`. The capture script currently uses the locally available Playwright installation and Chrome path; adjust those paths on another machine.

## Cost and controlled live experiment

Implementation and offline verification cost: **$0 provider usage**. The application reports actual model usage and configured token costs after each explicit call.

Illustrative planning budget for one review plus revision: 20k–50k total input tokens (reserve roughly 2k–8k of that for four images; model-dependent and not measured here) and 2k–10k total output tokens. At the repository's configured Terra rates of $2/M input and $12/M output, that is approximately **$0.064–$0.22** before any pricing override. A long revision near the 30k output cap plus a full review can approach **$0.48** with 50k input tokens. Budget about **$0.10–$0.50** for an initial experiment. These are local configuration estimates, not a verified current provider quote or an enforceable dollar ceiling. Optional reference images and larger scenes increase input usage; image billing cannot be precisely predicted from PNG bytes. The review uses four scene images; a supplied concept adds another image, and the revision receives that reference if present. Rendering/comparison/learning persistence add no provider calls.

One separately authorized controlled live experiment is justified as an evaluation of this connection, not as a claim that architectural learning already works. Prefer a visible, precisely scoped roof/entrance/composition issue, preserve all versions, inspect all four views, and reject collateral degradation. Do not enable automatic review. No live experiment was run or authorized by this implementation task.

Past geometric mistakes can now be linked to evidence and reusable approved guidance can reach later first-pass prompts. **Whether Terra follows those lessons, improves first-pass architecture, or reduces repeat paid redesigns remains unmeasured.** That requires real reviewed outcomes and subsequent controlled generations; offline mocks cannot establish it.
