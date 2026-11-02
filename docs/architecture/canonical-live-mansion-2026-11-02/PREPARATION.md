# Extended canonical mansion — prepared, awaiting request/cost confirmation

**Zero paid calls. No new house or architectural success is claimed.**

The normal `POST /api/ai/scene` handler was executed locally through its actual canonical dispatch, normal knowledge retrieval, canonical schema and SDK request serialization. The provider POST was intercepted before transmission. Its expected local 422 is a deliberate dry-run stop, not model or construction failure.

## Request for confirmation

[Exact provider payload](provider-request.exact.json) · [Readable brief](brief.NOT-SUBMITTED.json) · [Preparation and knowledge](preflight.json)

Model `gpt-5.6-terra`; provider-default reasoning; maximum 30,000 output tokens; zero retries, fallbacks or repair calls; one paid planning POST only after explicit request/cost confirmation. Payload: 34,795 bytes; SHA-256 `d7e49158aaa400a19b56320f0fe2cb36b349018c70f7768756fd090ea710f89d`.

The brief requests a US$25 million Saint Lucia waterfront estate, approximately six generous suites, social/service accommodation, connected circulation, memorable entrance, shaded terraces and a rectangular pool. Terra selects composition, hierarchy, organization, levels, roof style, entrances and facades within documented capabilities. There is no pavilion count or mansion template. Flat-site representation, ground-surface landscape reserves and no infinity-edge requirement explicitly bound unsupported amenities without prescribing building composition. Unsupported design decisions must remain disclosed or decision-required.

Official rates checked November 2, 2026: $2/M input, $0.20/M cached input, $12/M output: https://developers.openai.com/api/docs/models/gpt-5.6-terra . At a planning assumption of 9,000–15,000 input tokens and 10,000–20,000 billed output tokens, estimated cost is **$0.14–$0.27**. At the full 30,000 output ceiling, approximately **$0.38–$0.39** with that input assumption. These are estimates, not exact token counts or a hard dollar cap. Reasoning usage is part of billed output. Actual usage must be retained from the response.

## Connectivity and preparation findings

[Native connectivity result](connectivity-native.json): DNS and IPv4 TLS succeeded in the same host/workspace/Node runtime and existing-key configuration intended for execution. Model GET returned 200 for the exact model. Responses GET returned 401 missing_scope for read permission, which establishes endpoint reachability but does not certify creation permission, quota or payload acceptance. The live runner repeats these GET checks in its own process before a paid POST.

Initial sandbox DNS and a subsequent database timeout blocked knowledge retrieval; a later attempt succeeded and selected nine knowledge records from 334 approved active records. A stale historical harness assertion expected estate while the current classifier reports mansion; the harness now accepts either. An initial connectivity probe was intercepted by the dry-run POST guard; `connectivity.json` is retained as a harness artifact, superseded by the native result, not a provider-access failure. The corrected live harness uses native fetch for its GET-only probes. The initial preflight manifest is retained alongside the refreshed script fingerprint.

The harness restricts actual database queries to single SELECT statements with server read-only sessions, suppresses initializer DDL and redirects usage writes to local evidence. It preserves raw provider response bytes before SDK parsing and consumes authorization before transmission; no resubmission follows a transport or compiler failure. Exact model output will compile without architectural changes. There are no production application edits for this preparation, database mutations, key changes, commits or deployments.

## Evaluation after the separately confirmed call

Assess architectural ambition, compiler fidelity and visual quality separately. On successful construction, capture unchanged aerial/arrival/garden/poolside geometry through the normal renderer, measure actual occupied floor union excluding outdoors and stair voids, mass/level hierarchy, portal/stair circulation, programme coverage and component provenance/editability. Compare the retained 776 m² Azure Courtyard and 952 m² Water Court attempts. Neither area nor successful rendering establishes better architecture. On failure, retain the full response and investigate offline without paid repair.
