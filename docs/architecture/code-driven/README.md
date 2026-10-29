# Code-driven architecture audit and offline implementation

These are developer-authored capability studies, not autonomous Terra results, approved designs, completed homes or production templates. No paid calls, migrations, commits or deployment. Existing project records and retained model responses were not edited. The working tree already contained substantial architectural work; this change builds on its current state.

## 1. Why the original houses looked better

Villa Solana is handwritten architectural composition, not a special superior generation engine. `TropicalVilla`, `UpperSuite`, `Entrance`, `GardenStair`, `LivingRoom` and `DiningRoom` in `src/components/scene/architecture.tsx` coordinate exact dimensions and datums. The broad low salon, recessed upper suite, tall narrow arrival portal, subordinate dining pavilion and offset belvedere establish hierarchy before details. Glazing turns corners, opaque blades anchor elevations, timber soffits express roof depth, screens create shade, and furniture gives scale. Entrance blades, lintel, sidelights, transom and canopy form an assembly rather than a solitary door. `Roof`, `Glazing`, `FinishBox`, `Slats` and `Sofa` are reusable React/Three components; room placement and most dimensions are authored directly. Repetition comes from loops, not an architectural solver.

Other studies use a different method: `COMPOSITION_EXAMPLES` in `src/lib/villa/composition-examples.ts` supplies authored parameterized wings, connections, terraces and pool positions. `ComposedWing`, `WingWall` and `FloorPlate` in `src/app/dev/villa-playground/composed-villa.tsx` expand these into geometry, cut shared wall spans, reserve stairwell voids and generate roof/facade treatments. Flexible footprints and stacked volumes use their own legacy parameterized builders. The curved pavilion uses explicit triangulated ellipse plates/arcs (`src/components/scene/curved-pavilion.tsx`, `src/lib/villa/experimental/pavilion-geometry.ts`). These are distinct geometric techniques, not interchangeable colors on the same house.

Terra's direct scene already reuses the original `Roof`, `Glazing`, `FinishBox`, `Slats` and `Sofa` through `src/components/scene/OperationScene.tsx`. Therefore the difference is principally authored composition, coordinated assembly detail and reliable use of the available operation budget. More instructions or parts alone do not prove a better design. Retained rectangular/oversized roof failures are evidence of individual outputs, not proof that the model cannot design differently.

## 2–4. Capability inventory and implementation

Classes: **1** supported and exposed; **2** supported but requires explicit low-level composition; **3** original Playground geometry not available as individually editable direct-scene geometry; **4** unsupported.

| Capability | Class | Implementation evidence and practical limits |
|---|---|---|
| Multiple storeys, setbacks, rotated wings, split levels, geometric cantilevers | 1/2 | `elementSchema`, `applySceneOperations` (`scene/model.ts`); recursive parents in `OperationScene`; connectivity in `sceneRelationshipIssues`. Contact is not engineering. There is no automatic wing layout solver. |
| Flat, gable, hip roof assemblies | 1/2 | `buildSceneRoof` (`scene/roofs.ts`) reuses established gable/hip builders. Independent roof elements can articulate primary/subordinate wings. Flat overhang requires explicit size; pitched overhang is a parameter. |
| Other established roof forms and flexible footprint/stack geometry | 3 | `house/roof/{butterfly,mansard,sawtooth,shed}Roof.ts`, `villa/footprint.ts`, `villa/stacked-volumes.ts` have legacy geometry paths, but are not executable direct-scene kinds. Do not claim their availability to Terra. |
| Arbitrarily curved/Boolean solids and roofs | 4 | No arbitrary mesh/CSG operation. Rotated rectangular parts approximate angled plans, not smooth curves. |
| Curved lounge pavilion | 1/3 | `scenePavilionPlacement` invokes approved `curved-pavilion@1`. Entire pavilion is editable in position, yaw, dimensions and allowed finish; its generated roof, curved glass and furnishings are not independent scene IDs. |
| Grand entrances, reveals, layered facades, parapets and horizontal pergolas | 2 | `wall.opening`, `entrance`, `glazing`, `volume`, `roof`, `plate`; `OperationScene.Element`. One opening per wall; split walls for multiple bays. Horizontal members use explicit volumes; screen slats run vertically. |
| Stairs, landings and floor voids | 2/4 | Explicit plates/volumes and slab segmentation are supported. No stair solver, automatic opening, Boolean floor cut or code certification. See existing `construction-assemblies/README.md` and proof script for exact flight/landing/headroom evidence. Solana's tilted handrail cannot be represented as a tilted direct-scene solid: elements only rotate about Y. |
| Balconies, terraces, rails | 1/2 | Supported floor plates plus separately editable thin balcony rails. `sceneRelationshipIssues` checks full-span rail support. Balcony kind alone is not a floor. |
| Pools, spas, decks, outdoor kitchens, gazebos | 2/4 | Rectangular water surfaces, basin plates/walls, coping, furniture-like solids and post/beam/roof assemblies are possible. No curved pool shell, automatic excavation, hydraulics, appliances or simulated equipment. Existing pool proof establishes rectangular basin/freeboard/dry circuit only. |
| Materials | 1/3 | Five supported finish names; shared original procedural/PBR rendering. Original arbitrary color values, emissive light strips, sphere lights and arbitrary surface controls are not independently authorable through the scene element schema. |
| Coordinated wing editing | 1/2 | Root slab and nested stable child IDs; root move/yaw inherits in renderer and spatial checks. Resize does not scale children or preserve support automatically. Coordinated edits must repair dependents atomically. |

