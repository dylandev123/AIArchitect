# Coordinated assemblies exposed to Terra

Implemented locally with **zero OpenAI calls**, no migrations, commits or deployment. Retained projects and both live responses remain unchanged; SHA-256 evidence is in `verification.json`.

## Callable capabilities

The production JSON operation schema now accepts `assemble {assembly:{kind,parameters}}`. The shared contract currently has two versions of construction:

- `residential-wing`: a single rectangular storey with a real floor root, solid rear/side walls, segmented front wall bays, separately editable glazing and reveals, an optional fitted entrance bay, and a flat, gable or hip roof. Inputs are stable ID, position, yaw, width/depth, enclosure height, bay count, material, roof form/rise/overhang and optional entrance bay. Coordinates are metres and yaw is radians.
- `rectangular-pool`: basin floor, four walls, water, coping and a continuous dry deck circuit, adapted from the retained construction proof. Inputs are stable ID, near-deck centre, yaw, basin width/depth, basin depth and material. The prompt documents the offset between the deck root and basin centre explicitly.

The existing wing helper was developer-only and already coordinated child positions, dimensions, wall openings, glass, floor and roof. It did **not** implement multiple building levels, circulation, entrances, room planning, shared-wall joins or parametric editing. This integration adds an optional front entrance and a shared expansion boundary, rather than claiming those missing capabilities already existed.

`scale-assembly {id,factors:[sx,sy,sz]}` scales the existing descendant hierarchy, including openings and independently edited children. Plan factors must match (`sx=sz`) because nonuniform scaling of rotated wall frames is unsupported. Vertical scaling also changes slab thickness; root elevation must be reseated explicitly when needed. Existing move/rotate carry the hierarchy. Ordinary resize still changes just the selected part. There is no hidden regeneration that overwrites child edits.

## Engine and homepage request path

Homepage Generate (`src/app/page.tsx`) creates a direct-scene project and retains the brief. WorkspaceShell opens OperationStudio, which consumes that brief, builds `generationSceneRequest`, and POSTs `/api/ai/scene`. The route passes `sceneResponseFormatSchema` to `Output.object` and the existing provider. Both assembly kinds and scale-assembly are included in that **actual provider-facing schema**, including strict nullable Redesign/Complete schemas. Instructions and a wing example are supplied by `sceneSystemPrompt` in every mode. Knowledge retrieval remains on the same route.

Offline SDK transport tests execute an assembly response through that real route separately for Generate, Refine, Redesign and Complete Architecture. These use mocked transport, never OpenAI. Schema audit covers nested assembly branches and strict object conversion; normalization uses the assembly kind discriminator.

`stageSceneOperations` parses the shared contract, expands assembly requests to ordinary add operations, enforces the expanded operation budget, and writes them through its existing loop. `applySceneOperations` retains the authoritative atomic relationship check. There is no additional scene writer, mesh engine or JavaScript execution surface. Final scene limits still apply (400 elements / 800 operations).

## Relationships, datums and shared junctions

Assemblies use existing parent/local transform semantics, attach/place-on operations, scene spatial references and architectural-plan relationships. A root and every child have stable scene IDs; a courtyard can reference surrounding wing roots, an entrance its fitted child, and a terrace or manually authored stairwell its own parts. These references describe intent; they do not automatically create an accessible passage or support.

Wing roots retain a small `assemblyKind` provenance field through serialization. Existing oriented-rectangle relationship checks reject newly introduced touching/overlapping assembled wing floor envelopes and intersecting cross-owner roof envelopes including eaves. These checks also run after move, scale, child edits and reload followed by edits. Shared boundaries are **rejected**, not resolved by deleting walls, trimming roofs or moving architecture. Roof checks are deliberately conservative: overlapping plan envelopes at different elevations, stacked assembly roofs and overlapping entrance canopies can also require explicit primitive construction. This is not a roof Boolean/intersection solver. Existing unrelated faults remain governed by the executor's unchanged incremental-edit policy.

Separate wings can compose a courtyard or detached pavilion arrangement. A physically joined wing, arcade, stairwell, terrace passage or complex entrance must currently be constructed explicitly with ordinary parts and validated together. This limitation is preferable to silently inventing a join.

## Retained live scenes and prevention limits

Sources: `distinct-houses/A` (Luminous Reef Estate, tropical) and `distinct-houses/B` (Casa della Corte Ombrosa, Mediterranean), including their raw provider responses and unapproved scenes. They are read only.

- Tropical retained findings reproduce blocked stair headroom against `upper-suite-floor`, a likely blocked upper-suite/terrace passage, and basin perimeter gaps. The pool assembly establishes water/freeboard/basin/deck datums and could prevent those pool assembly mistakes. A wing hierarchy keeps enclosure, glass and roof aligned during edits. It **does not prevent the stair or internal room-access defects** because it has no stair or room solver.
- Mediterranean retained roof envelope analysis finds overlaps between living/west/east roofs and west/east/north roofs; it also records the entrance canopy overlap as plan evidence rather than a certified mesh collision. New assembled-wing combinations with those overlapping envelopes would be rejected clearly. No automatic hip/gable union is claimed. Weak arcades remain unsupported as an assembly; rectangular posts and beams remain manually available.
- The verified stair example is a specific flight, landing and preselected slab-void transaction, not a reusable arbitrary-host stairwell builder. It is intentionally not exposed as a generic assembly. Entrance support is limited to a fitted door bay, not a complete arrival solver.

## Offline proofs and editability

`tropical.operations.json` and `mediterranean.operations.json` use the actual model-accessible assemble operation. Their resulting scenes contain 56 and 42 ordinary editable elements respectively. One is an offset flat-roof composition with a pool; the other uses pitched wings framing an open court. Both have zero relationship issues and zero focused construction findings. These are exterior construction studies, **not complete houses**, manually repaired originals or Terra-generated quality successes.

Tests cover child identity, independent child/material edits, whole-wing move/rotation/scaling, roof property changes, unchanged unrelated geometry, collision and duplicate-ID rejection, budgets, project Undo/Redo and JSON reload. Pool tests additionally prove basin boundaries, depth and continuous one-metre dry access for three basin proportions.

Browser evidence uses an isolated temporary source copy and browser context; external and API network requests are blocked. Four matched-camera screenshots show actual workspace rendering, all expected selectable child IDs and finite mesh coordinates. The browser edit test uses one locally fulfilled operation response to exercise whole-wing move/scale with no live inference, alongside direct child selection, material/roof edits, Undo/Redo and reload. See `browser-result.json` for exact results. This is not a browser Generate call to Terra.

Validation: **156 tests passed across 23 files**, plus `tsc --noEmit` and ESLint on changed implementation and proof files. Tests use offline mocks. Browser screenshots and the verification JSON are retained alongside this report.

## Controlled live test

One controlled, separately authorized live test is technically justified to check whether Terra chooses and composes assemblies under the new schema. It has **not** been run. It should retain the exact request, raw response, operations, scene and construction findings as a separate unapproved candidate, with no automatic retries. It cannot establish stair, room-access, arcade or shared-junction correctness. The present evidence establishes accessibility and execution of the capability, not model adoption or improved live architectural quality.
