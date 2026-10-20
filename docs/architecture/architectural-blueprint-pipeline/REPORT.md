# True blueprint-to-V3 architectural pipeline: offline proof

Historical offline proof. The subsequent default-off production integration and coverage expansion are documented in [FULL_PROPERTY_REPORT.md](FULL_PROPERTY_REPORT.md).

20 October 2026, America/St_Lucia. **A complete independent spatial design now precedes detailed V3 construction in the implemented offline slice. NO-GO for further paid generation.** The production provider route has not been switched to this contract. The proof establishes deterministic construction and editing for a declared subset, not reliable natural-model authorship or complete extraordinary-house design.

No Terra/OpenAI calls, paid generations, V2/terrain implementation changes, commits, pushes, deployment, environment changes or saved-user-project writes were made. Project persistence tests use in-memory storage. Browser automation blocks AI and project APIs; production rendering reads existing assets. Existing work and fixture bytes were preserved.

## 1. Present architecture versus the desired workflow

The four requested reports were read against current generation, schemas, ingestion, blueprint approval, architecture materialization, footprint/roof construction, estate routes, access evidence, interior/circulation, operations, project persistence and rendering code. The old reports' next-doorway/threshold recommendation is not the scope of this change.

The actual production path remains:

`prompt → one scene-authoring response → normalization/materialization → optional blueprint-index approval → bounded reference repair → structural/design consistency → compilation/geometry checks → optional single preservation-checked follow-up → V3 project`

[`generateV3Scene`](../../../src/app/api/ai/house/route.ts) still uses JSON mode, no exact transmitted schema, a 10,000-token output cap and at most one objective repair **or** optional design revision. `AI_V3_BLUEPRINT_FIRST` still requests a reference index and objects together. It is not an independently approved geometric design stage. No flag was enabled or new provider call added.

`estatePlan.blueprint` indexes independently authored V3 scene information. Removing the index historically leaves geometry unchanged. Named `architecture`, actual `composition.footprint`, openings, roof intent, interior reservations and canonical spatial routes already drive real construction. The problem was repeated authorship around those semantics, not the absence of every geometric builder.

The new implemented path is:

`independently authored/loaded complete blueprint → strict capability/spatial planning gate, with zero full-scene compilation → opaque in-memory approval → deterministic lowering + existing production V3 acceptance/construction → ordinary editable V3Scene`

The independent input exists before detailed scene objects. Private lowering supplies semantic projections to shared planning calculations; it makes no creative choices. The caller receives no scene or model from planning. A regression spy proves `compileV3Scene` is never called during that phase. The existing compiled-access and physical-stair evidence is deferred to construction for this new path; all pre-existing callers keep their default behavior.

## 2. Complete representation and architectural authority

The executable contract and adapter are in [`architecturalBlueprint.ts`](../../../src/lib/v3/architecturalBlueprint.ts), with a field-by-field authority table and inactive provider instructions in [CONTRACT.md](CONTRACT.md). Four loadable [blueprint JSON examples](blueprints/) accompany the source-authored fixtures. The format is `v3-architectural-blueprint-1`; it is not a migration of the old reference-index version.

The contract includes concept/character; user-versus-design requirements; site, cardinal frame and explicit access; program/hierarchy; mass locations; rectangle/articulated/line-arc footprints; ordered storeys and major functional spaces; circulation; explicit entrance/opening hosts; compatible roof intent; outdoor living, pool and landscape layout; named connections; major materials; zone reservations and relationships; and existing interior partition/door semantics.

It removes specific duplicate geometric decisions:

- Building height/count and room hosts/elevations derive from nested storeys/spaces. Unequal storey heights within one mass are explicitly unsupported by this adapter.
- Outline width/depth derive from exact segment extrema in the unchanged local frame. Articulated envelopes retain their distinct addressing meaning; operations are not replaced with boxes.
- Roof location, yaw, envelope and bearing elevation derive from its mass. Terra supplies family/pitch/eaves/finish once.
- Entrances reference actual wall/arc openings. Routes reference entrances or named site access; surface contacts are local to their referenced surface. The connection graph, exact world contacts, normals, owner bounds and ribbon are projections.
- Each relationship is declared once. Existing scene and estate relationship records are generated from that declaration. Zones may be measured groups or explicit reservations; reservations remain constraints.
- Material definitions are selected through identities; object copies are deterministic projections rather than second model decisions.

