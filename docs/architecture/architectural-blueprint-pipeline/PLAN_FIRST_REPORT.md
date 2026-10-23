# Authoritative 2D plan → V3 construction

21 October 2026. Offline implementation; no Terra/OpenAI requests, paid generations, commits, pushes, deployments, flag changes, V2 changes or advanced-terrain changes.

## 1. Root cause and what was reused

The earlier Planning Studio projected existing V3 semantics into a useful editable drawing. Terra still returned **one complete blueprint containing site, rooms, roofs, facade detail and amenities together**. Prompt instructions described an internal design order, but there was no independently consumable plan contract, plan-only gate, or actual massing checkpoint. Switching presentation modes could not establish that architectural planning preceded construction.

Building locations/outlines, host-local room allocations, feature placements, explicit zone allocations and route bends were separately authored in that document. Each could be individually legal yet spatially incoherent. Facade spans were independently chosen relative to walls; entrance records referred to those later facade decisions. Roof world positions and route endpoint contacts were already derived correctly; they did not need another coordinate system. Roof *family*, facade addresses and outdoor datums still required compatible authoring decisions.

The recovered $15 million estate specified two rectangular buildings, no facade assemblies, limited roof articulation, a raised pool separated from its terrace and unresolved local access/interior details. V3 substantially followed that specification. Terra's underdeveloped spatial composition was the primary problem; contract limits on planting, material zoning, pool equipment and architectural detail constrained the ceiling. Rendering amplified the schematic appearance. There was no hidden magnificent design for the renderer to recover.

Existing line/arc and articulated footprints, named architectural geometry, semantic storeys/rooms, entrance-derived routes, explicit hosted roofs, facade assemblies, draft diagnostics, production compiler/renderer, replan/three-way merge, undo/redo and project persistence were sufficient for this milestone. No second construction engine was necessary.

## 2. Actual authoring contract

New flagged flat-site production requests now require `v3-plan-first-1`, containing **plan followed by exterior**. Legacy complete blueprints are rejected for new authoring, while the original offline recovery/blueprint functions remain usable.

`plan` is a separately parsable `v3-architectural-plan-1` document. It owns site boundary/orientation/access, conceptual identity, building locations and exact footprints, stable storey and room-zone identities/rectangles, ordered storey heights and double-height intent, entrances and their wall spans, vertical circulation reservations, outdoor-feature footprints/datums, canonical route references/bends, room adjacencies and estate relationships/requirements. A reserved `roofId` establishes identity without deciding roof geometry.

`exterior` owns finish bindings, roof families/pitch/overhang/thickness, non-entrance facade openings, host-relative assemblies, and optional detailed partitions/internal doors. It must address each planned building, feature and connection exactly once. Its strict schema cannot contain locations, footprints, storeys, room extents or route geometry. Planned entrance addresses cannot be repeated or overridden in exterior openings.

The prompt retains architectural freedom while requiring actual geometry to express hierarchy, arrival, privacy, views, climate response, composition, room relationships and outdoor integration. It clarifies centred room/stair coordinates, metre-valued internal-door offsets and pool base/rim datums. Rectangles remain valid choices; no style, amenity checklist or production mansion template was added.

## 3. Authority and persistence

The input plan lowers losslessly into the existing V3 semantic fields: named `architecture`, exact `composition.footprint` segments/operations, `interior` storeys/rooms/circulation and `estatePlan` entrances/features/routes. These fields are the persisted, editable plan authority used by all views. A second mutable plan geometry is **not** saved alongside them.

`inspectV3ArchitecturalPlan(scene)` reads the current plan directly from those persisted fields, including exact segments, floor-specific drawing polygons and room datums. Workflow metadata records provenance/stage without holding another coordinate copy. The evidence directory contains immutable stage checkpoints; those are demonstration artifacts, not competing live authorities. Local replanning now preserves structured workflow provenance and usage metadata that the provider compatibility normalizer otherwise discarded.

## 4. Gate and construction sequence

