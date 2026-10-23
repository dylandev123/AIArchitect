**Terra 2D authoring investigation — 21 October 2026**

The evaluation path was still exposing a construction-oriented semantic contract as the architect's drawing interface. The existing V3 scene is a suitable geometry authority; its complete internal bookkeeping is an unnecessarily demanding provider interface. I simplified that boundary and moved stair flight decisions to the existing exterior stage. No provider calls, paid generations, commits, pushes, deployments, V2 changes or terrain changes were made.

The baseline is the **working tree when this task began**, including its substantial pre-existing changes. It is not Git HEAD. The exact previous prompt/schema, revised prompt, measurements and original-response hashes are retained in [plan-authoring](plan-authoring/metrics.json). Original fixtures and previous evidence were preserved.

1. **What exactly was Terra being asked to produce?**

`AI_V3_PLAN_EVALUATION=1` enables the separate **`/api/ai/plan`** route. It does not select a branch inside `/api/ai/house`. The actual evaluation path is:

| Stage | Source and function |
| --- | --- |
| Submission | `src/app/page.tsx` mounts `src/components/landing/Design2DPlan.tsx`. `design()` creates a new blank flat V3 project, then invokes `requestPlanEvaluation(project.id,'design',brief)`. |
| Request/version protection | `src/lib/ai/planClient.ts::requestPlanEvaluation` posts the current JSON and `revisionOf` to `/api/ai/plan`; stale responses cannot overwrite newer edits. |
| Production handler | `src/app/api/ai/plan/route.ts::POST` checks the server flag, action, brief, revision, V3/flat site and blank-project requirement. Existing evaluation plans use `checkoutPlanEvaluation` for elaboration. |
| Model | `src/lib/ai/model.ts::getAiModel` uses `@ai-sdk/openai`'s `openai(getAiModelId())`. Selection is `AI_HOUSE_MODEL` or default `gpt-5.6-terra`; the historical records and offline transport use that default model ID. No model change was made. |
| Actual instructions | `src/lib/v3/architecturalPlanEvaluation.ts::planEvaluationPrompt`, followed by JSON schema. This is the prompt actually sent, rather than the general scene/composition prompt. |
| SDK request | `generateText` with `Output.json`, **10,000 output tokens**, `maxRetries:0`, 270-second abort signal; route duration 300 seconds. `AI_PROVIDER_OPTIONS` only sets `strictJsonSchema:false`. No explicit reasoning effort/budget or temperature is configured here. Provider defaults are not evidence of a particular reasoning setting. |
| Capture/parsing | `onStepFinish` calls `retainPlanResponse(step.text)` before accessing `result.output`. `src/lib/ai/planResponseArtifact.ts` retains/verifies response evidence; the SDK parses JSON; non-`stop` finish reasons fail. This is JSON mode with the schema in the prompt, not provider-enforced strict structured output. |
| Input normalization | `preparePlanEvaluation` now calls `expandPlanAuthoring` before `prepareV3ArchitecturalPlan`; previously it called the latter directly. Canonical legacy input is still accepted verbatim. |
| Semantic lowering | `src/lib/v3/architecturalPlanFirst.ts::prepareV3ArchitecturalPlan` parses the canonical plan, canonicalizes feature vocabulary, checks references/footprints, calls `normalizeArchitecturalBlueprintIdentities`, then `planningInput` → `lowerV3ArchitecturalBlueprint`. Temporary roof declarations are removed; no roof geometry is saved for the 2D stage. |
| Geometry/audits | `src/lib/v3/blueprint.ts::auditV3Blueprint`, room-adjacency inspection through `auditV3Interior`, and `normalizeV3GenerationOutput(scene,'flat')`. Existing Draft exceptions keep recoverable room problems visible; core-invalid geometry remains rejected. |
| Drawing | `Viewport.tsx` detects evaluation metadata and passes no compiled 3D model. `ArchitecturalFloorPlan.tsx` uses `architecturalPlanning.ts::deriveArchitecturalPlan` and the existing semantic footprints, rooms, entrances and route geometry to draw SVG. |
| Persistence/editing | `requestPlanEvaluation` calls `useProjectStore.appendVersion` and selects floor-plan view. `src/store/useProjectStore.ts` persists ordinary project versions. `PlanEvaluationControls` checks out the current scene for local edits; save, undo, redo and reload use that same scene. The disposable author input is not another editable scene. |
| Later construction | The explicit `elaborate` action checks out the current plan, requests `planExteriorPrompt`, and calls `elaborateV3ArchitecturalPlan` → `planV3ArchitecturalBlueprint({buildFirst:true})` → `constructV3ArchitecturalBlueprint`. `sameArchitecturalPlan` protects approved geometry. |

