# Semantic architectural editing

Implemented an application-owned vocabulary, target resolver and preservation gate for ordinary direct-scene Refine and V3 local edits. Existing geometry formats, renderers, V2 authoring, V3 compilation, validation, atomic execution, revision checks, history and usage tracking remain in place. This is a measurable safety improvement, not a claim of universal natural-language or architectural correctness.

## Diagnosis before implementation

The source tree contains complementary models rather than one interchangeable scene:

| Workflow | Authoritative construction | Existing execution / validation |
|---|---|---|
| Legacy feature edits | House feature arrays, stable feature IDs and material zones | `ai/targeting.ts`, room scopes, feature operations |
| V2 architectural generation/editing | `architecture/document.ts`, mass/opening/assembly IDs, optional outdoor placements | Architectural edit context/goals, compiler, critic, preservation and revision checks |
| V3 generation/editing | `v3/scene.ts`, named architecture, compositions, interior/circulation and site hierarchy | `v3/operations.ts`, capability registry, ingestion/acceptance, support/collision/circulation validators and safe revision |
| Normal Generate / direct-scene editor | `villa/scene/model.ts`, editable primitive IDs, assemblies and optional architectural plan | `villa/scene/terra.ts`, relationship/profile/roof/spatial checks, `OperationScene`, project store |

The direct-scene executor was atomic, but ordinary Refine preservation was mostly a provider instruction. V3 local edits supplied a subset to the model and executed its operation plan without an independent final target/field diff. These were the implementation targets. Replacing the existing scene formats would have risked saved work and compiler authority.

Baseline typecheck passed. Baseline full tests: 3,158 passed, five failed, three skipped. Failures were outdated test setup: a V2 fixture created a default direct-scene project; an intelligence test asserted superseded prompt headings; a route mock omitted filesystem reads required by current knowledge retrieval (and used an obsolete SDK output mock). These were corrected without removing geometry or preservation assertions.

## Decisions and behavior

- `semantic/vocabulary.ts` defines 28 semantic types, including all requested architectural, landscape, furnishing, lighting and material concepts. Each has aliases, editable/protected fields, host/connection policy, collision and placement policy, category and target-only preservation. The registry is semantic policy; existing scene schemas and compiler registries retain geometry authority. Unsupported renderer capabilities are never implied by vocabulary membership.
- IDs come from actual scene objects. Optional direct-scene `semanticType` and `aliases` persist without migration or ID changes. Semantic metadata must be compatible with the renderer kind. Existing scenes infer only conservative types from actual kinds, assembly provenance and door labels. An absent or ambiguous target is refused, with candidate IDs; no object ID is invented.
- Direct-scene selection resolves an explicitly selected object. Screen-left/right targeting uses the production camera's world right-vector and the existing scene transform calculation. Without camera evidence it refuses. Assembly parts remain independently addressable; a pool's water and deck parts no longer compete with the pool root for the generic noun.
- The application derives the requested operation and property allowlist before accepting a model transaction. The provider receives the narrow contract, not the full policy registry. Existing provider operations remain authoritative; a strict canonical-name adapter maps `changeMaterial`, `editArchitecture`, move/resize/rotate/create/delete/attach/detach, `editLandscape` and `editOpening` onto the existing executor. Direct-scene connector endpoint operations safely refuse; V3 retains its native endpoint operation.
- Before acceptance, compare every existing object, all scene-level design data, additions/deletions, and inherited world position/yaw. Reject protected fields, wrong targets, unrelated changes and whole-scene metadata/plan replacement. Normal audit/knowledge provenance and response usage tracking retain their existing behavior. No out-of-scope model transaction is offered as a recoverable construction draft.
- New pool construction uses the existing coordinated rectangular-pool assembly. Pool assembly resizing uses its coordinated uniform X/Z scaling, rather than changing one water/deck component and leaving an inconsistent basin. Stair widening must update every tread consistently while preserving positions, rise, run and endpoints.
- New semantic hosts are checked against the registry. Ground objects need ground contact or an appropriate supporting host; existing terrain height is consulted. Conservative box penetration checks supplement the existing validators for solids and landscape/furnishing changes. Ground cover is not treated as a solid obstruction. Roof/wall/glazing/screen geometry continues through the existing constructive/surface-aware validators, rather than treating intentional structural intersections as box collisions.
- V3 uses the same vocabulary/resolver and its original operation parser/executor. Local plans cannot replace estate plans, hierarchy or compositions, touch another object, or use a geometry patch to smuggle unrelated fields. A final whole-scene diff also catches unrelated changes introduced by normalization. Conflicting explicit UI selection and named targets refuse. Existing V3 native/compiler type names are adapted without changing persisted types.
- Direct-scene Redesign and Complete retain their existing explicit architectural authority, safety checks and separate candidate workflow. Existing review proposals retain their explicit element/field scopes and baseline approval flow; those scopes also pass through the new diff gate.
- Window frame finishes and roof color overrides now reach the production renderer. Existing default glazing and roof appearance remain unchanged. Door color already used the existing element color override.

## Verification

Final counts and command results are in [verification.json](verification.json).

