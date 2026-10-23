# Estate arrival and architectural creativity

Three new deterministic studies add winding circulation, circular/oval motor courts, optional fountains or planted islands, formal garden beds, and detached wings rotated in 15° increments. Select **Palmhaven**, **Splay House**, or **Cortile** in the playground. The [estate creativity report](estate-creativity/REPORT.md) includes aerial/arrival/poolside browser screenshots, reusable controls, validation evidence, and the precise follow-up needed to expose these local approved capabilities to Terra. No live calls were made.

---

# Creative freedom and estate-scale generation

Terra now controls original brief-responsive property layouts, larger pools and derived landscaped grounds, and can select the reviewed versioned elliptical pavilion. Three deterministic editable examples and the actual multi-view browser evidence are documented in [creative-freedom/REPORT.md](creative-freedom/REPORT.md), together with construction bounds, validation and instructions for one authorized live generation. No live calls were made during implementation.

---

# Architectural wing studies

Three local compositions now share the existing architectural kit: compact L, grand courtyard U and an asymmetrical pavilion estate. Open `/dev/villa-playground` and choose **Wing studies**. Direct routes, the composition audit, wing operations, files changed, screenshots and limitations are in [COMPOSITION_FREEDOM.md](COMPOSITION_FREEDOM.md). These studies make no AI calls and do not change Terra's controls.

---

# Solana Collection — current playground

The route now includes the preserved Villa Solana benchmark, four configurable architectural styles, manual customization, and live Terra generation/refinement. Start with `npm run dev` and open `/dev/villa-playground`.

Read the [source audit](REVERSE_ENGINEERING.md) and [implementation, screenshots, validation and limitations report](STYLE_SYSTEM.md). Browser evidence is in [styles/](styles/). Two real Terra requests (generation plus a targeted edit) passed; routine screenshot/control scripts make no AI calls.

---

The original benchmark construction and verification notes follow. Statements about the absence of AI below describe that original phase, before the collection extension.

# Villa Solana — fixed tropical villa study

Route: `/dev/villa-playground`, development only. Start with `npm run dev`.

## Built

The playground now renders a directly authored, fixed contemporary villa instead of the small imported candidate. Its asymmetric composition connects a two-storey salon/master suite, a double-height glazed entrance atrium, and a dining pavilion with a rooftop belvedere. Deep floating roof slabs, teak soffits/screens, wraparound glass balconies, a timber pergola and a tall pivot door give the elevations depth. Furnished rooms, pendant lights, an interior stair and an exterior garden stair make the glazing meaningful.

A 17 m pool, underwater shelf/steps, spill channel, large-format terraces, a timber sun deck, linen loungers, parasols, raised planting beds and a palm grove complete the grounds. The new local palm mesh has curved feathered fronds; existing shrubs and flowering vegetation remain in use.

## Reuse and scope

- Existing R3F Canvas, Drei OrbitControls, SunLight, SceneEnvironment, PostFx/N8AO/SMAA and PrimitiveMesh PBR materials remain the rendering infrastructure.
- WaterSurface adds optional colour, ripple size and ripple strength. All existing workspace defaults are unchanged; owned ripple textures are cleaned up on unmount.
- Reusable local parts: finished boxes, instanced slats, glazing/railings, roof assemblies, sofas, planters, loungers, parasols and palms. The villa and grounds are memoized so camera/lighting controls do not reconstruct static architecture.
- No architectural schema, compiler, generation pipeline, Terra/OpenAI integration, new dependency, V3 store or project-persistence change.
- The prior GLB, its provenance and `actual-scene.png` remain historical evaluation artifacts; the current scene does not load that house.
- Bundled CC0 texture credits remain in `public/textures/CREDITS.txt`.

## Route-type fix

Regenerated Next.js route definitions with the installed version's documented `next typegen` command and restarted the unresponsive development server. Added `npm run typecheck` (`next typegen && tsc --noEmit`) so future checks generate route types before consuming them. No generated declaration was hand-patched and no type checking was excluded or suppressed.

## Verification

- Development route returned HTTP 200.
- Final `npm run typecheck`: passed.
- 32 focused existing tests passed across verification runs: playground cloning (2), model cache (4), GLB assets (8), V3 scene compilation (6), V3 scene persistence (12).
- The first parallel run timed out four persistence tests at the existing 5 s limit. All 12 persistence tests passed with one worker and a 30 s command-line timeout; source tests and configuration were unchanged.
- Actual WebGL scene inspected in Chrome Guest through native browser controls. Poolside, Arrival, Garden and Above each produced visibly different, complete views. Both daylight and golden hour were inspected. The arrival preset and planting were revised after visual review.
- Actual unedited browser screenshots: `solana-poolside-daylight.jpg`, `solana-poolside-golden-hour.jpg`, `solana-arrival.jpg`, `solana-garden.jpg`, `solana-above.jpg`. Browser chrome is intentionally retained as evidence.
- Hot reload encountered transient `removeChild` and `e is not a function` errors while component exports changed. A clean browser reload recovered; final lighting and all camera preset checks completed without a new runtime error in the development log.
- Existing Three.js Clock/PCFSoftShadowMap deprecation warnings remain. Global AssetLibrarySync briefly reported a database timeout on `/api/assets`, then recovered; it is independent of this fixed scene.
- Direct drag/pan/zoom, tour timing, mobile framing and production HTTP 404 were not exhaustively re-tested. Existing controls and development-only gating remain in place.

## Remaining visual limitations

This is a real-time architectural concept, not an offline photoreal render. Shrubs and furniture are simplified, concrete textures repeat, distant surroundings are sparse, and some views place palms in front of architecture. Glass and pool water use environment reflections rather than planar reflections or ray tracing; water ripples remain an approximation. Interior detailing, circulation, stair/guard construction and roof drainage are conceptual rather than construction documentation. No complete interior walkthrough or AI editing is provided at this stage.

No migrations, commits or deployment were performed.
