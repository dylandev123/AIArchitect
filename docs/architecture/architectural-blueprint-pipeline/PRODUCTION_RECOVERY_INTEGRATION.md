# Production recovery integration — exact Terra blueprint

Verified 21 October 2026, America/St_Lucia. **GO for another controlled paid generation with `AI_V3_ARCHITECTURAL_BLUEPRINT=1` in a fresh flat V3 project.** No paid generation was performed. The recovered mansion passes the ordinary production API and becomes the same visible, editable **Draft — Needs Refinement**. Its unresolved architectural decisions prevent Complete, as intended.

1. **Exact production API result: succeeds.** The optimized `next start` application receives an ordinary workspace `POST /api/ai/house` and returns HTTP 200, pipeline header `v3-architectural-blueprint-1`, and outcome `draft`. `AI_V3_BLUEPRINT_FIRST=0` proves that `AI_V3_ARCHITECTURAL_BLUEPRINT=1` independently selects this route. The provider transport returns the untouched recovered JSON; the real production model adapter and AI SDK parse it. Normal identity normalization, preflight, deterministic construction, independent validation, client revision checks, draft acceptance and project-store commit all execute. One mocked authoring response serves the mansion; zero repair responses and zero real provider requests occur.

   Input: `.v3-debug/recovered-9733be300b2f/original-blueprint.json`. SHA-256 before and after: `9733be300b2fbb316ea248201c4af87df86665fb63fb9c6d63012aa49f1af9ed`. The normalizer changes only the four exclusive route-owner IDs, preserving their feature endpoints and authored route geometry. The browser does not receive a manually inserted constructed scene.

2. **Result: Draft, not Cannot Construct or Complete.** Current-scene validation retains 78 object-level diagnostic entries: 49 draft-tolerable and 29 advisory, with zero core-blocking entries. Several audits describe the same underlying local issue, so these are not 78 independent architectural decisions. Ingestion-only identity notices are replaced by current-scene diagnostics at the normal persistence boundary. Geometry, other metadata and Draft status remain consistent.

3. **Architectural fidelity: preserved.** The production API scene emits **316 primitives**, exactly equal to the deterministic construction from the original blueprint. Independent construction receipts report zero discrepancies. The API and browser checks compare original locations, dimensions, facade records, roofs, used material properties, feature geometry, route widths/waypoints, entrance references, rooms, partitions, doors and zones. No building or amenity is replaced or dropped.

   | Preserved object or intent | Verified result |
   | --- | --- |
   | Belvedere House / `main-villa` | Original x=-5, z=-5; 24 × 18 m footprint; storeys 4.2 + 3.5 m; total 7.7 m |
   | Garden Guest Pavilion / `guest-pavilion` | Original x=30, z=4; 18 × 12 m footprint; 3.6 m storey |
   | Both independently authored roofs | Original forms, pitch, thickness, overhangs, bronze material and host footprints; roof bases 7.7 and 3.6 m |
   | Both glazed main entrances | Original opening identities, spans, operation and height; transparent panels, bronze frames and authored 2.4 / 1.8 m entry canopies |
   | Outdoor features | Arrival court, ocean-view terrace, infinity pool, guest terrace and tropical garden reserve |
   | Pool | Original 20 × 12 × 1.5 m raised basin at base elevation 0; no implied excavation or lowered water |
   | Routes | Four independent editable route owners, original widths, uses, materials, endpoints and bends |
   | Interior records | All 17 spaces, 9 partitions, 8 doors/passages and the villa U-stair retained |
   | Materials | Authored ivory stucco, volcanic stone, bronze, paving, water and landscape finishes retained; facade/material receipt checks pass |

   Structural villa datums remain 0, 4.2 and 7.7 m; finished floors are 0.26 and 4.46 m. The guest finished floor is 0.26 m. See [machine-readable fidelity proof](production-integration-webgl/fidelity.json).

4. **Remaining design work is visible and retained.** Overlapping/out-of-host room rectangles and unresolved room boundaries remain authored intent. Seven unresolved partition boundaries and six related door boundaries do not gain invented wall or door coordinates. Reserved-zone extents and member placements remain unchanged. The western pedestrian route's ribbon-edge clash, the stair screen approach, one clipped door and raised-pool access/relationship findings remain visible diagnostics. Budget/style requirements remain unverified advisory intent. The API's planning findings also flag guest-terrace access; persistence recomputes current-scene access evidence rather than copying stale planning diagnostics. Nothing chooses a room coordinate convention, relocates a zone/building/stair, adds a route bend or invents a pool deck to obtain acceptance. The mansion remains Draft when the normal Revalidate construction action is pressed.