Coverage includes all eleven requested cases: front-door-only material/color; selected-window isolation; existing-pool resizing; garden addition preserving the house; plant addition preserving the pool; staircase widening preserving endpoints; ambiguous doors; invented IDs; roof changes during door edits; malformed/incomplete provider output; and atomic failure preservation. Additional tests cover camera reversal, missing camera evidence, inherited yaw, invalid hosts, floating plants, inconsistent stair widths, uncoordinated pool changes, metadata replacement, V3 scope/geometry smuggling, and actual renderer prop propagation.

Eleven new real-handler tests mock the provider boundary and exercise prompt → narrow provider contract → returned operations → local validation → acceptance/refusal. Existing real SDK wire tests remain active. No paid provider call was made. Existing revision/history/reload tests remain active.

Tests with vague fixture prompts now name their actual target or explicitly authorize broad executor probes; assertions about untouched objects, geometry faults, schema serialization and atomicity remain. Refine now refuses an unauthorized plan replacement before offering any draft; broader Redesign/Complete still exercise the existing incomplete-replacement diagnostics and recovery. Low-level multi-operation geometry tests remain on the existing atomic executor.

Repository-wide lint was run unchanged and reports 120 existing errors in archived `.data` scripts, diagnostic scripts and `generateStrict.test.ts`, plus existing warnings. All files changed for this task pass focused ESLint. No lint rule, ignore, validation check or test expectation was relaxed to conceal those errors. Resolving unrelated archived-script typing is outside this edit-safety change.

Reproduce:

```sh
npm run typecheck
npm test
npm run lint
npx vitest run src/lib/semantic src/lib/villa/scene/semanticEditing.test.ts src/components/scene/semanticRendering.test.ts src/app/api/ai/scene/route.test.ts
```

## Remaining limits

- Target/permission derivation is deliberately conservative and alias based. It does not fully understand arbitrary prose, compound edits, every spatial modifier, or every synonym. Unsupported phrasing refuses instead of widening authority. The AI still authors the requested geometry/operations within that narrow permission.
- V2 and legacy feature workflows retain their existing scope/preservation systems; this is not a migration of every legacy object into a new scene format. V3 sub-openings contained inside a building composition are not independently indexed as new scene objects; requests needing those identities safely refuse unless supported by the existing explicit architecture workflow.
- Direct-scene plants/trees use existing editable primitives/profiles. No botanical asset renderer, planting system or automatic landscaping design was added. Organic appearance is not proven by semantic metadata. Composite renderer internals are not promoted to fictitious independently editable objects.
- Assembly pool edits support uniform X/Z scaling. Independent width/depth remodeling, coordinated stair relocation, arbitrary connector rerouting and complex host repairs need explicit architecture development; the local gate does not silently authorize repairs to unrelated objects.
- Collision/placement coverage remains bounded by the existing geometry engines plus the new conservative checks. Roof unions, arbitrary profile intersections, complete path/headroom, structural design and code compliance are not certified. No existing safety check was removed.
- Provider behavior was tested offline with mocked responses and SDK wire tests. No new live model quality/reliability, pixel capture or production deployment is claimed.

No human approval is required for these local changes. No credentials, default models, generation call budgets, business logic, database schema, commits or deployments were changed. Existing uncommitted work was retained.

## Files changed for this task

New:

- `src/lib/semantic/vocabulary.ts`
- `src/lib/semantic/v3Editing.ts`
- `src/lib/semantic/v3Editing.test.ts`
- `src/lib/villa/scene/semanticEditing.ts`
- `src/lib/villa/scene/semanticEditing.test.ts`
- `src/components/scene/semanticRendering.test.ts`
- This report and `verification.json`.

Production integrations:

- `src/lib/villa/scene/model.ts`
- `src/lib/villa/scene/terra.ts`
- `src/lib/villa/scene/capabilityReference.ts` (keeps the existing prompt-size bound after adding schema metadata)
- `src/lib/villa/visual-review.ts`
- `src/app/api/ai/scene/route.ts`
- `src/app/api/ai/house/route.ts`
- `src/components/scene/OperationStudio.tsx`
- `src/components/scene/OperationScene.tsx`
- `src/components/scene/architecture.tsx`

Updated regression fixtures/contracts:

- `src/app/api/ai/scene/route.test.ts`
- `src/app/api/ai/scene/route.providerSchema.test.ts`
- `src/app/api/ai/scene/route.intelligence.test.ts`
- `src/app/api/ai/scene/route.testing.test.ts`
- `src/app/api/ai/villa/scene/route.test.ts`
- `src/app/api/ai/house/__tests__/route.v3.test.ts`
- `src/lib/ai/__tests__/clientV2AdditiveProxy.test.ts`
- `src/lib/library/architecture/composable.test.ts`
- `src/lib/villa/scene/terra.test.ts`
- `src/lib/villa/scene/planningBoundary.test.ts`
- `src/lib/villa/scene/replacementSafety.test.ts`

Other pre-existing working-tree changes are not claimed as part of this task. Tests rewrite the tracked homepage request evidence; that incidental artifact is restored after verification.
