# Homepage generation consolidation — October 27, 2026

## Cause and evidence

The retained `.v3-debug/failed-attempt-0.json` was captured at 2026-10-27T12:02:09.268Z (08:02 Saint Lucia), generation ID `b23e0950-7e36-4530-adac-5b107d898075`. Its exact response SHA-256 is `9df5809490c54424224320edab7611baaf88c51aaa232e250794d9c1037ca445`.

The response is a `v3-plan-first-1` envelope. The corresponding error is emitted by `/api/ai/house` → `generateV3Scene` → `generateArchitecturalBlueprintV3` → `generateV3FromArchitecturalBlueprint`. Local configuration has `AI_V3_ARCHITECTURAL_BLUEPRINT=1`; flat V3 generation therefore invokes independent blueprint planning before exterior construction. The arrival-sequence requirement lacks its authored `connects` relationship; estate form, destination access, blocked routes and unresolved room adjacency also fail. Patching the first relationship would not solve the failed design or routing problem.

The homepage checkbox changed the persisted project root from `architectural-scene-1` to V3. That selected WorkspaceShell's legacy workspace/ChatPanel and `/api/ai/house`, rather than OperationStudio and `/api/ai/scene`. Advanced terrain was disabled unless V3 was selected, encouraging that route. The retained response proves the blueprint engine ran; it does not independently record the checkbox state. A checked checkbox or an existing V3 project reaches this branch.

Earlier consolidation covered unchecked homepage generation (`consolidation-capture.mjs`) but left the alternate checkbox branch and shared V2 project default intact. Worse, `normal-direct-scene-check.mjs` imported `final-consolidation-check.mjs`, whose starting page was Playground, not the homepage. Passing tests did not establish a single homepage construction authority.

## Changes

- Homepage has one Generate button, always creating a direct-scene project and verifying its persisted root. Experimental V3 selection and its mode-dependent terrain selector are removed.
- Shared createProject default is direct-scene, including the normal New Project dialog. The deterministic V2 developer fixture explicitly requests its compatibility format.
- The separate 2D evaluation generator is removed from the homepage. Its code, plan endpoints, saved plans and legacy workspaces remain available for existing projects and developer work.
- Direct scenes use OperationStudio, `/api/ai/scene`, JSON operations, atomic scene validation and normal project versions. A stale direct root sent to `/api/ai/house` is rejected before any provider call. Legacy house and staged clients also reject direct projects.
- Advanced Terrain & Elevation remains an optional panel in the primary editor. `set-terrain` stores bounded natural-ground intent in the same scene. Rendering reuses compileV3Scene with an empty legacy object list solely for terrain. Direct architectural elements never enter legacy blueprint, footprint, stack or estate validators.
- Terrain supports width/depth, elevation, fall, grade and optional cliff intent. Manual controls expose elevation, grade and fall. Terrain changes do not move or constrain architecture. Terrain participates in atomic operations, saving, reload and undo.

## Capability audit

Existing primary integrations retained and verified: V2/shared gable and hip roof builders via buildSceneRoof; flat roofs; wall openings; framing/glazing; solid doors; slatted screens; materials; WaterSurface; arbitrary yaw, elevations and parent attachments; and Playground's approved version-pinned curved pavilion. Playground and image-first share OperationStudio and the canonical scene endpoint, while compatibility renderers and stored data remain intact. This change adds shared V3 natural terrain rather than another engine.

Compatibility-only: V2 ArchitecturalDesignDocument and staged generation, V3 semantic building/estate/blueprint planning and editing, independent 2D evaluation, older villa configuration/composition renderers and recovery tools. These remain for existing formats, explicit developer tools and recovery; they are not new-project defaults.

Primary limits remain explicit: 400 elements, 800 operations, five material finishes, one opening per wall element (split walls for multiple openings), flat/gable/hip standalone roofs, rectangular primitives plus the approved elliptical pavilion. General polygons/curves/CSG, other pitched roof forms (including the failed response's mono-pitch roof), automatic rooms/interiors/stairs, structural/code checks, terrain profiles/ridges/sea, automatic grading/pads/retaining walls and pool excavation are not integrated. No conversion of unsupported geometry to substitute solids is claimed. Older advanced systems remain preserved.

## Offline recovery

`scripts/homepage-failure-replay.ts` verifies the retained hash, forbids fetch, and runs the exact response through the legacy planner with repair disabled. It reproduces `arrival-sequence: missing authored connects relationship` and recovers the planning scene into `recovered-planning-scene.json`. The original response is preserved in `original-failure.json`; findings are in `failure-replay.json`. This is planning recovery, not a repaired, complete 3D house. A separate retained direct operations fixture succeeds without invoking that planner. No paid response was regenerated or silently converted.

## Verification

- Final focused store, scene, route and legacy client compatibility tests: 139 passing across 25 files.
- TypeScript: passed. ESLint: passed with three existing unused-variable warnings in unrelated capture scripts. Production build: passed.
- Fresh-context homepage browser check: zero live provider calls, two mocked scene requests, zero page errors and zero unexpected requests. Checks cover no generation selectors, canonical generation, five-level editable geometry, targeted conversational edit preserving unrelated elements, durable versions, undo/redo/reload/reopen, Casa Ladera import, shared roof rendering, optional terrain persistence/undo, and unchanged V2 and recovered V3 legacy data.
- Screenshots and machine-readable results are beside this report. The browser regression entrypoint now starts from the homepage. External requests and every unexpected AI endpoint are blocked. Development and production outputs are checked separately.

No migrations, commits, deployment, destructive project changes or live OpenAI calls were performed. Existing unrelated working-tree changes were preserved.
