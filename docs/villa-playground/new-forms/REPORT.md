# New architectural forms and site boundaries

Implemented locally on 22 October 2026. No live paid AI calls, commits, deployment, agents, blueprint pipeline, or library dashboard.

## Site failure and fix

The retained response `e648bab9…` described Caribbean Crown Estate: four building wings, two derived galleries, four terraces and a pool. Its garden was `{x:-30,z:-30,width:60,depth:60}`. Since x/z mean the rectangle's **centre**, its positive edges were both zero. The main villa (and other features) consequently lay outside it. This was a garden-coordinate error, not a reason to truncate approved architecture.

`siteMode:derived` now calculates a presentation garden from the union of all roof/veranda envelopes, generated galleries, terraces, experimental roof envelopes, and the pool's coping/furniture zone, plus 2 m landscape margin. It accounts for cardinal wing rotations and arbitrary supported pavilion yaw. New fictional Terra generations default to this mode; subsequent composition edits recompute it. No wings, connections, paving or pool features are changed or omitted. The replay produces **54.15 × 53.30 m**, centre **(-1.075, -0.450)**, and all six rendered wing/gallery volumes survive. `geometry-checks.json` records deep equality for all architectural fields. Character shortening is the pre-existing presentation-copy rule.

`siteMode:fixed` performs strict containment checks. Legacy stored configurations without a mode keep their previous fixed-garden semantics when loaded/edited. An explicit garden patch fixes the site. New provider output requires the mode: the prompt instructs Terra to encode any explicitly defined lot as fixed, with exact centre/dimensions. The optional **Fixed site** controls and request `site` rectangle are authoritative: server AND client override a provider attempt to derive/resize that lot. Invalid results are rejected transactionally; the current design remains visible. Only rectangular sites are supported. Natural-language extraction still depends on Terra representing the user's lot correctly; the structured controls remove that ambiguity.

Garden dimensions now support 12–128 m, enough for the full bounded composition domain rather than an arbitrary 80 m presentation cap. Building position/dimension limits are unchanged. Existing collision, roof-junction, hierarchy, pool and open-courtyard checks still run. Enlarging a fictional garden cannot make colliding architecture pass. Pool east clearance is conservatively 3.8 m, including the existing parasol's rotated canopy. Context planting for authored compositions follows the actual site centre and sits farther from the architecture; original preset grounds remain unchanged.

## Smallest viable creation path

| Path | What it supplies | Editability and fit | Decision |
| --- | --- | --- | --- |
| Extend existing wing/component builders | Additional facades, arches, roof profiles and wing variations | Excellent for supported rectangular building topology; existing shared-wall contacts and galleries remain rectangular | Keep using for variations. Forcing a circular wing into that topology would spread changes through stairs, contacts and roofs. |
| Bounded parametric descriptions → reusable Three.js builders | Curved shells, extruded profiles, elliptical roofs, controlled new component families | Dimensions regenerate geometry, connections are explicit, budgets and bounds are deterministic | **Implemented experiment and smallest useful next path.** A new allowlisted builder is authored once; Terra later requests parameters, never executable code or arbitrary triangle soup. |
| Specialized AI 3D mesh service | Organic sculpture, carved ornament, unusual decorative objects or a concept mesh | GLB is renderable, but does not imply doors, rooms, editable radii, separable material slots, accurate metres, useful topology or connection points | Exploratory only. Use when its visual benefit exceeds the ingestion/review cost; not needed for this pavilion. |

The existing native asset system already supports bounded primitive descriptions, including `curvedSurface`, `roundedRect`, `tube` and lattice. It is primarily a small-prop system with its own family/part limits; increasing those limits would not create a reliable building topology. The new architectural builder therefore reuses the **existing `PrimitiveMesh` triangle renderer, PBR finishes, kit furniture, camera, environment and WebGL playground**, without changing native prop generation.

For an external service, Meshy's [Text to 3D API](https://docs.meshy.ai/en/api/text-to-3d) documents separate geometry-preview and texture-refine jobs with GLB output; its [Remesh API](https://docs.meshy.ai/en/api/remesh) changes topology/face counts. Those are useful ingestion steps, not evidence of architectural parametric editability. That compatibility judgement is an inference from the mesh-based interfaces. No provider SDK, credentials or paid job was added. A future candidate should use existing `glbValidator`, `glbIngest`, `serverStore`, curated asset review, version resolution, placement and `glbModels` cache. Review true scale, origin, normals, watertightness where required, material slots/textures, triangle/draw-call cost and collision envelope before approval. Unvalidated assets must remain in the existing review queue.

