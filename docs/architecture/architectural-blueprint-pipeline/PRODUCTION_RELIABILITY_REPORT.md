# Blueprint-to-3D production reliability gate

20 October 2026, America/St_Lucia. This is the current reliability audit of the default-off independent blueprint branch. It extends [FULL_PROPERTY_REPORT.md](FULL_PROPERTY_REPORT.md) and [CONTRACT.md](CONTRACT.md). The supplied task ended partway through Phase 3; this report covers the production, preflight and construction-fidelity requirements that were supplied.

No live provider requests, paid experiments, flag/environment changes, saved-user-project writes, commits, pushes or deployments were performed. Provider tests use an offline SDK model; persistence tests use in-memory storage. Existing unrelated working-tree changes and captured response/blueprint fixtures were retained.

## Production request trace

1. `requestHouseEdit` resolves the persisted V3 project mode, captures its revision and sends a new-generation request to `POST /api/ai/house`. A concurrent project edit prevents a later commit.
2. `POST` checks project/root routing and terrain mode. Only `mode=generate`, V3, flat terrain and server flag `AI_V3_ARCHITECTURAL_BLUEPRINT=1` enter `generateArchitecturalBlueprintV3`. This branch wins over `AI_V3_BLUEPRINT_FIRST`. Advanced terrain, edits and legacy loading keep their existing paths.
3. The branch sends `v3ArchitecturalBlueprintPrompt()` and `Output.json({name:'v3_architectural_blueprint'})`, with a 10,000-token output cap. The prompt transmits **only** `v3ArchitecturalBlueprintSchema`; it has no scene `objects` or `v3Scene` field and rejects unknown top-level fields. The model is never asked for an independently authored detailed scene.
4. The AI SDK parses provider JSON text. Local strict Zod parsing and preflight validate the independent input. Abnormal provider termination is checked before reading the SDK's lazy output getter. Truncation, filtering, tool-call termination, provider errors and invalid output return no scene.
5. Planning lowers the single design into private semantic projections and runs plan-only identity, capability, spatial, interior and compiler-policy checks. No full-scene compilation occurs before approval. Approval captures an immutable snapshot in a process-local WeakMap; serialized/forged handles cannot construct.
6. Construction uses production ingestion, blueprint preservation, scene validation, design consistency, physical access/stair checks and the existing V3 compiler. The new component fidelity audit checks the **actual final returned model**, including its complete component receipts and real line/arc ground-slab boundary.
7. A recognized omitted brief feature is a failure, not another creative authoring opportunity. This finite-vocabulary review is not proof of general natural-language compliance.
8. Only a successful scene becomes ordinary `{version:3,generationMode:'v3-scene',v3Scene}` JSON. The client calls `apply` only for a successful response with JSON and an unchanged live revision. Every blueprint rejection phase leaves the project and its versions unchanged and creates no failed preview.

The one existing objective correction remains limited to diagnosed stair reservation/type/direction/turn or route waypoints. Protected identities, hosts, levels, endpoints, widths, materials, requirements and other design decisions are compared locally. The corrected candidate repeats the complete gate. There is no third call, elaboration call, aesthetic revision or detailed-scene fallback. SDK transport retries are now explicitly disabled (`maxRetries:0`), preventing hidden requests after a retryable/ambiguous transport failure. Usage logging retains initial/repair stage and retry attribution; successful scene metadata sums both attempts.

## Safe activation diagnostics

`GET /api/ai/house` reads flag state without accessing a model, project, prompt or credential. It returns only:

```json
{"architecturalBlueprint":{"enabledForNewFlatGenerations":false,"contract":"v3-architectural-blueprint-1","maxAuthoringAttempts":2,"maxOutputTokens":10000}}
```

The response has `Cache-Control: no-store`. `false` is the normal default; only exact flag value `1` selects the branch for a new flat generation. The actual selected branch also attaches `x-ai-architect-pipeline: v3-architectural-blueprint-1` on successful and failed generation responses. The existing `x-ai-architect-resolved-mode: v3-scene` remains. No environment/key/model configuration is exposed. Reading diagnostics does not activate generation.

## Preflight coverage and changes

| Decision area | Objective checks before construction |
| --- | --- |
| Identity and references | Existing unique object/storey/room/material/estate/assembly identities and references; new site-access versus semantic-ID collisions, dangling/self room adjacencies |
| Site and placement | Existing fixed site bounds, true footprints, reserved/derived zones, clear spaces and canonical route corridors |
| Building/storey intent | Existing program and ground-entrance decisions, compatible roof ownership, uniform storeys, real footprint containment and major spaces |
| Vertical circulation | Existing declared type/direction/turn/host/served levels and reservation/approach feasibility; detailed physical passage still checked after construction |
| Facade openings | New rejection of reversed/zero spans, missing segment addresses, segment addresses on rectangular hosts, absent upper storeys, height/sill clipping, overlapping bands and facade roles that would invent unchosen windows |
| Interior openings | Existing room-boundary and partition references; new rejection of overlapping door cutouts, dropped/narrowed/clamped cutouts and doors on unconstructed open/exterior-wall partitions |
| Roofs and unsupported forms | Existing explicit roof-family/host/pitch compatibility and no box/flat replacement; new explicit refusal of `archway` cutouts because the current partition builder makes rectangular gaps |
| Outdoor/landscape/access | Existing supported feature mapping, explicit canopy style, physical routes/contacts, pool crossings and dry-surface access; component receipts now verify actual output |
| Materials and intent | Existing material resolution, construction-policy conflicts, authored requirement measurements and protected semantic data; receipts now also compare emitted finishes |

