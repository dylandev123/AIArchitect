# Direct architectural scene prototype

Open `/dev/villa-playground?scene=ladera` on the existing development server. This is an isolated, development-only Playground mode. Generation routes and existing house formats remain available. No paid calls, V3 edits, migrations, commits or deployment.

## What Solana actually does

`architecture.tsx` directly composes `FinishBox`, `Box`, `Glazing`, `Roof`, `Slats` and `Sofa`. The ground salon, upper suite, entrance portal, dining pavilion and belvedere have separately positioned floors, wall blades, glass and roofs. There is no generic enclosing house box. Back windows are masonry sills and headers around real empty space. The entry has separate stone piers, timber pivot door, sidelights and overhead glazing. Roofs combine a light fascia, recessed teak soffit and upper cap. Repeated slats use instancing. Furnishings behind transparent glazing give scale and depth. Stairs and balcony glass are independently constructed. The grounds are separately authored and contain architecture-specific rooftop planters, so reusing them unchanged produces collisions with a new house.

This suggests a small vocabulary of construction parts, rather than further footprint families or architectural acceptance rules.

## Prototype and authoring contract

`src/lib/villa/scene/model.ts` defines a strict JSON scene with stable IDs, metre coordinates, yaw rotations, dimensions, optional parent-relative attachment and named finishes. Kinds: plate, wall, roof, glazing, balcony, entrance, screen, sofa, volume and water. A wall can have a rectangular opening with explicit offset, sill, width and height; the renderer builds jambs, sill and head around actual empty space. Glass is optional. Multiple openings can be constructed from several wall elements today.

Transactions support `add`, `replace`, `remove`, `move`, `resize`, `finish` and `attach`. Parsing rejects unknown fields, executable operations, nonfinite or out-of-range numbers, duplicate IDs, missing parents, cyclic attachments, invalid openings and unknown edit targets. Transactions validate the final scene before returning it. An unsuccessful transaction leaves the source untouched. Unchanged data objects retain identity. Removing a referenced parent requires removing or reattaching its children in the same transaction. Attach changes local coordinates explicitly; it does not auto-snap or preserve world coordinates.

Bounds are resource/syntax constraints: 400 elements, 100 operations per transaction, finite positions and bounded dimensions/repetition. No footprint, wing, style, roof-stack or house-composition family is required. These checks do not certify structure, circulation, weatherproofing or code compliance.

[Complete deterministic input](ladera.scene.json), [scene JSON schema](scene.schema.json), [edit transaction](edits.json), [edited result](ladera-edited.scene.json). The renderer dispatches whitelisted operations to existing R3F components; JSON never becomes JavaScript. Terra could emit this scene or edit transaction directly in a future provider integration. The current provider prompts/routes are deliberately unchanged; this proof uses deterministic data and button-driven mock edits only.

## Casa Ladera

78 independently identified elements describe a different composition from Solana: a low west salon, shallow east dining room, recessed bridge suite, offset stone lantern, long front balcony, timber-screened terrace and exterior garden stair. Dimensions and placements are explicit choices in `example.ts`, which is a deterministic authoring fixture, not a required renderer template. Arbitrary valid imported scenes use the same renderer. The garden uses existing palms, planters and loungers as fixed presentation staging; they are outside the editable house document.

[Poolside](ladera-poolside.png) · [Arrival](ladera-arrival.png) · [Aerial](ladera-aerial.png) · [Garden](ladera-garden.png)

The UI offers click/select by element, position and dimension edits, finish changes, undo, reset and JSON import/export. Roof extension changes just `bridge-roof`; screen movement changes just `suite-screen`. The browser proof checks that all 78 Three.js group UUIDs survive those edits, verifies the changed screen position and undo, and captures the result. React may rerender descendants; this demonstrates stable scene objects and local data edits, not an optimized incremental geometry compiler. JSON import/export provides persistence; this prototype does not modify the existing design-store schema.

[Edited house](ladera-edited.png) · [Browser evidence](browser-checks.json)

## Visual comparison

| Capture | Assessment |
| --- | --- |
| [Solana](solana-poolside.png) | Stronger monumental entrance and more detailed interiors, lighting and landscaping. Its unequal pavilion heights, deep soffits and solid/glass balance explain much of its appeal. |
| [Ladera](ladera-poolside.png) | Similar construction detail in a different arrangement: broad horizontal shade, a recessed upper volume, selective timber screening and a compact tall stone accent. The terrace reads as an outdoor room rather than an automatically appended strip. |
| [Recent angular study](angular-volumes-before.png) | Long repeated glass bays and disconnected-looking roof steps dominate; the exterior lacks a comparable hierarchy of entrance, shade and occupied terrace. |
| [Recent branching study](branching-levels-before.png) | A tall pile of glazed tiers with repeated rails and roof furniture reads more as stacked display boxes. Adding levels has not produced convincing domestic composition. |

These are subjective design observations, not an architectural quality score. The recent cases are retained offline studies, not freshly generated results. All use the existing daylight rendering environment and Poolside view selection, but their framing and grounds differ; this is a qualitative composition comparison, not a matched-pixel experiment. Ladera still has simplified furniture, flat roofs and incomplete stair/landing/guard detailing. A pleasing exterior does not prove a resolved inhabitable house.

## What remains to add

Terra can already choose independent wall/plate/roof proportions, positions, rotations, open versus solid facades, glazed corners, entrance size, balcony geometry, screen rhythm, local material selection and hierarchical attachments. Existing `PitchedRoof`, `Arch`, footprint triangulation and precise-facade geometry are good sources for future operations.

Next geometry operations should cover polygonal plates with holes, multiple/arced wall openings, curved walls/glazing, parameterized hip/gable/shed roofs with ridge orientation and junction trimming, explicit stair flights/landings/guards and endpoint wall connections. Parent attachment currently expresses a transform connection, not a structural joint. Material presets are intentionally small; glazing, balcony frames, sofas and water retain their existing component finish behavior. Roofs support ivory and other solid finish presets with a timber soffit. Element rotation is yaw only. Existing arbitrary mesh/code creation is not exposed through this vocabulary.

## Reproduction

- `npx vitest run src/lib/villa/scene/model.test.ts`
- `npx tsc --noEmit --pretty false`
- `npx eslint src/lib/villa/scene src/app/dev/villa-playground/operation-scene.tsx src/app/dev/villa-playground/operation-studio.tsx`
- `npx vite-node --config vitest.config.mts scripts/scene-operations-evidence.ts`
- With the dev server running: `SCENE_PROOF_URL=http://localhost:3000 node scripts/scene-operations-capture.mjs`

The capture script blocks all `/api/ai/` and nonlocal requests, checks browser errors, and exercises local edits and undo. Its Playwright/Chrome paths follow this workspace's existing capture scripts. Four focused transaction tests pass; TypeScript and focused lint pass. Browser results are recorded separately in the evidence JSON.
