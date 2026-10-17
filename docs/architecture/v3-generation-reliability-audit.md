# V3 generation reliability audit — captured cliffside mansion

Evidence: `.v3-debug/failed-attempt-{0,1}.json` (2026-10-15 15:24 UTC, one generation, unredacted, complete). Committed verbatim as `src/lib/v3/__tests__/fixtures/cliffside-mansion-attempt-{0,1}.json`. No provider call was made.

## Root cause

A chain, not a single bad object:

1. Terra's original plan used shapes the prompt never specified: `version: "V3"`, a `site.boundary` polygon instead of `width/depth`, `naturalFall: "south"`, levels without `region`/`supportType`, connections without `type`, string materials, and building intent (`levels`, `roofForm`, `composition`, `massHierarchy`, `facadeRoles`) nested in `architecture`, plus a scene-level `mainEntry` and `frame: "dark bronze"`.
2. Normalization silently dropped all of that. Replayed, attempt 0 fails on `INVALID_ROOT` (version) and `INVALID_SITE` (no width/depth). Both driveway and walkway are omitted, because untyped connections can't own a surface. Every composition is discarded, because one descriptive `frame` failed the strict schema.
3. The repair call sent Terra the *normalized* scene, which had already lost the composition, regions and roof intent. Terra faithfully returned the degraded plan with `region: {}`, producing the live `INVALID_SITE_LEVEL [upper-road]` (and the same error for all six levels).

## Further defects found in the captured response

- Elevations are absolute (road 60 m, sea 0 m) but natural ground was anchored at 0 m at the site centre. Every pad would have been a mesa about 45 m above the slope.
- Without `supportType`, grading ignored every level, so no pads were cut, filled or retained.
- Terra's design issues (warnings only): the last driveway segment is 80 % grade; Terra's levels descend at about 25 % against its stated 38 % natural grade, so the arrival court is a deep cut pit; `upper-view-garden` sits 2 m above grade; `terrace-descent` is a legacy box stair that renders as a fin.
- The failed preview applied stricter, separate parsing: it rejected the same levels and the box stair.

## Fixes (all general)

- `intentCanonicalization.ts`, run first by both ingestion and failed preview:
  - relocates misplaced intent to its canonical fields;
  - maps descriptive vocabularies (version, cardinal fall, roof form, finish descriptions, collision classes);
  - salvages compositions entry by entry (it falls back to presets only if nothing survives);
  - derives an absent site extent from the boundary or authored coordinates;
  - infers a connection's `type` from its surface object;
  - defaults `supportType` to `pad`;
  - derives a missing level region only from authored objects at that elevation and the routes landing on it. An unreferenced, underivable level is omitted with a reason; a referenced one stays fatal.
- `deriveV3NaturalGroundDatum` anchors the natural slope to the median offset of the authored levels, and only when no datum was authored. Levels never move.
- Repair now sends Terra its own authored output, not the normalized runtime scene.
- The prompt states the top-level, site, hierarchy, material and composition shapes explicitly.
- Unchanged: a malformed authored site extent, an invalid building mass, duplicate ids and an underivable referenced level remain fatal. No V2 code changed.

## Offline result

Both attempts now ingest with zero errors. All 18 authored objects survive, with no omissions. Persist/reload is identical, compilation is deterministic and ingestion is idempotent. A local `editArchitecture` changes only its target. Preview and persistence agree on the objects. Production WebGL captures are in `parity/captured-mansion/` (dev page `/dev/terrain-audit?fixture=captured-mansion`), with zero render errors.
