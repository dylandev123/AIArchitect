# First live extended canonical mansion experiment

**The single authorized request failed at OpenAI schema validation before Terra generated a design. No house was produced, the compiler was not reached, and there are no new renders. No success or architectural improvement is claimed. The authorization was consumed by one API submission; there was no retry, fallback or repair call.**

## Three separate outcomes

| Question | Observed result |
|---|---|
| Did Terra produce a more ambitious architectural design? | **Unassessed.** OpenAI rejected the request before generating a proposal. |
| Did the canonical compiler faithfully construct the design? | **Unassessed.** No canonical plan exists and compilation did not run. This is not a geometry/compiler rejection. |
| Does the architecture look substantially better? | **Unassessed.** No constructed candidate or new images exist. |

The intended comparison remains the [776 m² Azure Courtyard](../complete-mansion-2026-10-30/REPORT.md) and [952 m² Water Court](../physical-programme/REPORT.md). Both retained attempts use a 28 × 14 m hall with matching single-storey private wings, broad roofs and underdeveloped elevations. This experiment supplies no new architectural result to compare against them. Area, massing, circulation, programme coverage, facade development, completeness and editable component counts for a new house are **unavailable**, not zero or failed aesthetic scores. No fixture or historical image is substituted for a new model result.

## Exactly what ran

The user explicitly confirmed the frozen payload, model, token ceiling and cost estimate. [Exact request](provider-request.exact.json): SHA-256 `d7e49158aaa400a19b56320f0fe2cb36b349018c70f7768756fd090ea710f89d`, 34,795 bytes, `gpt-5.6-terra`, maximum 30,000 output tokens, provider-default reasoning, zero retries. The outgoing SDK body was checked for byte equality, then the frozen file bytes were transmitted unchanged to `https://api.openai.com/v1/responses`.

The first execution attempt stopped at a normal knowledge-database read timeout before any provider call; [failure](live-retrieval-failure.json) is retained. Because the approved payload already contained approved retrieved knowledge, execution then used the **real normal `/api/ai/scene` handler → `generateCanonical` → existing SDK and compiler path**, with its knowledge function returning the frozen preparation context and usage writes redirected to local evidence. No new generator, simplified schema, replacement architecture or compiler was introduced. This is a frozen-context handler replay, not a browser Generate click or a fresh knowledge retrieval. It made zero database queries. The complete [as-run harness](authorizedMansion.live.test.ts.as-run.txt) is archived as text so routine tests cannot execute a paid experiment.

A harness startup initially used test-mode env loading, which excluded the existing development key; its [configuration failure](frozen-live-connectivity.json) made zero provider requests. After correcting env loading, the [same-process preflight](frozen-live-connectivity-2.json) succeeded before the single POST: DNS/IPv4 TLS, exact model GET 200, Responses GET reachable with a read-scope restriction. GET did not establish POST schema acceptance. The existing key was reused without printing or changing it.

The [provider HTTP record](provider-http.json) is **400**, request ID `req_e87fcb6d5dd84ed78f3d0e6df608ea2c`. The normal application returned **422** with `providerCalls:1`. These are different layers, not two provider submissions. [Full provider response](provider-response.exact.json):

```json
{"error":{"message":"Invalid schema for response_format 'response': In context=(), 'oneOf' is not permitted.","type":"invalid_request_error","param":"text.format.schema","code":"invalid_json_schema"}}
```

The [route response](route-response.json), [call marker](call-started.json), [call result](call-result.json), [local usage record](usage-record.json) and [explicit compilation outcome](compilation-results.json) are retained. There is no canonical plan to save: the full provider response is an error object, not an architectural proposal or unsupported-design decision. No manual design corrections or simplifications occurred.

## Demonstrated offline cause

[Offline diagnosis](offline-diagnosis.json) regenerates the schema through the actual `strictSceneResponseSchema(canonicalProposalSchema)` and SDK `Output.object` format, and verifies equality with the rejected frozen schema. It loads no credentials and performs no network or model calls.

`canonicalProposalSchema` in `src/lib/villa/canonical/plan.ts` is a Zod discriminated union of proposed and decision-required. The installed conversion emits a root `oneOf`. The strict adapter in `src/lib/villa/scene/terra.ts` recurses through properties, array items and `anyOf`, but neither translates nor traverses `oneOf`. Consequently the root remains the provider-rejected union, and its branches bypass strict optional-field conversion. The offline scan additionally finds unconverted optional fields: plan screens, site cliff, mass relatesTo, facadeMaterial, portal sill and roof rise/overhang/material. These additional contract risks were not separately diagnosed by the provider, which reported the root failure first.

Simply renaming `oneOf` to `anyOf` is not established as a complete fix. A future offline correction needs a provider-compatible root object contract, recursive strict optional handling and matching local response normalization, while retaining proposed/decision-required behavior. Any such correction changes the approved request; **none was transmitted and no corrected request was prepared as an implicit retry**.

The existing four `generate.test.ts` tests pass offline, including the extended waterfront fixture. They mock `generateText` and return parsed objects, so they do not exercise remote schema acceptance. The live harness also completed normally while recording the rejected result; its passing test status means evidence capture completed, not that generation succeeded. This identifies the missing provider-wire validation coverage and explains why offline construction proofs did not catch the defect.

## Usage, cost and preservation

The provider error response has **no token usage**. The local logger records zero tokens and estimated cost $0 because missing usage defaults to zero. No generated tokens were returned; **actual provider billing is unverified**, and the logger must not be treated as an invoice. The accepted $0.14–$0.27 / approximately $0.38–$0.39-at-ceiling estimate remains a pre-request estimate, not observed consumption.

There was **one generation POST**, no further provider submissions, zero fallback models and zero automatic repairs. Connectivity probes were GET-only. No production database mutation, credential change, commit or deployment occurred. Existing application source and historical evidence were preserved. Only local experiment harness/evidence and offline diagnosis were added; the paid harness is archived, and the consumed `call-started.json` remains in place. The original preparation report is retained in [PREPARATION.md](PREPARATION.md).

Offline reproduction of the demonstrated contract defect:

```sh
npx vite-node --config vitest.config.mts scripts/canonical-live-mansion-diagnose.ts
npx vitest run src/lib/villa/canonical/generate.test.ts
```

The architectural question remains unanswered. The next necessary work is an offline wire-contract correction and verification, followed only by a separately authorized live experiment. This run provides no evidence that Terra chose ordinary boxes, proposed unsupported architecture, or that the extended compiler lost a richer design.
