# Corrected canonical mansion: single controlled Terra result

**The corrected schema was accepted and Terra returned a complete, parseable architectural proposal. The unchanged canonical compiler rejected its overlapping occupied volumes. No constructed house or renders were produced, and improved visual quality remains unassessed.** Exactly one paid POST ran; no retry, fallback, repair, commit, deployment or database access occurred.

## Execution and retained evidence

The submitted bytes are exactly the authorized [prepared request](../canonical-schema-compatibility/provider-request.prepared.NOT-SUBMITTED.json): SHA-256 `30623b205a0dff0f0aba72b636747ac2f7adbb792fb5c1390eeb2fc41a540ee7`, 35,195 bytes. [Submitted copy](provider-request.exact.json). The brief, retrieved context, schema and settings were not regenerated or changed: `gpt-5.6-terra`, 30,000 maximum output tokens, provider-default reasoning. The existing credential was reused without printing or changing it.

The existing [GET-only connectivity preflight](connectivity.json) ran outside the sandbox in the same process before the one POST. It passed DNS/TLS, model access and Responses reachability. A new exclusive [call marker](call-started.json) prevents resubmission; the prior experiment's consumed marker remains untouched. The runner uses one native fetch with redirects forbidden, a 170-second timeout, and no retry loop or SDK retries. [Runner](../../../scripts/canonical-corrected-once.mjs).

[HTTP result](provider-http.json): **200**. [Exact raw response](provider-response.exact.json): **completed**, no provider error. [Exact proposal text](proposal.exact.txt) passes the real SDK `Output.object` complete-output parser, existing strict adapter normalization and unchanged `canonicalProposalSchema`. The [normalized proposal](proposal.normalized.json) was passed directly to `compileArchitecturalPlan`, without architectural edits. This is a frozen-request transport followed by offline production parser/compiler replay, rather than a fresh retrieval or a browser Generate action. [Replay script](../../../scripts/canonical-corrected-review.ts).

[Usage](usage.json): **6,066 input**, **9,534 output**, **15,600 total** tokens, including **3,958 reasoning** output tokens and zero reported cache-read input tokens. The provider also reports 6,063 cache-write tokens, retained verbatim. [Estimated cost](estimated-cost.json): **US$0.12654**, using the repository's configured default rates of $2/M input and $12/M output. This is a local estimate, not an invoice or independent pricing verification; the current pricing helper has no separate cache-write rate.

## Demonstrated failure and dimensional cause

The [exact validation failure and stack](validation.json) are:

```text
foyer/upper-suite-6: occupied volumes overlap; revise outlines or levels.
```

The compiler reaches `compileBuilding` and rejects during occupied-volume checks, before it emits a scene or operations. This is a model-authored section/stacking coordination error, not schema rejection, output truncation, rendering loss or a demonstrated inability to represent ordinary stacked rooms.

In canonical local coordinates before centring, the foyer occupies X=0…8 m and Z=0…7 m, starting at Y=0.01 m with height 4.2 m, so its occupied top is **4.21 m**. Suite 6 occupies X=−4…6 m and Z=2…7 m, with its floor at **3.61 m**. Their horizontal overlap is **6 × 5 m**, with **0.60 m** vertical penetration: **18 m³**. The model selected a 3.6 m upper-level rise while placing upper rooms over taller ground rooms.

An independent, read-only dimensional diagnostic of the same unchanged relational placements finds six interior occupied-volume overlaps: foyer/suite 6, foyer/bath 6, gallery/upper landing, gallery/upper lounge, living/suite 4 and living/bath 4. [Full coordinates and overlaps](dimensional-diagnosis.json). This supplements the compiler's first failure; it is not a complete substitute for later construction checks. The compiler is fail-fast, so downstream stairs, portals, roofs, screens and site allocations have not passed validation. In particular, the proposed arrival screen hosts an outdoor space although current screen construction requires an interior host; the overall proposal must not be treated as one isolated clash away from success.

No scene, construction operations or partial house were returned. Their absence is recorded in [artifact availability](artifact-availability.json), rather than inventing an empty successful transaction. No geometry was repaired, no checks bypassed and no preview generated from rejected geometry.

## Comparison with previous mansion attempts

| Criterion | Previous retained mansions | This actual Terra proposal |
|---|---|---|
| Composition | [Azure Courtyard](../complete-mansion-2026-10-30/REPORT.md): broad hall and matching single-storey private wings; [Water Court](../physical-programme/REPORT.md): similarly repetitive large envelopes. | More differentiated **intent**: two levels, a guest wing, service rooms, upper retreat, gallery, stair, veranda, flat bronze roofs and two screens. No constructed composition exists. |
| Scale | Azure has 776 m² gross occupied slab union; Water Court has 952 m² principal gross shell plates. | 1,134 m² sum of authored interior room rectangles across two levels. This is an invalid proposal's allocation sum, **not constructed floor area, net area or a verified improvement**. |
| Programme completeness | Broad envelopes/capacity labels did not construct six individual suites with bathrooms and circulation. | Six separately identified bedroom spaces, six bath/dressing spaces, kitchen, pantry, laundry, powder room and circulation are explicitly planned among 30 total spaces. Coordination fails; none is verified constructed accommodation. |
| Facade and climate intent | Underdeveloped elevations and broad roof surfaces. | 28 roof allocations, two screens and a shaded 16 × 5 m veranda are authored. Only three `window` portals are requested; claims of rich, recessed elevations cannot be inferred from prose. Roof/screen construction remains unvalidated. |
| Circulation | Missing or unproven inter-wing links and suite routes. | 31 portals and one stair are authored, giving more explicit relationships. Actual circulation, stair fit and headroom remain unverified. |
| Visual quality | Actual retained images demonstrate basic/repetitive architecture. | **Unassessed**: construction rejected, so no aerial, arrival, garden or poolside images. No historical image or developer fixture is substituted. |

The earlier canonical experiment failed before model generation on root `oneOf`. This experiment demonstrates that the corrected transport schema permits a completed canonical response. It also demonstrates that Terra's richer room-level programme and two-storey ambition did not result in construction-coherent architecture on this call. It does **not** establish premium visual quality or reliable generation. A single stochastic sample cannot establish a general rate of success or isolate why the model made these decisions.

## Preservation and offline investigation

All raw bytes, usage, HTTP metadata, normalized intent, construction error and estimate are retained here. The verification manifest records hashes of evidence and compiler/parser sources. Only local experiment scripts and this new evidence directory were added; architectural instructions, construction engine and prepared schema were not changed. No production database connection was opened. No tests or captures made additional API calls.

For further offline investigation, copy the evidence to a new diagnostic directory and replay the retained proposal through the same parser/compiler. The replay script uses exclusive writes to preserve existing artifacts. Do not rerun the live runner: its authorization is consumed. No additional paid call is authorized by this report.