Strict parsing rejects extra runtime transforms, `objects`, independently positioned roofs and unsupported fields. Stable semantic IDs are preserved, collisions are diagnosed, and unsupported forms are never renamed, flattened or silently omitted. No building count, architectural style, pool, mandatory luxury program or mansion template is part of the contract.

Construction reuses the existing V3 normalizer, scene validator, design consistency, compiler and specialized builders. There is no second runtime. The only persisted project authority is the normal V3 scene; the independent input document and ephemeral approval are not attached to it. The proof's JSON input/output artifacts are evidence, not live project sidecars.

One genuine authority inconsistency emerged: `V3Storey.elevation` is documented and used by rooms/stairs as a finished floor, but the old blueprint audit expected the slab bottom. The audit now uses the existing `V3_FLOOR_SLAB` constant. This changes no compiler geometry or saved-scene baseline. Other integration changes are optional no-construction-evidence parameters; existing default validation/construction remains active.

## 3. Implemented end-to-end proof

[`crescentEstateBlueprint`](../../../src/lib/v3/parity/architecturalBlueprint.ts) is an explicitly authored offline design, never a generation template. Crescent Lantern has a two-storey limestone residence with a continuous inhabited east arc and articulated west library wing, a copper roof, an independent terracotta hip-roof orchard atelier, a perimeter arrival court, named north gate/drive, pedestrian approaches, dry outdoor belvedere, offset swimming pool and landscape clearing. The program includes arrival circulation, library, living/dining, kitchen/service, family suites and bath spaces; a stair serves the second storey. One partition and door exercise real interior construction.

The primary design yields **12 editable V3 objects and 115 construction primitives**. Its outline has no separately authored placement envelope. Gate, principal, atelier and garden connections have no independent path boxes. The pool basin is cut from the existing terrace builder rather than painted over a slab.

The [offline proof](proof.json) records all four original failed provider responses alongside four independent designs:

| Independent design | Spatial composition | Outcome |
| --- | --- | --- |
| Crescent Lantern | Two-storey mixed line/arc residence, detached hip-roof atelier, arrival, pool/deck, landscape, major spaces and stair | Planning, production construction, editing and reload pass |
| Moon Court | Full circular perimeter and arc-addressed entrance | Pass; full arc and identities retained |
| Ochre Court | Deep recessed entry and asymmetric garden notch | Pass; articulated slabs/walls/roof retained |
| Orchard Villa | Compact rectangular classical pavilion with a pitched terracotta hip roof | Pass; conventional form remains equally valid |

The untouched Canopy initial/repair and Cloister initial/repair remain rejected by production ingestion. The checkout adapter refuses to manufacture their missing complete room/storey designs or discard unsupported legacy detail. No synthetic correction is injected into either mansion. Their original contradictions remain evidence; the new designs are not presented as recovered provider successes.

The new tests exercise rejection before approval for incompatible/unsupported roofs, unequal storeys, unusable reservations, missing materials/entrances, duplicate identities, site overruns, room containment, blocked routes, malformed outlines, competing placement fields and conflicting compiler policies. Mutation of the source document after approval does not alter the captured design. A serialized/forged handle cannot construct a scene.

Preliminary approval and final acceptance are distinct. A deliberately authored wall across the stair entry passes geometric planning, then fails the detailed physical gate and returns no scene/model. A mocked compiler that erases the atelier roof is rejected even though the remaining primitives are renderable. The adapter checks semantic preservation, existing compiled errors, emission of all architectural objects and designated entrances; it never returns a partial saveable success.

## 4. What V3 derives versus what still requires design

| V3 deterministically constructs/resolves here | Authored architectural choices still required |
| --- | --- |
| Existing walls, slabs, supported line/arc facade geometry and host-following roof shapes | Mass composition, footprints, placement, scale, outline topology, wall/segment identities and level structure |
| Storey and room datums, known interior boundary partitions/door openings | Major functional spaces, privacy/service arrangement, intended adjacencies and which partitions/doors exist |
| Supported stair/lift construction, floor cuts, landings/guards | Host, served levels, reservation, type/direction/turn and circulation intent |
| Compatible pitched/flat roof construction and host-derived location | Family, pitch, eaves, thickness, finish and composition; unsupported roof forms remain gaps |
| Named-opening/gate contacts, optional wall-normal approaches and canonical route ribbons | Entrance selection, local surface contacts, width/use, graph and every obstacle-avoiding bend |
| Pool shell/water/coping, terrace pool cutouts, courtyard perimeter and groundcover zones | Pool/deck placement, proportions, levels, landscape territories, amenity/equipment selection |
| Existing material families and prescribed construction subparts | Major finish identities/colours and intended visual character; bespoke subpart finishes need further mappings |

