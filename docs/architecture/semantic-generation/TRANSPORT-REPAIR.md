# Semantic experiment transport repair

The demonstrated execution blocker is sandbox DNS resolution. The semantic runner fails at `getaddrinfo api.openai.com` with `ENOTFOUND` inside the sandbox and passes DNS, certificate-validated TLS and authenticated HTTPS outside it. Use the outside-sandbox execution context for this runner; do not change the provider, payload, TLS verification, hosts file or architectural code to bypass the restriction.

## Retained failure and limits of diagnosis

The original `live-2026-10-31/transport-error.json` retains only `TypeError` and a replacement message. The catch block discarded `e.message`, `e.cause`, timing, Node version, PID and environment. There is no original nested cause to read. Its exact historical root cause therefore cannot be proved retrospectively; the controlled environment comparison demonstrates the present blocker and is consistent with the prior sandbox failures. Do not relabel the original as definitely never transmitted or unbilled.

Original metadata: `call-started.json` records 2026-10-31T23:26:24.904Z, one-call limit, zero retries. The runner targeted POST https://api.openai.com/v1/responses using native Node fetch, certificate verification enabled, redirects rejected, 900000 ms timeout, existing `.env.local`/`.env` configuration, `gpt-5.6-terra`, provider-default reasoning and 30000 max output tokens. No HTTP status/request ID/response was retained. The old preflight's `viable:true` only meant credential presence and must not be treated as network evidence. Billing remains **unknown**.

## Controlled evidence

| Runner context | Evidence | Result |
|---|---|---|
| Current sandbox, PID 16706 | [sandbox preflight](live-2026-10-31/transport-preflight-1793489322100-16706.json) | DNS ENOTFOUND; no TLS or HTTP attempted |
| Current outside sandbox, final runner, PID 16982 | [successful preflight](live-2026-10-31/transport-preflight-1793489360805-16982.json) | DNS succeeds; IPv4 TLSv1.3 validates; exact-model GET 200; Responses GET 401 missing_scope |
| Earlier successful outside-sandbox Terra runner, PID 2870 | [historical preflight](../full-house-investigation/network-verified-intelligence/review.preflight-1793377133179.json) | DNS succeeds; IPv4 TLSv1.3 validates; models GET 200; Responses GET 401 missing_scope; subsequent authorized POST succeeded, per historical report |

Both current contexts use Node v26.12.1, darwin arm64, the same working directory, env-file loader, native fetch and configured credential. Both report no proxy, alternate base URL, Node options or extra CA configuration. The prior successful process used the same Node version and likewise reported no proxy/CA overrides. Current outside-sandbox preflight ran inside `semantic-generation-live.mjs` itself, not a different shell utility or browser. Its successful authenticated native fetch verifies that IPv6 EHOSTUNREACH does not block IPv4 operation. There is no demonstrated TLS, proxy, timeout or invalid-credential blocker on the working path. A runtime preflight cannot guarantee future network availability.

## Repair and execution procedure

`semantic-generation-live.mjs` now runs a fresh GET-only gate in its own Node process before any paid-call marker or generation fetch. `semantic-transport-preflight.mjs` checks credential presence, DNS, TLS per address family, authenticated retrieval of the exact model and Responses endpoint reachability. It fails closed on DNS/TLS/model access/unexpected HTTP errors and records PID, runtime, env-setting presence, stage, request hash, HTTP IDs and bounded nested/aggregate error codes without secrets or arbitrary exception messages. Preflight evidence uses exclusive, separately named files; original artifacts remain untouched. A saved successful preflight never bypasses a fresh check. All HTTP probes have 20-second timeouts, TLS probes 10-second timeouts; no retries are configured.

Run the following from the workspace with the execution tool's **`sandbox_permissions: require_escalated`** setting. The environment label is descriptive only; it does not grant network access. Running it in a restricted sandbox must fail before generation.

```sh
SEMANTIC_EXECUTION_CONTEXT=outside-sandbox node scripts/semantic-generation-live.mjs --preflight
```

This invocation sends only GET requests and exits. There is no paid request in this repair. The existing `call-started.json` permanently blocks the original attempt from being replayed, including with `--live`. After separate user authorization, a new attempt must have a distinct exclusive evidence directory and retain this in-process gate. Do not delete the original lock or reuse its paid-call authorization. No automatic retries or fallback models.

## Model and authorization readiness

Authenticated GET `/v1/models/gpt-5.6-terra` returns 200 with the exact model ID. The prepared payload uses system/user text input and `text.format.type=json_schema` with strict=false, no tools, no explicit reasoning override, and 30000 max output tokens. Official [Terra documentation](https://developers.openai.com/api/docs/models/gpt-5.6-terra) confirms Responses and structured outputs support, a 128000 output limit and a 1050000 context window. The 18512-byte request and output ceiling fit those advertised capacities. This is model-feature compatibility, not server validation of every schema constraint.

Responses GET returns 401 `missing_scope`, matching the historical successful runner. This is a read-scope restriction, not evidence that creation is forbidden or allowed. [OpenAI RBAC documentation](https://developers.openai.com/api/docs/guides/rbac) distinguishes model read access from model request and Responses permissions. **Current creation permission, quota and exact-payload acceptance remain unverified.** The available Platform connector offers key setup/creation and dashboard access, not inspection of the configured key's scopes; no credentials were created, rotated, printed or changed. A project administrator can verify the configured key's Responses write/model-request permissions and project/model limits before authorizing a new experiment. No inference from read authentication alone is presented as write authorization. No malformed POST or synthetic generation was used as a purported free authorization test.

## Experiment preservation and validation

The runner now asserts exact equality between its prepared wire string and the original retained request before checking connectivity. SHA-256 remains `3c99dee2f4a3becda07e405d27e018d976fbc1d82d52cc8a34ff36d3d6e8b8ed`. The original source request remains `61e103493517a1968246029465fe414eded487d5e6ce4f5c05879ec4aef2a90d`. Architecture, semantic compiler, construction engine, provider payload and existing house were not changed. The experiment is identical and network-ready in the verified execution context, with the authorization limitation above and a deliberate original-attempt replay lock.

Seven tests pass across `semanticTransportPreflight.test.ts` and the existing `connectivityPreflight.test.ts`: fail before HTTP on DNS, nested/aggregate error preservation and redaction, exact model checks, GET-only operation and explicit unverified creation permission. Native Node syntax checks pass. Full `tsc --noEmit` remains blocked by existing errors in `docs/architecture/design-first/live-2026-10-30/experiment-script.as-run.ts` and `scripts/sol-planning-comparison-review.ts`; those files were not changed. No database operations, paid AI calls, commits or deployments occurred during repair.
