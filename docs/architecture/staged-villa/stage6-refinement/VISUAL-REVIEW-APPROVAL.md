# Stage 6 visual review — exact request ready for approval

**Status: NOT SENT. Zero provider requests, zero AI credits spent and zero refinements executed.** The accepted Stage 5 villa and every pre-existing working-tree/evidence file remain unchanged. There were no credential reads/changes, database operations, commits, pushes or deployments.

## Approve this packet only

Use **[review-request-2/approval.json](review-request-2/approval.json)**. `review-request-1` is retained preparation evidence and is superseded; it is not the packet for approval.

| Setting | Prepared value |
|---|---|
| Provider / endpoint | OpenAI, `POST https://api.openai.com/v1/responses` |
| Model | `gpt-5.6-terra`, medium reasoning |
| Planned requests | One, zero retries, no fallback or repair call |
| Maximum output | 4,000 tokens, including reasoning |
| Proposed maximum cost | **US$0.20** |
| Conservative calculated bound | **US$0.193935** |
| Images | Four original 2400×1040 PNGs, embedded bytes, high detail |
| Request storage / tier | `store:false`, standard (`default`) tier |
| Tools / truncation | No tools; truncation disabled |
| Future transport timeout | 170 seconds; timeout must stop without retry |
| Scope of approval | Visual review and specific proposals only; no application of refinements |

Exact compact-JSON body SHA-256:

`54c8755445fbe7fd6c9f99a645627c2a629eaddfbad3914bae6a884ffbc98e14`

The body is 8,226,570 bytes when serialized compactly. The stored file is pretty-printed; the hash deliberately covers `JSON.stringify(parsedBody)`, not its whitespace. The [complete provider body](review-request-2/wire-request.json) contains the actual image content. For reading, use [readable request](review-request-2/readable-request.json), which replaces image bytes with clearly labelled hash placeholders; **that readable preview must never be sent in place of the full body**. There are no authorization headers or credentials in either file.

## Genuine vision input and provider evidence

Loaded and visually inspected the actual Stage 5 arrival, aerial, garden and poolside images. The preparation script loads the real source/save/checkpoint, verifies provenance, reconstructs the normal 377-element scene, and validates its unchanged construction. The source has 23 rooms, four bedrooms and five bathroom rooms. The saved source and checkpoint compare equal despite harmless JSON property ordering differences.

The installed OpenAI provider SDK was exercised against an explicitly local intercepted transport with a dummy credential string. That callback never forwards a request or calls global fetch. Its captured body has **four `input_image` parts with `data:image/png;base64,...` contents**, each immediately preceded by its view label. Decoding each image reproduces the original complete PNG SHA-256, in the exact arrival/aerial/garden/poolside order. High detail is explicit; filenames and prose are not substituted for image content. [Image dimensions, hashes and original cameras](review-request-2/images.json) are retained separately. The installed SDK serializes its low-level image bytes as file parts; an early preparation check caught and corrected the incompatible image-part shape before any packet was accepted.

Official OpenAI documentation checked on 2026-11-04 lists image input, Responses and Structured Outputs for this exact model. The same model's documented standard rates are US$2/M input and US$12/M output, with cache writes at 1.25× input. [Exact model documentation](https://developers.openai.com/api/docs/models/gpt-5.6-terra).

Multiple embedded PNG inputs are supported. Terra's high-detail inputs are bounded at 2,500 patches per image with a 1.2 token multiplier. We send the original bytes; provider-side high-detail resizing is expected and is not a claim of original-resolution analysis. [Images and vision](https://developers.openai.com/api/docs/guides/images-vision).

The exact [response schema](review-request-2/response-schema.json) passed the repository's strict-schema subset checks: all object properties required, closed objects, bounded arrays, disjoint operation alternatives using supported `anyOf`, and semantic target enums from this villa. The SDK wire has `text.format.type:json_schema` and `strict:true`. Runtime validation remains necessary for refusals, truncation and cross-field relationships. [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).

**Offline verification cannot establish current account access, quota or actual provider interpretation of the images.** No live vision/model/token-count endpoint was contacted. Capability is supported by official documentation and serialization proof; the eventual raw response must establish live behavior.

## What Terra receives and must produce

The [measured context](review-request-2/context.json) includes the original architectural concept and hierarchy, current five enclosed blocks and their footprints/levels/roofs/finishes, all 23 named rooms and measured bounds, circulation links/stair, exposed facade runs and room functions, seven door identities, entrance/veranda, actual 12×4.5 m pool, existing palms/planting/furniture/routes and the compiled semantic ownership catalog. Original Stage 1 statements referring to a future pool are identified as historical intent; current measurements take precedence. Ten retained room-plan warnings are included verbatim, not erased by zero construction findings.

The prompt requires assessment of beauty/identity, proportions, roofs, facades, materials, entrance, pool and landscaping. It asks for ranked visual weaknesses and **up to three ranked concrete refinement proposals**, each linked to observed image evidence, an existing editable component, an exact semantic operation, an expected visual benefit and a before/after acceptance criterion. Renderer or texture limitations are separated from architectural decisions. Lighting washout, ground repetition, palm asset density and water optics must not provoke unnecessary changes to the building.

The proposal vocabulary uses existing editing concepts:

- `set-facade`: one measured exposed block side; punched or large windows. Software must preserve room-specific privacy and real door passages.
- `set-roof`: one existing pitched roof; preserve form, bronze material, overhang and topology. At most ±15% rise adjustment, plus a justified color choice. Flat terrace roofs stay fixed.
- `set-finish`: one block; account for dependent entrance/gable finishes. A limestone tint-only change is rejected because the corrected compiler forces its limestone tint.
- `move-site-item`: up to two listed existing palms or selected lounge/sunbed items, at most one metre per axis. No independent dining-group moves, route/bed/lawn-mask changes or additions.

