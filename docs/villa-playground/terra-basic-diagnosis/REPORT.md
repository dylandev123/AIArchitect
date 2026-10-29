# Why Terra produced a basic house

The latest retained accepted direct-scene result is intrinsically a small, mostly single-storey composition. Execution did not shrink or simplify it. Terra stopped voluntarily well below its output allowance. Existing operations can construct a substantially larger, more articulated residence: the attached offline study proves that through the same executor, relationship checks and browser renderer.

This identifies the immediate failure in the authored architecture. It does **not** establish the model's internal reason for choosing it, nor prove that another prompt alone would solve repeated failures.

## Provenance and what Terra was told

Audited artifact: `.data/scene-responses/0bd8551e-ebcf-4685-8ee0-5aed50e7bea6.json`, status `accepted`, name **Caribbean Horizon House**, retained October 27, 2026, about 09:35 Saint Lucia time. Its mode is generate, with no current scene or image reference. The original prompt is `[REDACTED]`. Consequently the exact $25 million wording cannot be independently verified from this artifact. It is the latest retained accepted result and matches the described small house; the dollar amount comes from the user's account. An earlier accepted result, `0e79fe9c-8e2e-4b6c-a11e-22b1dd146ae2`, must not be confused with it.

The **current** model-facing contract is preserved in `current-system-prompt.txt`, sourced from `src/lib/villa/scene/terra.ts`. It instructs Terra to build a complete residence from an empty scene, including enclosure, floors, roofs, entrance and glazing. It explicitly requests a primary residence, subordinate connected wings, recessed links, layered roof datums, deep loggias, solid/void rhythm, stone piers, timber soffits and detail on all visible elevations. It permits arbitrary elevations, more than two floors, noncardinal rotation, bridges and cantilevers. It explicitly forbids using landscape or detached pavilions as a substitute for the main house.

The contract also forces new generation onto flat Y=0 staging, even for hillside briefs. The output discloses that limitation. This removes hillside drama but does not restrict building storeys. Retention does not snapshot the actual historical system prompt/schema/model options or lessons. The current instructions are strong code evidence, not a verbatim historical wire capture. Both retained lesson summaries are mocks, which `learningContext` excludes; they supply no substantive learned design guidance.

## What was actually authored

| Quantity | Latest Terra result |
|---|---:|
| Operations / elements | 55 add / 55 |
| Central enclosed slab | 16 × 9 m = 144 m² |
| West / east ground wings | 8 × 11 / 8 × 10 m = 168 m² combined |
| Upper suite slab | 7.4 × 6.4 m = 47.36 m² |
| Nominal enclosed slab area | 359.36 m², before wall deductions |
| Main ground walls | 3.2 m high |
| Maximum main-house roof top | 6.925 m |
| Sea loggia | 16 × 3 m |
| Pool water | 9 × 5 m |
| Detached lounge | 8 × 6 m approved elliptical pavilion |
| Walls / actual openings | 21 / 14 |
| Roofs / screens / railings | 7 / 4 / 1 |
| Noncardinal elements / parent attachments | 0 / 0 |

The ground residence is about 32 m across. Most roofs share the same 3.55 m centre elevation. The upper suite occupies only about 15% of ground enclosed slab area. The result therefore reads as a bungalow with one small upper room. It lacks a major vertical entrance, large upper residential volume, courtyard enclosure, expressive bridging or substantial setbacks. The summary's “grand”, “dramatic” and “long infinity-style pool” are descriptive claims, not geometric achievements.

There are also architectural omissions in the output: the west wing's inner wall is solid, without a connecting opening; the upper suite has no authored stair and its sea opening has a raised sill rather than balcony access. The balcony railing is almost against the suite facade, with no meaningful projecting outdoor room. These are authorship/completeness problems that the relationship checker is not designed to diagnose. A passing scene is not a complete habitable building.

## Executor and renderer

`resolveSceneResult` begins with an empty scene and invokes `applySceneOperations`. In generation it removes terrain operations only; this response has none. The replay asserts deep equality between every retained add element and every resolved scene element. **Zero architectural elements were removed, resized, moved, or substituted.** All 55 appear as named `operation:<id>` groups in the browser. There are no relationship issues.

`OperationStudio` resolves the returned operations again and persists the resulting scene. `OperationScene` maps plates/volumes to solids, walls to real jamb/sill/header pieces around their openings, roofs to roof geometry, and glazing to divided panels. No storey inference or massing reduction occurs. Pavilions invoke the approved builder.

Some renderer conventions are real but secondary: glazing/railings have builder-defined thin geometry; sofas honor width but use fixed furniture details rather than the supplied full size; ivory flat roofs add soffit/top detailing. None can explain the missing residential size or storeys.

Fresh browser screenshots reproduce the authored small house. This is an offline replay of retained instructions, not an asserted capture of the user's original browser session. The historical saved project was not independently recovered from that browser's storage.

## Budgets: no exhaustion

The read-only historical usage query found the latest scene call at **2026-10-27 13:34:04.932 UTC (09:34:04.932 Saint Lucia)**: `gpt-5.6-terra`, 2,443 input tokens, **5,970 output tokens**, **30,000 maximum**, `finish_reason: stop`, 66,032 ms, success. Its completion time aligns with the latest retained file. There is no response-ID field joining these records; correlation is chronological. The previous scene call also stopped normally, using 3,005 of 30,000 tokens.

Current limits are 400 scene elements, 800 operations, 40 panels per element, dimensions/coordinates bounded at 10,000 m. The result uses 13.75% of the element limit, 6.875% of the operation limit and 19.9% of output tokens. Route timeout is 170 seconds, with zero retries; this call completed in 66 seconds. A non-stop completion is rejected, not silently accepted as a smaller house. The route has no output-byte clipping step. The 12,000-character request limit rejects oversize input rather than truncating it. Neither the response retention function nor the client imposes a 55-element budget.

