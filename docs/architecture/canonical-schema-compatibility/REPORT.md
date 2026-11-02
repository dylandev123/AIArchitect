# Canonical strict-schema compatibility correction

The shared production adapter is corrected and the complete original mansion request is prepared offline. **No live submission, automatic retry, new AI design, commit, deployment or production database mutation occurred.** Architectural planning, compiler, geometry vocabulary and Terra guidance were not changed. Developer fixtures below establish transport/construction behavior, not architectural quality.

## Origin and complete rejected-schema audit

`canonicalProposalSchema` in `src/lib/villa/canonical/plan.ts` is `z.discriminatedUnion('status', …)` with strict `proposed` and `decision-required` objects. `zodSchema` from the installed AI SDK converts it to root `oneOf`. `strictSceneResponseSchema` in `src/lib/villa/scene/terra.ts` previously visited properties, items and `anyOf`, but skipped `oneOf` and its branches. The original root consequently had neither the required object type nor converted optional fields.

The [preparation script](../../../scripts/canonical-schema-prepare.ts) asserts that today's original Zod conversion equals the entire rejected frozen schema. The complete scan identifies:

- Unsupported root `oneOf` and missing object root.
- Six object definitions whose `required` lists omit optional properties: plan, site, mass, space, portal and roof.
- Eight affected fields: `screens`, `cliff`, `relatesTo`, `facadeMaterial`, `sill`, roof `rise`, `overhang` and `material`.

There are no additional unsupported keywords in that exact request. Its numeric, string, array and enum constraints are retained. Object closure was already present. The original [request](../canonical-live-mansion-2026-11-02/provider-request.exact.json), [HTTP 400 record](../canonical-live-mansion-2026-11-02/provider-http.json) and [exact error](../canonical-live-mansion-2026-11-02/provider-response.exact.json) remain untouched. Original request SHA-256: `d7e49158aaa400a19b56320f0fe2cb36b349018c70f7768756fd090ea710f89d`.

## Shared adapter correction and meaning

A non-object/root-union response travels in a closed required object: `{ "result": <original alternative> }`. The schema dialect declaration remains at the document root. The SDK custom validator unwraps `result`; `generateCanonical` still receives the same original discriminated proposal. No mansion-specific schema or architectural fields were added.

`oneOf` becomes nested `anyOf` only after every branch pair is proven disjoint by a shared required property with non-overlapping literal/enum values. Here the unchanged `status` constants establish exclusivity. An overlapping or unproven `oneOf` fails adapter construction. This is an equivalence-preserving conversion, not unconditional renaming.

Conversion now traverses both union forms and local definitions, makes every object property required, closes objects, and represents omission with null. Normalization traverses original union branches/references, removes transport null only for originally optional non-nullable properties, and preserves legitimate nullable values. Local references are resolved and rebased when wrapped. Wrapped responses undergo transport-shape validation before unwrapping, then the unchanged original Zod validator and canonical semantic/geometric compiler. Missing wire fields, mixed variants, added operations and invalid required nulls fail. Historical object-root adapter behavior is retained.

The new `strictSchema.ts` guard runs during production adapter construction. It rejects unknown/unsupported keywords, invalid root structure, incomplete required lists, open objects, unsupported formats and unresolved/external references, and checks nesting, property, enum and string budgets. It is a local preflight, not a remote OpenAI validator. The corrected entire request has **zero compatibility findings** against the documented base-model subset. The relevant requirements are documented in [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs): nested `anyOf`, object root, required fields, closed objects, local references and schema budgets. Fine-tuned-model restrictions and remote model-specific behavior are not inferred from an offline check.

## Offline verification and workflow

**291 tests pass across 53 files.** [Focused results](focused-tests.json) cover canonical and scene behavior, including all canonical proposal alternatives, nested roof/wall kind/type alternatives, invalid combinations, null/omission handling, reference resolution and recursive references, unsupported constructs and size limits. An independent installed Ajv validator evaluates the wire schema against valid and mutated responses; the adapter/runtime agrees on the tested canonical proposals. Compact, waterfront and courtyard fixtures normalize back to the original authored plans and compile deterministically. Invalid doors, grading, geometry and unsupported contracts still fail the existing validators.

