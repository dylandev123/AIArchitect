# Phase 2: architectural scale, layering and the element budget (2026-11-06)

This phase was offline engineering only. No paid calls, approvals, commits, pushes or deploys were made. The Private Studio `state.json` was left untouched (sha256 `19e700c0…`, the same value recorded in the Phase 1 report).

The three houses below were built from **developer-authored stage answers** run through the real five-stage pipeline. They prove what the generator can *construct* at every scale. They say nothing about how creative Terra is.

## 1. Audit: what stopped a real mansion

| Limit | Before | Arbitrary? | Now |
|---|---|---|---|
| Scene elements | 400 (scene schema) | Yes, for staged houses. It was a budget for model-authored scenes; the renderer was measured fine at 5,266 draw calls per frame. | 1,600 scene limit. Model-authored element operations stay at 400. |
| Repetitive pieces | One element per stair tread, column, beam, lintel, sill and shutter | Yes | Grouped `parts`: one selectable element per stair flight, colonnade or façade trim run |
| Property size | 120 m | Yes | 200 m (the terrain schema's limit) |
| Block size | 40 m | Yes | 60 m |
| Number of blocks | 12, open spaces included | Yes | 20 blocks + 10 open spaces |
| Stairs | 2 | Yes | 4 |
| Links between rooms | 60 | Yes | 160 |
| Exterior doors | 8 (7 garden doors) | Yes | 16 (15 garden doors) for `scale-1` houses |
| Verandas | 4 | Yes | 8 |
| Veranda depth / columns | 8 m / 10 | Yes | 10 m / 16 |
| Arrival court | 7 × 6 m maximum | Yes | `grand` court: 12–24 × 12 m |
| Main entrance door | 1.8 m wide | Yes | `grand` door: 2.4 m wide; 2.8 × 4.2 m in a double-height hall |
| Pool | Lap pool 14 × 4 m at most | Yes | `resort` pool: 20 × 7 m |
| Stage 5 walking-route search | Re-sorted its whole queue every step | Performance defect | Order-preserving heap; routes are identical (all pinned replays pass). Estate Stage 5 went from 45 s to 0.7 s. |
| Room solver | About 7 rooms per block with cross-block constraints | **Real limit, kept** | 8 constrained rooms in one wing exhausted the search budget. Larger wings must be split into more blocks. |
| Cantilever, support, two levels | Upper floor ≤ 3 m projection, ≥ 60% supported; two storeys | **Real, kept** | No three-storey support was added. |

## 2. What changed

1. **Construction revision `scale-1`** (`spec.construction`). New generations get it. Saved houses without it compile through the original code path, byte for byte. The real Terra house still rebuilds identically: 263 elements, sha256 pinned.
2. **Grouped geometry.** An element may carry `parts`, boxes inside its own envelope. It must be a plain volume, and its parts are validated against the envelope. The renderer draws each part; selection, saves and edits treat the element as one component. Grouped: stair flights (17 treads), colonnades, beam sets, and window surrounds and shutters per block, side and level. Nothing is dropped to fit: the site is reserved first, and any trim that cannot fit is still reported.
3. **Stage 1 scale plan** (`vision.scale`, required from Terra): footprint, gross floor area, levels, wings, principal spaces (kind, m², standard / tall / double height) and the evidence for that size.
   - Stage 1 rejects a plan that contradicts the brief: a modest floor area for an explicit luxury or estate brief, or the wrong number of levels.
   - Stage 1 also rejects a plan that does not fit the property: more than 45% coverage, or impossible floor-area-to-footprint ratios.
4. **Stage 2 builds the planned scale.** These checks earn one correction, then become recorded warnings:
   - floor area at least 80% of the plan;
   - footprint at least 75% of the plan;
   - the planned levels and wings;
   - a double or tall volume for each double or tall principal space.

   One hard check sits on top: `brief-scale`. An explicit luxury or estate brief with N bedrooms needs at least 100 + 35N m² (luxury) or 200 + 50N m² (estate) of real floor. Bedroom labels alone never satisfy it.
5. **Layering is measured, not just height.** New measures: gross floor area, upper floor area, levels, wings, double-height and tall area, upper-terrace area and cantilever area. A wing partly under an upper floor now counts its exposed roof terrace as a separate level in the height hierarchy. The prompts explain the difference between an occupied upper floor and a tall room, plus setbacks to terraces, projections, eave alignment and stairs.
6. **Grand entrances (Stage 4, `scale-1` only).** `canopy: grand` (4.2 m deep, up to 8 m wide) and `court: grand`, with a wide, tall door sized to its hall.
7. **Two old door bugs found and fixed for `scale-1`; the audit now catches them in any house.**
   - A wall exactly as long as door + 1.2 m silently became a window. This is how the modest study first lost its front door.
   - East and west walls are 0.3 m shorter at block corners than Stage 4 measured, so a terrace door in the Phase 1 estate study was never built.
   - `featureAudit` now fails any declared door that was not constructed.

## 3. Results

Measured from the built geometry. "Old construction" means the same design compiled with the original 400-element construction.

| | Modest home | Luxury villa | Estate |
|---|---|---|---|
| Property | 40 × 32 m | 90 × 70 m | 150 × 120 m |
| Building extent | 24 × 8 m | 60 × 24 m | 114 × 50 m |
| Footprint / floor area | 192 / 192 m² | 764 / 1,160 m² | 2,324 / 3,104 m² |
| Levels / wings | 1 / 2 | 2 / 4 | 2 / 7 |
| Double-height area | 0 m² | 324 m² (hall + living) | 764 m² (arrival hall + great room) |
| Upper terraces / projection | 0 / 0 m² | 80 / 36 m² | 192 / 60 m² |
| Rooms / bedrooms / baths | 11 / 3 / 2 | 28 / 6 / 7 | 49 / 7 / 12 |
| Upper rooms / stairs | 0 / 0 | 13 / 2 | 15 / 2 |
| Front door | 1.6 × 2.7 m | 2.7 × 4.2 m | 2.7 × 4.2 m |
| Pool | none (brief) | 14 × 4 m lap pool | 20 × 7 m resort pool |
| Elements (old construction) | 91 (102) | 367 (needs 610: 214 trim pieces dropped) | 510 (**fails**: 492 required > 400) |
| Validation / audit | clean / clean | clean / clean | clean / clean |
| Pipeline time (stages 1–5) | < 0.1 s | 1.0 s | 6.8 s (Stage 3 solver 5.4 s) |
| Save size | 33 KB | 118 KB | 167 KB |
| Browser: load / draw calls per frame / p95 frame | 2.7 s / 736 / 16.8 ms | 2.1 s / 3,185 / 16.8 ms | 3.2 s / 5,266 / 16.8 ms |

- The real baseline house measures 1,341 draw calls per frame, also at 16.7 ms. Every frame time is pinned at the display's 60 fps refresh limit on this Mac (M-series GPU, headless Chrome on Metal), so these numbers show headroom, not a ceiling. Weaker hardware was not measured.
- Every upper room is reached by a stair. Supported share of the upper floors: villa 1.00 and 0.83, estate 1.00 and 0.86.
- Edits (set the block height, set the finish, set the façade) were accepted and atomic, and the houses saved and reopened identically. Each edit took 34–50 ms.

### Screenshots
- Each house in four views: `{modest,villa,estate}-{arrival,aerial,garden,poolside}.png`.
- `*-same-scale.png` uses one fixed camera for every house: the cottage is a speck; the estate fills its 18,000 m² property.
- `baseline-*` shows the real Terra house for reference.

## 4. Live-readiness measurements
- The largest estate request is Stage 4 at about 32 KB, under the 60,000-byte reservation cap.
- The largest answer is the Stage 3 programme, about 2,500 tokens, under the 8,000-token cap. Terra's reasoning tokens are not included and are unknown.
- The live policy is still fixed at a **60 × 48 m site**. A 150 × 120 m live test needs a reviewed policy change (site, and possibly the cost cap) and a new single-use approval.

## 5. Known limits
- **Room solver:** about 7 rooms per block when the block has cross-block door constraints. Large wings need more blocks; the solver reports `search-budget` rather than guessing. Flexible circulation rooms can grow large (a 193 m² gallery in the estate) when the programme under-fills a wing; this is recorded as a warning.
- **"Covered terrace" vocabulary:** an open space is classified by its first architectural noun, so "covered terrace" is read as an *uncovered* terrace. Terra must say veranda or loggia. The classifier was left unchanged so existing saved houses audit exactly as before.
- **Stage 5 terrace geometry:** sun decks are placed only beside the pool along the façade. A pool boxed between wings gets no lounger space. This is landscape work, deferred by request.
- **Flat roofs and the landscape** look plain at estate scale (ten trees on 18,000 m²). Roofing and landscaping were deliberately deferred.
- **Not done:** a mezzanine or gallery overlooking a double-height room; an upper floor over a double-height room; three storeys.
