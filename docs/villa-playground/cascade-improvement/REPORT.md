# Cascade Skyline: controlled architectural revision

Local experiment, 26 October 2026. **Zero provider calls.** The revisions are manually authored hypotheses evaluated against actual browser WebGL renders, not output from a live Terra vision review. No runtime template, schema, builder, agent, V3 code, migration, commit or deployment was added.

## Evidence and preservation

- [Matched side-by-side browser screenshots](comparison.png), ordered aerial, arrival, opposite façade and human height. Left: original. Right: revised.
- Retained source: `.data/villa-responses/322247c40a2c1eb0b3e667280d7f9551759779cb4b753e6c925c386e99664036.response.json`. Its raw SHA-256 was verified against its filename before replay and its bytes checked unchanged afterward. [Baseline response copy](original.response.json), [baseline configuration](original.config.json), [proposed configuration](revised.config.json).
- [Exact patches, leaf differences, scope and geometric measurements](evidence.json). The existing `resolveVillaResult` replays the original. The existing `stageReviewEdit` and atomic form replacement executor stage both changes, checking scope and preservation. No generation API was called.
- Screenshots use the existing Villa Playground and its `VillaScene`, original grounds, daylight, original material values, 39° field of view and identical camera coordinates/targets. [Browser checks](browser-checks.json) record all eight poses, four levels per design, finite geometry, healthy WebGL contexts and no browser errors. Screenshots hide interface overlays; the small Next development indicator remains.
- The human-height camera is y=1.7 m in scene coordinates, tilted toward the building at y=6 m. No automatic fit or zoom is performed between designs. The revised building therefore occupies less image area because it is physically smaller.
- Chrome runs in a separate, disposable browser context. The retained original loads from its real recovery URL; only the isolated React authored-state setter receives the staged proposed config. No scene storage, current user browser, retained response or saved villa is written. The experiment is not added to the preset catalog.

## What changed, exactly

All changes target `forms[0]`, stable ID `main-residence`; all four level IDs and their parent relationships remain. Dimensions and positions are metres, in the same local coordinate frame. Stack x/z values are absolute in that frame, not offsets from the parent.

| Control | Original | Revised |
|---|---|---|
| Base height | 4.4 | 3.6 |
| Shared opening pattern | panoramic | rhythm |
| Base façade section 0, edge 0 | glass | loggia |
| Level two x, z | −1, −1 | −2, −2 |
| Level two width × depth × height | 28 × 18 × 4.1 | 26 × 14 × 3.3 |
| Level three x, z | 1, −0.5 | −6, −2 |
| Level three width × depth × height | 25 × 16 × 3.8 | 18 × 14 × 3.2 |
| Sky pavilion x, z | −1, 0 | −1, −2 |
| Sky pavilion width × depth × height | 21 × 13 × 3.6 | 12 × 10 × 3.0 |

The 30 × 20 m base outline, entrance and other façade section definitions, all materials, rooftop treatments, pergola, arrival plinth, garden, landscape, pool state and appearance are preserved. Furniture changes visible in upper rooms follow the existing deterministic furnishing algorithm as their footprints shrink; no furniture was added as an improvement operation.

The total stack height including its four roof slabs falls from 16.94 to 14.14 m above the base datum, excluding the ground offset, railings and rooftop pergola. Summed enclosed rectangular floor area falls from 1,777 to 1,336 m² (about 25%). This is a real capacity tradeoff, not an equal-area rearrangement.

The base's front roof terrace deepens from 2 to 5 m across 26 m. The next roof gains an 8 × 14 m side terrace instead of mainly 0.5–1.5 m front/rear strips and a 3.5 m side strip. The roof beneath the crown gains an 8 × 14 m terrace on the other side. These are gross exposed roof cells, not certified furnished clearances or proof of door access. Existing rails and junction geometry still require detailed review. The crown projects 2 m beyond its immediate supporting level on one side; the existing support validator accepts 83% footprint support, but that is not structural engineering verification.

## Architectural assessment

The original visibly repeats large glazed floor plates, thin horizontal bands and many identical mullion bays. Its upper volumes nearly fill each supporting floor. The arrival elevation has a broad blank stone ground floor and three repeated timber door bays. Its combination of tall floors and extensive curtain glazing reads as commercial accommodation.

