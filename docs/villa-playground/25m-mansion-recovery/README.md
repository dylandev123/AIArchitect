# Calypsonian House: offline $25m mansion recovery

Recovered from `.data/scene-responses/ed0d5d1e-a7f5-4e39-99b3-d203f5b63393.json` (latest retained response, status rejected). Original bytes are copied to `original.response.json`, unchanged, SHA-256 `c1613800abe2efaa2bb5f200f8c807bc345df7bebd3eed9965f5436b8a44c9e5`. No provider calls, retries, commits or deployment. Existing application changes and the user's current house were not modified.

## Exact cause and correction

Terra misplaced both railing centres vertically. This is not floating-point error, deck matching failure, or an overly restrictive railing rule. The validator correctly checks bottom Y against a supported walking surface, with 0.16 m contact tolerance. The original mismatch is 0.40 m.

| Element | Original centre | Corrected centre | Intended deck centre / size | Walking Y | Rendered local-X world span |
|---|---|---|---|---|---|
| east-terrace-rail | (12, 3.8, -4.8) | (12, 4.2, -4.8) | (12, 3.55, 0) / (8, 0.2, 10) | 3.65 | X=8..16, Z=-4.8 |
| west-terrace-rail | (-12, 3.8, -4.8) | (-12, 4.2, -4.8) | (-12, 3.55, 0) / (8, 0.2, 10) | 3.65 | X=-16..-8, Z=-4.8 |

All four objects have no parent and yaw 0, so local and world coordinates coincide. Each railing size is (8, 1.1, 0.12); the renderer places glass symmetrically about its centre along local X, not Z. The deck south edge is Z=-5; the rails are inset 0.2 m. The glass spans the full 8 m deck width. The rendered horizontal cap is 8.06 m wide, extending 0.03 m beyond each end, within the existing contact tolerance. Original base: 3.8 - 0.55 = 3.25. Correct base: 4.2 - 0.55 = 3.65. Deck top: 3.55 + 0.10 = 3.65.

Only these two Y coordinates change. All 67 elements, IDs, materials, dimensions, roof datums, horizontal positions and architectural composition are preserved. No validator changes were needed. `corrected.response.json` retains Terra's plan and explanatory metadata; `corrected.scene.json` is the importable geometry.

## Replay and verification

Run `npx vite-node --config vitest.config.mts scripts/recover-25m-mansion.ts` for deterministic local reconstruction. It imports geometry/schema/plan auditing only; it does not import an AI client. It checks the source file bytes remain identical. The corrected geometry has zero construction relationship issues.

Run `npx vitest run src/lib/villa/scene/mansionRecovery.test.ts src/lib/villa/scene/relationships.test.ts src/store/__tests__/directScenePersistence.test.ts`: 14 tests passed. Focused regressions preserve the exact source hash and two-coordinate-only correction, and reject buried/floating/overrunning railings and deck removal. Existing relationship tests cover rotated attachments, multiple supporting decks, gaps and indirect support loss.

`scripts/25m-mansion-capture.mjs` replays the corrected scene through the real renderer with AI endpoints and external requests blocked. It uses a temporary browser context. `browser-checks.json` records all 67 rendered element IDs, finite mesh coordinates, browser errors, request counts and edit/history/persistence checks. Images: `aerial.png`, `front.png` (entrance), `rear.png`, `poolside.png` and `workspace-entrance.png`.

To inspect the recovered geometry locally, use **Import scene JSON** in the direct-scene editor with `corrected.scene.json`. Import into a separate project if keeping the current project's version history untouched.

## Architectural assessment and limits

The complete authored exterior renders, but this is a recovered inspection scene, not a fully accepted generation. Applying the corrected response through `resolveSceneResult` still fails the separate architectural-plan audit. These findings are retained in `recovery.json`; no audit is suppressed or marked passing.

The upper retreat floor overlaps both suite floor plates at the same elevation and lacks complete perimeter enclosure evidence. The raw floor sum is 744 m² versus the declared 792 m², with overlap making the sum unsuitable as verified enclosed area. Pool court floor evidence is 87.6 m² versus 120 m² declared. Additional commitment-kind errors arise because the plan mixes roofs/walls/water into commitments whose audit categories allow narrower kinds; those messages should not be mistaken for absent rendered objects. They were left outside this railing recovery's scope.

Visually the tall central block and lower wings give the residence a clear hierarchy, with a pool axis and shaded ocean frontage. The entrance is understated, long arrival walls are sparse, and the broad timber roof surfaces dominate the composition. The result is a plausible contemporary house study, but not yet architecturally convincing as a resolved $25m mansion. Unmodeled stairs (explicitly disclosed by Terra), overlapping upper space allocation, and sparse facade/arrival resolution remain substantial limitations. No architectural redesign was performed.