Three.js [ExtrudeGeometry](https://threejs.org/docs/pages/ExtrudeGeometry.html) supports the shape extrusion used here; regeneration from stored parameters provides editability. This is **developer-authored procedural creation**, not AI-generated mesh geometry and not autonomous invention of an unknown builder.

## New reusable form

`curved-pavilion@1` creates an open elliptical garden lounge with an extruded curved masonry rear shell, matching curved glass side panels, curved bench/cushion, elliptical plinth/floor, projecting elliptical roof, timber soffit, roof cap, bronze frames and kit furniture. These are actual curved surfaces, not rectangular wings arranged to resemble a curve.

- Placement: metres, +Y up, floor-centre origin at y=0.47 in the existing playground; entrance faces local +Z. x/z are supported from -30 to 30 m; yaw is 0–359° about +Y using Three.js rotation.
- Supported dimensions: width 6–10 m, depth 5–8 m, wall height 3–4.2 m; elliptical radii are half width/depth. Roof overhang is 0.65 m. Shell finish: ivory or limestone; other material slots are deliberately fixed in v1.
- Entry connection: pedestrian approach at local `[0,0,(depth/2)*sqrt(1-(1.2/(width/2))²)]` (a chord that fits the 2.4 m approach, at floor y=0; world floor y=0.47), outward normal +Z, nominal width 2.4 m. `pavilionEntry` gives world position/normal after placement. No automatic wing/gallery joins or enclosed-floorplan claims.
- Spatial validation: exact rotated ellipse AABB, fixed-lot containment, conservative 0.2 m roof separation from all wings/galleries/other forms, pool furniture clearance, and no intrusion into an open courtyard. Paving can pass beneath its raised slab, consistent with existing wings.
- Reuse: **Horizon** has an 8 × 6 × 3.5 m limestone pavilion at (15,4), yaw 25°. **Breeze** uses the same builder as a 6.5 × 5 × 3.2 m ivory pavilion at (17,9), yaw 105°. Select **Curve / Modern** or **Curve / Island** in the playground, or open `?composition=curve-horizon` / `?composition=curve-breeze`.

## Minimal versioned library record

`src/lib/villa/component-record.ts` defines the proposed small descriptor: record schema version; stable component ID and version; experimental/review/approved/rejected status; procedural versus AI-mesh provenance; versioned builder reference **or** existing curated asset ID plus content hash; coordinate convention; nominal dimensions; supported parameter ranges; connection positions/normals/width and their dimension rule; allowed material slots; validation status, checks, evidence and limitations.

The concrete record lives in `experimental/catalog.ts`, separate from approved capabilities and assets. `approvedComponents` requires both approved status and passing validation. The paid provider schema excludes `experimentalForms`, so Terra cannot silently use this experiment. Existing `DesignRecipe` parameters, `CuratedAsset` storage/versioning and Needs remain the infrastructure to reuse when promoting a component. No new persistence subsystem or dashboard was introduced.

## Browser review and validation

Completed: **91 focused Vitest tests**, `npm run typecheck`, and scoped ESLint passed. The tests cover the exact retained failure, fixed-site authority even against contrary provider output, legacy site preservation, recomputation after edits, transactional rejection of collisions, disabled pools, remote terraces, all tested yaw envelopes, finite curved geometry at dimension extremes, and exclusion from approved retrieval / paid provider output.

Actual Chromium WebGL verification finished with **zero page errors and zero live AI requests**. It checked two pavilion studies in poolside, overhead and close views, Villa Solana (572 mounted meshes), all four established styles, and all three prior wing studies. The retained estate was replayed once through an explicitly intercepted offline response into the actual client submit handler; all **six wing/gallery groups** mounted (1,858 meshes). `browser-checks.json` stores mounted R3F groups, actual placements/yaws, geometry envelopes and camera positions. Screenshots are actual browser renders, not image generation or synthetic drawings.

Visual review: both roofs and floors are visibly elliptical; masonry, side glazing and seating follow the curved shell; bronze frames and timber soffits meet the roof; the scaled/rotated second instance retains its proportions. Overhead views show separation from villa roofs and the pool. The close views were moved inside the context planting to avoid palm leaves obscuring the form. The first landscape placement was corrected after an overhead screenshot exposed a palm intersecting the new pavilion. Solana retains its original massing, stairs, terraces, landscape and pool. The component's validation status is now passed, while its lifecycle status remains **experimental**.

Screenshots:

- [Modern composition](curve-horizon-above.png) · [Modern curved-shell detail](curve-horizon-detail.png)
- [Island composition](curve-breeze-above.png) · [Island curved-shell detail](curve-breeze-detail.png)
- [Recovered estate](boundary-recovered.png) · [Preserved Villa Solana](solana-preserved.png)

Reproduce without paid calls: run `npx vite-node --config vitest.config.mts scripts/villa-new-forms-evidence.ts`, then, with the local development server running, `VILLA_URL=http://localhost:3000/dev/villa-playground node scripts/villa-new-forms-capture.mjs`. The capture uses the same optional Playwright/Chromium environment overrides as existing playground scripts. It blocks provider endpoints and fulfills only its planned offline replay.

## Next smallest step

After review and explicit promotion of this one builder, add an optional bounded component request/patch to Terra's existing paid composition response: `{componentId,version,placement,parameters,materialSlots}`. Resolve only approved, version-pinned builders/assets, validate the whole composition transaction, and persist its placement alongside wings. This lets a premium Terra call choose and customize the pavilion without a new agent or raw code execution. An unknown form should produce an existing Library Need / proposed component record for review, with a truthful unsupported result until a builder or validated asset exists. A separate authorized paid mesh experiment could then test whether an ornamental component improves visual quality enough to justify its cost.

This demonstration does not establish unrestricted AI architecture generation: it proves one new reusable procedural form, a viable bounded parameter contract, and a route to controlled library growth.
