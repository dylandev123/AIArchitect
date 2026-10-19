# V3 architectural blueprint foundation

19 October 2026. Offline implementation. No provider calls, paid generations, commits, pushes or deployment. Existing uncommitted construction work and both recovered raw mansion responses are retained.

## 1. Current architectural generation weaknesses

Reviewed `mansion-failure/DESIGN-CONSISTENCY.md`, its recovered fixtures, and the existing ingestion, validation, revision, project storage and construction paths. The completed mansion construction investigations are not repeated here. The synthetic correction helper from that investigation is extracted into `src/lib/v3/__tests__/correctedMansionFixture.ts` and reused unchanged by its original tests and the new blueprint proof.

The production path is:

1. The user prompt reaches `generateV3Scene` in `src/app/api/ai/house/route.ts`. Terra receives the shared V3 architectural/estate contract. JSON mode supplies one authored scene response; no exact provider schema is supplied in this path.
2. `estatePlan` records concept, user/design requirements, program, zones, circulation, architectural commitments, relationships, views, landscape and privacy. Objects separately carry named geometry, composition footprints/openings, roof forms and hosts. Interior semantics separately carry storeys, rooms and stairs/lifts. These are all parts of the same V3 scene.
3. `normalizeV3GenerationOutput` resolves field conventions, named geometry/runtime arrays, semantic interiors and intent aliases. It retains the plan. `repairV3GeneratedScene` drops dangling references and incompatible support hints; it is not a spatial design engine.
4. `validateV3Scene` checks canonical semantics and construction executability, including footprint construction diagnostics. New API generations additionally enable the existing design consistency gate. Successful ingestion checks compiled geometry. Architectural review then checks composition, completeness and supported spatial relationships.
5. One bounded follow-up is available: objective repair, or an optional design revision when the initial scene was valid. Existing preservation guards compare stable ids and narrowly permitted changes. Candidates are ingested again. This task does not change that call budget or its repair permissions.
6. Client/project storage persists the authored `v3Scene` through the existing project root and commit checks. `compileV3Scene` deterministically elaborates it, with derived support, junctions, floors, walls, roofs, stairs and route ribbons. Meshes and inferred support are not a new persisted authority.

| Decision | Already established once | Repeated or insufficiently reconciled |
| --- | --- | --- |
| Site dimensions | `scene.site` | Allocations and object extents can contradict it. |
| Building placement/form | Named object geometry and `composition.footprint` | Zone rectangles, form claims, entrances and explicit roofs can disagree. Runtime arrays are a deterministic cache, not another design decision. |
| Storeys | Object levels/height; existing V3 level resolution | Interior datums and stair reservations may not reach upper volumes. |
| Access | Doors, `serves`, routes and graph edges | Path endpoints, actual recessed wall positions, route widths and finished elevations can contradict the intended destination. |
| Roof | Implicit mass roof or explicitly hosted roof object | Host, envelope convention and footprint compatibility may disagree. |
| Required/outdoor spaces | Program, requirements and scene objects | Allocation membership, usable clear space and physical overlaps need reconciliation before facade construction. |

The recovered mansion demonstrates these weaknesses: multi-plane doors, disconnected side walks and recessed arrival, zone conflicts, a joined lawn/pool gap and a landscape overrun. Existing consistency checks expose them after canonical validation. The missing boundary was a construction-independent check of the major authored decisions, with explicit identity for the planning representation.

## 2. Blueprint structure

`estatePlan.blueprint` is an optional version-1 semantic index defined in `src/lib/v3/blueprintSchema.ts`:

```ts
{
  version: 1,
  buildings: [{ id, objectId, role }],
  entrances: [{ id, objectId, openingId, level }],
  verticalCirculationIds: [/* scene.interior.circulation ids */],
  roofObjectIds: [/* explicit scene roof ids */],
  outdoorObjectIds: [/* selected pool/terrace/landscape/etc. ids */],
  routeIds: [/* estatePlan.circulation ids */],
  allocations: [{ id, requirementId, objectIds, roomIds }]
}
```

Building roles use open text to describe spatial hierarchy. There is no primary-house count rule or prescribed composition. Entrances reference the actual authored opening, which already carries a compass span or stable line/arc `segmentId`; `level` is local to its host. Stair/lift reservations remain in the existing interior semantics. Implicit roofs remain on their building; independent roofs retain their own ids and host relationships. Required program maps to existing object or room footprints.

Concept/identity, explicit user requirements, site dimensions, zone allocations, clear space, landscape/view/privacy considerations and connections remain in their existing locations. The blueprint does not copy these fields, object coordinates, footprints or roof geometry into another document. Semantic entry ids are unique across the estate plan and its blueprint. Referenced object/room/route/opening ids remain editable in their existing domains. No production function infers a blueprint from labels or invents a missing decision. The indexing helper is test-only and indexes explicitly authored fixtures.

