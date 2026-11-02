# Whole-building acceptance generation — prepared, awaiting hash approval

Zero paid calls. Dry run via the real `POST /api/ai/scene` handler, intercepted at the provider boundary (expected local 422).

- Request: [provider-request.exact.json](provider-request.exact.json), 32,422 bytes, SHA-256 `f16409a5bfea2039428a11a1e7498bf372463db3f0f504effd9f1ea3f8e90dec`
- Model `gpt-5.6-terra`, provider-default reasoning, max_output_tokens 30,000, strict json_schema, maxRetries 0, no fallback or repair call.
- Brief: the Saint Lucia US$25M estate brief used by every canonical-path attempt (unchanged, no previous plan supplied). Knowledge: 9 of 334 approved records.
- Runner: `scripts/canonical-acceptance-once.ts` (`--preflight` done; `--authorize-one-live-call` consumes a one-shot marker, re-checks the payload byte-for-byte, DB read-only, usage redirected to local evidence).
- Estimate at $2/M in, $12/M out: ~$0.14–0.27 typical, ~$0.38 at the 30k output ceiling.
