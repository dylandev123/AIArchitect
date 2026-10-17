# Flat-land tropical mansion: quality audit

Project `f2149916-31a2-4ede-b910-6d982c15a9d5`, generated 2026-10-15 16:00Z (one attempt, no repair, 5,589 output tokens). No Terra/OpenAI calls were made for this audit.

## Evidence

- **Brief and committed scene** were recovered from `.next/dev/logs/next-development.log`: the `[EDIT INPUT]` line has the prompt, and the `[RENDER TRANSITION]` `to.configJson` has the 25-object V3 scene. It is saved at `parity/flat-mansion/scene-f2149916.json`. `ai_usage` stores only a fingerprint for accepted runs.
- **Terra's raw output was not persisted.** What we have is the canonical post-ingestion scene. The generation audit reports 5 intent relocated, 21 supports inferred, 1 transform defaulted, 2 fallback renders, 1 unresolved connector and 1 junction partition.
- **Compiled geometry** came from offline `compileV3Scene` on that scene: 498 primitives.
- **WebGL captures** came from the production `/workspace/[id]` route. The scene was injected into an isolated headless Chromium's localStorage (`scripts/workspace-replay-capture.mjs`) and provider requests were blocked. Views: `parity/flat-mansion/1-arrival`, `2-arrival-eye`, `3-garden-pool`, `4-garden-eye` and `5-aerial`.

## What Terra designed (canonical scene)

| Object | Footprint × height | Notes |
|---|---|---|
| main-living-pavilion | 16 × 11 × 8.4, **levels 2** | Labelled "Double-height Great Room". Arrival door, portico and sidelights on "south". Full-height view glazing and a 4-post loggia on "north". |
| west / east bedroom wings | 6.5 × 18/17 × 7.2, levels 2 | Flush against the main pavilion's side walls. Each has 6 identical 1.1 × 1.55 m windows per floor on its outer face. Balcony on the inner ("courtyard") face. |
| service / wellness | 4.5 × 8 × 3.9 | Flush against the wing ends. |
| roofs | 3 × hip (pitch **0.24**, height 1.65/1.25), green flat, timber mono | Roof-form widths already include the overhang (16 + 2 × 1.1 = 18.2). |
| site | arrival drive + turnaround + court + rill at **−z**; terrace, pool, lounges at **+z** | No courtyard object. 4 landscape zones. |

Floor area is about 880 m², so the programme is satisfied. The plan is a symmetric, fully flush H/U with 1.5–5.5 m wing projections. There are no real courtyards or setbacks.

## Findings

### A. Terra failed to design it

1. **The composition is a flush symmetric block, not wings around outdoor rooms.** All five masses share walls. The "courtyard" faces of the wings sit against the main pavilion. The brief's landscaped courtyard was never authored.
2. **The mass hierarchy is weak.** The primary pavilion is only 1.2 m taller than the wings and shallower than them (11 m vs 18 m). In the renders, all three read as one two-storey box (shots 1 and 3).
3. **It ignored the explicit contract for double height.** The prompt says to "Use levels:1 for a whole double-height pavilion", but Terra authored `levels: 2`.
4. **Facades are repetitive and undersized.** Bedroom wings get 1.05–1.15 × 1.55 m punched windows in identical rhythms of 6 per floor. Service and wellness boxes are mostly blank.
5. **The material palette is incoherent.** It uses five different wall materials, one per mass (warm concrete, coral stone, sand render, charcoal render, timber-concrete), instead of one coordinated palette.
6. **Outdoor objects collide with the buildings:**
   - The lounge deck and its canopy overlap the east wing by about 3 m.
   - The fire lounge overlaps the west wing.
   - The pool (z 13.1–21.3) overruns its terrace (ends at z 18.95) into the lawn.

### B. V3 failed to interpret or construct it

1. **The whole design is built 180° backwards (highest impact).** In V3, south is +z, but Terra placed its arrival court and drive at −z and labelled that side "south". V3 compiled it literally:
   - The front door, sidelights and portico face the **pool**: door at z = +8.1, portico at z = +9.1 to +10.3 (shots 3 and 4).
   - The great-room glass wall, loggia and wing "pool glazing" face the **driveway** (glazing at z = −2.0 and −7.6, shots 1 and 2).
   - The pool facades of the wings get only 3 small upper windows and blank ground floors.
   - The entry steps (z = −2.95) lead to the loggia, not the door (`UNRESOLVED_CONNECTOR`).

   The compass-to-axis mapping appears only inside the advanced-terrain `naturalFall` text. Nothing cross-checks `facadeRoles`/`mainEntry` against where the arrival and pool objects actually are.
