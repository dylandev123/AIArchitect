# Complete mansion experiment — prepared, not executed

The single-call experiment is technically prepared. **No paid generation has run.** Separate user authorization is still required. The exact requested brief is in [brief.txt](brief.txt); it has not been shortened or augmented. Preparation reuses the existing API configuration without printing, creating or changing credentials.

A material preflight finding affects interpretation: the normal retrieval classifier treats this estate brief as **compact** because its final sentence contains “small conceptual representation.” `projectDescription` in `src/lib/library/architecture/retrieval.ts` matches `compact|small|tiny` anywhere before considering estate scale or property value. The US$25 million value is recognized, but estate-composition, composition-hierarchy, infinity-pool and other estate knowledge are excluded as incompatible scale. This is an observed upstream divergence before any Terra planning or construction; it is not a prediction of Terra's output. No retrieval fix, prompt alteration or additional validator was introduced. A run of this frozen payload evaluates the current normal pipeline including this confound; it cannot cleanly isolate the effect of numeric planning.

## Proposed call and cost

| Setting | Frozen configuration |
|---|---|
| Provider calls | One generation request maximum; zero visual-review, refinement or research calls |
| Model | `gpt-5.6-terra`; assert current configured house model matches |
| Reasoning | Unset on the wire, preserving production provider-default reasoning |
| Output limit | 30,000 tokens, including reasoning within the provider allowance |
| Format | Normal strict Generate JSON schema with required physical programme |
| Retries / fallback | Zero / none; redirects rejected |
| Timeout | Normal Generate 170 seconds; no testing override |
| Input | `mode: generate` and exact brief; no fixture, reference, current scene or test override |
| Knowledge | Normal retrieval, 334 approved active entries; three selected entries |
| Database | Normal read source; SELECT-only query forwarding and read-only sessions; initializer DDL suppressed; usage INSERT redirected to local evidence |

The exact serialized request is 136,291 characters. At four characters per token this is approximately **34,073 input tokens**, a rough estimate including schema rather than a tokenizer measurement. At $2/million uncached input and $12/million output, estimated cost is **about US$0.43 if all 30,000 output tokens are consumed**: ~$0.068 input + $0.36 output. Actual input tokenization, cache handling and output usage determine the bill; $0.43 is not a hard dollar cap. Current official rates and default reasoning support are documented at [GPT-5.6 Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra), checked 2026-10-30. The local pricing table matches these input/output rates. The paid run will preserve actual provider usage.

## Execution and evidence readiness

[scripts/complete-mansion-once.ts](../../../scripts/complete-mansion-once.ts) invokes the actual `/api/ai/scene` POST handler, its real SDK serialization, retrieval, operation construction, normal validation and response retention. It does not substitute a generator. A preparation dry run throws `OFFLINE_PREFLIGHT_NO_PROVIDER_CALL` at the provider fetch boundary. The resulting 422 is the intentional intercepted request, not a generated-house failure; its recorded provider call count is zero.

[preflight.json](preflight.json) preserves full system instructions, injected retrieved knowledge/lessons, selection and exclusion trace, messages, schema, model configuration and source hashes. [provider-request.exact.json](provider-request.exact.json) preserves the exact provider request body without headers or credentials. [request.json](request.json) preserves the application input. On execution the harness reruns normal retrieval and requires identical context, source fingerprint and wire payload before transmission. Changed source or knowledge blocks the run; it does not silently use stale knowledge or authorize a changed payload.

Immediately before transmission, an exclusive `call-started.json` consumes the attempt. A subsequent invocation refuses to send again, including after timeout or transport failure. HTTP status, request ID, exact raw response and transport failure metadata are retained. The complete route result, accepted-but-quality-unapproved scene or explicitly rejected recoverable draft, original provider text and diagnostics are copied into this directory. Malformed, truncated and rejected results remain failures; no corrective response is requested. If no construction survives, report that outcome rather than fabricate a scene for capture.

The source snapshot covers `src`, package manifests and the guarded call runner. Offline review/capture scripts have separate preparation-manifest hashes. The normal route also retains its standard `.data/scene-responses` evidence. Existing experiments and unrelated uncommitted work remain untouched. The initial sandbox database lookup failed before retrieval; network-enabled read-only preflight then succeeded. The first successful dry-run evidence is archived in [preflight-revision-1](preflight-revision-1/) after a runner comment/cleanup changed its source fingerprint. Neither dry run transmitted to the provider.

## Physical measurements and completeness review

[scripts/complete-mansion-review.ts](../../../scripts/complete-mansion-review.ts) prohibits all network and writes new evidence exclusively. It retains normalized programme, authored operations and indexed assembly expansion; records every surviving element's ID, parent, dimensions, world transform, vertical bounds, material, openings and profile; and saves the existing complete architecture/physical-programme/programme/relationship audits without filtering findings.

