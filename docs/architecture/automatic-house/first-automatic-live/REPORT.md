# First fully automatic live experiment — stopped safely at Stage 2

The existing Mediterranean Garden House job `386d0a81-92a3-4871-8252-c93aaeec4dce` resumed under its original exact-prompt, project-bound approval. Before release, verified a fresh worker heartbeat, ready/automatic/non-cancelled run, zero call records and reservations, unchanged approved prompt/policy, and no other eligible/active/uncertain jobs. Removed only the protective operational hold. No new job or approval was created; no call was dispatched directly by a development script.

The server worker automatically dispatched and accepted Stage 1, then dispatched Stage 2. Terra completed both responses normally (`stop`), with usage settled. Stage 2 was rejected by its provider schema; the worker stopped and made no Stage 3 or retry call.

| Stage | Input tokens | Output tokens | Recorded cost | Result |
| --- | ---: | ---: | ---: | --- |
| 1 — concept | 707 | 537 | US$0.007858 | Accepted: Limestone Courtyard House |
| 2 — massing | 1,148 | 1,819 | US$0.024124 | Rejected by schema |
| Total | | | **US$0.031982** | No unsettled reservation |

## Exact Stage 2 rejection

All six model-authored block IDs contain underscores: `social_main`, `private_wing`, `arrival_entry`, `garden_veranda`, `limestone_terrace` and `garden_pool`. The existing schema requires `/^[a-z][a-z0-9-]{0,39}$/`. The retained SDK/local schema diagnostics identify `blocks[0].id` through `blocks[5].id`. This is a known actual schema failure, unlike the earlier historical run whose Stage 2 raw output was lost.

No ID normalization, design revision, schema relaxation, geometry acceptance or paid retry was attempted. The schema rejection occurred before massing construction, so this run does not establish the physical validity of those proposed volumes. Only the accepted architectural concept remains authoritative; it is not a constructed 3D house. Stages 3–5 were not called.

## Evidence and UI verification

Both complete provider response bodies, raw model outputs, exact system/prompt and wire requests, provider usage, finish reasons, checkpoint validation details and the SDK exception stack are saved in the original ledger. [Sanitized retained evidence](evidence.json) copies the relevant run/calls/project/approval while excluding account credentials and sessions. No construction exception occurred because schema validation stopped Stage 2 first. Previous live runs and their evidence were not changed.

Read-only observation of the user's existing Safari Studio confirmed 1 of 5 stages completed, Architectural concept Completed, Building massing running, actual recorded/held spending, and subsequent Generation stopped with Building massing Failed, later stages Pending, the accepted concept available and spending rounded to US$0.0320. Status polling returned successful responses. The UI's category is currently generic “provider execution”; the precise retained diagnostics establish a schema rejection. The transient validating state was too short to observe directly in this live run and is not claimed as a live visual check.

The run is failed and must remain stopped under the zero-retry rule. Any future correction or continuation requires separate explicit authorization; no action in this experiment dispatches it automatically. A full editable house was not produced. No commits, pushes, deployment or calls outside this approved generation occurred.
