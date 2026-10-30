# Chrome repair and offline preflight — 2026-10-30

The browser blocker is the execution filesystem sandbox. The exact unchanged launch configuration reproduces `browserType.launch: Target page, context or browser has been closed` inside it ([full error](browser-launch-sandbox.log)). The same executable, Playwright module and arguments launch and close successfully outside it. This isolates the current reproducible failure to the execution environment; the historical failure record did not retain enough browser stderr to establish a more specific OS denial.

Chrome exists and is executable at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`. Chrome reports 156.0.8078.76; the existing Playwright core is 1.48.2. Their actual launch, protocol communication, rendering and shutdown work together. No dependency upgrade, binary replacement, headless/Metal flag change or browser-profile deletion was necessary. Playwright creates isolated temporary profiles; no profile-lock error was observed. The local server was initially unreachable. A development-server startup was requested; a server on port 3015 subsequently served the captures. That startup process reported another server already running (PID 86251); the existing server was left intact.

The operational correction is to execute browser capture outside the filesystem sandbox. Keep this requirement for the separately authorized paid execution too; running the same command inside the sandbox will still fail. No automatic fallback or retry was added.

## Small infrastructure change

`scripts/retained-visual-review.ts --browser-preflight` is a capture-only mode with a separate output directory, an explicit prohibition against combining it with `--live`, strict console-error checking, browser-version and block diagnostics, and shutdown evidence. It preserves earlier evidence with exclusive-create writes. The shared layout requests `/api/assets`; two diagnostic runs captured the house successfully but the strict console assertion detected its intentionally aborted request. Those attempts remain in `browser-preflight/attempt-1` and `attempt-2`. The final preflight fulfills only that GET locally with an empty asset catalog. All other API/external requests remain blocked, and no server API is reached. The house uses primitive scene geometry, so no catalog asset is required. This local fixture is confined to preflight; live experiment behavior is unchanged.

## Final free result

[Preflight record](browser-preflight/preflight.json): zero provider calls, zero page errors, zero console errors. All four 640×360 images pass the normal renderer's exact 47 element ID/position/yaw checks, nonempty visible architecture bounds, live WebGL context check and nonblank pixel-diversity check. Visual inspection confirms actual house geometry in every view.

- [Aerial](browser-preflight/prepared-aerial.png)
- [Entrance / Arrival](browser-preflight/prepared-arrival.png)
- [Garden](browser-preflight/prepared-garden.png)
- [Poolside](browser-preflight/prepared-poolside.png)

[Exit record](browser-preflight/browser-exit.json) confirms browser disconnection and original preservation. The post-run process inspection found no Chrome processes using Playwright temporary profiles ([empty process record](browser-preflight/remaining-capture-processes.txt)). Existing personal browsers were untouched. PNG bytes are not asserted identical to historical captures; [comparison](browser-preflight/baseline-image-equality.json) records the observed byte equality, not geometry changes.

The source and separate original copy still share SHA-256 `b76ed99bad6f6bda1c1e6f233ef9d65e9b01b0c1c0687f97e488dc44feadf983`. Architecture instructions, geometry, model configuration and visual-refinement behavior were not changed.

## Experiment readiness

Ready for another explicit paid authorization, with the server reachable and the runner executed outside the filesystem sandbox. The unchanged runner uses `maxPasses: 1`, unique phase tracking, at most three provider requests and no resubmission after `started.json`. That file remains absent. The route uses `maxRetries: 0`. Review may decline refinement; failures stop the sequence. The intended maximum sequence remains one review, one structural refinement and one identical-camera comparison. Existing preservation and construction acceptance gates remain enforced: 23 existing targets for this house, 32 additions, 8 removals, 80 primitive operations and a 6 m extent margin. No alternate model or second pass was introduced.

27 tests pass across the generation-review and visual-review route suites; focused ESLint passes. No paid calls, commits, deployments, database changes or house edits were made during this repair.

Offline reproduction (run outside execution filesystem sandbox; refuses evidence overwrite):

```sh
npx vite-node --config vitest.config.mts scripts/retained-visual-review.ts --browser-preflight
```