Thus **raising output limits is not supported as the first fix**. Reasoning-token usage was not retained separately. The observed stop and substantial headroom rule out forced output truncation, while leaving model-level preference for concise output possible.

## Comparison with existing benchmarks

See `metrics.json`, `browser-evidence.json` and the three view captures for each design. Mesh counts below count only each architecture root, excluding grounds; these are rendered meshes, not comparable to editable scene elements.

| Design | Direct elements | Architecture meshes | Main architectural composition |
|---|---:|---:|---|
| Latest Terra | 55 | 269 | Three low blocks, small upper suite, shallow entrance canopy; 14 openings |
| Casa Ladera | 78 | 185 | 13 × 7 m upper bridge, broad balcony, 8.72 m lantern/cap, offset lower spaces, stairs, pergola, corner glazing |
| Villa Solana | Not a direct-operation scene | 336 | 13.5 × 9.9 m upper suite slab, ~9.3 m entrance portal, 4 m salon glazing, roof belvedere, wrapping balcony, layered open rooms and fine detail |
| Offline study | 174 | 972 | Three-storey west wing, two-storey salon/east wing, receding upper floor, tall portal, 44 m colonnaded loggia, rooftop belvedere; 70 openings |

Ladera has **fewer rendered meshes than the failed house**, despite stronger spatial composition. Solana's upper slab alone is about 2.8 times the failed suite slab area. More primitives alone are not the diagnosis: generous vertical scale, large upper volumes, transparency, recesses and differentiated roof levels do the work. Solana includes landscaping that the direct scene lacks; architectural mesh measurements exclude it, and the study/failed scenes share flat staging.

The normal view presets auto-fit each design and sometimes view the arrival side despite the Poolside label; they are not identical framing. Additional `*-fixed-camera.png` captures use the same position `[60,35,65]` and target `[0,5,-5]` for all four. Grounds differ for the legacy Solana comparison.

## Capabilities and practical guidance

Already exposed but underused: multiple substantial upper floors, receding terraces, meaningful projecting supported decks, bridges, angled wings, parent transforms, large glazed corners, varied pier/beam depth, repeated facade bays, real stairs assembled from plates, and gable/hip roofs. Pitched roofs or rotations are optional design choices, not mandatory marks of sophistication.

The direct contract does **not** expose every capability elsewhere in the repository. Legacy footprint/stack builders, arched facades, arbitrary shaped footprints and more specialized architectural components are not available as direct-scene kinds. Direct walls allow one opening each, requiring separate walls for repeated windows. Screens generate vertical slats only; horizontal pergolas need beams/volumes. The pavilion is an open lounge, not an enclosed curved house. Missing arbitrary curves, CSG, automatic stairs and automatic interiors are genuine scope limits, but are unnecessary for the demonstrated increase in residence scale and articulation.

The contract is geometrically usable: units, axes, opening placement, support, slabs, transforms and limits are explicit. It gives **qualitative** luxury advice but no resolved residence programme, area allocation, bay strategy or worked construction examples showing how many parts a detailed residence actually takes. The JSON schema enumerates primitives; it does not encode a spatial programme or architectural hierarchy. Terra must invent the architecture and individually serialize every part in one completion. This makes underdeveloped composition easy to accept. It is a plausible contributing contract weakness, not experimental proof that wording caused this output.

## Offline proof and limitations

`scripts/terra-basic-diagnosis.ts` constructs the study exclusively as add operations, runs the existing atomic executor and relationship checks, and exports static JSON. It uses 174/400 elements with zero relationship issues. It is **not registered as a preset, generation template, builder or application route**. No production source was changed.

The browser capture imports those JSON scenes through existing local preview persistence. It blocks all AI endpoints and all external hosts. Twelve preset views plus four fixed-camera renders were captured. All expected operation groups exist, with no page errors. The study is visibly larger and more articulated than the failed house through the same renderer.

This is an exterior capacity study, not a finished mansion design: it repeats bays, omits internal circulation and room fit-out, and some adjacent walls remain partitions. Its 16.05 m maximum includes an open belvedere above three residential levels. It proves that neither geometry nor validation forces a small result; it does not prove Terra will independently produce this quality, or that a large mesh count guarantees excellence.

## Smallest justified next changes — recommendations only

1. Preserve a privacy-appropriate, reviewable request specification and correlate response ID, usage, prompt/schema version and applied scene hash. Today the original brief is redacted and historical system instructions are not snapshotted. This is the smallest observability fix needed for exact future diagnosis.
2. At the existing contract boundary, make the requested residence programme and scale explicit: area allocation, substantial upper accommodation, entrance proportions and circulation intent. Add a small amount of practical instruction showing how existing walls/openings/slabs form articulated bays, corners, decks and links. Avoid a fixed mansion template or a longer feature wishlist. The current qualitative luxury paragraph already exists and was insufficient here.
3. Keep the present token/element limits initially. Evaluate existing retained briefs against rendered spatial composition and realised programme before changing budgets or adding geometry. The unused headroom is overwhelming.
4. Treat terrain staging and camera selection as separate presentation follow-ups. Flat ground removes the Caribbean hillside setting, and the Poolside preset can face away from an authored pool. Neither created the small building. Do not mask the architecture failure with scenery.

No new prompts, validators, generation systems, geometry, V3 changes, migrations, commits or deployment were implemented. Zero OpenAI calls were made. Historical database access used an explicit read-only transaction; an earlier attempt through the generic store failed DNS before connecting, and was replaced because its initialization contains schema DDL.
