# Single live vision test — rejected before construction

Exactly one live Terra generation invocation was executed with retries disabled. No image generation, paid review, second live call, V3 edit, commit or deployment was performed.

Run: `7f6322d4-8b39-43fe-a10e-52a5e7b13686`

Response: `resp_004eabf48921a699006adfa2c688ec87d2b2eb7e28ba397fd7`

Usage: 11,455 input tokens; 2,042 output tokens; 13,497 total tokens.

## Interpretation

The returned interpretation identifies the principal visible features: a single-storey elongated residence, red hip roof, broad eaves, pale walls with dark trim, blue near-end window, side patio, foreground rectangular pool and a separate paved pad. It explicitly marks scale, orientation, entrance position, unseen elevations and interiors as uncertain or inferred. This is a reasonable textual reading of the saved image, not evidence of reconstruction fidelity.

The candidate uses one 23 × 10 m wing, 3.4 m storey height, Tuscan appearance, warm-stone walls, divided glazing, two terraces and an offset pool. These dimensions and stylistic choices are estimates. Divided glazing and the warm-stone/Tuscan facade are potential mismatches to the source's simple blue window, pale stucco and timber trim. The roof pitch, individual openings and furniture are not exactly controlled. The model marks tree placement, terrain and grid reproduction unsupported; interiors are hidden. Its claim that editable planting is unavailable is scoped to this interpretation contract, not an audit of every landscape capability in the application.

## Validation result

The full vision contract fails `Evidence disposition mismatch`: `garden-trees` has unsupported construction disposition but visible evidence basis. This also exposes a contract limitation: something can be visibly observed while construction is unsupported, so observation and capability should be independent in a future fix.

The feature-mapping stage independently fails `Unmapped image feature: main-massing`. The returned paths use `architecture.wings[0]` and similar notation, whereas the current mapper expects paths relative to architecture, such as `wings.0`. Every constructed feature mapping follows this incompatible prefix pattern.

An isolated offline architecture-only validator accepts the candidate geometry. This does not accept the complete vision result. No configuration was installed in the renderer, and no corrected substitute was created. Therefore four captures were not produced and rendered visual fidelity remains unassessed. The single-call end-to-end success criterion was not met.

## Retained artifacts

The private `.data/image-vision/7f6322d4-8b39-43fe-a10e-52a5e7b13686/` directory contains:

- `concept.jpg`: original input image bytes.
- `request.json`: source hash, model, prompt and settings.
- `response.json`: raw SDK/provider response, text and usage.
- `interpretation.json`: parsed response, unchanged.
- `candidate-architecture.UNVALIDATED.json`: unchanged candidate architecture, explicitly unaccepted.
- `validation-report.json`: offline stage diagnostics.

Offline replay requires no API call and currently reproduces the rejection. No `proof.json` was generated because full validation did not pass.