5. **Workspace visibility: succeeds.** The landing page's Generate action creates a blank V3 project and sends the pending brief through the workspace client. The ordinary production viewport then renders both buildings, both roofs, the pool, terraces, arrival surfaces, routes and landscape with WebGL 2, production meshes, PBR materials, lighting and PostFx. The workspace displays Draft — Needs Refinement and target-selectable diagnostic buttons. This replaces the earlier capture method that seeded an already constructed scene into storage. The [capture manifest](production-integration-webgl/capture.json) records the actual API flow and eight screenshots. The first four mansion views are captured before any editing:

   - [API-generated original mansion](production-integration-webgl/api-generated-mansion.jpg)
   - [Original plan](production-integration-webgl/property-plan.jpg)
   - [Original ocean facades, pool and guest residence](production-integration-webgl/ocean-facades-pool-and-guest.jpg)
   - [Original entrances and roofs](production-integration-webgl/entrances-and-roofs.jpg)
   - [Object diagnostics and normal inspector editing](production-integration-webgl/object-diagnostics-and-edit.jpg)
   - [Edited Draft after reload](production-integration-webgl/edited-draft-reloaded.jpg)
   - [Unrelated design after valid refinement](production-integration-webgl/unrelated-refined-complete.jpg)
   - [Unrelated Complete design after reload](production-integration-webgl/unrelated-complete-reloaded.jpg)

6. **Editing, atomic persistence and reload: succeed.** A normal semantic-inspector material edit changes the guest finish to `#514d47`; architecture, interior, circulation and estate geometry remain identical. Revalidation appends a consistent version while retaining Draft. Reload preserves the saved JSON exactly, including geometry, finish and validation status. The harness observes project-storage writes: each initial constructed scene arrives with its Draft diagnostics and matching version JSON in the same commit. A separate sentinel project and the mansion remain unchanged while another project is generated/refined. Store regressions additionally prove rejection without storage writes for removed essential objects, stale/removed validation labels and prohibited replacement of an existing designed project.

   Persistence verified here is the application's actual browser project store, in a fresh Chromium context. Real shared databases and account services are deliberately disconnected. The production server consequently logs the expected non-fatal usage-telemetry storage warning; it does not write to the user's usage database or saved projects. Provider token counts in the offline envelope are synthetic, not billing or live-provider latency evidence.

7. **Generalization: passes.** An unrelated Crescent Lantern estate goes through the same SDK/API and browser flow with unequal 4 / 3.5 m storeys, glazed entries, colliding owner aliases, two buildings, curved footprint, independently authored roofs, pool, covered outdoor living and a clipped service door. One response produces Draft. A normal door-inspector edit to offset 3 m clears the defect; current-scene revalidation yields Complete with zero diagnostics, and reload preserves Complete. Additional route tests reject missing main buildings, unsupported roofs, absent essential stairs, changed construction geometry and missing mesh/assembly parts. Existing tests preserve unknown-object fallback warnings and require malformed estate routes to remain invalid. No validator thresholds, architectural draft exemptions or core-failure severity rules were relaxed for this task.

8. **Final validation: passes.** Focused integration/regression checks: **92 passed** across 9 files. Full suite: **2,322 passed, 3 skipped**, 189 files (187 passed, 2 skipped). TypeScript, repository-wide ESLint with zero warnings, optimized production build and `git diff --check` pass. The final production source map is checked against the exact edited validation source. Final WebGL replay: eight captures, no browser errors or unexpected external/write requests. [Validation manifest](PRODUCTION_RECOVERY_CHECKS.json) records commands, source hashes and evidence. An earlier concurrent focused run suffered resource timeouts; the successful final focused/full runs use bounded worker counts. The initial sandboxed build could not fetch existing Google Fonts; the successful build used approved network access for those fonts, with AI credentials disabled.

9. **GO / NO-GO: GO for one more controlled paid generation.** The failure class tested here no longer requires a recovery command, manual blueprint edits, mansion-specific runtime handling or another architectural call. Use the architectural flag and a fresh isolated flat V3 project. A paid provider's ability to author a different complete design is outside this offline proof; core construction failures must still reject. The recovered mansion itself must retain Draft until its remaining architectural decisions are resolved and genuine revalidation passes.

Only one new production correction was necessary during this verification: `validation.ts` no longer falsely reports a supported estate driveway as generic fallback geometry. The compiler already emits its canonical route ribbon before per-object dispatch. Suppression is limited to supported path/driveway route owners; malformed routes, unknown-object fallbacks, core estate audits and construction receipts retain their checks. Existing construction recovery work in the user's working tree was preserved.

The reusable test harness is `scripts/production-blueprint-integration.mjs`, with the test-process-only preload `scripts/offline-blueprint-provider.mjs`. Neither is imported by the application. The preload returns fixture text at the provider fetch boundary and denies all external fetch/socket connections. It sets only child-process environment values and never edits environment files. All generation requests reach the actual local production API. Peripheral shared-library reads are mocked empty; unexpected writes abort the run.

To reproduce after `npm run build`, first emit the unrelated provider fixture through the real route test:

```sh
BLUEPRINT_INTEGRATION_DRAFT_INPUT=/private/tmp/production-blueprint-unrelated.json npx vitest run --maxWorkers=2 --testTimeout=30000 src/app/api/ai/house/__tests__/route.architecturalBlueprint.test.ts
PLAYWRIGHT_MODULE=/path/to/playwright CHROMIUM_EXECUTABLE=/path/to/chromium node scripts/production-blueprint-integration.mjs .v3-debug/recovered-9733be300b2f/original-blueprint.json docs/architecture/architectural-blueprint-pipeline/production-integration-webgl /private/tmp/production-blueprint-unrelated.json
```

No Terra/OpenAI requests, paid generations, V2 changes, terrain changes, commits, pushes, deployment, environment-file writes or modifications to existing user projects were performed. Original recovered responses remain unchanged.
