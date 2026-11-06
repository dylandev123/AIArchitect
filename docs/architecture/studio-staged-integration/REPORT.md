# Studio staged workflow: local vertical slice

The normal direct-scene project Studio now contains a development-only staged rehearsal panel. No separate generation scripts are needed to operate it. Open an existing direct-scene project using the local development server, expand “Staged generation · local rehearsal”, enter a flat-site Caribbean brief, and start. Continue and inspect Massing, Rooms, Exterior and Site independently. Save, reload the workspace, and choose Reopen staged house. Enter “Move the pool 2 metres closer to the veranda”, validate/preview, then accept or reject. Accepted edits append normal project versions; Undo/Redo/History retain previous versions.

## Inspection and smallest safe integration

OperationStudio already renders direct scenes and commits through useProjectStore. Project storage is browser-local, compressed on quota pressure, with permanent version snapshots. The retained Terra workflow has different stage contracts: Stage 2 massing; Stage 3 software construction from Terra's programme; Stage 4 measured exterior derivation; Stage 5 rich-site derivation. The generic staged pipeline alone does not reproduce those focused contracts. The adapter reuses their actual derivation, compilation and measurement functions instead of introducing another engine.

The retained Stage 3 loader reconstructs accepted Terra programme geometry. The adapter reconstructs Stage 2, re-derives the retained corrected-v5 exterior and rich-site design, and measures each checkpoint before exposing it. Stage 5 saves are recompiled on reload. Stable compiler IDs and original evidence remain intact. The existing accepted-save semantic pool editor validates proposals and preserves unrelated geometry atomically.

## What is proved

The browser regression operates the normal workspace UI, starting with a browser-local fixture project. It clicks stages 2–5, inspects intermediate results, saves, reloads, reopens, previews/rejects a pool change, previews/accepts another, and reloads/reopens the edited house. No generation or editing is performed by a development script outside the website during this flow. The script is only the automated browser driver. External requests and unrelated APIs are stubbed/blocked in this browser test. Its screenshot was visually inspected. See browser.json and studio.png.

The server adapter tests construct all four checkpoints, preserve the supplied brief at each stage, verify reload, accept the two-metre edit, reject an invalid ten-metre edit without changing its baseline, reject unsupported requests, and deny production/cross-origin rehearsal access. Existing pool-edit tests cover stale hashes and unrelated geometry preservation.

## Explicit limitations

This is retained-checkpoint replay, not new AI design. Geometry is fixed and labelled as such throughout the UI. The entered brief is carried by each checkpoint, not interpreted by a model. Scope keyword rejection is an offline mock boundary, not a production requirements classifier. The mock edit planner accepts only the displayed numeric pool movement grammar. Neither stage progression nor edit preview spends money: estimate and maximum are both $0.

Checkpoints are retained in the panel during a run and included with the complete saved version. Unsaved checkpoints do not survive a page reload. Cancel aborts the client request and ignores late results; it does not interrupt synchronous server compilation. No durable worker, cross-device save, resumable server job, active-stage progress stream, or production identity system is supplied. Saved staged source belongs to the matching scene version; manually changed geometry must not be silently overwritten by semantic editing. Preview acceptance checks the exact saved baseline.

## Access and spending

The temporary x-admin-email check is not authentication. No genuine verified session/ownership infrastructure was found in the inspected path. Rather than granting paid access through it, proxy.ts now denies all /api/ai/* execution except the two existing offline-only rehearsal/edit paths. This includes development and production, future nested AI endpoints, and spoofed email headers. The new rehearsal route also denies production/Vercel directly. This deliberately disables older paid Studio Generate/Refine/Redesign routes until secure execution is built. No paid-enable environment switch was introduced.

Before a controlled production test:

1. Add verified server sessions and authorize every job/project/version against its owner. Enforce this at the execution boundary as well as routing.
2. Add transactional per-user/job spending reservations using conservative request/output bounds, concurrency protection, idempotency, recorded actual usage, bounded retries and unknown-billing handling. Existing CallBudget records cost after calls and cannot alone guarantee a dollar ceiling.
3. Add durable owned jobs/checkpoints and version storage, cancellation between provider calls, resume validation and stale-baseline protection across tabs/devices.
4. Connect injectable providers to the successful focused Stage 2–5 contracts. Interpret and validate the full prompt/programme before construction; pass the original brief and accepted requirements to every relevant stage. The Stage 5 request builder now accepts an explicit brief and no longer asserts a hardcoded Breezeway identity/programme. The offline UI does not invoke live designers.
5. Review the full request/schema/cost bounds, approve a controlled test, and only then implement/open the paid execution gate. Unsupported architecture must be rejected or clarified, never converted into this retained villa.

No paid calls, credentials, production database changes, commits, pushes or deployments were made. Existing unrelated workspace changes were preserved.