At the start, the provider had to return `v3-architectural-plan-1`: concept/character, site/access, fully identified buildings/storeys/rooms, reserved roof IDs, addressed facade doors, a separate entrance index, outdoor geometry, individually identified connections and their generated surface owners, vertical circulation, requirement and program tables. Several ancillary ledgers were already optional. Roof forms, materials, facade assemblies, detailed partitions and interior doors were **already deferred** in this evaluation path; blaming those required fields on the current evaluation would be inaccurate.

The ordinary generation path is different: `ChatPanel` → `src/lib/ai/client.ts::requestHouseEdit` → `/api/ai/house::POST` → `generateV3Scene`. With `AI_V3_ARCHITECTURAL_BLUEPRINT=1` on flat land it calls `generateArchitecturalBlueprintV3`, sending `architecturalBlueprintGeneration.ts::v3ArchitecturalBlueprintPrompt`. That response contains **both plan and exterior**, and permits one bounded objective repair. A saved evaluation plan is rejected by `/api/ai/house` with 409. This change deliberately simplifies the separate 2D evaluation, without replacing ordinary generation or migrating existing projects.

2. **Why was a 2D layout unnecessarily difficult?**

The application confused its canonical internal representation with the minimum information an architect must author. A single door needed a facade record, opening identity and a separate entrance record; a route needed a connection identity and an exclusive generated surface identity. Storeys/rooms needed identities and repeated label/role text. Roofs needed reserved identities despite having no geometry yet. Building function was repeated in a separate program ledger.

More significantly, `auditV3Blueprint` always called `auditV3StairUsability` and used `resolveV3Circulation(...).usable` for floor reachability—even when called with `constructionEvidence:false`. Thus a conceptual stair reservation had to satisfy flight construction before the 2D layout could be accepted. Saying “interiors are deferred” in the prompt did not remove that requirement.

This adds avoidable syntax, cross-references and vertical construction work to an already demanding spatial design task. It is evidence of unnecessary burden, **not proof that every weak architectural choice was caused by the schema**. Coherent room arrangements, circulation and site proportions remain real architectural work.

3. **Which fields and restrictions are unnecessary, and which are real design decisions?**

The table covers every field family in the baseline schema, including optional branches. The [exact baseline schema](plan-authoring/before-schema.json) retains individual required flags and numeric bounds. “Derive” means deterministic bookkeeping; schematic height defaults are explicitly identified as defaults rather than inferred design.

