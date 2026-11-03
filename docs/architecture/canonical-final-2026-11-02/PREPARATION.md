# Final canonical generation — prepared, awaiting hash approval

Zero paid calls. Dry run through the real `POST /api/ai/scene` handler (stubbed at the provider boundary, expected local 422), read-only database.

- Request: [provider-request.exact.json](provider-request.exact.json), 36,214 bytes, SHA-256 `cf5cbfc634290c1f0590294d002fb2817e745cf1ba6162cf42cd8daf6916c10c`
- Model `gpt-5.6-terra`, provider-default reasoning, max_output_tokens 30,000, strict json_schema, maxRetries 0, no repair/fallback call.
- Brief: identical to the retained acceptance brief, no earlier plan supplied. Knowledge: 9 of 334 approved records. Checks: [verification.json](verification.json) (all pass).
- Estimate: ~US$0.12 at the prior output size (8.5k), ~US$0.20 at 15k, ~US$0.38 at the 30k ceiling. Local estimate, not an invoice.
- Live run: `npx vite-node --config vitest.config.mts scripts/canonical-final-once.ts --authorize-one-live-call --approved-sha256=<hash>`; re-checks the body byte-for-byte, writes a one-shot marker.
- Offline compatibility replay of the earlier plan: [../canonical-final-compat-2026-11-02/replay.json](../canonical-final-compat-2026-11-02/replay.json).