1. `prepareV3ArchitecturalPlan` validates the 2D input and identities, resolves endpoint references, checks primary access/program, supported geometry, dry contacts, site fit, allocations, rooms and stairs using the existing plan audit with construction evidence disabled. **No detailed compiler runs at this boundary.** Future roof references remain explicit deferred identities.
2. The resulting plan scene is separately inspectable. Core-invalid geometry stops massing while retaining that scene for diagnostics. Local room/allocation/secondary-route problems use the existing explicit draft policy and do not erase the building or silently clip rooms. Route-owner aliases receive the existing deterministic identity correction; selectable route envelopes remain derived.
3. `constructV3PlanMassing` uses the ordinary `compileV3Scene` on the same named footprints/heights. The massing projection omits exterior roofs/assemblies/partitions and normalizes finishes for inspection. No alternate extrusion engine redraws the plan. Supported articulated operations targeting ground/upper floors retain their distinct outlines; arbitrary independent storey polygons remain unsupported.
4. `elaborateV3ArchitecturalPlan` attaches exterior choices by planned identity. The existing blueprint approval/construction and receipt checks then construct walls, glazing, assemblies, hosted roofs and supported amenities. Plan geometry is compared before exterior construction and again against the resulting scene. Drift refuses publication.
5. Existing Complete/Draft/Cannot Construct classification still describes actual supported construction. Local defects remain editable; a valid plan is not a certificate of fully finished private interiors or architectural excellence.

The generation orchestrator emits copied plan, massing and exterior checkpoints through `onStage`. Production uses the same orchestrator behind the unchanged `AI_V3_ARCHITECTURAL_BLUEPRINT=1` flat-site flag. Failure responses retain a separately named `architecturalPlan` when available. GET diagnostics and saved contract metadata identify the new contract. The legacy pipeline response header remains the existing branch identifier.

## 5. Views and editing

The ordinary workspace now offers **2D Floor Plan → 3D Massing → 3D Blueprint → Finished House**. New plan-first results open in the estate plan. Massing is a transient projection of current semantic data, never another saved scene. Blueprint and finished views retain the production renderer and identical constructed geometry.

The footprint editor is available through a building's Advanced Properties. It accepts the supported rectangle/articulated/line–arc plan JSON and calls the existing lossless checkout/replan path. Walls, floor plates, hosted roof and entrance-derived route contacts update together. Unsupported changes fail atomically. Existing room, height, placement, opening, material and JSON editors remain available. Undo/redo and reload use ordinary project history and storage.

## 6. Offline demonstration and traceability

The explicit Lantern Garden capability example was adapted into **separate plan and exterior source files**, transparently retaining its hand-authored provenance. It has a recessed west library wing, inhabited curved eastern wing, two room-planned floors, a subordinate atelier, arrival court, garden shelter and dry terrace around an offset pool. Neither source file is imported by production authoring. This is not a natural Terra success or a hardcoded generation template.

Run `npx vite-node --config vitest.config.mts scripts/plan-first-evidence.ts`. It forbids fetch, saves/reloads `01-plan.json` before compiling massing, and reads the exterior source only after massing exists. It then tests the production generation orchestrator with one offline author response. The observed sequence is plan → massing → exterior. The demonstration emits 99 massing primitives and 193 finished primitives; these counts are descriptive, not quality metrics.

[Proof and per-building traces](plan-first/proof.json) record exact footprint segments/polygons, massing part IDs, finished wall IDs, roof IDs/host IDs and roof part IDs. Existing independent construction receipts report no geometry loss. Changing the atelier footprint from 12 × 10 m to 13 × 10 m updates both building and hosted roof, preserves room IDs, and survives JSON reload.

Production-browser verification uses an isolated local-storage context against an isolated optimized build, with AI/provider and project APIs blocked. It checks actual floor-plan selection, footprint editing, undo/redo, exact persisted reload, view/history invariance, and 192 common mounted meshes whose geometry agrees between blueprint and finished views. There were zero page errors and zero attempted forbidden requests. [Capture manifest](plan-first/capture.json).

