# Creative principal residences — offline verification

## Retained estate audit

Inspected the actual retained response `6d31056837d287b9b8ea01707a43bcc6db1bc39dd36fccb668a52ebb32429f5d`, replayed it in the browser, and saved an unchanged response fixture at `src/lib/villa/__tests__/fixtures/main-residence-estate.response.json`.

Its principal wing is `skyhouse`: centre (0, −10), **42 × 16 m**, two storeys at 4.2 m each, orientation 0°, 4 m veranda, 2.4 m balcony. A 20 × 12 m west salon, 22 × 14 m east wing and 18 × 14 m arrival suite directly touch its walls. Two guest retreats are detached. The curved `sea-orbit-pavilion` at (0, 59) is a separate outdoor lounge. Thus the existing principal composition is connected and asymmetric, but its main wing remains a rectangle with an unbroken two-storey roofline.

## Existing builders and the change

- `ComposedWing`, `wallContacts` and `WingWall` already support directly connected cardinal flat-roof volumes with different proportions, heights, verandas and balconies. Straight galleries support separated wings. Pitched roofs require separated building envelopes. Upper walls otherwise repeat each wing's rectangular plan.
- `curved-pavilion@1` supplies a bounded open outdoor lounge, not an enclosed main house.
- `footprint-building@1` already supports a continuous enclosed curved or articulated plan, sampled glazing, walls, soffits and concave floor/roof triangulation. It previously had a single height.

The compatible extension is **one optional `upper:{points,height}` field on the existing footprint form**. It uses the same point schema, local coordinates, facade/plate builder, finishes and glazing. It supplies an inset upper floor, an independent upper height and a glass railing around the exposed lower roof. New two-level forms also reuse the existing sofa, rug and table geometry in bounded interior seating groups. Single-level forms retain their previous geometry and furnishing behavior.

Validation checks both outlines for simplicity, wall clearance, area, perimeter and facade budgets. Upper boundary samples at intervals of at most 0.2 m must remain inside the sampled lower outline and at least 0.65 m from its edges. Both levels count toward the existing 300-bay combined form budget. Lower bounds still enclose the whole building. The existing `forms:put` operation replaces a complete form; final-state validation remains atomic. Terra's provider schema and instructions expose this capability. No new editing executor, preset routing or separate generation contract was introduced.

## Three deterministic designs

Use Development presets or `/dev/villa-playground?composition=<id>`. Complete editable configurations are in [configurations.json](configurations.json).

| Design | Demonstrated composition | Heights | Facade bays |
| --- | --- | --- | --- |
| Crescent Crown (`crescent-crown`) | Continuous crescent plan and a smaller curved upper crown; broad end terraces | 4.2 + 3.8 m | 222 |
| Terrace Ziggurat (`terrace-ziggurat`) | Staggered rectilinear base, offset folded upper plan and projecting lower terraces | 4.2 + 4.5 m | 121 |
| Butterfly Headland (`butterfly-headland`) | Two continuous splayed arms around a compact polygonal upper crown | 4.8 + 3.4 m | 84 |

These are each one continuous principal building, with two connected floor envelopes. The studies replace the retained response's six residential wings with that principal form; they are not edits to the saved retained response. Pools, all terrace rectangles, landscape configuration and the sea pavilion are copied unchanged. The detached retreats are not reproduced in these three studies. The original estate and Solana remain selectable and are captured separately.

## Actual browser screenshots

All images are actual Chromium WebGL captures of the playground, using its existing renderer. Each design has the native estate-scale views plus close camera orbits of the principal house. Detail images change only the camera and orbit target. They are not generated illustrations or image edits.

| Design | Aerial detail | Arrival detail | Poolside detail |
| --- | --- | --- | --- |
| Crescent Crown | [Aerial](crescent-crown-aerial-detail.png) | [Arrival](crescent-crown-arrival-detail.png) | [Poolside](crescent-crown-poolside-detail.png) |
| Terrace Ziggurat | [Aerial](terrace-ziggurat-aerial-detail.png) | [Arrival](terrace-ziggurat-arrival-detail.png) | [Poolside](terrace-ziggurat-poolside-detail.png) |
| Butterfly Headland | [Aerial](butterfly-headland-aerial-detail.png) | [Arrival](butterfly-headland-arrival-detail.png) | [Poolside](butterfly-headland-poolside-detail.png) |

Visual review completed for all nine detail views: the crescent reads as two continuous curved bands; the staggered house has a long offset crown and stepped end terrace; the butterfly house has two angled arms and a smaller central crown. All three remain visually simpler than the bespoke Solana model.

Regression views: [retained estate](retained-estate-poolside.png), [Solana](solana-poolside.png).

## Verification

- `npx vitest run src/lib/villa src/app/dev/villa-playground/villa-model.test.ts`: **129 passed**, 12 files.
- `npm run typecheck`: passed.
- Targeted ESLint for the footprint geometry, footprint renderer, examples and new tests: passed.
- `git diff --check`: passed.
- Tests cover three provider-compatible configurations, finite triangulated geometry, unchanged outdoor configurations, successful upper-floor edits through `resolveVillaResult`, atomic invalid edits, upper edges crossing a concave recess, and unchanged retained estate wing configuration.
- `scripts/main-residence-evidence.ts` exports configurations and [geometry checks](geometry-checks.json).
- `scripts/main-residence-capture.mjs` records finite scene geometry, both rendered floors, native camera selections and regressions in [browser checks](browser-checks.json). It blocks all AI and nonlocal HTTP requests.
- `scripts/main-residence-edit-check.mjs` exercises the real conversational UI with intercepted local responses: an accepted upper-floor height change and an unsupported upper footprint rejected without losing the current residence or landscape. See [edit checks](edit-checks.json) and [rejection screenshot](rejected-edit-preserves-residence.png). No live provider calls.

## Practical limits

The new freedom is bounded exterior composition, not arbitrary architecture. There is one inset upper floor, shared material/opening style, flat roofs and no upper cantilevers or independent upper rotation. A lower roof terrace is a real exposed plate with a railing, but stairs, terrace access doors and professional interior plans are not generated. Simple seating is visual furnishing only. No dramatic entrance portal or sculptural overhang builder was added. New forms cannot share walls or galleries with wing buildings or other forms. Conservative plan bounds still restrict close adjacent compositions.

The new residences reuse the renderer, materials and component geometry, but do not match all of Solana's bespoke interior and facade detailing. Original Solana rendering is preserved. Estate-scale Aerial still frames the generous property boundary; detail captures use a closer orbit to make the principal silhouette assessable.

The retained `sea-pavilion-walk` intersects its pavilion and remains an unresolved landscape draft in all three studies, as in the retained estate. Its authored configuration is preserved; the existing landscape acceptance projection omits that route from rendering. Neither complete circulation approval nor a construction-ready residence is claimed.

No blueprint/V3 pipeline changes, migrations, commits, deployment, extra agents or live OpenAI calls were made.