The first local revision reduced floor heights and introduced deeper setbacks but still read as a diminishing tiered stack. It was not treated as sufficient evidence of residential quality. [First-iteration configuration](iteration-one.config.json) and [arrival render](iteration-one-arrival.png) retain that rejected study. The final revision instead aligns the west and rear sides of the middle pair and shifts the crown back toward the east, creating larger continuous volumes and alternating outdoor rooms.

**Verdict: a visible, bounded improvement in massing, glazing balance and terrace proportions; partial success against the full residential-quality goal.** In the aerial view the first roof is an outdoor room rather than a perimeter ledge, and the two alternating 8 m side terraces are clearly legible. Arrival shows a lower, less glass-dominated body with a smaller crown; aligning two middle floors gives a stronger side shoulder instead of four almost identical glazed bands. The opposite view shows more masonry in the upper levels and a shaded base, but still exposes repeated glazing bays. Human height confirms that reducing the upper bulk improves scale while leaving the arrival unresolved. The residence is more distinctive and less office-like, but still has aspects of a small apartment building. This does not establish a convincingly finished main residence, and is not proof that a live Terra model can discover the edits autonomously. The base still lacks a well-resolved residential arrival. The existing entrance treatment generates three adjacent doors across roughly 6.9 m; reducing its height lowers each door from about 3.34 to 2.74 m but cannot consolidate them into one entrance. It remains closer to a bank of doors than a convincing front door with a clear pedestrian approach. The same broad blank base wall remains, and upper façade rhythm still repeats between floors. A claim of a fully resolved luxury residence would exceed this evidence.

## Smallest reusable mechanism

Use the existing **capture → one-component review → scoped edit → matched comparison → explicit acceptance** mechanism. Ask for architectural dimensions and relationships, not a finish swap. Keep stable identities and unrelated site choices. Review usable terrace depth, entrance scale, solid/glass distribution, floor-height hierarchy and the relationship of successive volumes as visible criteria. Compare all views before acceptance; successful validation is only a gate.

This exact proposal already stages through the existing executor in two bounded steps: six leaf paths for heights/opening pattern/base loggia, then eleven paths for massing and setbacks. Each step fits the review schema's maximum twelve scope paths and targets the same existing form. The full seventeen-path proposal cannot be returned in one current review response. The offline script demonstrates the two steps without widening the safety guard; a future authorized session can review/accept them sequentially. The current deterministic UI mock changes only one façade treatment (or a finish), so pressing that button would not reproduce this experiment. Live model diagnosis and edit choice remain untested.

| Capability boundary | Finding |
|---|---|
| Existing controls/executor | Floor heights, per-level rectangles and positions, supported cantilevers, shared `panoramic/rhythm/private` opening pattern, base façade treatments, rooftop use and matched-camera review. These suffice for this massing/terrace improvement. The manual composition panel does not expose these footprint fields; Terra's edit contract/executor does. |
| Missing per-level façade/material controls in `stack` | Upper stacked levels have no per-level opening pattern, façade sections or material fields. `StackedBuilding` explicitly passes `facades: undefined` above the base and inherits one form material/opening pattern. An independently solid bedroom floor, local loggia, aligned masonry spine or differentiated crown façade cannot be authored here. Other two-level forms have façade fields, but converting Cascade to them would not preserve this four-level stack. |
| Larger builder/structural work | One precisely located, correctly scaled portal; entrance recess/approach geometry; nonrectangular four-level footprints; actual terrace doors and circulation; stairs/lift; engineered cantilever support and buildable waterproof roof/rail junctions. These cannot be claimed from this exterior experiment. None were implemented. |

Recommendation: retain the current staged-review mechanism and require evidence-led massing edits with matched multi-view acceptance. Do not add a new pipeline. The highest-value capability gap exposed here is localized façade/entrance control, not another generator. Decide that separately after this bounded result is reviewed.

## Reproduce and checks

With the existing local development server on port 3000:

```sh
./node_modules/.bin/vite-node --config vitest.config.mts scripts/cascade-improvement-evidence.ts
node scripts/cascade-improvement-capture.mjs
./node_modules/.bin/vitest run src/lib/villa/visual-review.test.ts src/lib/villa/stacked-volumes.test.ts src/lib/villa/facade.test.ts
```

The capture script follows the repository's existing Playwright installation path and Chrome executable. It blocks all browser `/api/ai/` and non-local requests. The offline evidence script forbids fetch. The three existing focused suites pass: 18 tests. No test result is used as a substitute for visual judgment.