## 3. Implemented foundation and construction boundary

`auditV3Blueprint(input)` checks planning prerequisites and geometry without calling `validateV3Scene`, `compileV3Scene`, facade mass construction or roof construction. Its narrow prerequisite schema does not require materials, facade assemblies, partitions, detailed stair geometry or meshes. Tests validate the corrected mansion after removing finishes and unplanned facade detail.

`approveV3Blueprint(scene)` returns findings and, only after success, immutable in-memory decision evidence. `auditV3BlueprintElaboration(approval, candidate)` checks the candidate and compares its major decisions with that evidence. It protects site constraints, estate commitments, referenced object geometry, footprints, levels, entrance addresses, roof relationships, rooms, storeys and circulation. Finishes, facade assemblies, non-designated windows and internal partition/door detail may be elaborated. Comparison is conservative: changing the plan's intent or ordering its arrays can require replanning. This is comparison evidence, not a security credential, a persistence record or a second scene.

`ingestV3GenerationOutput` now applies the preliminary gate when the response contains a blueprint, or when called with `requireBlueprint:true` or `approvedBlueprint`. It checks before reference repair and detailed validation/compilation, then compares again after reference repair. An invalid blueprint cannot be made acceptable by silently dropping its support/relationship commitments. A failure returns coded fatal/advisory findings through the existing validation result and a `blueprint` result. Valid planning still proceeds through every existing V3 construction check; preliminary approval does not certify detailed construction.

The API is not switched to mandatory blueprint generation and its prompt/provider orchestration is not rebuilt. Callers without a blueprint retain historical ingestion policy. Saved-scene loading, editing, storage and direct compilation retain their existing policy. Blueprint metadata persists as part of `estatePlan`, with no new database/store or geometry renderer. Existing `replaceEstatePlan` operations can edit it. Approval evidence is intentionally not persisted and must be recaptured after explicit replanning.

For a future staged integration:

```ts
const planned = approveV3Blueprint(planningScene);
if (!planned.approval) return planned.findings;

// Same objects/ids. Elaborate facade/interior detail without relocating the plan.
const result = ingestV3GenerationOutput(elaboratedScene, 'flat', {
  approvedBlueprint: planned.approval,
  requireDesignConsistency: true,
});
```

There is no separate blueprint compiler. The approved object's own coordinates, footprints, levels, doors, roof intent and route data feed the existing V3 compiler.

## 4. Existing systems reused

- Estate plan schema/audits: requirements, actual allocated footprints, joined groups, route continuity, authored relationships, clear-space reservations and supported spatial corridors.
- Named architectural geometry and its deterministic materializer; existing footprint/arc resolution and storey-count/stacking semantics.
- Actual polygon overlap/separation. Optional floor arguments extend the same helpers for upper-level relationships; default callers retain identical behavior.
- Existing facade/curve threshold probes, extracted without behavioral changes from `completeness.ts` into `accessPlanning.ts`. Both completeness and preliminary checking consume the same addresses.
- Existing footprint roof-family/envelope compatibility, extracted into `roofPlanning.ts` and shared with construction. No roof meshing implementation is added or re-investigated.
- Existing generation ingestion, preservation guards, semantic edit operations, project persistence and deterministic compilation.

## 5. Validation capabilities and limits

Fatal contradictions include malformed/duplicate references, missing building/route/roof/circulation entries, invalid/out-of-site footprints (including upper levels and rotation), invalid door/segment/level addresses, non-spatial paths missing the actual designated door, disconnected or blocked spatial routes, unfulfilled measurable requirements, incompatible roof forms/hosts/envelopes, unallocated required features/rooms, conflicting storey datums, room overlap/out-of-host allocation, unrelated overlapping building volumes and pool/building volume conflicts.

Vertical checking uses reserved stair/lift footprints and a preliminary reachability graph. It verifies reservations inside all traversed host floors, connected equal-datum wings and actual landings within stacked upper masses. It does not substitute stair tread/riser, door-clearance or structural engineering checks. Explicitly connected/joined overlapping wings remain possible; the later junction compiler must prove their constructed passages. Ground entrances with no designated entry are advisory because another connected wing may provide access; missing upper-level reachability is fatal.

Geometric `contains` commitments must contain the actual target footprint; planned roof `hosts` edges must agree with the roof's own host. Advisories retain decisions that cannot be certified from planning geometry: unspecified alignment axes, general physical-support claims, budget/style claims, privacy/views, unresolved subjective amenity/form quality and small finished-surface threshold differences. These are not converted into fatal findings merely by count. Existing default roof semantics remain existing V3 semantics; the foundation adds no new geometry defaults or automatic architectural repair. Outdoor footprints may overlap intentionally (for example landscaping/deck compositions); these are not universally treated as independent enclosed rooms. An explicit joining relationship is planning intent, not proof that a detailed shared wall has an opening.

