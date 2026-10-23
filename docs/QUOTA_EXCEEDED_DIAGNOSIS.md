# Design 2D Plan: browser persistence quota

Investigated 2026-10-22. No paid requests, credential changes, commits, pushes, or deployments were performed.

## Root cause

Safari's native `Storage.setItem` throws `DOMException` with name `QuotaExceededError`, message `The quota has been exceeded.`, and legacy DOM code `22`. The application was displaying this raw browser error after a successful generation. It is unrelated to available OpenAI credits.

The exact application call chain on the affected attempt is:

1. `Design2DPlan.design` creates a blank V3 project.
2. `requestPlanEvaluation` POSTs to `/api/ai/plan`.
3. The route validates the blank project and calls `withUsageLogging` → `generateText` → `getAiModel` → `@ai-sdk/openai`'s `openai.responses` adapter → `https://api.openai.com/v1/responses`.
4. One provider call completes; the response is retained, normalized, and returned to the browser. Retries are disabled.
5. The client caches the retained response and calls `useProjectStore.appendVersion`.
6. Zustand `persistImpl.setItem` → `createJSONStorage.setItem` → native `window.localStorage.setItem('ai-architect-projects', ...)` attempts to rewrite every project and version. The native write exceeds Safari's quota.
7. Zustand has already changed memory, but durable browser storage still contains the blank project. The raw exception reaches the landing page instead of navigation to the plan.

Creating the project was also outside the button's `try` block, so an earlier storage failure could leave the button busy. This secondary error-handling defect is fixed too.

## Evidence from the actual attempt

The configured Postgres usage log was queried in a read-only transaction:

| Field | Value |
| --- | --- |
| Started | 2026-10-22 09:58:42.890 America/St_Lucia (13:58:42.890 UTC) |
| Project | `d4fbb3cc-b8c1-4d7f-a48f-9b2a82de11c8` |
| Stage / model | `v3-plan-evaluation` / `gpt-5.6-terra` |
| Provider result | `success: true`, `finish_reason: stop` |
| Upstream error category / diagnostic | Both null |
| Output SHA-256 | `3b599d4ffe1a888a97610eb1622b620cc055cadfa69f84050767fd471d4c9787` |
| Retained raw response | `.v3-debug/plan-evaluations/3b599d4ffe1a888a97610eb1622b620cc055cadfa69f84050767fd471d4c9787.response.json`, 14,883 bytes |
| Retained response redacted | false |
| Browser durable project | 1 version, 162-character blank scene |
| Browser live project | 2 versions, 47,303-character generated scene |
| Browser storage | 56 projects; project value 2,357,168 characters; total localStorage keys and values 2,725,973 characters |

Re-persisting the existing live state, without generation, reproduced the exact error. Safari's stack reported `setItem@[native code]`. Both the durable snapshot and the complete live state were first backed up to IndexedDB database `ai-architect-quota-recovery`, store `snapshots`, key `2026-10-22`, properties `persisted` and `live`.

The original successful upstream HTTP status and response headers were not retained by the existing logger; its provider request ID field is null. No upstream error code/message exists for this successful attempt. The UI failure is a native DOM exception, not an HTTP 429. An older 2026-10-21 usage entry records `provider_429`, but does not retain its upstream code or message and is a different attempt.

## Provider and credentials

- The app imports an explicit OpenAI adapter, bypassing the SDK's default gateway. The installed adapter defaults to `https://api.openai.com/v1`; its selected interface is `openai.responses`.
- `.env.local` supplies `OPENAI_API_KEY` and `AI_HOUSE_MODEL=gpt-5.6-terra`. No other workspace env files were found.
- The running server's inherited environment has no OpenAI key overriding the env file, alternate OpenAI base URL, organization/project setting, or HTTP/HTTPS proxy.
- A read-only `GET /api/ai/plan` returned HTTP 200 and confirmed this model, one call, and a 10,000-token output allowance.
- A read-only OpenAI `GET /v1/models` using the existing local configuration returned HTTP 200 and listed the configured model. No inference was requested. Metadata request ID: `9c5cacba-aa2a-4e70-9188-d843ed826667`.
- The adapter sends no explicit `OpenAI-Organization` or `OpenAI-Project` header. These are determined by the existing key's scope. The model-list response did not include organization/project headers, so their exact account IDs cannot be established from available evidence. No key was decoded, displayed, rotated, or replaced.
- Lovable Cloud, Supabase, a model/project spend limit, a generation proxy, and an internal application quota are not the source of this browser exception. The successful provider response and reproduced native storage failure establish the cause.

## Corrective change

`src/lib/storage/projectStorage.ts` transparently reads legacy JSON and, only when necessary, atomically replaces the project value with lossless gzip/base64 storage. Subsequent saves stay compressed. It retains every project, full scene, version, and ID; it does not clear storage or trim history. The existing `fflate` installation is now declared as a direct dependency. All application reads of the durable project value use the decoder, including recovery, mode verification, and deletion.

The plan client distinguishes post-generation storage failure from provider failure, preserves the retained response for download, restores the previous in-memory project state if saving fails, and tells the user not to generate again. Blank project creation is now caught and the busy state always resets.

The generation route, architectural prompts, model, provider adapter, normalization, geometry, construction, validation, and call limits were left unchanged.

## Verification

- 33 targeted tests pass, covering quota overflow, exact project/history reload, undo/redo, deletion, recovery import, workspace view persistence, provider-success/browser-save-failure handling, retained response availability, and failure rollback. An initial run hit the existing 5-second timeout in an architecture-heavy test; the targeted runs completed successfully with a 20-second test timeout.
- ESLint and TypeScript checks pass for the change.
- Browser recovery/reload verification is pending while Safari's window is unavailable to the computer-use tool (`cgWindowNotFound`). The preserved live snapshot allows recovery without another provider request.

Do not retry paid generation to recover this plan. Restore the existing live snapshot through the new storage adapter and verify it reloads.