The focused implementation adds `residentialWingOperations` in `scene/assemblies.ts`: parameterized slab, rear/side walls, individually opened facade bays, separate fitted glazing, projecting reveal headers and roof. It emits existing `add` operations; only `applySceneOperations` mutates a scene. Parameters are validated; output IDs are derived deterministically from the supplied root ID. It is a reusable code-authoring helper, **not a new Terra tool or a production house generator**. Terra expresses the same construction using the existing operation schema. There is no hidden assembly regeneration or special saved format. Root position/yaw, bay sizes, material, roof form and roof rise remain normal editable properties. The helper deliberately does not pretend to provide room planning, passages, stairs or a complete residential wing programme.

## 5. Responsibilities and remaining overlap

The actual homepage `handleGenerate` (`src/app/page.tsx`) creates a direct-scene project, verifies its persisted mode and passes the pending brief to the workspace. `WorkspaceShell` selects `OperationStudio`; it consumes that brief and now uses the extracted `generationSceneRequest` in `scene/terra.ts`. That same pure builder is exercised by the mocked homepage handler regression.

`POST /api/ai/scene` uses `architecturalRequestContext`, the structured provider schema and `resolveSceneResult`. The latter executes the transaction through `applySceneOperations`. The browser validates the returned operations through the same resolver before appending a project version; this is duplicate validation, not independent geometry generation. Support failures preserve an unapplied recoverable draft. The new helper has no store access and cannot override Terra.

Knowledge (`library/architecture/service.ts::generationKnowledge`) chooses relevant guidance; Terra chooses composition; `spatial.ts` resolves the same parent transforms as rendering and audits declared relationships; `relationships.ts` validates geometric contacts without repositioning; `OperationScene` renders; `useProjectStore` persists/history; visual review evaluates rendered evidence. Legacy villa/V2/V3 engines and developer studies remain for compatibility and explicit legacy routes. They still duplicate some construction implementations, but they do not execute after the direct-scene homepage branch. No broad consolidation was justified for this task. Legacy site reconciliation is not imported into the direct-scene executor. New generation still deliberately uses flat staging and filters set-terrain; that policy is disclosed in the prompt.

## 6–7. Schema-derived teaching and editability

`constructionCapabilityReference` reads the actual Zod element and operation schemas, including nested parameters, bounds, defaults, tags and the element budget. It is appended by `sceneSystemPrompt`, shared by Generate, Refine, Redesign and Complete Architecture. Renderer meaning remains in the existing guide; schema syntax cannot derive semantics such as a balcony being railing only. The reference explicitly explains root/child movement and coordinated resizing. It introduces no second knowledge catalogue or model-executed code.

All proof parts have individual stable scene IDs and normal selection handlers. Tests move/rotate an entire dining wing, replace its roof with a hip, change one bay finish, deepen one reveal, resize the wing with explicit coordinated replacements, and enlarge one window with its wall opening. Unrelated elements preserve identity. History tests append separate versions, undo/redo and round-trip JSON. No automatic cascading resize is claimed. Cross-wing support must be repaired if a requested move removes it; attachment is not support.

