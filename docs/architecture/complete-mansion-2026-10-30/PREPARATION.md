# Complete mansion experiment — corrected preflight, no paid generation

**The single Terra generation is prepared for separate authorization. It has not run.** The exact [mansion brief](brief.txt), architectural ambition, six-suite requirement, numeric programme planning and normal Generate workflow are preserved. This correction changes retrieval intent classification only; it adds no architectural validators, terrain engine or alternate generator.

## Narrow intent correction

`projectKnowledgeContext` previously treated any occurrence of `small`, `compact` or `tiny` as compact-property intent. The final sentence, “rather than a small conceptual representation,” therefore overrode the waterfront estate and US$25 million requirements.

The correction in `src/lib/library/architecture/retrieval.ts` excludes rejected alternatives from the text used to infer scale and monetary context, stopping at punctuation or positive contrast/creation clauses. Compact size words must describe a property/site rather than an incidental pool, study or representation. Positive estate/mansion identity is retained; explicit compact homes, including expensive luxury compact homes, remain compact. The original brief is not rewritten or filtered in provider messages, knowledge trace or stored evidence. Existing feature exclusion, ranking, diversity and retrieval budgets remain active.

[Scale-intent regression tests](../../../src/lib/library/architecture/scaleIntent.test.ts) exercise estates, mansions, family homes, waterfront villas, cottages, tiny cabins and expensive compact homes; `not`, `no`, `without`, `avoid`, `rather than`, `instead of`, positive contrast and `not only`; incidental small amenities; and real compact-property guidance. A pre-existing expensive-compact-home fixture caught a monetary modifier case during testing; that failure is retained in [corrected-tests.json](corrected-tests.json), and the final full run passes in [corrected-tests-final.json](corrected-tests-final.json). No expected compact classification was weakened.

## Corrected normal retrieval

The exact brief now yields **estate**, recognizes **US$25,000,000**, and receives the **complex** budget of up to 12 entries / 18,000 characters. Normal database retrieval sees 334 approved active entries and selects eight, using 17,548 knowledge characters:

| Selected entry | Architectural contribution |
|---|---|
| `property-value-25m-50m`, version 2 | Exceptional estate ambition; substantial connected living, private suites, bespoke arrival, sophisticated roof/façade relationships; value is not an area formula |
| `estate-composition` | Primary/secondary hierarchy; meaningful subordinate programmes; arrival → entrance → living → shaded terrace → view |
| `waterfront-estate` | Landward arrival where feasible, view-oriented living, private suites and explicit shoreline/setback assumptions |
| `tropical-envelope` | Caribbean shade, weather protection, coastal materials and climate assumptions |
| `infinity-pool` | Actual edge/catchment intent, basin/perimeter construction and safe terrace connections |
| `living-view` | Connected principal living/dining/covered terrace and framed outlook |
| `legacy-recipe-3b2b038a-d096-4f7d-a405-001fb1493795` | Tropical ventilated roof and deep-eave component guidance |
| `legacy-recipe-15dd352f-73be-4803-a630-d590ba125c97` | Tropical driveway threshold, framed entrance and guest drop-off |

`compact-family` is absent. Estate guidance is no longer rejected as incompatible scale. The two existing legacy entries are component references with family/luxury provenance, not compact-house layouts or whole-building size caps; the normal retrieval header explicitly subordinates stored parameters to the user brief and construction contract. No knowledge entries were inserted, approved, edited or specially forced into ranking for this test.

The final SDK-serialized [provider-request.exact.json](provider-request.exact.json) was checked directly: its developer message equals the frozen system instructions; selected knowledge content is present; the user message contains the exact original brief; numeric `physicalProgramme` is required by the strict schema; and six-suite capacity guidance remains present. [preflight.json](preflight.json) retains complete instructions, retrieval text and selection/exclusion trace, schema, messages and source hashes. [corrected-preflight-verification.json](corrected-preflight-verification.json) records these checks and the exact request SHA-256.

## Exact controlled terrain limitation

This experiment uses the existing Generate policy, verbatim in the provider's developer message:

> Always design on one level ground plane at Y=0. Do not emit set-terrain during generation, even for a hillside brief; disclose the temporary flat-site constraint.

**The gently sloping site is approximated by one flat ground plane at Y=0.** Ground floor/deck slab bottoms rest at Y=0, with consistently coordinated positive walking-surface datums. This does not construct accurate sloping terrain, terrain-following foundations, retaining structures, drainage, surveyed shoreline, flood elevation or bathymetry. Ocean-view orientation and architectural waterfront relationships can be designed; they do not establish accurate coastal site geometry. The normal viewer's default terrain is flat when no authored terrain is present.

The user's original gentle-slope request remains in the exact brief. The existing higher-priority policy requires the response to disclose its approximation. That approximation is an explicit limitation of this controlled exterior test and must remain visible in the eventual result and quality verdict. No terrain capability was added, and no scenic ocean/landscape geometry will be injected to hide the limitation.