It reports planned numeric demand, missing referenced floors, actual horizontal floor-surface union by slab datum, occupied slab projection union and world-axis footprint dimensions. Polygon unions remove same-datum overlaps and support rotation, horizontal extrusion/arc profiles and holes. Unsupported floor-profile axes withhold totals. The result is gross referenced slab evidence, not certified net enclosed floor area. Model-selected floor IDs are provisional classifications: inspection must compare them with every plate in `geometry-ledger.json`, identify omitted habitable floors and wrongly cited terrace/roof plates, and retain any corrected measurement classification separately without changing geometry. Bounding dimensions and footprint area are reported separately. Roof/eave and all-built-component extents can be read from the same world geometry ledger; they must not be called occupied floor area.

Use [REVIEW.md](REVIEW.md) to record actual geometry for each suite allocation, principal living/entertainment area, service allowance, level, stair/landing/void, architectural volume, entrance, terrace, pool basin/infinity edge and landscape feature. A slab datum is not automatically a storey; adjacency and cited access IDs are not automatically a usable route. Inspect openings, walking surfaces, enclosure, headroom and connections. Preserve unresolved/profile evidence limits explicitly. Element counts are construction bookkeeping only.

The current generation instructions still require a flat site at Y=0 even for sloping briefs. The experiment must report whether slope/waterfront response is physically represented or merely disclosed. Landscape semantic types can map to editable volumes; inspect their actual shapes and composition rather than treating plant/tree labels or green plates as developed tropical landscaping. Exterior scope deliberately defers interior fit-out: six-suite capacity is not six constructed finished suites. That distinction remains visible in the verdict.

## Four-view design assessment

[scripts/complete-mansion-capture.mjs](../../../scripts/complete-mansion-capture.mjs) renders the unchanged route scene or recoverable draft through `OperationScene` and the existing `VillaScene` presentation. It writes Aerial, Arrival, Garden and Poolside screenshots, camera/target coordinates, a scene hash and matching rendered IDs/local transforms. APIs and all non-local browser resources are blocked. Captures refuse overwrites. No additional ocean, planting, furniture or architectural corrections are injected.

The development-only `/dev/complete-mansion` page loads the experiment result. Its explicit `?fixture=1` mode uses a retained family house, visibly labelled as preparation evidence. The [preparation-render](preparation-render/) directory contains four successful fixture captures: all 47 IDs and transforms match, no page errors, no WebGL context loss. All four captures were visually checked for framing and their fixture labels. This proves the capture path works, not that a mansion has been generated. [preparation-measurement](preparation-measurement/) demonstrates the offline pipeline on that same historical response: 228 m² union of referenced floor surfaces, 24 × 12 m occupied bounding dimensions, one 0.15 m slab datum. These are historical fixture measurements, not experiment results.

After generation, inspect the four actual mansion views using the rubric in REVIEW.md. Compare against both [the rejected US$25m estate](../terra-controlled-estate-2026-10-29/) and [the latest retained mansion diagnosis](../architectural-bottleneck/REPORT.md), using their retained views and consistent display conditions. If additional matching-angle renders are necessary, keep source geometry and provenance exact; no paid call is needed. A single stochastic output supports an observed case comparison, not a general causal claim that numeric planning improved Terra.

## Verification and authorization status

- 91 focused tests passed across four files: physical programme, walking access, route provider schema and Generate route.
- Typecheck passed. Focused ESLint passed for the new TypeScript files; capture script syntax checked.
- Offline polygon checks cover overlap, holes, negative coordinates, duplicate slabs, a contained rotated polygon and a partially intersecting rotated polygon.
- The full offline evidence review and four-view capture ran on a labelled historical fixture.
- Final source hashes match the frozen preflight. No paid-call marker exists.
- No production database writes, credential changes, commits or deployments occurred. No architecture/prompt/validator/product defaults were changed for this task.

Execution readiness: **ready to submit one guarded request after separate authorization, with the compact-retrieval confound disclosed**. The source/context guard will require re-preparation if the working tree or knowledge changes before then. Account/model access is not proved by a no-network provider dry run; any provider rejection consumes the single submitted attempt and is retained without retry.

Only after separate paid authorization:

```sh
npx vite-node --config vitest.config.mts scripts/complete-mansion-once.ts --authorize-one-live-call
npx vite-node --config vitest.config.mts scripts/complete-mansion-review.ts
node scripts/complete-mansion-capture.mjs
```

The last two commands are offline analysis/capture and require a surviving scene for rendering. The local development server uses port 3015. These commands have **not** been executed against a new generated mansion. Assess and document all three success criteria independently; passing scale alone remains failure of the overall objective.
