# Prompt-driven staged Studio integration

The Studio now has a prompt-generation flow separate from the retained-villa replay. A provider-independent controller advances the existing five-stage pipeline one stage at a time. The internal Terra adapter uses the existing `LiveDesigner`, not the retired one-shot scene generator. **Arbitrary live prompt generation remains disabled.** This work proves the connection with mocked model responses; it does not establish that Terra reliably designs these houses.

## Connection and preservation

The original user description, flat site, accepted design direction and prior accepted decisions reach each stage. Stage 1 chooses identity and materials; Stage 2 chooses blocks and dimensions; Stage 3 returns a coordinate-free room programme and relationships for the existing room solver; Stage 4 supplies roofs, facade treatments and entrance choices; Stage 5 supplies finishes and the outdoor environment. Existing deterministic compilation, geometry validation, stable component IDs and source saves remain in use. Explicit bedroom and storey counts are checked; an omitted bedroom count is left to the brief/model rather than accidentally requesting zero bedrooms. The small English count parser is not a general natural-language requirements interpreter.

`advancePromptRun` resumes server-owned checkpoints, invokes one next stage and returns the last accepted scene after rejection. Five calls per complete run, no corrective calls or automatic retries, existing 12,000-token ceiling and 170-second provider timeout. Resuming no longer resets the pipeline's call and reported-cost counters. Provider exceptions also notify checkpoint callbacks. These counters are accounting safeguards, **not secure spending reservations**.

The Studio accepts a description, exposes each accepted stage, preserves earlier geometry when a later stage stops, and saves the compiled scene together with its editable staged source. Saved source can be reopened after a browser reload. Concurrent project changes prevent replacing the saved baseline. The prior fixed-villa rehearsal remains explicitly labelled and collapsed below this flow; the new path never reads its geometry or retained response files.

The original general Stage 1–5 slice interface was selected for the internal adapter because it supports the different massing and entrance orientations without forcing the retained villa's composition. The newer focused exterior and landscape request builders were also inspected and had unconditional Caribbean/Mediterranean style instructions removed. Their brief forwarding is tested. They are **not** silently substituted into this controller: the focused site solver still requires a south veranda, north arrival and its limited tropical/pool vocabulary. Unifying those richer solvers across arbitrary courtyards and orientations is future work, not a completed capability.

## Offline evidence

The Studio's mock endpoint supports **only three exactly labelled sample descriptions**. It explicitly rejects other descriptions instead of mapping them to a villa. Editing the description routes to the separately blocked live endpoint. Sample fixtures are intentionally authored mock model decisions, not a general prompt interpreter and not AI quality evidence. All three use the actual programme solver at Stage 3, not pre-solved room rectangles.

| Authored mock request | Bedrooms | Storeys | Gross block area | Scene elements | Stage validation findings |
| --- | ---: | ---: | ---: | ---: | ---: |
| Compact Caribbean home | 3 | 1 | 216 m² | 69 | 0 |
| Spanish courtyard villa | 4 | 2 | 368 m² | 135 | 0 |
| Modern connected-wing estate | 6 | 1 | 546 m² | 115 | 0 |

The Spanish result has two ground wings flanking a clear 6 × 8 m courtyard recess, upper bedrooms, a constructed stair and terracotta roofs. The estate has two connected gallery/bedroom wings and flat roofs. The compact house has one enclosed mass and a different solved plan. Every result round-trips through `loadHouse`; tests also apply an isolated semantic finish edit and reload its source without altering the saved baseline. The modest mock garden and stylised rendering are not premium landscape or architectural-quality claims. Zero stage findings do not remove the Studio's separate completeness warnings or certify engineering, code compliance or arbitrary navigation.

[Offline results and scene hashes](offline-results.json) · [test results](tests.json) · [browser results](browser.json)

[Compact Studio capture](compact.studio.png) · [Spanish Studio capture](spanish.studio.png) · [Estate Studio capture](estate.studio.png)

## Security and usage

[The private-development security specification](SECURITY.md) records the inspected email-only login, browser-local project storage and tolerant usage logger, and defines verified server sessions, owner-scoped projects, atomic worst-case reservations, idempotency, durable checkpoints and settlement of actual usage. These controls are specified, not implemented or verified. There is currently no secure live admission path.

The proxy's blanket paid-route block remains. The new live handler independently returns 403, including when called directly with a spoofed admin email; there is no enable flag or provider import in that route. Offline orchestration is hidden in production/Vercel, requires same-origin requests, and imports no paid provider. Its in-memory run store has a one-hour expiry, a 20-run capacity and a per-run concurrency lock. It is development mock state, not authenticated persistence. Incomplete previews remain in the current browser component and server process; they do not survive a browser refresh as resumable runs. Completed saved source/checkpoints persist in browser project history. Production durability requires the specified server store.

The Terra provider now uses the existing pricing utility, including cached-input pricing and configured pricing overrides, refuses unpriced models before calling, and retains usage when lazy structured-output access throws. SDK-mocked tests exercise all five actual adapter calls and billed output failures. This is not a billing-ledger integration: durable per-user cost records and unknown-usage reservation reconciliation remain activation requirements. The provider's returned cost is not presented as an enforceable dollar cap.

## Verification and reproduction

138 tests passed across 14 files covering the staged system, new controller, HTTP handlers and proxy. Typecheck and focused ESLint passed. Three local Chrome Studio workflows passed stages 1–5, inspection, exact scene/source saving, reload and reopening, with no page errors or observed WebGL context loss. The browser script blocks external traffic and all AI mutation requests; existing metadata GET requests are stubbed locally. It allows only the offline stage endpoint to execute. All SDK calls in provider tests are mocked. No database or billing logger was invoked.

```sh
npx vite-node --config vitest.config.mts scripts/prompt-staged-offline.ts
npx vitest run src/lib/villa/staged src/proxy.test.ts src/app/api/dev/staged-generation/route.test.ts
npm run typecheck
node scripts/prompt-staged-browser.mjs
```

The browser script uses the existing development server on port 3015, local Chrome and the local Playwright installation named in the script. Its first sandboxed launch could not start Chrome; the approved local execution succeeded. An initial assertion counted intercepted metadata GET requests as AI execution; it was corrected to distinguish reads from mutation requests. The compact mock was reduced from 280 m² to 216 m² and the final evidence was regenerated. A smaller 180 m² trial was rejected by the room solver; no validator was relaxed to accept it.

Existing unrelated uncommitted changes and historical evidence were preserved. No API key was created, exposed, copied, rotated or modified. Paid provider calls: **zero**. No production database access, migrations, commits, pushes or deployments occurred.
