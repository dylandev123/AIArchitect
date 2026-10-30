# Generate visual review integration

Generate now runs a bounded visual review/refinement loop in `OperationStudio`, including project-backed generation. Architectural generation guidance, scene kinds and edit operations were not expanded. The existing API key configuration is reused; no credentials were changed.

## Reuse audit

- `SceneReview` already captured actual `OperationScene` geometry through `ReviewPreview` / `VillaScene`, staged edits with `stageSceneReviewEdit`, showed before/after images and saved human decisions. It was a development-only manual experiment, not part of Generate. Its three-weakness prose contract and human verdict did not support structured automated comparison. Its lesson-writing endpoint remains separate; machine preference must not become human-approved learning.
- `ReviewPreview` supplied bounded PNGs, render error/context-loss handling, camera poses and a nonblank check. Its direct-scene grounds were decorative `LaderaGrounds`, it lacked the authored entrance ID, and its renderer options differed from the studio. Direct captures now use the actual `SceneTerrain` fallback/settings, authored entrance/pool IDs, studio tone mapping and a matching 40-degree field of view. Legacy preview renderer settings remain available. Captures additionally verify exact scene element IDs, local positions and yaw against rendered groups.
- `stageSceneReviewEdit` already invokes the normal resolver, operation restrictions, immutable staging, structural relationships and preservation checks, including inherited world movement. It is reused without changing those gates. `compareSceneEvidence` supplies the preservation/relationship/audit diff. The normal studio commit provides project versions and local history.

## Connected workflow

After a successful Generate transaction, its exterior is saved as the original version. No ordinary Refine/Redesign request triggers this loop. The UI stays busy throughout the loop.

1. Capture the actual generated scene in **Aerial, Arrival, Garden, Poolside** order, at 640 × 360 using the existing presentation components.
2. Ask configured Terra to assess all ten requested categories exactly once. Findings have a category, severity, observed evidence, existing target IDs and a supported suggested change or null. A single optional refinement points to one finding and a subset of its targets, up to twelve existing IDs. Unsupported landscape work and camera limitations can remain findings without geometry changes. Camera findings cannot authorize geometry edits.
3. Request one targeted transaction through the existing scene output vocabulary. This is always Refine: no generation, Redesign, additions, removals, assembly creation or terrain operations. The executor uses the application's validated scope rather than reparsing reviewer prose into a different scope. This required a small optional trusted-scope argument to the existing edit instruction builder; ordinary Generate instructions and ordinary edit planning are unchanged.
4. Stage and validate on both server and client using `stageSceneReviewEdit`. Preserve metadata, architectural intent, terrain, identities and unrelated elements. Reject newly introduced relationship findings or architectural audit warning strings. The existing atomic transaction and indirect-transform preservation checks still run.
5. Render the candidate at the saved original cameras. Camera equality permits only `1e-7` numerical tolerance for OrbitControls spherical-coordinate round trips; a visible camera move fails the check.
6. Send the four previous renders followed by the four proposed renders to Terra for comparison. Retain only `prefer revised` with an empty regression list. `prefer previous`, `uncertain`, malformed/truncated output, errors and render failures retain the previous saved version and stop.
7. Re-run deterministic staging checks and the live revision check immediately before committing a separate history version. A second pass can review that retained scene. **The controller cannot exceed two passes; every provider call has zero retries.** Maximum additional calls are six: review, targeted edit and comparison for each pass. Early stops spend less.

The review route is `/api/ai/scene/visual-review`, with separate review/refine/compare phases. Its wire contract rejects pass numbers outside 1–2. It reuses the configured model, usage logging and normal provider setup; no new generation engine or key is introduced. The two-pass orchestration limit is application-controlled, not a global quota on manually calling API endpoints.

Local revision counters and project-store subscriptions invalidate stale work even if an edit/Undo/Redo restores the same geometry. Every asynchronous boundary checks the current revision and serialized baseline. Closing the studio aborts in-flight requests and prevents continuation. Accepted versions use normal history/Undo; rejected candidates are not appended. The panel retains structured review, operations, before/after scenes, PNGs, diffs and verdicts for inspection/export during the session. Those review records are not automatically persisted as project metadata or approved knowledge.

## Verification

- **277 tests pass across 40 files** in the focused scene, visual review, Generate API/provider-schema and new visual-route suites. [Results](tests.json).
- `npm run typecheck` passes. Focused ESLint passes.
- The [browser result](browser-result.json) exercises the actual Generate button, actual WebGL renderer and capture pipeline, two scoped transactions, identical-camera comparisons, six bounded review-phase requests, automatic history commits and two Undo actions restoring the original generated elements. No page errors occurred. External resources and unrelated APIs were blocked. Rendered IDs/transforms are checked in each capture. Full [browser evidence](browser-evidence.json) contains both passes, all sixteen captures, operations and preservation diffs. [Studio after Undo](studio.png).
- Provider responses in this browser test are **offline developer fixtures**, including the positive comparison verdicts. They establish integration behavior, not architectural improvement. **Zero live/paid provider calls were made for this task.** This is not evidence that Terra reliably prefers better architecture.
- Failure coverage includes rejected/uncertain/mixed comparisons, no supported refinement, stale revisions, renderer/provider failures, malformed output, invalid geometry, unknown targets, scope violations, metadata rewrites, forbidden additions/removals, incomplete image sets and camera movement. Existing construction and preservation suites remain unchanged and pass.

Initial browser runs exposed an overly strict byte-for-byte camera comparison; restoring a camera through OrbitControls introduces floating-point noise. The numerical tolerance fixes that without permitting a composition change. A separate browser harness timeout was increased to allow all sixteen real captures. The final browser run passes.

The hard checks retain their existing coverage limits: they do not certify engineering, arbitrary circulation/headroom, or every possible unsupported surface. Visual preference remains a model judgment. Reusing the current operation vocabulary means some important massing, arrival or landscaping findings will remain unresolved rather than trigger regeneration or new feature construction. No planting was injected into review renders. No live model quality comparison, database mutation, migration, commit or deployment was performed.

Reproduce offline (local server on port 3015 and existing Chrome/playwright-core installation required for browser check):

```sh
npx vitest run src/lib/villa/scene src/lib/villa/visual-review.test.ts src/app/api/ai/scene/visual-review/route.test.ts src/app/api/ai/scene/route.test.ts src/app/api/ai/scene/route.providerSchema.test.ts
npm run typecheck
node scripts/generation-review-browser.mjs
```