| Baseline field(s) | Design / needed for initial drawing? | Derivation, duplication, later use and revised treatment |
| --- | --- | --- |
| `format` | Serialization only | Retained discriminator; not architectural work. |
| `concept`, `character` | Design intent; neither defines geometry | `concept` retained; duplicate `character` may be omitted and is copied from concept. Explicit legacy character is preserved. |
| `site.width/depth` | Yes | Retained; V3 cannot infer the chosen plot size from a luxury brief. |
| `site.baseElevation/north/groundColor` | Datum/frame/cosmetics | Omittable; defaults 0, `-z`, `#61754b`. Explicit values retain their supported constraints. |
| `site.access[].id/boundary/point` | Gate location is a design decision | Named boundary contact retained; point remains `[x,y,z]` in the existing flat coordinate contract. Identity is useful for route references. |
| `buildings[].id/label/role` | Identity and readable function; role repeats label | Building ID retained because routes/relationships need stable hosts. Role defaults to label. |
| `buildings[].location.x/z/rotationY/baseElevation` | Placement/orientation are design; vertical datum is later | x/z retained; omitted rotation/base default to zero. Nonzero authored values are preserved. |
| `plan.kind/width/depth` | Chosen footprint family and spans: essential | Retained. Outline envelopes were already derived before this task; there was no duplicate outline width/depth obligation to remove. |
| Articulated operations: `type/id/floors/facade/start/end/depth/open/postSpacing/corner/width/size/glazed` | Recesses, projections, notches and chamfers define real shape; remaining controls are optional | Retain all supported branches/floor scopes. Optional IDs and appearance controls need not be supplied. No mandatory shape or template introduced. |
| Outline segments: `id/type/start/end/center/radius/startAngle/sweep` | Exact line/arc geometry: essential | Retained, including segment identity for door addresses. Only fields belonging to the chosen segment type are valid. Bounding envelopes remain derived. |
| `storeys[].id/label/role/height/spaces` | Ordered floors and conceptual rooms are design | IDs may be generated; role defaults to label. Height may be omitted for the stated **3.6m schematic default**, editable before construction. No separately authored mass height or slab elevations. |
| `spaces[].id/label/role/program/footprint` and `footprint.x/z/width/depth` | Room function and host-local zone rectangle are design | IDs may be generated; role defaults to label. Label/program/rectangle remain. IDs must still be explicit when an authored legacy adjacency/requirement references them. |
| `spaceHeight` | Optional vertical/interior intent | No longer advertised to 2D author; explicit legacy value remains accepted. |
| `roofId` | Bookkeeping for later construction | Generated uniquely; no roof family, dimensions or finish required in 2D. |
| `accessOpenings[].id/type/facade/segmentId/start/end/floors/height` | Door location/span determines entrance and route contact | Keep exact horizontal address and opening ID. Floors default to ground; height may use the stated **2.4m default**. Outline segment addresses remain necessary. |
| Optional door `frame/reveal/serves/operation` | Appearance/assembly use, not initial layout | Existing optional controls remain accepted; initial author need not supply them. No automatic detailed facade is invented. |
| `entrances[].id/objectId/openingId/level` | Duplicates already addressed access openings | May omit the whole table. V3 derives the index; compact route `entranceId` names a uniquely identified opening. Ambiguous references fail instead of being guessed. Explicit legacy entrance records win. |
| `features[].id/label/role/type/location/width/depth` | Outdoor composition/boundary: design | Keep identities, labels, types and planar geometry. Role defaults to label; location uses the same optional datum/rotation defaults. |
| `features[].height` | Vertical construction only | Already optional at baseline; omission remains supported with deferred metadata, not a fabricated pool depth. Later construction still requires this decision. |
| `features[].footprint.kind/segments/operations` | Exact nonrectangular outdoor boundary | Retained unchanged, with the segment/operation fields above. Such features are drawable in 2D; detailed nonrectangular feature construction remains unsupported. |
| `connections[].id/surfaceId/purpose` | Purpose is design; identities mostly bookkeeping | Connection ID may be omitted, and exclusive surface owner is generated. No AI-authored path box. Explicit legacy IDs remain accepted. |
| Endpoint `kind/entranceId/approachDistance/accessId/objectId/local` | Destination/contact/approach choices affect real circulation | Retain discriminated endpoint references. Named entrance/gate contacts are resolved by V3; dry-surface contact is authored once in that surface's local frame. |
| Connection `use/width/waypoints` | Circulation function, width and bends: design | Retained; omitted waypoints default to empty. V3 derives ribbons/bounds; it does not invent obstacle-avoiding detours. |
| `verticalCirculation[].id/type/hostMassId/fromLevel/toLevel/footprint` and rectangle fields | Stair/lift reservation and connected floors: design | Retained. Placement must fit actual host footprints and reservations must reach declared floors. No physical flight certification required for evaluation acceptance. |
| Vertical `stairType/direction/turn` | Later flight construction | Removed from advertised 2D schema. Existing explicit values remain supported. Optional exterior entries can fill only deferred details by reservation ID; cannot move/resize/rehost it or change connected levels. |
| Vertical `label/semanticRole` | Optional repeated prose | No longer advertised; compatibility preserves explicit values. |
| `requirements[].id/source/statement/metric/objectIds/range.min/max/value` | User/design commitments, not drawing geometry | Already allowed an empty array; collection is now omittable. Explicit obligations are preserved, never inferred or deleted to make a plan pass. Budget is intent, not a verified cost estimate. |
| `program[].id/role/kind/objectIds/source/access` | Repeated function grouping/access policy | Omission derives a design-sourced building program from each building's declared function. No inferred residence hierarchy or invented amenity program. Explicit programs remain authoritative. |
| `zones[].id/purpose/objectIds/allocationMode/allocation` and `allocation.x/z/width/depth`; `clearSpace.x/z/width/depth/baseElevation/height` | Optional reservations; independently drawn envelopes can duplicate member geometry | These were already optional. Not advertised in the compact prompt; explicit legacy reserved/clear-space geometry remains supported and audited. No automatic reservation rectangle is invented. |
| `forms[].id/objectIds/form/intent/minWidth/minDepth/minHeight` | Optional form/scale commitments | Already optional; compact drawing expresses actual shape directly. Explicit legacy commitments remain supported. |
| `relationships[].id/intent/from/to/kind` | Some relationships, particularly connected wings, carry real intent | Retained as optional. No mandatory duplicate relationship table for every geometric contact. |
| `considerations[].id/intent/objectIds/kind` | Optional view/privacy/landscape narrative | Already optional; omitted from compact prompt, preserved on explicit legacy input. |
| `roomAdjacencies[].from/to` | Optional explicit adjacency claims | Already optional; omitted from compact prompt, still accepted/audited on legacy input. Drawing actual adjacent zones does not require a duplicate claim. |

