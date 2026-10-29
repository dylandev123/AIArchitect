# Independently stacked principal residences

Implemented as optional `stack` data on the existing `footprint-building@1` form. These studies are plain configurations of one renderer. Terra does not select these study IDs or emit code.

## Limitation traced

- `wing-composition.ts` / `ComposedWing` repeat the same rectangular plan for one or two storeys; a front balcony inset is the only per-floor plan change. Shared-wall cuts and galleries belong to that wing system.
- `footprint.ts` / `FootprintBuilding` derive slabs, flat roofs and façade bays from a common sampled outline. `upper` supplies one inset second floor; `volumes` places every sibling at the same `base.height + .26` elevation. Neither legacy representation stacks three or four levels.
- Ground terraces are separate paving. Legacy footprint railings follow lower outlines, without a general parent relationship for higher masses.
- Terra already uses `compositionSchema` for generation and `compositionPatchSchema` / `executeCompositionPatch` for atomic form replacement. Extending `footprintSchema` makes the new capability available through both paths, saved configurations, site bounds and façade-work validation.

## Controls and verified bounds

Use a rectangular base `points` outline and `stack: []` for a single-storey composition. Add up to ten volumes, each with:

| Field | Meaning |
| --- | --- |
| `id` | Stable unique local ID; `base` is reserved |
| `parentId` | `base` or another volume ID; order independent |
| `x`, `z` | Absolute centres in the base's local coordinates, −40…40 m |
| `width`, `depth` | Independently controlled rectangular footprints, 5…40 m |
| `height` | Independent wall height, 3…6 m |
| `rooftop` | `none`, `railed`, `lounge`, `shaded` |

The base also accepts `rooftop`. Each parent roof establishes its child's floor elevation including the .26 m roof plate. Up to four occupied levels are supported. Branches can have different heights and level counts. Whole-form position, orientation, material, openings and base façade articulation remain existing controls.

Supported area must be at least 60% of the child plan; projection beyond each parent edge is limited to 2 m. Unrelated volumes whose vertical envelopes overlap require .65 m separated bounding boxes. Missing parents, cycles, intersecting shells, fifth storeys and mixed `stack`/legacy `upper`/legacy `volumes` are rejected. The existing combined 300 façade-bay budget and fixed/derived site checks include stack geometry and projections.

Every volume reuses the existing façade/plate builder. Roof slabs are partitioned around child floors to avoid duplicate coplanar surfaces; child floor plates support their projecting portions. Rails are clipped at upper walls crossing the perimeter. Exposed roof cells reserve 1 m around all higher-volume footprints before placing furniture and pergolas. Cells below 5.6 m in either direction remain unfurnished. At most three furniture groups and one 3 m pergola are derived per roof; groups stay within cells with perimeter clearance.

## Remaining boundaries

This extension uses aligned rectangles on a rectangular base, flat roofs, one supporting parent per upper volume and a common whole-form rotation. It does not merge intersecting solids, join pitched roofs, bridge two parents, generate holes, rotate individual levels or cut connecting doors through legacy wing walls. Sibling volumes communicate visually through exposed terraces; an interior circulation plan is not generated. No functional stairs, lifts or rooftop access are implemented. Projection/support rules are massing constraints, not structural engineering.

`upper`, `volumes`, existing wings/galleries, Solana and previously saved payloads retain their original paths. No version migration is required. Changing a stack uses the existing complete-form `put` operation; unrelated forms, estate grounds and detached components are preserved. No live AI call was used to test generation or edits.

## Four offline studies

Open `/dev/villa-playground?composition=<id>` and enable **House only**, or select a study in Development Tools.

| Study | Distinguishing massing | Screenshots |
| --- | --- | --- |
| `sky-mansion` | Four diminishing floors; 22 × 16 m roof with three furnished areas and pergola | [Aerial](sky-mansion-aerial.png), [front](sky-mansion-front.png), [rear](sky-mansion-rear.png) |
| `wing-estate` | Broad 40 × 28 m plinth, long unequal-height east/west wings, central hall and west crown | [Aerial](wing-estate-aerial.png), [front](wing-estate-front.png), [rear](wing-estate-rear.png) |
| `staggered-mansion` | Four laterally shifting floors, alternating setbacks and 2 m projections | [Aerial](staggered-mansion-aerial.png), [front](staggered-mansion-front.png), [rear](staggered-mansion-rear.png) |
| `tower-pavilion` | Narrow four-storey tower beside a low pavilion, with separate shaded rooftops | [Aerial](tower-pavilion-aerial.png), [front](tower-pavilion-front.png), [rear](tower-pavilion-rear.png) |

All four use ivory walls, the same glazing/timber materials, daylight and neutral ground. Images are actual Chrome WebGL screenshots. Aerial and opposite oblique views were visually inspected for every design. The estate is composed on a continuous ground-floor plinth; it does not imply a new ground-level shared-wall junction capability.

## Validation

- `npm run typecheck`: passed.
- `npx vitest run src/app/api/ai/villa src/lib/villa src/app/dev/villa-playground/villa-model.test.ts`: 204 tests passed in 22 files, including existing Solana/model, estate, façade, legacy footprint and API regressions.
- Six new focused tests cover one–four levels, parent elevations, schema/provider compatibility, missing/cyclic parents, support/projection limits, collision and fifth-level rejection, atomic edits preserving unrelated features, projected bounds, roof partition area and rail/furniture clearance.
- Browser capture traverses actual scene geometry for finite vertices and stack/roof/pergola counts. It captures all four designs and Solana from three perspectives. External and AI routes are blocked; successful runs require zero page errors and zero attempted blocked requests.
- Active-render timing moves the real camera and invalidates each frame. Results and mesh/memory counts are in `browser-checks.json`; approximately 16.7 ms median frame interval on this desktop Chrome run. This is a short desktop smoke check, not a mobile or long-session benchmark. Three.js render-frame counts include postprocessing passes; `lastPassDrawCalls` and `lastPassTriangles` describe only the final pass, not total scene work.

Evidence inputs: [configurations.json](configurations.json), [resolved geometry](geometry-checks.json), [browser checks](browser-checks.json). Reproduce with `npx vite-node --config vitest.config.mts scripts/stacked-volume-evidence.ts` and `node scripts/stacked-volume-capture.mjs` while the local dev server is running.

No live OpenAI calls, V3 changes, migrations, commits or deployment were performed.