Spatial route support retains its existing flat-site, one-surface-owner capability. The checker verifies encoded user constraints; it cannot certify a requirement omitted from the estate plan or recover one by interpreting the original brief. No routing algorithm, advanced terrain extension, arbitrary roof intersection, general polygon room program, building-code certification or privacy ray analysis is introduced. Preliminary success is not a claim of luxury quality, engineering readiness, step-free access or complete interior design. Full V3 validation/geometry/completeness checks remain necessary.

## 6. Offline proof and compatibility

`src/lib/v3/__tests__/blueprintFixtures.ts` contains five test-only proofs:

| Proof | Distinct spatial decisions |
| --- | --- |
| Corrected recovered mansion | Existing articulated residence, two independent pavilions, floating roofs, pool/terrace/lawn axis, corrected arrival and side circulation, retained main stair. Reuses the prior synthetic corrections. |
| Sculptural contemporary estate | Mixed line/arc residence, asymmetric wing/recess and an explicitly reserved internal stair. |
| Mediterranean compound | Three separate orchard buildings with hip roofs and authored bent paths to actual pavilion doors. |
| Circular residence | Full circular footprint with semantic arc-addressed entrance and independent privacy intent. |
| Rectangular home | Compact three-storey urban building, garden arrival and an internal vertical reservation. |

These are diversity proofs, never generation templates. The raw recovered mansion is still rejected by the preliminary checker; the proof does not relabel either recovered response successful. The checker leaves every fixture unchanged. Compiled models with/without blueprint metadata compare exactly; all five also pass compiled geometry checking. A project-store test edits and reloads blueprint references through the existing persistence and operation paths, without storing approvals or construction output.

The new preliminary containment check also exposes one previously unaudited semantic claim: `rel-terrace-pool` says the terrace contains the pool, but the terrace ends at z=27 and the pool extends to z=36.5. The blueprint fixture explicitly changes that stable relationship to `connects`, with intent describing the adjoining pool edge, in both existing relationship locations. This is a test-author planning decision; it changes no object geometry and is never applied by production repair. The original correction helper and recovered records remain unchanged.

Reproduce the machine-readable evidence:

```sh
BLUEPRINT_REPLAY_OUTPUT=docs/architecture/blueprint-replay.json npx vitest run src/lib/v3/__tests__/blueprint.test.ts --maxWorkers=2
npx vitest run --maxWorkers=2
npx tsc --noEmit
npm run lint
git diff --check
```

Final checks: **169 test files passed, 2 skipped; 1,991 tests passed, 3 skipped**. The focused blueprint/persistence run passes **37/37**. TypeScript, ESLint (zero warnings), `git diff --check` and explicit new-file whitespace checks pass. Machine-readable results are recorded in `blueprint-checks.json`. No new rendering capture is required for this planning-only change; exact compilation equality and existing construction/footprint regressions guard renderer behavior.

## 7. Remaining integration work and single-call viability

The provider still receives the existing generation contract and usually produces no blueprint. A future milestone must teach Terra to author the reference index, rooms/reservations and constraints coherently in the same V3 response, then enable `requireBlueprint:true` only for that generation path. Existing objective-repair guards intentionally have no broad permission to redesign a blueprint or remove commitments; a material layout change requires explicit replanning. Persisted approval lifecycle and UI review/editing are future product choices, not new stores added here.

A single initial AI call is architecturally viable: return one coherent V3 scene with its planning index and minimal semantic construction intent, run the blueprint gate locally, then expand through the deterministic compiler. The existing optional single repair can remain bounded. This proof does not establish provider reliability or guarantee success in one attempt. In an ordinary single completed JSON response, local validation occurs after the provider has emitted it; it cannot literally approve an intermediate concept before the model continues writing. Enforcing that temporal boundary would require a deliberately staged/streamed orchestration design. It is documented rather than implemented in this task, and would need to preserve the agreed provider-call budget.

## 8. Recommended next milestone

Build an offline blueprint-authoring contract evaluation: add blueprint instructions/examples expressed as capabilities rather than house templates, replay a broader corpus through the gate, measure missing decisions and over-rejection, and prove that facade/interior elaboration preserves approved decisions. Include courtyard openings, rotated multi-floor wings, shared stairs, stacked upper masses and unusual supported roof combinations. Only after that should the generation API require blueprint coverage. Any later live provider evaluation needs separate authorization; none is used for this foundation.