[Actual SDK transport test](sdk-transport.json) uses the installed OpenAI provider and `generateText` with an in-memory HTTP mock. **The complete serialized outgoing request equals the prepared payload**, not merely a separately reconstructed schema. No credentials or external network are used.

[Mock workflow tests](../../../src/lib/villa/canonical/schemaWorkflow.test.ts) send JSON text through the real SDK output parser, adapter, `generateCanonical`, semantic/geometric validation and deterministic compilation. The resulting editable scenes retain plan metadata. JSON save/reload preserves geometry; an individual screen finish edit changes only that element, and the actual project store restores exact scene states through Undo/Redo. Invalid architecture returns 422 with one mocked call and no repair/fallback.

The resulting compact and waterfront mocked scenes were loaded into the existing developer lifecycle viewer and rendered through normal scene presentation. [Browser evidence](browser-result.json) verifies eight captures, exact element IDs/positions/yaw, no page errors or WebGL loss, project Undo/Redo, local save and full-page reload. APIs and external resources were blocked. The viewer's revision button deliberately changes a fixture plan and recompiles; it does not establish live semantic-edit capability. Individual element editing is separately verified by the workflow test.

| Mock fixture | Arrival | Aerial | Garden | Poolside |
|---|---|---|---|---|
| Compact | [View](compact.arrival.png) | [View](compact.aerial.png) | [View](compact.garden.png) | [View](compact.poolside.png) |
| Waterfront | [View](waterfront.arrival.png) | [View](waterfront.aerial.png) | [View](waterfront.garden.png) | [View](waterfront.poolside.png) |

Focused source typecheck and ESLint pass. Full repository typecheck remains blocked by existing archived/script errors outside this correction. The broader scene/canonical/route run recorded 332 passes and 29 failures. Repeating those route tests with the **pre-fix adapter** produces the identical 29 failing test names: old Generate mocks/expectations target operation responses or historical logging rather than canonical proposals. Both runs are retained in [current broad results](tests.json) and [baseline](baseline-route-tests.json); those tests were not rewritten to mask the mismatch.

## Exact prepared request and remaining uncertainty

[Prepared payload — NOT SUBMITTED](provider-request.prepared.NOT-SUBMITTED.json): **35,195 bytes**, SHA-256 **`30623b205a0dff0f0aba72b636747ac2f7adbb792fb5c1390eeb2fc41a540ee7`**.

The brief, retrieved architectural context, instructions, `gpt-5.6-terra`, 30,000 maximum output tokens, default reasoning and all other non-schema JSON fields are identical to the rejected request. The only changed request field is `text.format.schema`: root envelope, equivalent nested union, and recursive required-nullable conversion. The [verification manifest](verification.json) enumerates every internal changed field after aligning the moved union (36 leaf/path differences). No constraints or discriminants were removed. `maxRetries: 0` remains the SDK execution configuration; it is not a serialized request field.

Remote API acceptance, model availability/account restrictions, any undocumented provider/model limitations, model behavior and output quality remain unverified without a separately authorized live submission. This prepared file is ready for review, not authorization to execute. The original experiment's consumed call marker remains intact.

Offline reproduction (no paid calls):

```sh
npx vite-node --config vitest.config.mts scripts/canonical-schema-prepare.ts
npx vitest run src/lib/villa/canonical src/lib/villa/scene
npx tsc --noEmit -p docs/architecture/canonical-schema-compatibility/tsconfig.verify.json
node scripts/canonical-schema-capture.mjs
```

Browser capture requires the existing development server on port 3015 and local Chrome/playwright-core. The old `canonical-live-mansion-diagnose.ts` and its historical output are preserved as the pre-fix diagnosis; its assertion that the production adapter reproduces the rejected schema is intentionally no longer true. Use the new preparation script for current reproduction.
