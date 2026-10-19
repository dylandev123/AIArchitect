# V3 Estate Master Planning v1

V3 now carries optional, authored `estatePlan` intent. It does not generate geometry or replace the scene as the authority. Old projects remain plan-free; loading and normalization never infer a plan.

## Contract

`estatePlan.version` is 1. `concept` and `character` describe the property. `requirements` separate user constraints from design choices, retaining original statements, optional numeric ranges/value and stable object references. `program` names the residence, secondary buildings, amenities and landscape. `zones` use freely named purposes, object allocations in world X/Z and optional reserved clear volumes. `circulation` names arrival, pedestrian or service purposes using object chains. `relationships` express intended graph edges. `considerations` retain views, privacy, landscape and intentional open-space intent.

No zone taxonomy, architectural style, number of buildings or amenity list is mandatory. Plan IDs and object IDs are distinct namespaces. Plans are editable via the validated, atomic `replaceEstatePlan` operation. Ordinary object edits preserve the entire plan; deleting a referenced object produces a localized warning rather than destroying the plan or blocking unrelated edits.

Both flat and advanced generation prompts request concept and estatePlan before detailed objects in the same response. No additional planning call or larger retry allowance is introduced. Explicit floor areas, dimensions, bedrooms, budget, style and amenities take precedence; the US$5–10M mansion reference remains conceptual ambition, not a cost estimate. The output schema remains optional for compatibility with older payloads.

## Fulfillment and repair

The pure estate audit checks missing references, building program types, rotated footprints against allocations, allocations against site dimensions, declared relationship edges, access chains, separation of standalone access footprints, occupied reserved clear volumes, gross floor area, site dimensions and semantic bedroom counts when available. Budget/style and unavailable measurable evidence produce an explicit unverified advisory, not a claim of compliance. Generic feature fulfillment means its referenced authored objects exist.

Structural corruption is rejected, but fulfillment conflicts remain warnings in normal validation/save/edit paths. Significant objective findings join the existing single bounded design revision. A failed or unsafe revision retains the original renderable scene. Plan absence and missing optional luxury amenities never trigger estate repair.

The preservation guard permits exact missing referenced objects, exact missing planned graph edges, local path corrections and placement/size corrections to conflicting nonbuilding objects. Existing objects cannot be removed or renamed; unrelated geometry, materials, roofs, graph edges and estate intent stay protected. Building dimensions and site constraints are not automatically rewritten to clear a warning. A conflict needing such a change remains visible for an explicit user edit.

## Offline acceptance

Fixtures cover a rotated solitary limestone residence in meadow, a dispersed residence/guest-lodge/atelier estate, and a compact three-storey urban mansion with a private garden. Tests exercise normalization, real project-store save/reload, stable references, local material edits, explicit plan edits, missing program, rotated allocations, reserved-space conflicts, access, requirement limits and repair preservation. An API-route test mocks the model and verifies the same two-call maximum for an estate repair. Three captured mansion scenes remain plan-free and compile identically after serialization. No construction geometry is added to persistence.

## Limits and next validation

This is a semantic planning layer, not a cost estimator, zoning/code checker, navigation mesh or aesthetic scorer. Floor area uses gross mass footprints times storeys and does not subtract overlapping mass volumes or voids. Bedroom evidence depends on authored semantic rooms. Views and privacy are retained intentions, not ray-traced guarantees. Free-text requirement extraction still depends on the generator; the audit cannot detect a requirement omitted from the plan. Rectangular allocations and clear volumes do not measure all usable outdoor space. Standalone access uses plan-footprint proximity; hierarchy-owned routes retain the existing hierarchy audits. It does not prove continuous door-to-door, vertical or vehicle access. There is no dedicated estate-plan editor UI in this version.

A later, explicitly authorized live generation is justified to measure whether Terra follows the new concept-first contract and produces richer property-wide plans within the existing output budget. It is not needed for offline acceptance and was not run for this implementation.

## Verification result

Final offline run: 159 test files passed, 2 skipped; 1,861 tests passed, 3 skipped. `npx tsc --noEmit`, `npm run lint` and `git diff --check` passed. The full suite includes V2 and terrain regressions. No Terra/OpenAI calls, commits, pushes or deployments were performed. Pre-existing completeness work in the workspace was retained.
