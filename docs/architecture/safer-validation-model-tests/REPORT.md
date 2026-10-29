# Safer validation and development model testing — 29 October 2026

Implemented in the existing direct-scene studio and `/api/ai/scene` route. **Zero OpenAI API calls, zero model-discovery calls, no commits, migrations or deployment.** Existing production model configuration remains unchanged. There is no alternate generation pipeline, geometry writer, automatic retry or architectural approval.

## Validation behavior

Generate retains the existing distinction: invalid construction schemas/operations, impossible relationships and unsafe geometry fail atomically. Incomplete accommodation, missing amenities, inaccurate room allocation, absent design-intent evidence and architectural quality remain visible warnings. No programme-completeness checklist or aesthetic threshold was added to Generate.

The edit-only replacement guard requires destructive removal plus explicit replacement evidence. It checks newly promised but missing construction references in the relevant construction role (for example, replacement roof IDs after roof removal), together with a replacement assertion in the summary or a sentence explicitly identifying the removed and missing parts. A removal-only response explicitly promising new roofs/stairs/etc. can also be rejected when it contains no replacement construction operations, even if Refine omits its plan. Existing historical missing references and guidance-only knowledge citations cannot trigger the guard by themselves. Ordinary removal, opening a court without replacement, valid replacement operations and existing partial repairs still pass the geometric executor.

This is a conservative evidence guard, not a semantic proof of every architectural promise. It does not certify route usability or architectural quality. There is no automatic geometry repair or retry. Failed transactions preserve the current project and provide the schema-valid draft for inspection.

Replaying the exact last Terra response is now rejected in Refine, Redesign and Complete: it removes `salon-roof` but promises absent flanking roof construction. The 88-element original stays unchanged; the 87-element draft remains recoverable. The same original Generate failures from true roof/occupied-space and pool/solid intersections remain hard failures because those are geometric conflicts rather than missing amenities. Existing historical redesigns and direct-scene Undo/Redo/reload tests pass.

## Model and reasoning controls

The existing scene studio now has a **Development model test** panel. It offers Current configured model, GPT-5.6 Terra, GPT-5.6 Sol, GPT-6.1 Sol and GPT-6 Astra, with Provider default, Medium or High effort where documented for the chosen model. Exact IDs are allowlisted server-side. Unknown IDs, unsupported efforts and all testing overrides outside development are rejected before provider use. Production hides the panel and returns 404 for the development catalogue/fixture GET endpoint. Selecting a test model never writes `.env.local` or changes `AI_HOUSE_MODEL`.

The normal scene route still uses the same operations, schema, context assembly, raw-response capture and executor. Model and effort are request options; testing metadata is excluded from model messages so selection does not change the prompt. The model capability table records separate supported-effort sets: the 5.6 models include `none`, while the two selected 6.x models do not. Only the documented Medium/High subset is exposed, and absent effort remains omitted from the wire. No assumption that all models share the same parameter set is used.

The following official pages were opened and checked for exact ID, Responses endpoint, structured outputs and reasoning support. Public documentation plus the installed SDK have been verified; **account entitlements and live provider acceptance have not been tested**, in compliance with the prohibition on API calls.

| Exact model ID | Medium/High | Structured outputs / Responses | Standard input / output USD per million |
|---|---|---|---|
| `gpt-5.6-terra` | Both | Supported | $2 / $12 |
| `gpt-5.6-sol` | Both | Supported | $4 / $20 |
| `gpt-6.1-sol` | Both | Supported | $2 / $10 |
| `gpt-6-astra` | Both | Supported | $10 / $50 |