| Stage | Inspected production workspace capture |
| --- | --- |
| Initial 2D estate plan, no explicit roofs | [Master plan](plan-first/estate-master-plan.jpg) |
| Initial conceptual ground-floor layout | [Ground floor](plan-first/ground-floor.jpg) |
| Initial conceptual upper-floor layout | [Upper floor](plan-first/upper-floor.jpg) |
| Massing compiled from the saved plan | [Massing](plan-first/massing.jpg) |
| Exterior architecture in neutral view | [3D Blueprint](plan-first/exterior-blueprint.jpg) |
| Existing finished renderer | [Finished exterior](plan-first/finished-exterior.jpg) |
| Edited plan, massing and exterior | [Plan](plan-first/edited-footprint-plan.jpg), [Massing](plan-first/edited-footprint-massing.jpg), [Finished](plan-first/edited-footprint-finished.jpg) |

Visual inspection confirms that the curved east end, recessed west wing, atelier, arrival and pool arrangement persist across stages. Compared with the recovered two-box estate, the example has a more articulated silhouette, actual curved glazing/loggia, roof/material hierarchy and a pool integrated with its deck. It remains a schematic architectural example, with sparse facade composition and generic landscape scatter; it does **not** demonstrate exceptional $15 million architecture. Changing the workflow does not make this old hand-authored reference a new model-quality result.

## 7. What can no longer contradict the plan

Exterior authoring cannot supply a replacement building origin, yaw, footprint, floor count/height, room allocation, stair reservation, amenity position or route geometry. It cannot replace a curved outline with a rectangle or move an entrance while retaining a stale arrival contact. Roof position and outline derive from the same host. Only declared exterior choices are added; ordinary validation still checks their compatibility.

Room containment, door usability, support and local architectural detail still require validation and explicit editing. The plan geometry comparison protects data authority; the independent production construction receipts also check what the existing compiler actually emitted.

## 8. One-call boundary and cost

One existing authoring call now returns two structurally distinct dependent documents, followed by genuinely separate **local** planning, massing and exterior-construction stages. The SDK still buffers that response. This does not prove Terra's hidden reasoning order, provide a live streamed plan while Terra is still authoring, or allow human feedback to influence later AI exterior choices within the same call. The user can inspect/edit all stages in the workspace after the response.

No additional creative AI call was introduced. The existing single bounded objective stair/route repair remains available, with immutable plan/exterior fields protected and both attempts retained. A later architectural critique/redesign call would be a new paid decision and remains unimplemented and unauthorized.

The reproducible character counts are in `proof.json`; dividing by four is only an approximate token estimate, not billing/tokenizer evidence. The one-response envelope adds schema/ID overhead rather than a second creative request. Natural-model output size, acceptance rate, latency, design quality and current provider pricing were not measured.

## 9. Remaining limits and paid-generation decision

Independent arbitrary per-storey polygons, footprint holes, complex joined roof groups, spline walls, arbitrary stacked-host round trips, facade material zoning, bespoke part finishes, authored planting/species layouts, engineered infinity edges, threshold steps/ramps, furniture and comprehensive room navigation/egress remain outside this milestone. Supported ground/upper articulated setbacks are tested. Local diagnostics are software acceptance findings, not structural, planning or code approval.

**GO for this offline plan-authority/construction milestone. NO-GO for another paid mansion generation on the expectation that exceptional architecture is now proven.** The flagged production path uses the exact new sequence and remains opt-in; no flag was enabled here. A later separately authorized, capped natural-model evaluation is needed to assess independent planning quality. Another AI call is not necessary for the supported deterministic workflow; model critique or creative revision would require explicit authorization and cost limits.

## 10. Validation and preservation

**Final validation: 2,354 tests passed, 3 skipped, across 194 test files; 52 focused plan/production-route tests passed. TypeScript, zero-warning ESLint, optimized production build and whitespace checks passed.** See [validation record](PLAN_FIRST_CHECKS.json) for the full suite, focused regression checks, TypeScript, zero-warning ESLint, optimized production build, whitespace checks and source preservation. The build ran in an isolated source copy, with existing Google Fonts fetched after the sandbox-only attempt failed. No credentials were copied into that build directory.

Both original recovered blueprint files retain their recorded SHA-256 values in `proof.json`. All pre-existing unrelated modified/untracked source and evidence files were compared against the pre-task hash inventory. Saved browser projects were never opened or modified. No original evidence was used as an editable production fixture.