## 8. Two different compositions

`codeArchitectureStudies` (`scene/codeArchitectureProof.ts`) is imported only by offline scripts/tests:

- **Solana techniques:** 56 editable elements, four roots: broad salon, recessed elevated suite, double-height arrival hall and lower dining volume, with independent flat roofs and a fitted door, sidelights and transom in the tall arrival portal.
- **Sheltered court:** 48 editable elements, three low wings enclosing a central void; inward-facing glazing, hip-roofed north hall and perpendicular gabled side wings.

The difference is topology, orientation, height hierarchy, view direction and roof construction, not color randomness. Both use `residentialWingOperations` and the authoritative executor. Dimensions and IDs fully reproduce them. These are exterior construction-technique proofs, not exact Solana replicas or complete $25m mansions. They deliberately make no circulation, enclosure programme, pool, stair or subjective beauty certification. Existing isolated stair/pool proofs supplement the inventory rather than being relabelled as parts of these houses.

## 9–10. Knowledge and generation information

The unified retrieval path is unchanged: `generationKnowledge` reads the existing library, combines approved active revisions with legacy recipes, and `retrieveArchitecturalKnowledge` ranks relevance, scale, explicit property value and category diversity under a per-request budget. It does not inject 334 records. `constructionFor` links retrieved knowledge to supported element kinds/operations. Selection evidence is retained even when a model fails to cite or build it. Approved transferable corrections enter through `designLessonKnowledge`; unreviewed/mock corrections are excluded. Legacy user-reviewed lesson summaries retain their existing bounded context path; no second recipe reader was added.

The actual API handler regression runs four briefs ($250k compact, $1m Mediterranean, $5m tropical, $25m waterfront) with the real request builder, a frozen 334-active-record snapshot, retained output and mocked provider. It asserts the derived capability contract reaches the provider system prompt alongside the selected knowledge and a single provider invocation. Output is replay evidence, not brief-specific model design. Capture: `homepage-requests.json`. All edit intents use the same context function and executable reference.

Terra now receives a mechanically current parameter reference and explicit assembly-edit instructions alongside the existing design guide and selected knowledge. It has sufficient syntax and primitives to express much richer architecture, but that is not evidence it will choose or coordinate them well.

## 11–12. Verification and principal limitation

Run:

```sh
npx vitest run src/lib/villa/scene src/store/__tests__/directScenePersistence.test.ts src/app/api/ai/scene src/lib/villa/visual-learning.test.ts src/lib/villa/design-learning.test.ts
npx tsc --noEmit
npx vite-node --config vitest.config.mts scripts/code-architecture-proof.ts
node scripts/code-architecture-capture.mjs
```

`verification.json` records zero calls, counts and empty geometric relationship findings. JSON scenes and `capabilities.txt` are reproducible artifacts. The screenshot harness uses an isolated Chrome profile and blocks API/external requests. Browser evidence is in `browser-result.json`: matched cameras, expected rendered IDs, finite mesh vertices, no page errors, and successful actual workspace selection/material-edit/Undo/Redo/reload. `solana-overview.png`, `court-overview.png` and `edited-overview.png` show the studies and scoped wing move. `original-solana-overview.png` shows the original handwritten house using the same camera. Original and proof scenes differ in grounds and furnishing completeness, so these are technique comparisons, not a controlled aesthetic score. Existing visual review (`SceneReview`, `visual-review.ts`) preserves the original, stages scoped corrections and compares identical cameras; `validateDesignLesson` requires replayable correction evidence, matched captures and review. This task does not run paid review/revision or approve lessons.

**Most important remaining limitation:** no verified evidence yet that Terra reliably converts a rich architectural concept into coordinated, functionally complete geometry on its first pass. Runtime connectivity is weaker than a room/circulation/structural model; schema-valid architecture can still be repetitive, poorly proportioned or unusable. A later explicitly authorized model run and rendered comparison are required to assess model behavior. Offline proofs establish expressiveness and editability, not autonomous architectural quality.

Validation completed: **142 tests passed across 23 files**, `tsc --noEmit` passed, and ESLint passed for the changed source/test files. The browser capture requires the existing machine-local Playwright installation (as in the repository capture scripts), Chrome and a running dev server. Use `localhost`, since this Next.js development server rejects the numeric loopback origin for development resources.