Sources: [GPT-5.6 Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra), [GPT-5.6 Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol), [GPT-6.1 Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol), [GPT-6 Astra](https://developers.openai.com/api/docs/models/gpt-6-astra). GPT-5.6 Sol pricing is promotional at least through 21 November 2026. Rates are a dated snapshot, not account-specific billing. The newer Sol is documented for complex professional work at near-Astra performance; these descriptions do not establish architectural quality.

Real installed-SDK tests intercept fetch locally for every model at Medium and High, verifying exact `/v1/responses` URL, model ID, reasoning field and strict **full scene response schema**. No request reaches OpenAI. The production default remains `gpt-5.6-terra` unless the existing environment already overrides it. No SDK dependency upgrade was required.

## Controlled case and evidence

“Load retained 88-element case (offline)” loads the exact prior architectural brief/request, original editable mansion, programme, coordination findings and approved-knowledge retrieval snapshot. It creates a reversible original version in the current testing project; it does not call a model. “Run retained revision once” submits that frozen case through the normal route. It does not generate an alternative design behind the scenes. The server rejects a changed scene/brief before provider use and requires reloading the retained original before another comparison.

`controlledFixture.ts` reads the retained original and coordination evidence; the offline readiness script asserts equality with the previous experiment's system text, messages and strict construction schema. Eight model/effort variants share the same request fingerprint:

`ee1f148dcd16bea0f13e99e1b7a93f387a7e5c0ade998720d16f4f29d4bb0e33`

The route records requested model, effort (or omission), provider response metadata and actual usage, complete operations/execution diagnostics, input fingerprint, validation result and architectural audit. Raw provider bodies and request wires remain privately retained under `.data/scene-responses`. Accepted responses create ordinary editable versions with Undo/Redo; rejected responses do not create a successful replacement version. Reloaded diagnostics expose model/effort/usage/validation without exposing private provider bodies or messages. Architectural quality remains scene-derived findings plus a **requires-visual-review** status. Nothing writes a subjective conclusion to approved knowledge.

Development overrides permit a ten-minute request timeout for reasoning tests; ordinary requests retain their previous timeout and all modes retain zero SDK retries and the 30,000-output-token rail. A click starts one provider attempt, not an automatic retry loop.

## Cost scenarios

These use standard processing, input below 272K, no tools and the prior measured 29,867 input / 5,785 output tokens. Output includes reasoning tokens. The range runs from ordinary uncached input to all input treated as a cache write (1.25× input rate), with no cache-read discount. High effort and a complete replacement may consume considerably more tokens than the failed historical response.

| Model | Prior-volume scenario per new call | 30K input + 30K output scenario, uncached |
|---|---|---|
| GPT-5.6 Terra | $0.129–$0.144 | $0.42 |
| GPT-5.6 Sol | $0.235–$0.265 | $0.72 |
| GPT-6.1 Sol | $0.118–$0.133 | $0.36 |
| GPT-6 Astra | $0.588–$0.663 | $1.80 |

These are estimates, not spending caps or measured new charges. The output rail includes reasoning; input size and cache treatment affect billing. Existing general usage pricing may report unknown cost for newly selectable models; the experiment records exact usage and these documented scenario rates separately. Historical billing records are not rewritten.

## Readiness and checks

**Ready offline for one explicitly authorized new comparison run.** A useful next candidate is `gpt-6.1-sol` at High, compared with the retained Terra response. That is a historical-baseline comparison: the earlier Terra call omitted an explicit effort setting. A fresh paired comparison with matched explicit effort needs two authorized requests, one per model. No live account access, model success, visual improvement or revised architecture has been demonstrated by this preparation.

Validation passed: **184 tests across 34 files**, TypeScript (`npx tsc --noEmit`) and targeted ESLint. Tests cover the retained bad response, legitimate removal-only edits, open-court conversion, valid replacements, unsafe edits, normal Generate warnings, production override rejection, frozen fixture inputs, per-model actual SDK serialization, retained diagnostics privacy and normal history/reload behavior.

A Chrome check exercised the actual OperationStudio component in an isolated temporary preview using mocked local route responses. It verified selectors, High effort, exact retained-case submission, Undo/Redo and unchanged original/version count after rejection. All external hosts were blocked; no provider calls occurred. The screenshot shows mocked rejection state, not a live GPT-6.1 architectural result.

Evidence:

- [Offline readiness and cost calculations](offline-readiness.json)
- [Offline tests](offline-tests.log)
- [Browser checks](browser-checks.json)
- [Development controls screenshot](development-controls-offline.png)
- Offline preparation: `npx vite-node --config vitest.config.mts scripts/scene-model-readiness.ts` (fetch is prohibited by the script).
