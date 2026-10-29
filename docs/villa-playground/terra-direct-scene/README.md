# Terra direct architectural construction — offline audit

Entry point: `/dev/villa-playground?scene=ladera`, using Generate scene / Edit scene. This is an explicit independent authoring mode; existing text-first villa, image-first and Villa Playground composition workflows remain available. Existing designs are neither migrated nor reinterpreted. No V3 files, migrations, commits or deployment were made.

## Authoring path

`OperationStudio → POST /api/ai/villa/scene → sceneRequestSchema → existing getAiModel / withUsageLogging / generateText → sceneResultSchema → resolveSceneResult → applySceneOperations → validateScene → OperationScene`.

The client validates/replays the returned operations before committing. Only JSON data is accepted; unsupported element kinds, unknown operation fields, executable-code payloads, invalid openings, nonpositive dimensions, duplicate IDs, missing parents and cyclic attachments fail atomically. There is no fallback geometry or model retry. A truncated provider response cannot commit a partial scene.

Terra can construct plates/floors, rectangular walls with a real opening, flat roof planes, glazing, doors, balcony glass rails, vertical screens, explicit volumes, sofas and water surfaces. It can add, replace, remove, move, rotate, resize, finish, attach and detach elements. Replace retains the ID and supports opening edits. Attachment coordinates are parent-local; detach requires explicit world placement. Removing a parent requires removing or reattaching its dependents. Unaffected element data and React/Three identities remain stable under targeted edits.

Generation starts with an empty scene, never a template. Edits receive the current authoritative scene and request targeted operations. Scene JSON persists in the separate `terra-direct-scene-1` localStorage key and can be exported/imported. Undo restores the prior scene and its persisted snapshot. Undo history itself is session-local. This is not workspace/cloud design-library integration. A failed request preserves the existing scene; unlike the older villa endpoint this endpoint has no paid-result recovery archive.

## Restrictions bypassed or changed

Neither API, prompt, executor nor renderer imports the legacy villa/composition/footprint/stack schemas or their geometry correction. The independent path does not impose style/roof compatibility, main/guest wing hierarchy, 15-degree/cardinal orientation, prescribed facade rhythm, gallery alignment, roof clearance, storey alignment, automatically generated floors, two-storey wing limits or four-storey stack limits. Shapes are assembled explicitly from supported primitives. Legacy validators remain intact for legacy designs.

The original scene engine's ±100m coordinates and 60×30×60m size caps were replaced with ±10000m coordinate / 10000m dimension safety bounds. Opening bounds now follow the same range and must still fit their wall. Angles permit multiple turns. Transaction capacity increased from 100 to 800 operations, enough to populate a complete 400-element scene and perform replacement transactions. Added a reusable rotate operation; whole-element replacement remains available. Provider vectors use length-three homogeneous arrays, avoiding unsupported tuple JSON Schema. Schema generation is tested with the actual AI SDK adapter.

Retained performance/integrity bounds: 400 elements, 800 operations per transaction, 40 panels per element, finite bounded coordinates/dimensions, stable slug IDs and valid acyclic relationships. These are scene/data budgets, not architectural family rules. No structural or spatial collision validation is claimed: overlapping/cantilevered elements can be intentional.

## Acceptance evidence

Casa Ladera is replayed as add operations through the Terra resolver and mocked API route, with exact scene equality. The browser generates it through the actual Terra-facing editor with a mocked response.

`turning-lantern.operations.json` creates a different 43-element composition: five offset floors with independently chosen noncardinal rotations, explicit enclosures, five wall openings, glazing, decks, rails, entrance and privacy screen, plus an elevated diagonal bridge. This is impossible under legacy wing storeys (1/2), cardinal main-wing placement and the stack validator's maximum four storeys and aligned parent-derived elevations. It is an architectural representation test, not a structurally engineered or circulation-complete building.

Browser evidence: [Ladera replay](ladera-terra-replay.png), [lantern aerial](turning-lantern-aerial.png), [lantern poolside](turning-lantern-poolside.png), [checks](browser-checks.json), and [persisted editable scene](turning-lantern.scene.json). The script blocks external requests and intercepts all AI endpoint requests. No live OpenAI calls were made. It verifies real Three.js element groups, attachment hierarchy, wall-opening segment meshes, stable UUIDs during a targeted edit, unchanged unrelated element data, undo and reload persistence. Screenshots are actual WebGL browser renders.

Run:

```
npx vitest run src/lib/villa/scene src/app/api/ai/villa/scene src/lib/villa/composition.test.ts src/lib/villa/image-first.test.ts src/app/api/ai/villa/route.test.ts src/app/api/ai/villa/route.metadata.test.ts
npx tsc --noEmit
node scripts/terra-direct-scene-capture.mjs
```

The browser script uses the existing local Playwright installation and Chrome, and defaults to the existing server at port 3000 (`SCENE_PROOF_URL` overrides it). Existing workflows are covered by their offline regression tests, not a new live generation.

## Remaining limits and live readiness

This is not unrestricted geometry. Elements are rectangular and support yaw only. No arbitrary polygonal/curved solids, pitched/curved/domed roofs, arbitrary mesh, CSG, multiple openings on one wall, custom material palettes, engineering checks, automatic stairs or automatic circulation/interiors. Split wall elements can represent multiple openings. Glazing/rails/screens/sofas/water use specialized renderers rather than general solids; sizes and finishes have semantic renderer behavior. There are no terrain/site operations on this path; Ladera garden staging is presentation context, not Terra-authored landscaping. Current camera presets suit villa-scale work and do not automatically frame very large scenes.

The integration is ready for one controlled live **development-mode** Terra generation using the existing configuration, within these primitive limits. That statement means the transport, validation, persistence and rendering path are offline-tested; it does not establish live model design quality, response-budget sufficiency for 400 elements, structural feasibility or production readiness. No live generation was performed or authorized as part of this validation.