Necessary restrictions remain: finite positive dimensions, unambiguous referenced identities, valid connected line/arc outlines, actual host ownership, site fit, dry contacts, and circulation avoiding buildings/water. Local room overlap/outside-host findings remain visible under existing Draft rules. Full construction still checks actual stairs, openings, supported roofs and faithful geometry. Those are warranted construction constraints at the construction stage.

Expressive limits also remain honest: conceptual rooms are rectangles; outlines have lines/arcs without holes/splines; arbitrary curved mass unions and arbitrary independent per-storey outlines are unsupported. A courtyard can use arranged wings or articulated recesses. Building outlines are **not restricted to rectangles**. Roof-family/material/assembly restrictions belong to the later builder, not a requirement to author roofs in this evaluation. `/api/ai/house`'s unsupported-brief keyword gate is not invoked by the 2D route.

4. **What actually failed previously?**

Both real recovered mansion fixtures were read and replayed with current source. [Metrics](plan-authoring/metrics.json) records hashes, building/room counts and diagnostic inventories. The 20 October response contains a 24×18m rectangular main villa and 18×12m guest pavilion, 17 rooms, nine partitions and eight doors; the 21 October response contains a 24×18m main villa and 12×8m pavilion, 20 rooms, fourteen partitions and ten doors. Both authored rectangular footprints and zero facade assemblies. The source data does not contain an elaborate curved mansion that V3 secretly flattened.

The historical 20 October rejection included reused route-owner/feature identities, invalid main-entry references and an old uniform-storey restriction. These must not all be called bad architecture. Current identity normalization already separates route aliases; current lowering supports the original unequal storey heights. Those improvements predate this task and are not credited here.