2. **Every pitched roof renders essentially flat.** `pitch` is read as **degrees** and clamped to ≥ 1 (`construction.ts:104`), but the prompt never states a unit. Terra's 0.24 (a rise/run ratio, consistent with its authored 1.65 m roof height) became 1°. The main roof's compiled plane rises from y 8.4 to 8.5 instead of 8.4 to 10.05, and the authored roof-form `height` is ignored. Shots 1–4 show thin floating plates.
3. **Roof overhang is counted twice.** The authored roof width already includes the overhang, and the compiler adds it again: the main roof compiles to 20.4 m instead of 18.2 m, and the wings to 10.1 m instead of 8.3 m. The wing roofs then run about 4 m under the main roof, so the hips collide with no valley or abutment (shot 5). This is the "excessive roof coverage".
4. **The double-height space is not built.** Even allowing for Terra's `levels: 2`, the "Double-height Great Room" gets a full 16 × 11 level-1 slab at y 4.33. Its full-height glazing is split into two stacked 3.7 m bands. Nothing reconciles the label or role with the storey count.
5. **Balconies are buried inside the building.** Both upper balconies (slabs at x = ∓7.3, railings at ∓6.6, over z −4.8 to 7.3) are built on faces shared with the main pavilion, so they sit inside its volume. No diagnostic flags assemblies on a party face.
6. **The arrival drive and turning circle use fallback geometry.** They render as a generic slab and a generic cylinder (`FALLBACK_RENDER_USED`) because no `siteHierarchy` connection owns them. The turning circle shows up only as a faint ring in shot 5.

### C. Renderer and material limitations

1. **Walls are flat-shaded colour only.** Facade walls carry no `surface`, so the stone, timber and textured concrete in the brief all read as beige or grey paint. Glass is a flat light blue with no reflection of the sky.
2. **Vegetation is primitive.** There are 10 cube-canopy "lollipop" trees in total (3 per garden zone, 1 at arrival) and no palms. The 17 × 31 m gardens render as flat translucent green rectangles.
3. **There are ground artifacts.** Shots 1, 2 and 5 show mottled dark shadow-acne/z-fighting around the landscape planes and lot, an editor grid on the ground, and an endless featureless lawn.
4. There is no architectural lighting and no soffit or fascia depth on the pitched eaves.

## Where quality was lost

| Stage | Loss |
|---|---|
| Brief → Terra | A flush, symmetric, weakly hierarchical plan. Wrong storey count for the double-height space. Small repetitive windows. Fragmented materials. |
| Terra → canonical | Nothing is caught. The orientation contradiction, the colliding terraces and the balconies on party faces all pass validation. |
| Canonical → compiled | The design is built backwards against its own site plan. Roofs flatten (1°) and their overhang doubles. No double-height volume. Balconies buried. |
| Compiled → pixels | Untextured paint, cube trees, flat garden planes, shadow artifacts. |

Composition was lost mostly at **B1 and B2**: one coherent but plain design was turned into an inside-out house with flat roofs. A's weaknesses then cap what is achievable. C sets the visual ceiling.

## Top three improvements, in implementation order

1. **Site-orientation coherence (B1, A6).**
   - State the axes explicitly in the flat contract: +z is south, −z is north.
   - Add a deterministic check that derives the arrival side (driveway, arrival court, entry stair) and the view side (pool, terrace) from site objects.
   - When `facadeRoles`/`mainEntry`/opening facades are consistently inverted relative to those, remap the compass facades (N↔S, E↔W) for every mass, with a note. When they are only partly inconsistent, diagnose and send to the existing repair attempt.
   - Also flag terraces or decks that overlap building masses.

   This alone puts the portico and door on the arrival court and the two-storey glass wall and loggia on the pool, which is the most visible fix.
2. **Roof fidelity (B2, B3).**
   - Define the `pitch` unit as degrees in the prompt and schema.
   - When a hip or gable roof-form has `pitch` below 2 together with an authored `height`, derive the pitch from `atan(height / (min(w, d) / 2))`. Treat a value of 1 or less as a ratio.
   - Stop adding the overhang twice when the roof-form footprint already exceeds its host by about 2 × overhang.
   - Make lower wing hips terminate against the primary roof (abutment or valley) instead of running underneath it.

   This brings back the "impressive rooflines" and removes the overlapping lids.
3. **Mass hierarchy and double height (A1–A3, B4, B5).**
   - Map a primary mass whose label or role says double-height or great room to a `levels: 1` volume, or diagnose it and send it to repair.
   - Require the primary mass to be clearly taller than the secondary masses, and require secondary masses to be offset or set back rather than flush along a full face.
   - Reject balconies and assemblies on shared faces.
   - Have the prompt ask for courtyard voids between wings and a large-format, varied glazing vocabulary.

   This needs one repair loop, which can be validated offline with mocked responses.

After those three: a coordinated material palette with surface textures for stone, timber and concrete; a palm vegetation set; and the fix for the landscape-plane shadow artifacts (C1–C3).

No code was changed for this audit, apart from the capture script and the recovered artifacts.