Interior `doors` describe rectangular wall cutouts under the established builder policy. They do not build leaves, locks or hardware. Exterior doors must be actual facade openings. The authoring instructions now state this explicitly. Unsupported arches fail instead of appearing as rectangular substitutes.

These are contradictions or construction capability limits. No amenity count, mansion template, style, private-room count or arbitrary proportion was added. Style, budget, privacy and view statements remain unverified intent unless an existing measurable contract applies. A functional room label still does not invent walls, furnishing or equipment.

## Construction fidelity

Previously, an object emitting any primitive could satisfy object-presence acceptance even if a different required component was missing. Entrance and facade-assembly checks were stronger, but windows, wall pieces, floor slabs and amenity subparts were not exhaustively compared.

[`architecturalConstructionFidelity.ts`](../../../src/lib/v3/architecturalConstructionFidelity.ts) now derives temporary receipts directly from the established supported component builders, bypassing scene dispatch/generic fallback. It applies the same junction, roof-terrace and circulation finishing policies, then compares every required component with the final model by stable identity, ownership, geometry and finish. This includes walls, all slabs, glazing/door leaves on facades, roof parts, assembly parts/guards, pool basin/shell/water/coping, canopy slats/headers/posts, dry decks, courtyard rings, groundcover and interior wall/header components. Canonical route geometry retains its independent ribbon check. Duplicate primitive identities, unexpected blueprint-owned parts and generic fallback also fail. Failures return neither scene nor model.

An additional check compares the approved line/arc ground-slab boundary directly with world-space mesh vertices. A builder and scene dispatcher agreeing on a rectangular fallback cannot certify a curved outline. Fault injection proves this check catches that case even when the component receipt itself has the same faulty box. Existing outline/articulation, roof, movement, rotation, material, editing and reload tests still pass.

The audit is read-only, creates no persisted sidecar, introduces no mesh engine and makes no new design decision. It adds local builder/geometry work during acceptance. It deliberately scopes strict receipts to blueprint-owned architecture so unrelated ordinary editor additions survive a replan. Legacy scene loading/editing is not migrated into this gate.

**Limit:** receipts share the production component builders. They detect dropped/misdispatched/moved/substituted components and final orchestration drift; they cannot independently prove every builder's architectural correctness. The independent outline/route and physical stair checks reduce specific shared blind spots. This is not structural engineering, complete navigation/egress/privacy proof or a certificate of human-level design quality.

## Offline evidence

- [`route.architecturalBlueprint.test.ts`](../../../src/app/api/ai/house/__tests__/route.architecturalBlueprint.test.ts) keeps the real AI SDK and actual route. An offline `MockLanguageModelV3` returns provider JSON **text**, exercising SDK parsing rather than injecting an already-parsed `generateText.output`. Network access is forbidden by the test. It inspects the actual model-call schema/prompt, covers four distinct forms, one bounded repair, failed repair/redesign, wrong/double contracts, missing construction, abnormal termination, malformed/non-object output, retryable transport failure and safe diagnostics.
- [`architecturalBlueprintReliability.test.ts`](../../../src/lib/v3/__tests__/architecturalBlueprintReliability.test.ts) proves early rejection without compilation and fault-injects missing upper slabs, walls, glass, pool parts, pergola members, partitions and guards. It also tests geometry/finish/ownership changes, duplicate/unexpected parts, curved-to-box substitution and preservation of unrelated editor additions.
- [`clientV3Routing.test.ts`](../../../src/lib/ai/__tests__/clientV3Routing.test.ts) verifies that every rejected blueprint phase leaves the project/versions unchanged and never calls `apply` or creates a failed preview.
- Existing route, persistence, compatibility, distinct-form and captured-failure regressions remain in the full suite. No synthetic fixture is presented as a successful natural-model generation.

Final commands and results are recorded in [PRODUCTION_RELIABILITY_CHECKS.json](PRODUCTION_RELIABILITY_CHECKS.json).

Final verification: **2,259 tests passed, 3 skipped; 181 files passed and 2 skipped.** This adds 67 tests to the previous 2,192-test milestone. TypeScript, repository-wide ESLint with zero warnings, `git diff --check` and new-source whitespace checks passed. The final full-suite run was made against the finished source tree. The checks artifact records source hashes for the gate and its regression tests.

## Decision

GO for the tested offline contract and its stronger fail-closed production branch. Keep the feature disabled by default. No additional paid experiment is authorised by this work, and broad activation or a claim of reliable arbitrary dream-house generation remains NO-GO. Natural-model omission rates, brief/room/service/privacy coverage, output-budget adequacy and human architectural quality remain unmeasured. Any later controlled provider evaluation needs separate authorisation and review of untouched responses against the original brief.
