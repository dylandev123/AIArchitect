Latest outcome: the masked identifier matched; one authorized request completed, then failed semantic identifier validation. See [fresh attempt report](live-fresh-2026-10-31/REPORT.md). The text below records the earlier waiting state.

# Fresh semantic mansion authorization status

The user authorized one fresh paid request on 2026-10-31, conditional on privately verifying that the runner uses the exact active Platform key named “AI Architect App” and passing outside-sandbox preflight. No paid request has been sent under this new authorization.

Credential inspection printed no credential or fingerprint. The effective runner credential comes from `.env.local`; there is no inherited `OPENAI_API_KEY` override and no competing credential in `.env`. The same credential authenticates successfully to the exact model endpoint. This establishes a valid, non-revoked credential, but does not identify its Platform display name.

[Outside-sandbox preflight](live-2026-10-31/transport-preflight-1793489732716-18262.json) passes: DNS, validated IPv4 TLS 1.3, GET exact model HTTP 200. Responses GET reports the previously documented read-scope restriction. Request SHA-256 remains `3c99dee2f4a3becda07e405d27e018d976fbc1d82d52cc8a34ff36d3d6e8b8ed`.

Existing-key identity lookup is unavailable through the Platform connector, and both attempts to inspect Chrome through computer use timed out with `-10005 timeoutReached`. A masked key identifier was requested from the user; no full secret was requested. The paid call is held until the configured credential can be compared privately with that identifier. A successful GET is not presented as proof of a key's display name.

The runner now supports a separately locked `live-fresh-2026-10-31` evidence directory via an explicit fresh-authorization flag. Before a paid call it requires a privately verified key suffix, checks it against the effective credential and checks a fresh same-process network preflight. The old evidence directory and original lock remain intact. Provider headers/status are retained before streaming the exact response bytes to disk, preserving even partial output on a transport failure. The offline postflight script preserves parsed proposal, unchanged compiler outcome, scene/geometry and physical findings where construction succeeds. No architecture, model, compiler or request-payload changes were made. No retry or fallback path was added.
