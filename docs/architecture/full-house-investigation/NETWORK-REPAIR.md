# Reference-house connectivity repair — 2026-10-30

Network connectivity is verified outside the execution sandbox. No paid generation was requested during repair. The original failed cycle remains closed; a separate, identical-input cycle is prepared and awaits fresh authorization.

## Failure and evidence

The original retained error is `AssertionError [ERR_ASSERTION]: Visual refinement failed; previous version retained. No retry made.` See [original runner failure](fresh-intelligence/review.failure.json), [route result](fresh-intelligence/review.result.json), and [execution summary](fresh-intelligence/execution-summary.json). No nested transport exception, HTTP status, request ID or usage receipt was captured then. That missing historical exception cannot be recovered by a new diagnostic. Consequently the original failure cannot conclusively be attributed to DNS, and its billing remains unconfirmed.

The actual `vite-node` experiment runner now has a read-only `--preflight` mode. With its normal environment loading and original-house assertions, [sandbox execution](fresh-intelligence/network-sandbox.json) fails at `dns.lookup(api.openai.com)` with `ENOTFOUND`. The [same runner outside the sandbox](fresh-intelligence/network-unsandboxed.json) resolves both address families, validates TLS 1.3 over IPv4 and receives HTTP 200 on authenticated `GET /v1/models`. This controlled difference identifies the current blocker as the execution sandbox's network restriction, rather than a credential or global DNS repair requirement. It supports, but does not retrospectively prove, the cause of the historical failure.

IPv6 direct TLS fails with `EHOSTUNREACH`; IPv4 and the runner's default native fetch succeed. No IPv4 override is needed. The process has no HTTP_PROXY, HTTPS_PROXY, ALL_PROXY, NO_PROXY, NODE_USE_ENV_PROXY, NODE_EXTRA_CA_CERTS, NODE_OPTIONS or OPENAI_BASE_URL overrides. The sandbox's `scutil --proxy` returns an empty dictionary and `scutil --dns` cannot expose resolver configuration. The host's generated resolv.conf lists Tailscale resolvers, but explicitly says macOS does not consult that file for normal hostname resolution. Successful unsandboxed lookup is stronger evidence than changing that file. No resolver, proxy, trust-store, security, credential or global network setting was modified.

## Correction and preflight

Run this experiment through a per-command approved unsandboxed execution context. The sandbox remains restricted. The application, model policy, prompts, schemas and construction logic are unchanged.

[scripts/reference-connectivity.ts](../../../scripts/reference-connectivity.ts) performs DNS lookup, certificate-validated TLS probes of available address families, and authenticated GET requests using the same native fetch and loaded existing credential as the experiment. It never calls POST, creates a Response, requests model output, retries or imports the application route. Each request has a timeout; redirects are rejected. Only bounded structured error names/codes, status, request IDs and environment-variable presence are logged. Authorization headers, key values, arbitrary error text and API bodies are excluded.

[Final actual-runner evidence](network-verified-intelligence/network-final.json):

- DNS succeeds; IPv4 TLS 1.3 validates; default native fetch succeeds.
- Authenticated `GET /v1/models`: HTTP 200.
- Non-generative `GET /v1/responses`: HTTP 401, structured `missing_scope`, with a provider request ID. This proves the exact provider path responds; it does not validate permission to create a response. The GET permission restriction is retained explicitly as `readScopeRestricted:true` and `creationPermissionVerified:false`. No credential change or inference was used to resolve that uncertainty.

The first exact-path probe expected HTTP 405 and therefore failed its overly narrow readiness check; both diagnostic files remain preserved. The final gate accepts only 405 or the observed 401/missing_scope for this extra reachability probe, and separately requires authenticated models success. Other endpoint errors fail the gate. A missing key, DNS failure, no usable TLS family, fetch exception, or failed authenticated models request stops execution. This gate verifies network readiness, not model access, quota or future generation success.

The preflight is also mandatory inside every live runner process, after checking phase eligibility but before any started marker or route import. It stores its own evidence. A preflight failure consumes no paid phase and cannot lead to generation. Preflight diagnostics can be rerun explicitly; paid phases retain exclusive markers and zero retries. Old preflight success is never used as permission to skip the current process's gate.

## Prepared experiment and safeguards

The new `network-verified-intelligence` directory is selected only with `--network-verified-cycle`. [Readiness](network-verified-intelligence/readiness.json) verifies:

- Original scene hash `b76ed99bad6f6bda1c1e6f233ef9d65e9b01b0c1c0687f97e488dc44feadf983`, 47 elements, and four preserved actual images/camera records.
- Review input exactly equals the original cycle's input, including the brief and full scene. Prepared construction evidence contains all 47 elements, world transforms, vertical bounds, programme, knowledge and preservation context. Historical source hashes remain unchanged.
- Existing significance/feasibility checkpoint still requires a positive explained decision bound to the fresh review-result hash before refinement. No positive checkpoint exists yet.
- Existing normal route/staging safeguards remain unchanged. Review uses gpt-5.6-terra, provider-default reasoning, 5,000 output-token ceiling; optional refinement uses 12,000. Maximum two newly authorized paid calls, one per phase, zero automatic retries, no comparison call. Historical attempted-call billing remains separately unknown.
- Local usage evidence only; database URLs removed before route import; no retrieval, project save or database writes. No paid phase has started in the new directory.

No authorization is inferred from the cycle flag. After fresh authorization, execute review outside the network sandbox:

```sh
npx vite-node --config vitest.config.mts scripts/reference-intelligence-test.ts --approved-review --network-verified-cycle
```

Stop for the existing offline checkpoint. Only an approved positive checkpoint permits the separately guarded refinement phase. Preserve the established Observe → Diagnose → Fix generalizable issues → Replay → Render → Evaluate → Repeat process. Do not manually repair the house or generate a replacement.

For non-paid verification only, outside the network sandbox:

```sh
npx vite-node --config vitest.config.mts scripts/reference-intelligence-test.ts --preflight --network-verified-cycle
```

## Verification

14 focused tests pass: three network gate/secret-redaction tests and eleven normal visual-review route tests. Typecheck, focused ESLint and git diff --check pass. The network tests cover DNS failure with no HTTP request, IPv4 success despite IPv6 failure, authenticated GET-only requests, exact-endpoint missing-scope reporting and cyclic exception redaction. Preparation succeeded offline with zero provider requests. Existing uncommitted application work was preserved. No paid calls, failed-request retries, database mutations, commits, deployments or architectural changes occurred during this repair. Billing of the historical attempt remains unknown.