Labels do not create equipment, trees, furniture or private rooms. The proof is spatially complete for its declared open functional zones and explicit construction choices, not a finished, code-certified household interior. It does not certify extraordinary aesthetic quality, structural engineering, accessibility, privacy, fire escape or cost.

## 5. Architectural freedom and editing preservation

Curves are not reduced to boxes; the full circle, mixed arc/line wing, recess and notch survive. Tests move the complete residence, resize an arc's radius, change articulated dimensions and rotate a curved building. Host roof placement/envelope, entrance contacts and route construction recompute while IDs and unchanged segments remain stable. Modern, classical, tropical, castle-inspired or Mediterranean decisions remain possible within actual supported semantics. Those style labels do not grant unsupported domes, vaults or equipment.

`reviseV3ArchitecturalBlueprint` computes a stable-ID three-way semantic change against the current scene. Unrelated material/window edits and a newly added local landscape object survive. Simultaneous edits to the same changed coordinate fail atomically. Replanning does not mutate the supplied current scene. The merged result passes full production acceptance again.

`checkoutV3ArchitecturalBlueprint` reconstructs the supported blueprint from the current saved V3 scene and proves its projection is lossless before returning it. A real project-store test creates, edits, serializes, rehydrates, checks out and revises construction using in-memory storage. It confirms no independent blueprint or approval is stored. Legacy scenes outside the adapter retain their existing editor and receive explicit checkout diagnostics, not a lossy migration.

Regular V3 operations keep their existing semantics. They do not become a hidden synchronization engine: independently moving an editable roof is a new scene decision, and independently moving a legacy mass does not acquire automatic roof-following. Blueprint replanning updates its derived geometry together. Reopening a scene that has left that supported relationship is refused rather than overwriting the scene from an old document. This distinction must be made explicit when integrated into the main workspace.

## 6. Remaining gaps and an incremental scaling plan

The adapter deliberately stops at a complete property-layout and major-space slice. It does not claim arbitrary full-house construction. Its present limits and actual compiler policies are enumerated in [CONTRACT.md](CONTRACT.md), including fixed courtyard finishes, minimum groundcover/ring thicknesses and refusal of automatic compiler design overrides.

Extend the same mechanism in bounded milestones, with one owner for every new decision:

1. **Provider/workspace integration:** one inactive-by-default blueprint-only generation branch, mocked at the actual API, same successful one-call budget, explicit no-save planning/construction failures and a supported blueprint editor. Audit user constraints independently of generated claims.
2. **Facades/materials:** map existing assemblies and roof-datum groups to host/segment identities, define which subpart finishes are explicit versus construction policy, and remove current policy conflicts through targeted builder support. Add generation fixtures for deep shade, classical colonnades and tropical openings without prescribing a style.
3. **Interiors:** expand functional-space topology into authored private/service partitions and door relationships, then verify room circulation, floor/ceiling datums, headroom and required access. Never infer missing private rooms or fake a kitchen from its label.
4. **Roofs and supported forms:** map existing stacked/connected masses and multiple roof owners before adding geometry capabilities. Preserve line/arc outlines. Treat roof intersections, holes, domes, vaults, variable storeys and curved room boundaries as explicit capability work with their own compiler proofs.
5. **Site/features:** extend existing semantic features, equipment and planting layouts through stable host/site references; specify physical level changes when needed. No route search, terrain extension or automatic amenity insertion is implied.

Each milestone must demonstrate independent input, pre-construction rejection, deterministic output, unsupported diagnostics, conflict-safe edits/reload and unchanged saved-scene baselines. This change does not implement those milestones or enlarge the provider call budget.

## 7. One blueprint call versus two calls

| | A: one blueprint authoring call + deterministic V3 | B: blueprint call + constrained elaboration call |
| --- | --- | --- |
| Evidence today | Proven offline for the declared subset: the complete design documents construct without a second scene-authoring input | Not implemented or evaluated; no extra call activated |
| Feasible output | Supported massing, major spaces, entrances, roofs, routes, pool/deck, zones and basic known construction | Potentially richer host-addressed facade/detail choices, after defining a bounded detail contract |
| Remaining authorship | Every creative/layout decision must be in the blueprint; missing design fails or is explicitly outside the scope | Stage B may author only designated new detail; it must not repeat mass/roof/room/route placement |
| Drift | No second AI geometric interpretation; normalization/effective policy drift still needs the implemented checks | Additional chance to remove/rewrite relationships, styles, footprints or materials; requires a protected projection and explicit detail allowlist |
| Limitation | A is **not proved sufficient for arbitrary complete houses**, bespoke facades/equipment, natural-model reliability or exceptional architecture | A second model cannot add unsupported construction capability; current approval logic is not a complete constrained-detail contract |