There are genuine remaining contradictions: fresh audit inventories include room overlaps/outside-host zones, nonshared partition boundaries, inconsistent estate allocations and blocked routes. The 21 October source places pool east edge at x=-20.5m and terrace west edge at x=-18.5m: a 2m planar gap. Pool rim is 1.4m versus terrace top 0.18m: a 1.22m height difference. Those declarations do not describe connected flush poolside living. Calling the basin “infinity” does not author an overflow edge. The spare composition is also an architectural choice, rather than solely a transport or renderer error. Current build-first planning accepts these recovered examples with Draft findings; that is not a clean or habitable-design certificate.

The earlier paid **2D** failure has a different evidence limit. `first-live-plan-geometry/recovery-evidence.json` records 4,936 input and 6,026 output tokens, normal `stop`, but no recovered original design response. The captured error inventory rejected descriptive feature names (`paved arrival court`, `paved terrace`, `swimming pool`, `lawn`), then rejected dependent dry endpoints. Those are vocabulary/normalization failures; the current source already supports those aliases. The synthetic regression is not the lost paid plan, so neither its architecture nor all its geometric validity can be reconstructed.

The latest record, `failed-paid-2d/recovery-evidence.json`, is **HTTP 429**, stage `v3-plan-evaluation`, zero reported tokens, approximately 2.76 seconds. No original provider body/code or architectural response was recovered. Whether it was rate limiting or quota/account state is unknown. It is not evidence that Terra failed to design a blueprint. The present route tests separately exercise 429 subtypes, malformed JSON, schema failure, truncation, normalization failure and geometric rejection without conflating them.

5. **What changed?**

`src/lib/v3/architecturalPlanAuthoring.ts` adds a disposable authoring adapter over the existing plan schema. `expandPlanAuthoring` reserves supplied identities, generates collision-free missing IDs, derives entrance/program indexes and repeated metadata, and resolves only unique opening references. It preserves explicit legacy fields and rejects malformed data. Nothing is persisted as a second scene and no builder was added.

`architecturalPlanEvaluation.ts::planEvaluationPrompt` now advertises this compact input and explicit coordinate/default conventions. Reused JSON-schema definitions are referenced rather than repeated. `preparePlanEvaluation` expands input and requests reservation-only stair checks. `architecturalPlanFirst.ts::prepareV3ArchitecturalPlan` passes that scoped option; `blueprint.ts::auditV3Blueprint` uses reservation geometry/connectivity only when **both** `constructionEvidence:false` and the evaluation reservation option are set. Ordinary blueprint approval/construction retain full flight checks.

The same existing exterior schema now optionally accepts flight detail records keyed by an existing stair ID. `elaborateV3ArchitecturalPlan` rejects unknown/duplicate hosts, reservation geometry fields, and replacement of explicit flight decisions. `sameArchitecturalPlan` compares vertical reservation geometry/ownership/levels, excluding genuinely deferred type/direction/turn. This closes the otherwise broken handoff from conceptual reservations to real stair construction.

The implementation changes four pre-existing files: `architecturalPlanEvaluation.ts`, `architecturalPlanFirst.ts`, `blueprint.ts`, and the production route test. The new adapter, focused test, fixture and offline evidence script are additional files. `/api/ai/house`, the scene compiler, persistence, renderer, terrain and V2 were not modified by this task.

6. **How much smaller is the actual provider contract?**

| Measurement | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| Transmitted JSON schema, minified bytes | 20,883 | 13,139 | 37.1% |
| Schema without shared-definition compression | 20,883 | 16,574 | 20.6% |
| Complete system prompt, characters | 22,454 | 15,570 | 30.7% |
| Required root collections/fields | 11 | 4 | 63.6% |
| Required-key occurrences across inline schema branches | 200 | 143 | 28.5% |
| Property occurrences across inline schema branches | 279 | 225 | 19.4% |
| Equivalent estate fixture, minified response bytes | 9,495 | 5,023 | 47.1% |
| Fixture JSON property occurrences | 481 | 307 | 36.2% |
| Rough response tokens at characters/4 | 2,374 | 1,256 | 47.1% estimated |

