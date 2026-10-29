# Controlled live Terra Redesign — rejected response, original preserved

Exactly **one paid OpenAI request** was made to `gpt-5.6-terra`, using the existing key. **Zero retries.** Terra returned an architectural concept but **no construction operations**. The existing output validator rejected the response. **No redesigned candidate exists, no architectural improvement was applied, and the original 67-element mansion is unchanged.** No additional generation/review calls, learning writes, migrations, commits or deployment occurred.

## Recipe revision and approval

All nine recipes were revised and approved as **version 2**, using the existing `importArchitecturalKnowledge` workflow. All nine passed; no entries failed review. Schema validation, review/source requirements, optimistic concurrency, duplicate title/ID checks, supersession checks, atomic persistence and revision history remained active. The existing `library_docs` table was checked before use; no CREATE, ALTER or other schema migration ran.

Each recipe now distinguishes estimated property value from construction budget; identifies location, land value, market conditions, condition and other price factors; describes flexible architectural ambition, spatial quality, craftsmanship, complexity and possible amenities; and preserves creative freedom without fixed areas, storeys, rooms or amenities. Distinct modest-home, refined/premium-residence, luxury-mansion and exceptional-estate profiles remain. Band endpoints use the existing lower-inclusive selector, so exactly $25m selects $25m–$50m.

The verified curated source is the **current user's explicit subjective-design instruction**, recorded in [authorized-recipe-brief.md](authorized-recipe-brief.md). It verifies curation preference only, not market prices or costs. The unverified legacy user-brief attribution remains unverified. No market source was invented or relabelled as verified. See [revised submission](revised-recipe-submission.json), [approval receipt and full histories](recipe-approval.json), and [review results](recipe-review.json). The previous blocked review is preserved separately for history.

## Workflow and preflight

The normal `/workspace` direct-scene editor uses `OperationStudio`. Its **Redesign** button sends `mode: edit`, `editIntent: redesign` to `/api/ai/scene`, through `developmentRequest`. `sceneSystemPrompt` explicitly permits replacing/removing/reorganizing major volumes, floors, walls, roofs, entrances and façades, overriding conservative composition-preservation instructions within the requested architecture. All operation/geometry/support/attachment budgets remain active. Browser verification intercepted this actual request and confirmed the original version remained unchanged.

**31 targeted tests passed** across the Redesign transaction, canonical scene route and property-value selection tests. These cover permissions, canonical prompt/retry settings, atomic construction, original/version preservation, undo/redo/reload, invalid transaction recovery and value-band selection. All nine revised entries also passed the unmodified approval schema before submission.

The paid call ran in `scripts/redesign-controlled-once.ts`, using the same model, request builder, system prompt, retrieval, lessons, messages, provider output schema and construction resolver as the canonical route. This controlled harness adds an exclusive attempt marker, `maxRetries: 0`, a one-request transport guard and raw-response retention. It does not claim that a paid browser request was made; browser checks and result replay were offline with provider traffic blocked.

The input was the exact raw original [original.scene.json](../25m-mansion-recovery/original.scene.json), not a later developed or hand-authored study. Its hash was checked again after the call and is unchanged. [Preservation audit](preserved.json), [request](request.json), and [settings](settings.json) retain the exact baseline and prompt. The prompt required fundamental recomposition and explicitly identified the original two railing-height defects and overlapping upper floor allocation for coordinated resolution.

## Knowledge actually retrieved and sent

| Entry | Version | Role |
|---|---:|---|
| `property-value-25m-50m` | 2 | Exceptional-estate subjective design ambition |
| `facade-materials` | 1 | Façade/material relationships |
| `roof-main-secondary` | 1 | Primary/secondary roof hierarchy |

Retrieval supplied **5,653 characters**, within the existing 6,500-character scoped-edit budget. Its estimated token count is a character-based estimate, not an isolated measured token charge. The full selection and text are in [knowledge.json](knowledge.json). The standard built-in architectural design guide and retained lesson context were also included; [settings.json](settings.json) records the exact final system text. Terra's concept explicitly cited all three retrieved entries, but its `constructed` labels are unsupported because it supplied no operations.

## Actual provider result and usage

HTTP **200**, provider status **completed**, `finishReason: stop`, no provider error. Request ID: `req_70e81b10943c4f2cbf9b2efbe03912cf`.

| Token measure | Actual tokens |
|---|---:|
| Input | 11,047 |
| Output | 3,302 |
| Total | **14,349** |
| Reasoning, included in output | 2,439 |
| Text output, included in output | 863 |
| Cache read, included in input | 0 |
| Cache write, included in input | 11,044 |

The provider response included only `architecturalPlan`. It omitted the required **`name`, `summary`, `unsupported`, and `operations`** fields. The transmitted schema did require these fields; the existing provider setting was `strict: false`. The SDK correctly rejected the output. This was neither a token-limit termination nor an authentication, quota or transport failure. The precise reason Terra stopped without the required fields is not established by this one response. No retry, schema weakening, field repair, invented operations or geometry simplification followed.

**Returned operations: absent. Applied operations: 0. Added, removed, moved or resized elements: 0.** See [audit.json](audit.json), [raw provider response](provider-response.raw.json), [SDK validation evidence](sdk-failure.json) and [failure receipt](failure.json).

## Architectural assessment

The **unbuilt concept** proposes a stronger primary salon, lower independent owner/guest pavilions, a compressed north arrival gallery, limestone forecourt and bronze portal, a deep south loggia, varied openings, deep eaves and a restrained limestone/timber/bronze palette. It proposes removing the overlapping upper arrangement and using a single-level residence. This is a substantial compositional idea, rather than an accessories-only proposal, but it is **not a constructed redesign**. Its dimensions, enclosure, supports, access, roof relationships, site preservation and façade quality cannot be validated without operations.

The concept also says the former dining, kitchen and lounge composition would be removed, without establishing replacement everyday/service facilities. It therefore does not establish a complete residential programme. Its claims of constructed knowledge application are not accepted as evidence.

The original's inadequate arrival, broad dominant timber roof surfaces, sparse façade articulation, two railing-height defects, overlapping upper retreat/suite floors and missing usable stair evidence remain. Original geometry and architectural warnings were retained, not repaired or suppressed. No candidate was approved or written to successful-design learning. Existing lesson filenames were unchanged by the call.

## Matched views and preserved version

These are **original versus unchanged state after rejection**, not images of a successful redesigned candidate. A fresh browser context replayed the retained error through the actual workspace Redesign UI, with all paid traffic blocked. The single original project version and every rendered element ID remained unchanged. Position, target and field of view match for each pair; rendered geometry had no non-finite vertex coordinates. Pool water animation can vary between captures.

| View | Before | After rejection — unchanged |
|---|---|---|
| Arrival | [Before](before-arrival.png) | [Unchanged](after-UNCHANGED-NO-CANDIDATE-arrival.png) |
| Aerial | [Before](before-aerial.png) | [Unchanged](after-UNCHANGED-NO-CANDIDATE-aerial.png) |
| Poolside | [Before](before-poolside.png) | [Unchanged](after-UNCHANGED-NO-CANDIDATE-poolside.png) |

[Browser verification](browser-result.json) records the matching cameras and unchanged state. [Preserved project/version artifact](preserved-versions.UNAPPROVED.json) contains only the original version and explicitly records `NO_CANDIDATE`. The concept is retained separately as [NOT CONSTRUCTED](concept-only.NOT-CONSTRUCTED.json).
