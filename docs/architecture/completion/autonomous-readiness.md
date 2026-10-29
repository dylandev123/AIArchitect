# Autonomous architectural completion readiness

Prepared offline on 2026-10-28. No OpenAI calls, new engines, migrations, commits or deployment.

Complete Architecture now uses explicit `editIntent: complete`. The request preparer carries the entire selected scene (elements, parent transforms, openings, existing plan and knowledge evidence) and all current audit findings. Findings are not truncated. The original and repaired retained $25m redesign remain separate, unchanged files. Ready-to-submit request artifacts are `retained.completion.request.json` and `repaired.completion.request.json`; use the repaired request for the controlled test through the existing request lifecycle.

Terra is authorized to choose ordinary stair runs, landings, corridors, openings, room connections, rectangular pool construction and entrance/facade development. It must preserve the architectural identity, important rooms, intentional voids, terrain and unrelated geometry. Only consequential choices that cannot reasonably be inferred should require input. The functional order is occupied-level access, disconnected circulation, blocked room connections, misaligned openings, selected incomplete structures, then facades/details.

Assumptions must appear explicitly in `architecturalPlan.arrivalAndCirculation`, with reasons and constructed element IDs; facade assumptions go in `roofFacadeAndMaterials`. The updated plan is saved with the resulting scene. Unsupported capabilities, consequential unresolved choices and unverified geometry belong in `unsupported`. This is an instruction contract; assumptions are not independently semantically certified by the schema.

Complete Architecture uses the strict provider adapter and requires an architectural plan and 1–800 operations. Runtime checks reject concept-only, missing/empty operations, finish-only/terrain-only and unchanged transactions. Existing atomic geometry/attachment/support validation still runs. Failed construction preserves the input; valid recoverable drafts remain separate. Audit findings remain visible even when geometry is technically valid; accepting operations does not certify complete circulation.

The repaired candidate has zero confirmed technical defects. It still has missing access to owner/guest upper floors, disconnected upper slabs, blocked kitchen–salon and kitchen–dining boundaries, and incomplete pool evidence. These are the live completion targets. The unrepaired redesign retains six confirmed technical findings. Offline preparation does not claim that either design is architecturally complete.

Supported stairs are manually composed rectangular plates/solids and landings; there is no automatic stair builder. Pools support rectangular water, basin walls/bottom and coping assembled from existing primitives. Arbitrary curved/polygonal or CSG pool shells, automatic excavation, hydraulic infinity edges and pool equipment remain unsupported. Headroom, navigability, structural engineering and code compliance are not certified by current validators.

Validation: completion/context tests cover both retained scenes with fetch forbidden; actual SDK transport tests use a mocked provider boundary to check strict schema and safe failure. Existing redesign tests verify separate versions, persistence/reload and undo/redo. The offline audit replays the original repair operations and checks source byte preservation. Targeted lint and TypeScript checks also run.

Readiness: the repaired candidate is ready as input for one controlled live completion test, saved as a separate unapproved candidate. The live result must still be reviewed for functional improvement, honest limitations and geometric validity. No live test was performed during preparation.