Required-key occurrences are a schema-definition measure across alternatives, **not 200 simultaneous constraints in every response**. Required root fields are now `format`, `concept`, `site`, `buildings`; spatial audits still require appropriate entrances/circulation for the authored design. Fixture savings include omitting optional narrative/intent ledgers as well as bookkeeping. Token estimates are not model tokenization, actual usage, or a forecast of natural Terra output; the 10,000-token cap was not reduced. Both fixture versions have identical building/room drawing polygons on the estate, ground and upper-floor projections.

7. **Can the same 2D architecture now be described without detailed construction bookkeeping?**

Yes, offline. `src/lib/v3/__tests__/fixtures/plan-authoring-estate.plan.json` describes an articulated line/arc residence, separate atelier, two storeys of conceptual rooms, entrances, a gate, arrival court, pool/deck, gardens, canopies and five routes. It omits roof IDs, route owners, storey/room IDs, separate entrance/program tables, repeated role text and stair flight details. No runtime fixture/template is injected into the provider prompt. The fixture is an explicitly adapted example, not a natural model response.

Focused tests also accept the estate with all storey/door heights omitted and all feature heights deferred. Defaults are explicit and editable. Tests reject broken/ambiguous references, duplicate semantic identities, malformed/unsupported outlines, site violations and stair reservations outside their host or failing to connect floors. A later explicit exterior response can resolve flight details within the reservation; a physically impossible flight is rejected while preserving the saved plan.

The [optimized production browser proof](plan-authoring/ui/proof.json) uses real UI → HTTP handler → model adapter → SDK parsing, replacing only provider transport with fixtures and blocking external traffic. It verifies two isolated mocked responses (one plan, one explicitly requested exterior), no 3D canvas during evaluation, local diagnostics, editing, undo/redo/reload, unchanged saved geometry through construction, and an unrelated persisted-project sentinel. The [ground plan](plan-authoring/ui/02-ground-zones.jpg) was visually inspected. Existing old project/Draft compatibility is exercised by the broader suite.

8. **What remains unproven or incomplete?**

Natural Terra design quality, instruction following, response length, latency and success rate are unproven. No offline fixture can demonstrate that a $15m brief produces exceptional architecture. The two recovered original estates prove neither that the renderer discarded a sophisticated design nor that Terra is incapable of producing one.

This is still a bounded geometry system, not a full architect/BIM implementation. In particular, deferred **feature heights still need an explicit saved-plan decision before Build in 3D**, and nonrectangular outdoor features remain 2D-only. The pre-existing exterior contract cannot finish every arbitrary 2D feature. Schematic storey/door defaults become ordinary editable plan decisions; this change does not implement general later restacking. A conceptual stair reservation may still prove too small when the exterior flight is resolved; rejecting it is appropriate rather than moving the plan silently. Full automatic completion of any arbitrary estate is therefore not claimed.

The flagged 2D path now better supports Terra → authoritative 2D → deterministic normalization → existing massing → explicit exterior → editable V3 house. Normal Generate still asks for plan plus exterior in one authoring response. No deployment or runtime flag changes were performed.

9. **Is another paid evaluation justified?**

Not as the immediate next action while the latest 429 remains unexplained. A paid request cannot diagnose local schema complexity, and the missing earlier 2D response cannot be recovered by generating a replacement. Resolve provider readiness separately without mistaking a transport/account problem for architectural failure. After that, one explicitly authorized, capped **2D-only** evaluation would be meaningful to assess natural authoring and design quality under this smaller contract. Preserve the exact response and assess the drawing before requesting exterior work. No additional generation was authorized or performed here.

Validation commands, final counts and preservation checks are recorded in [checks.json](plan-authoring/checks.json). The production build used an isolated source copy, local font fixtures and an external-network guard; it did not disturb the existing development build or read account credentials.
