# Villa descriptive metadata recovery — 2026-10-23

The latest Caribbean Crown Estate is recovered and rendered in the real Villa Playground. No new OpenAI call, migration, commit or deployment was made.

## Original response and root cause

The latest retained response is `.data/villa-responses/351c9784227a3700c660e6935d67c07ca07785b1978995c962386fa17b7b5625.response.json` (3,712 bytes). Its SHA-256 matches that identifier. It remains unchanged, and `src/lib/villa/__tests__/fixtures/long-summary.response.json` is an exact byte copy for regression tests. Neither file is the synthetic earlier character fixture.

The original character contained 392 UTF-16 code units and summary 629. The earlier implementation normalized only generation `changes.character`. The SDK validated summary against its 600-character maximum before the local executor could recover it. Thus a display-copy defect prevented an otherwise valid architectural response from reaching rendering.

## Metadata policy and full audit

These are all provider-authored descriptive fields in generation and editing response contracts:

| Field | Local display limit | Handling |
| --- | ---: | --- |
| `changes.name` (villa title) | 80 | Generation only; truncate at a word boundary, otherwise a Unicode-safe hard boundary; missing, blank or malformed values receive a neutral title. |
| `changes.character` (tagline) | 160 | Generation only; same truncation; missing, blank or malformed values receive neutral display text. |
| `summary` | 600 | Generation and both composition/legacy editing; same truncation; neutral fallback for missing, blank or malformed text. |
| `unsupported[]` (feature/capability explanations) | 200 per item | Generation and both edit contracts; same truncation. Missing/null containers become an empty list. A single string is retained as one warning. Malformed entries become an explicit unreadable-explanation warning; warnings are never silently filtered out. |

The wire schema requests at most eight unsupported explanations. The local display boundary preserves overflow items rather than rejecting architecture or discarding warnings. Prompt instructions and numeric JSON Schema `maxLength` values communicate every text limit. The SDK validates normalized display metadata against the strict provider contract while retaining the original parsed object for the shared resolver; its raw text is captured before SDK validation. The resolver repeats normalization idempotently for browser and offline replay.

Normalization names only the four audited fields. It does not recursively rewrite strings. Patch schemas still reject name/character edits and unknown fields. IDs, parent IDs, component builder names/versions, roles, materials, enum values, numeric dimensions, rotations, placements, geometry, relationships and all construction checks remain strict. Missing architectural data and unsupported builders continue to fail with precise architectural findings. Original provider text remains in private diagnostic storage with the existing credential redaction policy; this captured response is retained completely and unmodified.

## Exact design replay

Replay using:

```sh
./node_modules/.bin/vite-node --config vitest.config.mts scripts/replay-villa-response.ts .data/villa-responses/351c9784227a3700c660e6935d67c07ca07785b1978995c962386fa17b7b5625.response.json
```

The response passes all current architectural validation and constructs six building wings, three derived galleries, seven terraces, a 22 × 8 m pool, and the original `curved-pavilion@1` lounge. No architectural validation errors remain in this captured design. Character is now 155 characters and summary 597 after whole-word truncation; its 22-character name is unchanged.

Regression assertions prove normalization leaves the entire architectural payload, including garden, unchanged. The existing `siteMode: derived` executor then computes garden bounds from occupied envelopes and the authored 24 m landscape margin: `{x:0,z:-1.25,width:126.3,depth:113.5}`. The original `{x:0,z:0,width:110,depth:94}` remains the provider's presentation hint. This is existing site derivation, not a metadata repair or a new architectural substitution. Fixed-site validation is unchanged.

The development-only recovery URL replays the original server-side file without a provider client:

[Open recovered estate](http://localhost:3000/dev/villa-playground?response=351c9784227a3700c660e6935d67c07ca07785b1978995c962386fa17b7b5625)

Only a 64-character hexadecimal response identifier can address retained files; missing files return not-found. Invalid retained architecture throws rather than loading another design. No saved projects are overwritten.

## Verification

- `npm run typecheck`: passed.
- `npm test -- src/lib/villa src/app/api/ai/villa src/app/dev/villa-playground`: 117 tests passed in nine files. The additional final architecture-preservation assertion was rerun: 19 metadata tests passed.
- Boundary regressions exercise below/exact/above limits for all four descriptive fields, whole words, Unicode, missing/malformed copy, unsupported warning overflow, both edit formats, unchanged architecture, and continued rejection of invalid geometry, identifiers and builders.
- Real AI SDK tests use a mocked language model and forbid network fetch. They verify numeric wire limits, exact original capture before SDK validation, and replay of the actual failed response.
- `npm run lint`: passed with zero errors; one existing unrelated unused `label` warning remains in `scripts/villa-compositions-capture.mjs`. The newly added capture script warning was fixed, and lint of all touched source files and the new script passes without warnings.
- `node scripts/villa-metadata-recovery-capture.mjs`: passed against the restarted local dev server. All AI and nonlocal HTTP requests were blocked; none were attempted. Actual Chromium WebGL rendered Poolside, Arrival, Garden and Above views. Each view contains 1,891 meshes / 269,544 triangles with finite geometry and transforms, active draw calls, zero page errors, nine wing/gallery groups and the curved pavilion. Screenshots were visually inspected (Poolside and Above).
- The first browser launch required access outside the execution sandbox. The old dev server subsequently timed out with an internal JSON error; restarting that local server restored the recovery page. No application-data migration or architecture repair was needed.

Evidence: [replay proof](replay-proof.json), [resolved offline design](offline-replay.json), [browser checks](browser-checks.json), [Poolside](poolside.png), [Arrival](arrival.png), [Garden](garden.png), [Above](above.png).
