# Unobstructed villa exploration

The playground opens in Focus House with a viewport-filling canvas, a compact title, and closed property details, Terra controls, customization, and development presets. The development presets retain the existing styles, component studies and offline examples. Fullscreen hides supporting interface elements while retaining camera controls and an exit button. Browsers without the Fullscreen API retain the same exploration layout within the page.

Warnings are presented as a small status button. Opening it shows every unresolved finding, including its actual diagnostic message. Dismissal changes only local presentation state; it does not clear the response, unsupported-item list, authored composition, unresolved landscape objects or approval state. The status can be reopened after dismissal.

Camera presets use the rendered architecture's world bounds and the current viewport's horizontal and vertical field of view. Fit Property and Aerial include the actual composition garden bounds. Arrival uses the authored court direction; Poolside uses the authored pool direction. Focus House retains all architectural buildings, including detached pavilions. Legacy Garden and Above views, reset and tour remain available. Fog distance follows the camera so wide mobile property views remain visible. No building geometry was changed.

## Evidence

Actual retained responses, replayed locally without model requests:

- Latest retained estate: **Aerial Oasis, Saint Lucia**, `6d31056837d287b9b8ea01707a43bcc6db1bc39dd36fccb668a52ebb32429f5d`.
- **Ocean Crescent Villa**, `8100bca24525c07e1319837d172478ea71557c45a367dc1d49b99a4bbd6a6483`.
- Original **Villa Solana**.
- Compact **Breeze Family Villa**, `?composition=family-breeze`.

The latest response was selected by retained-file timestamp; the response itself does not contain budget metadata.

Desktop viewport: 1500 × 1000. Mobile viewport: 390 × 844 with Chromium touch/mobile emulation. Screenshots in this directory include the opening view and fullscreen for all four properties, unresolved-item panels for both retained responses, and individual estate camera presets. `results.json` records camera positions, projected architecture bounds, mesh counts and interaction checks.

## Tests

Final browser verification: **8 / 8 property/viewport combinations passed**, with **40 camera screen/depth checks**, zero AI endpoint requests and zero page errors. Desktop and mobile results were refreshed after the local server restart.

- TypeScript: `npx tsc --noEmit` passed.
- ESLint on the two changed TSX files passed.
- Villa and playground regression suites: **129 / 129 passed**, across 12 test files.
- Broader villa/playground/V3 run: **1,143 passed, 3 failed**, across 95 test files. The three failures are outside the edited UI/camera files:
  - `planRecovery.test.ts`: `window is not defined` in project storage.
  - `productionRouteDiagnostics.test.ts`: expected `FALLBACK_RENDER_USED` diagnostic absent.
  - `supportCapabilities.test.ts`: fountain deterministic support-policy expectation differs.

The browser verifier blocks every `/api/ai/**` request and asserts zero such requests. It checks initial collapsed panels, Terra brief preservation across close/reopen, customization open/close, warning opening/dismissal/reopening, exact authored-draft preservation, unchanged scene group identities after warning dismissal, five camera presets, whole-architecture screen/depth bounds, and fullscreen entry/exit. See `results.json` for the final browser results.

## Limitations

- Mobile verification uses Chromium emulation, not physical iOS/Android devices; Safari fullscreen behavior was not independently tested.
- Live Terra generation/editing was not invoked, as requested. Existing deterministic generation, patch, component, footprint and landscape tests passed.
- V3 was not modified. Its broader suite is not fully green due to the three failures above; this task does not establish that every V3 workflow is regression-free.
- Fit Property deliberately includes the entire retained garden and can make buildings small on very large sites. Focus House is the opening view for this reason.
- Existing unresolved landscape drafts remain excluded from rendering by the existing acceptance policy and remain retained for editing. Dismissal grants no estate approval.
- The framework's Next.js development badge remains visible outside native fullscreen.

Intermediate browser runs encountered a scene-initialization failure and then a Next.js development response with “Unexpected end of JSON input.” The retained JSON artifacts remained valid and their hashes matched. The local development server was restarted, and final verification used a fresh browser context per property. Prolonged repeated-reload stability was not established.

Retained response file SHA-256 hashes still match their content-addressed filenames.

No OpenAI calls, migrations, geometry edits, commits or deployment were performed. Existing unrelated working-tree changes were preserved.
