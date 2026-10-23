# Prepared evaluation — DO NOT EXECUTE

One future initial 2D design request to the existing Terra agent, after the provider availability issue is resolved. No live request was executed for Phase 2. No follow-up design, repair, exterior or 3D provider request belongs to this evaluation.

## User prompt

> Design an extraordinary US$15 million private estate overlooking the Caribbean Sea in Saint Lucia. For this conceptual study, use a level 130m east–west by 110m north–south site: sea views to the north and road access at the south boundary. Treat these as study assumptions, not surveyed conditions, and keep the existing flat terrain. Imagine a memorable place to arrive, live, host friends and retreat in privacy. Choose a coherent architectural identity and an appropriate family/guest/service program with your own judgment. Give the property a convincing spatial idea, thoughtfully proportioned buildings and outdoor spaces, climate-conscious indoor–outdoor living, and believable room layouts and circulation on every floor you choose. Make geometry, landscape and arrival work together. You have broad creative freedom; select amenities and expressive forms only when they strengthen the design. Resolve weak relationships before finalizing one authoritative 2D estate and floor plan. Briefly explain the spatial idea and important assumptions in the concept. Produce the 2D design only; leave exterior development and 3D construction for after my review.

## Execution boundary

- New blank **flat V3** project; `POST /api/ai/plan`, `action:"design"`, through **Design 2D Plan**. Existing projects must remain untouched. The route requires `AI_V3_PLAN_EVALUATION=1`; this task changes no rollout flag.
- Check the running route's read-only `GET /api/ai/plan` diagnostic before any future request. Confirm the enabled route, configured model, pricing and one-call/10,000-output-token settings. Do not infer running configuration from a source file.
- Exactly one initial authoring request; SDK `maxRetries:0`, 270-second abort, 300-second route duration. No additional agents. Do not click **Build in 3D** as part of this evaluation.
- Archive the actual active prompt and submitted brief locally with the resulting response hash before comparing designs. The generated [active prompt snapshot](active-2d-prompt.txt) is the current offline baseline, not proof of a future running server's prompt.

## Cost estimate

The repository's `DEFAULT_PRICING` for `gpt-5.6-terra` is $2 per million uncached input tokens, $0.20 per million cached input tokens, and $12 per million output tokens. These are configured estimates, not verified current provider prices. Model overrides may change the applicable rates; use the diagnostic's model/pricing for the eventual decision.

About 5,000–6,000 input and 6,000 output tokens would estimate **$0.082–$0.084**. With 6,000 input and the full 10,000 output budget, the estimate is **$0.132**. Prompt character/4 estimates are approximate; actual tokenization, reasoning/output accounting and provider billing can differ. This is not a guaranteed cost cap. The future exterior call would cost extra and is excluded.

## Retention and failures

The existing route captures completed-step text **before application parsing/validation**. Full credential-redacted text is retained without truncation in `.v3-debug/plan-evaluations/<sha256>.response.json`; `<sha256>.capture.json` records the safe text, hash, original hash/byte counts and redaction state. Immutable `wx` writes preserve older responses. On read-only hosts, evidence remains in the HTTP response; inspect the recovery payload and download it immediately rather than assuming disk retention succeeded.

The client stores recovery under `ai-architect-plan-response:<sha256>` in localStorage, including rejected responses when present. Successful geometry is saved as an undoable project version, with brief, response hash and usage metadata. Failure diagnostics use `.v3-debug/plan-evaluations/<uuid>.failure.json` with action/project correlation, status, allowlisted provider code and request ID when available. Existing usage logging records reported usage/cost; it does not certify billing when an exception carries no usage.

Possible outcomes include HTTP 429, transport/timeout, refusal, truncation, invalid JSON, schema failure, unresolved geometry, or a valid but generic/poor design. Stop after any failure and inspect retained evidence; do not retry automatically. A 429 with no completed text has no architecture to judge. A parseable response may remain an editable draft with unresolved objects. A valid response with weak composition is a failed creative evaluation, not proof of architectural excellence.

## Review the actual 2D drawings

Inspect the estate, ground floor and every upper floor at useful scales. Compare the concept with the geometry: hierarchy/proportions, arrival and entrance, usable public/private/service relationships, possible room access, aligned landings, climate response, views and outdoor connections. Keep objective diagnostics separate from architectural observations. Neither shape complexity, amenity count, budget adjectives nor a clean validator earns an excellence label. A simple rectangle can succeed when the spatial relationships justify it.

Retain both strengths and weaknesses with room/building IDs and screenshots. Evaluate the drawing before any exterior design. These offline examples do not predict Terra's natural creativity; this future response would supply the first relevant evidence for the revised instructions. Consider staged paid design only if a specific observed failure demonstrates a plausible benefit, with a separate proposal first.

## Current decision: NO-GO for spending

The prior [429 investigation](../FAILED_PAID_2D_RECOVERY.md) establishes that the October 21, 2026 16:04 Saint Lucia attempt failed at the provider boundary before a completed design response. Its original HTTP body/provider code was not retained. Rate limiting and exhausted quota therefore remain indistinguishable. A zero-token usage row is not confirmation of available credit or an invoice.

Before recommending execution, establish through existing account/admin information that the configured project's quota/billing and model access are available, and check applicable request/token limits or any recorded request-ID diagnosis. No trial generation is needed to establish those prerequisites. If the cause cannot be resolved from existing evidence, keep this **NO-GO**. Phase 2 does not change credentials, create keys, clear captures or test the provider. Offline correctness is ready; provider availability and natural design quality remain unproven.
