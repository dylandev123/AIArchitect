# Stage 6: first offline refinement boundary

Read the current `../HANDOFF.md` first. The accepted baseline remains the actual Terra Stage 5 Breezeway Courtyard Villa: 377 elements, 23 rooms, four bedrooms and five bathroom rooms. No accepted source, checkpoint, image or existing code was overwritten. No model calls, credential access, database work, commits or deployment occurred.

## Review of actual evidence

Inspected the actual source/save and retained arrival, aerial, garden and poolside PNGs, plus the Stage 5 live report and current working tree. The inventory matches the handoff's 34 tracked modifications and 41 untracked entries before this work (new work is within existing untracked directory entries, plus the new script).

The arrival view shows a small entry pavilion against a large upper roof. Aerial and garden reveal extensive empty roof terraces and regular, narrow planting strips. Poolside shows a coherent but sparse outdoor room and thin palm crowns. These support the handoff's limitations; no visual score or premium-quality claim follows. Broad roofs/empty terraces are architectural decisions outside the initial transaction scope. Washed-out lighting, repetitive surrounding ground, simplified vegetation and water are renderer/asset concerns. Colour adjustments cannot resolve these collectively.

## Implemented contract

`src/lib/villa/staged/refinement.ts` is an offline staged-specific boundary, independent of the older direct-scene visual review. A strict review contains up to six view-labelled observations, semantic component IDs, responsibility (architecture/renderer/uncertain), a summary and zero to two supported suggestions. No-op/no-supported-change reviews are retained without an accepted candidate. The JSON wire schema passed the existing strict-provider schema check; no provider was contacted.

Application policy is separate from model prose. It pins the source/compiled scene/ownership hash, permits at most one finish block or two site-item targets, explicitly lists affected semantic components and bounds changed elements (maximum 80). The initial operation subset is `set-finish` and existing `move-site-item`, bounded to one metre per axis. A combined finish/movement transaction is conservatively rejected when its movement fails the finish-only geometry guard; use separate reviews. Unsupported roof/facade/room/pool/recomposition edits reject before execution. No new operations or renderer were added.

Candidates run through existing `runEdit`, the staged compiler and all stage validators/hard relationships with four bedrooms required. The existing Stage 3 room-area and narrow-circulation warnings remain applicable; this validation does not cure or certify them. Acceptance requires zero additions/removals, stable ownership, no changed element outside policy, at least one real change, the declared change budget, flat site and the unchanged 400 cap. Thus this first subset uses none of the remaining 23 slots. Finish edits may change material/colour/appearance and gable finish, but cannot alter other serialized element fields. Entry-pavilion finishes require explicit entrance and roof ownership permission as well as its room/block ownership. Rejected candidates return the original source; the baseline is rebuilt, not modified. No automatic repair or retry occurs.

This is a transaction boundary, not a complete Stage 6 refinement system. It cannot address the most important massing or empty-terrace weaknesses under current preservation rules. Visual merit is not checked by geometry validation. Policy must be application-owned, never copied from a model response.

## Separate evidence and verification

`boundary-1/input-hashes.json` pins the actual save, checkpoint, scene, browser evidence and all four screenshot inputs. `policy.json`, `developer-proposal.json`, `outcome.json` and `verification.json` are separate. The proposal is explicitly a SOFTWARE test fixture, not Terra review output. It moves palm-5 by 0.2 m; exactly one element changes and 376 remain unchanged. Save/reload and unchanged input hashes passed. The candidate was not rendered or promoted; no after image is fabricated. There is no raw provider review because no request occurred. This evidence predates the final diagnostic wording/type correction; the final suite tests the final boundary.

87 tests passed across seven staged test files, including 11 new boundary tests; `verified-tests.json` is the passing result. Earlier `tests.json` retains a failed intermediate diagnostic. Initial test failures exposed JSON negative-zero comparison, unsupported schema `oneOf`, an ineffective limestone tint change, and missing entrance scope; tests now use serialized equality, the supported union wire shape and explicitly scoped finish fixtures. Typecheck and focused ESLint on the new module, tests and script passed. Full repository tests, hosted checks, candidate renders, AI review and natural-language editing were not run.

Reproduce with a fresh, exclusive tag:

```sh
npx vite-node --config vitest.config.mts scripts/staged-villa-refinement-offline.ts new-tag
npx vitest run src/lib/villa/staged
npm run typecheck
npx eslint src/lib/villa/staged/refinement.ts src/lib/villa/staged/refinement.test.ts scripts/staged-villa-refinement-offline.ts
```

## Next work and paid-call boundary

Before any paid review, prepare the exact multimodal packet with measured semantic target context, retained screenshot bytes/cameras/hashes, unresolved Stage 3 warnings and application-owned policy. The reviewer may return no supported edit and must distinguish architectural observations from renderer limitations. If this limited vocabulary cannot address a worthwhile visible issue, disclose that rather than force a finish edit. A broader facade/terrace contract needs separate bounded offline implementation and preservation tests first.

A possible future review budget is at most US$0.15, 4,000 output tokens, one request and zero retries; this is a proposed ceiling, NOT approval or a verified image-input cost bound. Calculate the exact model/image wire bound before seeking new authorization. Existing Stage 5 approval is consumed. No executable live branch is added here. Record raw review/usage before interpretation, then retain operations/diffs/findings separately and capture accepted candidates at identical cameras before any visual success claim. Natural-language live editing and production integration remain subsequent work.
