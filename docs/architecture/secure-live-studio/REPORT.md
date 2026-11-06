# Secure private-development staged Studio

The first real prompt-driven run is prepared, but **no paid calls or real live approvals have been made**. The new private Studio path is implemented and tested offline. The developer must complete private sign-in and explicitly approve the [exact live packet](APPROVAL.md) before a model can be called. No production database, deployment, commit or push was performed.

## What changed

The private development site now has server-verified password authentication, using a one-time local bootstrap secret, salted scrypt password hashing, opaque 256-bit sessions stored by hash, expiry/revocation, login throttling, HttpOnly/SameSite=Strict cookies, a session-bound CSRF token and a pinned localhost origin. It supports one private developer. This is deliberately a single-machine localhost backend, disabled on production and Vercel. HTTP cookies are permitted only on that pinned loopback origin; remote use needs a separate TLS/shared-storage design. The existing email-only gate provides no authorization here.

An ignored owner-only local file store atomically replaces and fsyncs state under an exclusive cross-process transaction lock. It contains authenticated owner/project relationships, exact-brief approval consumption, stage state, architectural source, checkpoints and an authoritative per-call usage/reservation ledger. No database is necessary for this local scope, so no migration was prepared or applied. This backend must not be used across different machines or serverless instances. A stale lock fails closed and is not automatically broken.

Before every paid stage the service verifies session, CSRF, ownership, exact approval policy, expected stage, duplicate-request key, cumulative cost and call limits, and absence of another running/unaccounted call. It durably reserves the full worst-case cost before constructing the provider. Each reservation permits one network dispatch only. The new transport gate also blocks legacy model helpers when called without a reservation, independently of the HTTP proxy. Legacy AI routes remain proxy-blocked and all non-login legacy admin routes are now hidden locally too, closing the previous admin learning/research spending path. The new private HTTP route authorizes every operation itself. Paid semantic-edit endpoints remain disabled.

The provider is fixed to the approved Terra model and price snapshot, with no retries, fixed token/output limits and a complete-wire byte ceiling checked before transmission. Provider usage, cached tokens, reasoning details when reported, request IDs, finish reasons and costs are persisted before geometry construction. Invalid output is still billed and recorded. Missing usage holds the full reservation and stops future calls rather than claiming it cost zero. Ledger data survives page refresh and process restart; an interrupted running call is not automatically dispatched again. Failure to persist/settle stops the run. Local files contain private prompts and authentication records and must not be deleted to reset allowances.

The Studio includes private sign-in, owned server-project creation, the new description input, start/continue controls, checkpoint inspection, recovery reads, server saving and import into ordinary browser project history with staged source. A browser disconnect does not pass its abort signal into the paid provider; the bounded server call can finish and be read later. After a server crash the last committed checkpoint remains; ambiguous calls stay blocked for reconciliation. No new architectural features, model defaults or generation engine were added.

## Prompt-driven evidence and limits

The three original sample workflows **do choose among predefined authored mock houses**. They are useful regression fixtures, not evidence of general prompt interpretation. The live path imports none of those mocks and never selects architecture by prompt equality. Its only exact-brief comparison is approval authorization, not design selection.

The new requested description is not one of those samples. Offline tests send it through the actual five `LiveDesigner` stages and through the real OpenAI SDK wire serialization, intercepting HTTP before any external network. Each stage receives the entered description and accepted prior decisions; the response uses the same stage schema the live call will use. Stage 3 returns room relationships for the existing deterministic solver. Separate tests supply different identities and mass sizes for the **same** prompt and confirm those independent model responses become different accepted construction, rather than a selected template.

The wire test's architectural decisions and browser test's decisions are still authored doubles. They do not prove Terra will follow the new brief, create a beautiful house, include every requested feature or complete all stages successfully. The first authorized run will be the first evidence of that behavior. No model repair loop disguises a failed stage. The original Breezeway response/checkpoints are never loaded by the live path.

Current schema limits remain: flat land, rectangular blocks, one/two storeys, the supported room/material/roof vocabulary, and a pool-based site contract. The secure path explicitly refuses common incompatible terrain/basement/curved/no-pool requests and requires an explicit bedroom count. This is a limited requirements parser, not a complete natural-language capability detector. More subtle unsupported requirements may emerge as stage findings and need human review. Geometric validation is not architectural or engineering certification.

## Evidence

158 tests passed across 18 files. Typecheck, focused ESLint and diff whitespace checks passed. The secure browser workflow passed with zero page errors.

- [Offline test results](tests.json): authentication, ownership, budgets, concurrency, idempotency, restart/unknown-usage holds, provider wire contracts, semantic editing, staged regressions and legacy guards.
- [Browser workflow](browser.json): real auth/store/HTTP handlers backed by an isolated temporary account and approval; injected offline provider; new prompt stages 1–5, inspection, save/import, reload and server reopen. The application's real account/approval was not used.
- [Browser capture](offline-browser.png): explicitly offline model decisions in the normal Studio viewer, not a real AI generation.
- [Actual local denial probes](local-route-check.json): private project mutation returned 401 without a session despite a spoofed admin email; legacy scene/house returned 403; legacy admin learning returned 404.

The real local store was initialized by the unauthorized probe: a bootstrap code and empty state exist, with no account, approval, run or paid-call records. No bootstrap secret or password was printed or included in evidence. Tests use separate temporary stores and dummy credentials. The existing OpenAI key was neither read into output nor modified.

Reproduction (all provider traffic mocked):

```sh
npx vitest run src/lib/privateStudio src/lib/ai/paidExecution.test.ts src/lib/ai/model.capture.test.ts src/lib/villa/staged src/proxy.test.ts src/app/api/dev/staged-generation/route.test.ts
npm run typecheck
npx vite-node --config vitest.config.mts scripts/secure-studio-browser.ts
```

The browser script uses the existing localhost:3015 development server, local Chrome and the local Playwright installation named in the script. It intercepts private API calls into a temporary backend and blocks all real paid/external requests. The real live packet remains unapproved; no production database was accessed.