## Frozen call and construction configuration

| Setting | Verified value |
|---|---|
| Workflow | Actual `/api/ai/scene` Generate POST handler, production SDK serialization, normal retrieval, operation construction and validation |
| Model | `gpt-5.6-terra` |
| Reasoning | Unset in provider payload; normal provider default |
| Output ceiling | 30,000 tokens |
| Operations | Existing 800 authored/expanded operation budget |
| Schema | Strict normal Generate contract; required numeric physical programme and programme evidence |
| Timeout | Normal Generate 170 seconds; no testing override |
| Retry / fallback / review / refinement calls | Zero / none / zero / zero |
| Database | Read-only sessions and SELECT-only forwarding; initializer DDL suppressed, usage INSERT redirected to local evidence |
| Input | Exact original brief; no test fixture, current scene, reference image or experimental generation override |

The dry run reached the real provider fetch boundary and threw `OFFLINE_PREFLIGHT_NO_PROVIDER_CALL`. Its 422 is an intentional local interception, not a rejected model design. **Zero generation requests were transmitted.** Source/context and exact wire equality are checked again before any future transmission. An exclusive `call-started.json` consumes the attempt before sending; any submission, timeout or transport failure cannot be automatically resubmitted. The marker remains absent.

The final serialized request is **148,564 characters**, approximately **37,141 input tokens** using characters/4 rather than a tokenizer measurement. At the previously verified $2/million input and $12/million output rates, estimated cost at the full 30,000 output-token allowance is **US$0.4343**, approximately **$0.43**. Actual tokenization/cache/output usage determines billing; this is not a hard dollar cap. [Official Terra pricing](https://developers.openai.com/api/docs/models/gpt-5.6-terra) was checked during initial preparation. No pricing or model defaults were changed.

## Verification and connectivity

- **146 tests pass across 12 files**, covering all architectural retrieval tests, scale intent, physical capacity, walking access, actual Generate route, strict SDK provider schema and safe connectivity handling. [Final test evidence](corrected-tests-final.json).
- Typecheck and focused ESLint pass for the classifier, regression tests and preflight scripts.
- The final complete no-transmission SDK preflight passed against the normal current knowledge store with unchanged source hashes.
- Offline polygon-area self-checks and full measurement/audit replay ran again on the historical family fixture. The four-view capture readiness check was repeated separately; its evidence lives in [preparation-render](preparation-render/) and is explicitly labelled historical, not a mansion result.
- IPv4 DNS/TLS connectivity passed with TLS 1.3. IPv6 was unreachable, while IPv4 succeeded without weakening certificate validation.
- Authenticated `GET /v1/models` returned **200**. `GET /v1/responses` returned **401 `missing_scope`**, confirming reachability but restricting response-read scope. **Response creation permission/model entitlement is not proved by these read-only probes.** No Responses POST or other paid endpoint was called.

Connectivity was tested with the existing key; no credential was printed, created, rotated or changed. The verification script permits only the two explicit GET URLs and prohibits request bodies. This is a read-only network check alongside the offline provider-boundary interception, not an AI request.

## Preservation and next execution

All earlier architectural experiments remain unchanged. Previous preflight payloads, instructions and reports are retained under [preflight-before-intent-fix](preflight-before-intent-fix/), [preflight-revision-1](preflight-revision-1/) and [preflight-intent-fix-initial](preflight-intent-fix-initial/). Previous fixture captures/measurements are retained under `preparation-render-before-intent-fix` and `preparation-measurement-before-intent-fix`. The final [preparation-manifest.json](preparation-manifest.json) records hashes and readiness checks. No production data writes, paid AI calls, commits or deployments occurred.

The existing offline [measurement script](../../../scripts/complete-mansion-review.ts), [capture script](../../../scripts/complete-mansion-capture.mjs) and [review rubric](REVIEW.md) remain ready to preserve and assess the one real result after authorization. They record actual physical floor unions/dimensions, levels, programme capacity, element geometry, operations and complete existing validation findings; they render unchanged geometry from Aerial, Arrival, Garden and Poolside. Labels/counts are not accommodation proof. Scale, complete exterior architecture and excellent design receive separate verdicts; scale alone is not success. No aesthetic validators or automatic repairs were added.

Readiness: **ready for separate authorization of at most one Terra generation**, subject to the disclosed flat-site approximation and the source/context equality guard. Submission permission can only be established by a future authorized request; provider rejection would be retained without retry. Preparation is complete and stops here.

After separate authorization only:

```sh
npx vite-node --config vitest.config.mts scripts/complete-mansion-once.ts --authorize-one-live-call
npx vite-node --config vitest.config.mts scripts/complete-mansion-review.ts
node scripts/complete-mansion-capture.mjs
```

No command above has been run against a new generated mansion. The latter two perform offline evidence analysis/capture and require a surviving scene for rendering.
