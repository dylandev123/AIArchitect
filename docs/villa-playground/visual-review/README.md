# Optional Terra visual review experiment

Development only: open `/dev/villa-playground`, select an existing authored villa, and expand **Visual review experiment**. No generation engine or new architectural components are involved.

The playground retains a successful generation's original brief separately from the current edit prompt. Subsequent customization, reviews and acceptance retain that brief. A preset or retained response has no historical brief attached: supply its actual original brief explicitly before a live evaluation. Context lives in the current playground session; reloading does not recover historical briefs.

**Evaluate deterministic mock** uses real WebGL scenes and zero provider calls. For footprint villas with existing façade sections it changes one section treatment using the existing `forms put` executor; other villas use a single exterior finish field. Mock observations are intentionally labeled and do not constitute architectural judgment.

A live evaluation requires checking the explicit spending authorization for each run. It captures three 640 × 360 PNGs directly from isolated canvases using the existing `VillaScene`, daylight, postprocessing and adaptive exterior cameras. Captures check dimensions, PNG header, nonblank pixel variation, camera framing and WebGL context health. Capture failure stops before any provider call. Aerial framing focuses on architecture; distant site edges may be outside the image.

The review route sends the original brief, validated current configuration, known unresolved features, supported customization contract and three ordered images. It requests three visible weaknesses, one improvement and exact changed leaf paths. Review and edit each run at most once, with provider retries disabled. The edit uses the existing villa API and atomic executor. Usage and configured pricing are logged by the existing usage system; successful responses also expose usage and cost (`null` means unknown pricing).

Staging compares the entire resulting configuration against the original. Out-of-scope changes, multiple target groups, no-ops, component identity changes, removals, disabled features and resized/reordered existing collections are rejected. These conservative restrictions intentionally exclude some otherwise supported customization operations. An existing façade section can change without replacing its building or landscape. Every changed leaf is displayed for approval.

The original and proposed villa render independently with the same captured camera pose, fixed field of view, aspect ratio and daylight. Camera selection changes both previews. No scene orbit is enabled inside comparison canvases. Accept checks the original configuration and a monotonically increasing edit revision; stale proposals cannot overwrite newer edits, including an edit that restores the same values. Reject only discards staging. The experiment never writes a saved original or persists a proposed design automatically.

## Verification (2026-10-23)

- Typecheck passes.
- 16 focused tests pass: review route (provider mocked), staging/rollback/preservation/stale revisions/call limits/payload validation, and existing façade tests.
- Changed TypeScript files lint clean. Repository lint exits without errors, with two existing unused-variable warnings in capture scripts.
- Chrome inspection with actual WebGL renders and deterministic mock responses: three captures completed; matched aerial, arrival and poolside comparisons displayed without UI inside the scene images; façade treatment visibly differed; rejection discarded the proposal. A subsequent manual material edit disabled stale acceptance. A fresh mock proposal was accepted successfully, preserving the manual material choice and original brief.
- An additional existing villa API suite has three failures: its 6000-token assertion differs from the current 12000-token limit, and two orientation diagnostics assertions expect old numeric-index paths instead of current stable-ID paths. This experiment does not alter those architectural limits or diagnostics.
- No paid provider calls were made. Live image delivery/model compatibility and the subjective quality of a live proposal remain unverified. Rendering and safe editing do not demonstrate that AI review improves architectural quality.