No room resizing, new blocks, entrance relocation, pool move, terrain or decorative assets are offered. Plans, partitions, programme, circulation, stairs/voids/guards, massing footprints and levels, doors, veranda, pool and routes are preservation boundaries. A no-supported-change result is allowed; the model must not use tiny inconsequential edits to pretend success.

**This request deliberately permits actionable facade/roof proposals beyond the first narrow finish/move boundary. It does not claim those proposals are executable through `stageRefinement` today.** Their eligibility is checked without execution; they are explicitly marked as needing a bounded executor before application. This task adds request preparation and validation-only checks, not that wider executor. It would be misleading to promise that a review call alone will make the house better.

## Cost controls

The calculation excludes base64 image transport strings from text token counting. It conservatively bounds remaining text/schema/message input at **46,374 tokens** using UTF-8 byte count plus a 4,096-token framing reserve, and adds **12,000 image tokens** (four × 2,500 × 1.2). The total input bound of 58,374 stays below the documented 272K long-context pricing threshold.

The bound charges **every input token at US$2.50/M**, including a worst-case 25% cache-write margin, assumes no cache-read savings, and reserves the full 4,000 output tokens at US$12/M:

`58,374 × 2.50 / 1,000,000 + 4,000 × 12 / 1,000,000 = US$0.193935`

US$0.20 is a proposed per-request ceiling, not an existing approval. It replaces the earlier report's illustrative US$0.15 proposal because the exact multimodal packet's conservative bound exceeds that amount. The project experiment ceiling remains US$5; the historical failed Stage 3 cost is still unknown. No exact provider token count or invoice was obtained.

OpenAI has no per-request dollar-cap field in this body: the budget is enforced by a fail-closed preflight bound, fixed model/tier/output limits and a one-request guard, at the checked published rates. Before future execution, recheck pricing and all pinned source/image/wire/schema hashes; stop if anything differs or exceeds US$0.20. Any later live runner must reserve sticky exclusive attempt/network markers before the one POST, reject redirects, disable retries and retain raw response/HTTP/usage/finish information before interpretation. A refusal, timeout, truncation, bad schema or rejected proposal stops without a repair call. This preparation script has **no live branch** and does not implement such a runner.

## Validation after an approved review

Approval of this packet would authorize only the review response. It would not authorize automatic refinement execution. The next milestone must continue beyond criticism through these separately recorded checks:

1. Retain raw review/usage/finish status, then parse the strict response and validate rank/evidence/semantic references. Reject renderer-only justifications, unknown targets, repeated targets, no-op edits, ineffective limestone tints and roof changes outside the stated bounds.
2. Establish application-owned exact target/dependency scope. Finish/move subsets can use the existing boundary where they fit; facade/roof proposals require a bounded extension and offline compiler/preservation coverage before application. Never let model prose assign permissions.
3. Apply an authorized transaction atomically through the existing spec/compiler path and all stage validators/hard relationship checks. Validate source changes against the exact operations and compare the complete source for unrelated changes. Recheck all 23 rooms/types/dimensions, partitions, links/stairs/voids/guards, door passages, flat site, dry routes, collisions and furniture support. Door IDs and unscoped elements/ownership must remain stable. Facade re-cutting additionally needs conserved exposed wall runs, privacy/sill checks, explicit dependent trim scope and no deletion of unrelated architecture. Roof changes need actual-surface/abutment clearance checks. Reject instead of trimming/removing components silently.
4. Enforce at most 400 elements from the current 377, report every added/removed/changed ID and require any additions to be necessary dependencies within the 23 remaining slots. Save the candidate separately, verify source recompile/save/reload and carry all prior warnings forward.
5. Render the accepted candidate through normal OperationScene/VillaScene at the exact retained four cameras, same lighting/material system, and compare before/after against the model's stated criteria. Archive images and browser errors/geometry checks separately. Geometry acceptance alone cannot establish beauty. A visually unsuccessful candidate leaves Stage 5 as the accepted baseline.

## Observed offline results

**21 preparation tests passed**, including exact image-content/order checks, model/output/detail corruption rejection, strict schema and real context, separated image cost bounds, over-budget rejection, unsupported/invented/renderer-only proposals, roof bounds and semantic mismatches, and pure preservation checks for programme, circulation, stairs, massing, pool, flat-site and cap violations. Synthetic response-shape/damaged-source copies in tests are explicitly developer fixtures; no edit executor or proposed refinement was run. [Test report](visual-request-tests.json).

Typecheck and focused ESLint passed. Original source validation and exact Stage 5 element reconstruction passed. Live-mode refusal and existing-packet overwrite refusal passed. All **419 pre-existing dirty/untracked files** pinned before this task remain unchanged; the final packet's source hashes also match. [Final checks](visual-request-final-checks.json), [packet verification](review-request-2/verification.json).

Not run: any paid call, actual AI review, actual refinement execution, candidate renders, wider/full repository tests, hosted checks or production integration. Earlier 87-test results remain historical and were not rerun here because those suites execute developer edit fixtures. Existing unrelated dirty work was preserved.

Reproduce preparation with a new immutable tag only:

```sh
npx vite-node --config vitest.config.mts scripts/staged-villa-visual-review-prepare.ts new-packet-tag
npx vitest run src/lib/villa/staged/visualReviewRequest.test.ts
npm run typecheck
npx eslint src/lib/villa/staged/visualReviewRequest.ts src/lib/villa/staged/visualReviewRequest.test.ts scripts/staged-villa-visual-review-prepare.ts
```

**Stopping point:** `review-request-2` is ready for the user's approval for one review request capped at US$0.20. Nothing has been sent or applied.
