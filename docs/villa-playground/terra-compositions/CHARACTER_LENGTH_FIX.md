# Terra character metadata failure

The reported `changes.character` failure came from the 160-character string limit in `compositionSchema`. `character` is displayed beneath the villa name in `VillaPlayground` and copied into the renderer's composition metadata. It does not determine geometry, appearance, dimensions, hierarchy, galleries, terraces, pool or garden placement.

Previously, `Output.object` used the strict composition schema, so the AI SDK could reject this display text before `resolveVillaResult` reached construction validation. The route reconstructed field findings from `NoObjectGeneratedError.text` but did not retain that response. The error alone does not establish an architectural problem.

The provider-facing schema now accepts long `character` strings while preserving every other constraint. At the shared server/client Terra boundary, generation responses get a shallow, deterministic copy with only overlong `changes.character` shortened to at most 160 UTF-16 code units. Truncation uses a word boundary where available; a single overlong token uses a safe hard cut without splitting a surrogate pair. Short text remains byte-for-byte unchanged. The strict output schema and all construction validation then run as before. Direct configuration imports and edits retain their existing strict contracts.

The other descriptive limits were reviewed: `name` (80), `summary` (600), and each `unsupported` entry (200; at most eight entries). No retained failure demonstrated a problem with those fields, so those limits remain unchanged. IDs and architectural enums were not treated as descriptive prose.

## Development diagnostics and offline replay

The route captures response text in the AI SDK's `onFinish` callback, before SDK output parsing/validation. It also retains text carried by SDK validation errors if no capture is available. Successful, structurally invalid, geometrically invalid, and truncated/malformed responses are covered. Transport failures that provide no response text cannot supply a replayable design.

Captures are development-only, private local files under `.data/villa-responses/<responseId>.response.json`. `.data/` is already gitignored. Files use mode `0600`, their directory uses `0700`, and content-addressed exclusive writes avoid overwriting an earlier response. Original text, formatting and full architectural payload are retained, subject to the existing shared secret/sensitive-field redactor. Credentials are redacted before hashing or writing; provider errors, environment contents and request headers are not captured. No raw response is returned to the browser. API diagnostics report the response ID, retention status and whether redaction occurred. A storage failure reports `retained: false` without replacing validation findings or rejecting an otherwise accepted villa.

Replay a complete generation response without any model or network call:

```sh
node_modules/.bin/vite-node --config vitest.config.mts scripts/replay-villa-response.ts .data/villa-responses/RESPONSE_ID.response.json
```

For an edit response, supply the corresponding original current configuration as a second JSON file. The replay helper reads files, runs the shared executor and construction adapter, and prints the accepted result or precise findings. It never updates saved villas or project state.

## Verification and limits

The original failed Terra response was not retained and the user has no separate copy. The original design was **not recovered**, and its geometry or browser rendering cannot be assessed from the length error.

The explicitly synthetic `src/lib/villa/__tests__/fixtures/long-character.response.json` reproduces the exact strict-schema failure path. It then passes the real AI SDK output parser and local strict/construction validation after normalization. Its two authored wings, derived connecting gallery, appearance, terraces, pool and garden are preserved. The fixture replay succeeds with `providerCalls: 0`. This verifies parsing and construction adaptation; it is not a claim about rendering the missing original design.

Focused checks:

```sh
npx vitest run src/lib/villa src/app/api/ai/villa src/app/dev/villa-playground/wing-composition.test.ts src/app/dev/villa-playground/villa-model.test.ts
npm run typecheck
```

All **83 tests across seven files passed**, including a check at the SDK validation entry point proving that the response is already captured. Coverage includes unchanged architecture, exact remaining orientation/overlap errors, immutable original fixture data, word-boundary/Unicode truncation, unchanged other text limits, malformed/truncated captures, secret redaction, production gating and unavailable diagnostic storage. Typecheck and targeted ESLint passed. The offline replay helper was also run successfully against the regression fixture.

No OpenAI calls, migrations, commits or deployment were made. Existing villa state, V3 workflows, and Terra model/prompt/provider options/token/retry configuration were preserved; only the descriptive field's provider schema boundary changed.
