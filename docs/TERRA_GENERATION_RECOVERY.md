# Successful Terra generation recovered — 2026-10-22

Recovered workspace: **http://localhost:3000/workspace/76386b2f-8095-49fd-8169-5407837818a7**

Open this URL in the same Safari profile at `localhost:3000`; the projects are stored in that browser origin. Workspace name: **Terra estate — exact recovered plan**. Recovery added one project, preserving its original blank and generated versions and selecting the generated version. The generated `houseConfigJson` is byte-identical to the complete live IndexedDB backup (47,303 characters). Recovery did not run plan normalization, reconstruction, automatic repair, or generation.

The original 56 projects and all 113 existing versions remain structurally identical to their pre-recovery records. The recovered project's two versions are exact copies, including their original version IDs and timestamps. The new project has its own workspace ID, name, timestamps, viewing preferences, and an immutable copy of the provider response. Total: 57 projects and 115 versions. All seven other localStorage keys are unchanged, verified by SHA-256.

Integrity was verified before the first storage write, again after opening/reloading the normal workspace and exercising undo/redo, and independently outside the application. The independent check decompressed the Safari download with Node's `zlib`, compared the entire decoded string with the application export, deep-compared every original project/version, and compared the recovered scene and history with the live snapshot. Result: **PASS**.

| Evidence | SHA-256 |
| --- | --- |
| Original provider response, 14,883 bytes | `3b599d4ffe1a888a97610eb1622b620cc055cadfa69f84050767fd471d4c9787` |
| Exact generated scene string | `45f1c70a48b791587b8045cf0fb0d4795b774d23fc87a7c8c9cff65a70049242` |
| Original IndexedDB snapshot object, JSON serialized | `9931dd5acea82b849bf87a2a473dd151f0ce37c2e353f38fc6607761bae89c9b` |
| Original durable project snapshot | `4b2e050a7b9827905018abbe97c01501e6035cd8ccd9bc8e6bc44b27453a7a94` |
| Original live project snapshot | `46f10932ca3b6265bcc8e3ec8d64015a6f44479104ea2b713b564e676b9a37ee` |

Storage measurements below come from the final independent verification after workspace reload and undo/redo. Counts are JavaScript string lengths; UTF-16 byte figures are estimates of string payload, not Safari's internal allocation or quota accounting.

| Storage | Before | After |
| --- | ---: | ---: |
| Project value, characters | 2,357,168 | 321,577 |
| All localStorage keys and values, characters | 2,725,973 | 690,382 |
| Estimated UTF-16 payload, bytes | 5,451,946 | 1,380,764 |
| Projects | 56 | 57 |
| Versions | 113 | 115 |

The decoded post-recovery project value contains 2,481,344 characters. Lossless gzip/base64 storage accounts for the reduction; no project, history, scene, response, or unrelated key was removed. Subsequent saves remain compressed. Opening a workspace changes its `updatedAt` and may change compressed length by a few characters. IndexedDB is separate from this localStorage measurement; its physical usage before recovery was not measured.

Verification completed:

- Safari visibly rendered the estate master plan, ground floor, and Level 1. Ground floor showed the guest pavilion's three resolved rooms; Level 1 showed the retained residence shell/stair reservation. Three building shells, five outdoor features, and four routes remain in the original generated scene.
- Level 1 viewing preference survived a full Safari reload. The local plan editor opened successfully and was cancelled without saving changes to the recovered design.
- Native workspace Undo selected the preserved blank version; Redo restored the exact generated scene. Final integrity verification confirmed the two-version history and generated cursor remained exact.
- An isolated test using the actual backed-up scene edited the plan's concept text, saved through the normal store and quota-triggered compression, exercised undo/redo, and reloaded from compressed storage. It verified the original projects, original version prefix, 23 unresolved items, and three room-layout drafts remained intact. It made zero network requests and did not touch real browser data. The isolated edit is absent from the recovered workspace.
- Twelve existing storage/client/view tests passed. TypeScript and ESLint passed for the added recovery code. The separate actual-snapshot test passed too.

The recovered design retains the original architectural limitations. Terra authored 26 requested spaces; the successful application's saved scene resolved three guest-pavilion rooms and retained 23 other spaces as three unresolved room-layout drafts (main residence ground and upper levels, and service garage). It also retained 23 unresolved adjacency items. Diagnostics cite size/proportion constraints and a fixed stair reservation. These were already present in the successful live scene before the quota failure. Recovery preserves them and the raw provider response exactly. Main-residence and garage room subdivisions therefore remain undrawn; this recovery does not certify a complete floor layout or architectural quality.

Remaining storage growth was investigated. The original 56-project snapshot contains 720,894 characters of current scene strings and 1,301,808 characters of version scene strings before JSON escaping. Every permanent version stores a full scene, while the current scene is also stored on the project; the full collection is rewritten on project edits, view changes, and workspace timestamp updates. Compression addresses today's failure but remains finite and synchronous. The response cache in `planClient.ts` creates a separate uncompressed key per response hash with no retention bound (45,209 value characters across three keys currently). The asset store uses 203,700 characters. The generation store uses 110,878 characters; reports are capped at five, but its per-project/placement outcome map has no bound. Other uncompressed keys could eventually consume headroom even when projects are compressed. No growth-related data was purged or trimmed. A future durable IndexedDB store for complete project histories and response evidence would remove this dependence on localStorage capacity while preserving all records.

Original evidence remains in place:

- IndexedDB `ai-architect-quota-recovery` / `snapshots` / `2026-10-22`, with original `persisted` and `live` values unchanged.
- A separate append-only recovery record under `exact-recovery-3b599d4ffe1a888a97610eb1622b620cc055cadfa69f84050767fd471d4c9787`, containing the pre-write project snapshot and recovered identity.
- The original `.v3-debug/plan-evaluations/3b599d4ffe1a888a97610eb1622b620cc055cadfa69f84050767fd471d4c9787.response.json` and capture file, unchanged.
- Independent browser downloads and protected local copies in `.v3-debug/terra-quota-recovery/`. The before export contains complete browser storage and must remain private.

[Independent integrity proof](../.v3-debug/terra-quota-recovery/independent-proof.json), [isolated edit proof](../.v3-debug/terra-quota-recovery/isolated-edit-proof.json), [independent verifier](../.v3-debug/terra-quota-recovery/verify-independent.mjs), [estate screenshot](../.v3-debug/terra-quota-recovery/estate-master-plan.png), [ground floor](../.v3-debug/terra-quota-recovery/ground-floor.png), [Level 1](../.v3-debug/terra-quota-recovery/level-1.png).

A development-only inspector at `http://localhost:3000/dev/terra-recovery` can repeat integrity verification and export evidence. Its recovery action refuses mismatched backups, responses, or concurrent project changes and reuses the recorded recovered identity. It is unavailable in production.

No generation/provider requests, credential changes, commits, pushes, or deployments were performed. The architecture was not simplified, redesigned, or repaired. Ordinary local page loads and the workspace's existing read-only configuration requests occurred during browser verification.