Compact independent blueprint sizes are approximately **668–2,229 output tokens** (JSON characters / 4, rounded up), with the principal mansion at **8,916 characters / 2,229 estimated tokens**. The corresponding saved V3 scene is 13,133 characters. That comparison is serialization evidence, not measured provider savings: the current provider may omit runtime arrays and does not author the same full room program through its normal output schema. No real tokenizer, latency, billing, truncation rate or generation success rate was measured.

For reproducible engineering estimates only, the repository's [`DEFAULT_PRICING`](../../../src/lib/ai/pricing.ts) configures Terra at $2/M uncached input and $12/M output tokens. These are local configured coefficients, not a verified current provider price or a charge incurred here. With **8,000 assumed input tokens**, the 2,229-token mansion output would cost approximately **$0.0427** for A. A hypothetical B with a further **6,000 input / 1,500 output tokens** would add **$0.0300**, giving approximately **$0.0727** total before repairs/cache effects. B repeats approved-plan context; a failed planning stage must stop before paying for elaboration. Different prompts, schema transmission, bigger programs or retries change these numbers.

A is the technically justified next offline integration target for this subset. Do not activate B merely to make a deficient blueprint whole. A cannot be called production-sufficient for the entire product vision on this evidence.

## 8. Verification and exact next milestone

[Focused results](focused-tests.json), [full suite](full-tests.json), [checks](checks.json), [preservation](preservation.json) and [proof](proof.json) record the final verification. Coverage includes the two failed mansion pairs, four independent styles/forms, supported construction, zero compilation at planning, physical failure after planning, omitted construction, stable IDs, curved/articulated edits, collision/conflict rejection, supported round trips, actual project-store persistence and the nine saved-scene construction baselines. Final verification: **223 focused tests passed; 2,167 full-suite tests passed, 3 skipped, across 179 files (177 with executed tests and 2 with only skipped tests). TypeScript, ESLint with zero warnings, `git diff --check` and new-source whitespace checks passed.**

[Ten browser captures](webgl/capture.json) comprise three boundary/error UI states and **seven production WebGL views**: the whole crescent estate, moved estate, material edit/reload, an interior section and three distinct forms. They use the actual production `PrimitiveMesh`, edge finishing, PBR materials, environment, sun/shadows and `PostFx`; they are not mock renders. All ten were inspected. The capture reports zero page errors and zero attempted AI/project calls. Existing Three.js clock/shadow deprecation warnings remain. The images prove construction/composition preservation, not full luxury quality. The dev server was stopped after capture.

**Exact next milestone:** integrate the independent contract into one mocked, inactive-by-default production generation branch, replacing scene output for that branch with blueprint-only output. Prove one successful mocked provider response → preliminary gate → deterministic V3 → existing project save/edit/reload, plus pre-construction failure and no second paid elaboration request. Include complete brief-specific room/service/privacy commitments, explicit capability responses and architectural human review. Keep legacy generation/loading/editing unchanged. Finish that offline milestone before reconsidering any separately authorized provider evaluation.

## 9. GO / NO-GO

**GO for the stated offline blueprint-authority slice. NO-GO for further paid generation or broad production activation.** Independent design authority and deterministic supported construction have concrete proofs. The production authoring route is not wired to this input yet, natural-model authorship has not been measured, both recovered estates remain invalid, and full private interiors, bespoke detail/site equipment and unsupported forms remain gaps. No additional paid evaluation is authorized or required to complete this task.

Reproduce without provider requests:

```sh
NATIVE_LIVE_QA=0 TEST_DATABASE_URL= ARCHITECTURAL_BLUEPRINT_PROOF=docs/architecture/architectural-blueprint-pipeline/proof.json npx vitest run src/lib/v3/__tests__/architecturalBlueprint.test.ts src/store/__tests__/v3ArchitecturalBlueprintPersistence.test.ts --maxWorkers=2
NATIVE_LIVE_QA=0 TEST_DATABASE_URL= npx vitest run --maxWorkers=2
npx tsc --noEmit
npm run lint -- --max-warnings=0
git diff --check
# Start the existing local Next dev server; the capture script blocks provider/project APIs.
PLAYWRIGHT_DIR=<existing-installation> node scripts/architectural-blueprint-capture.mjs
```
