# Main-house creativity: implementation and browser evidence

Implemented offline, 26 October 2026. No live OpenAI calls, agents, migrations, commits, deployment, V3 edits or landscape expansion. Existing uncommitted work was preserved.

## 1. Why the recent live houses resemble each other

Read the actual retained responses, not only the previous example screenshots. [Extracted house configurations](retained-house-audit.json) preserve exact source IDs and component requests. The response files do **not** retain the original user prompt or budget, so the $30m/$25m attribution cannot be independently established from these files. The comparison is identified precisely as Horizon versus the latest accepted Tide generation.

| Actual response | Main residence Terra selected | Repeated hierarchy |
| --- | --- | --- |
| Horizon `1b1a4c3a3770…` | `horizon-residence`, broad curved/faceted outline about 61 × 35m in control bounds, height 4.5m; one six-point inset upper outline about 35 × 14m, height 3.8m | Ivory, panoramic glazing, orientation 0°, flat outline-following roof, broad low base, compact centered crown; no section-specific façade treatments |
| Tide accepted `3d0c67b331dc…`, assembled `d814528a67dd…` | `ocean-crown-residence`, ten-point angular/faceted base 44 × 21m, height 4.2m; eight-point inset upper outline 27 × 9m, height 3.6m | Same material, glazing, orientation and two-band hierarchy. Ground-floor solid/entrance/loggia sections and upper screen/glass sections improve façades but do not change that hierarchy |

The latest accepted Tide house is angular, **not actually a curved oval**. The earlier rejected Tide response `c3d8a6633bb4…` did choose a curved crescent base with an inset crown. Its failure should not be confused with the accepted configuration. [Horizon browser replay](retained-horizon.png) and [accepted Tide browser replay](retained-tide.png) show actual retained buildings with grounds hidden.

Terra chose these outlines, dimensions, heights and treatments. The renderer did not replace different authored buildings with an oval: it extrudes the exact sampled outlines. However, the construction contract strongly constrained Terra: one lower outline, one upper outline, mandatory 0.65m inset everywhere, no projecting upper edge, no multiple upper volumes, no independent roof heights within that upper floor. Uniform default glazing further encouraged repetitive façades. The wing builder could already make a Mediterranean courtyard and mixed heights, but footprint forms could not join wings or other forms, and pitched wings need separate roof envelopes and straight galleries.

Automatic creation had a separate structural bias: the only new geometry grammar was a freestanding four-post swept ribbon. Tide's actual request was `arrival-tide-canopy`, described as a missing dramatic entrance canopy. It successfully added that object but could not use creation to invent enclosed residence architecture. This was a builder capability gap as well as a prioritization problem; prompt encouragement alone could not fix it.

## 2. Smallest construction changes

Extended `footprint-building@1` with optional `volumes:[{points,height,facades?}]`, mutually exclusive with legacy `upper`. One to four independent upper volumes use the **same existing** outline, slab, roof, façade, furnishing and material components. Local coordinates allow offset, staggered, splayed and curved/angular plans. Each volume height is independently 3–6m; all stand on the lower roof at lower height + 0.26m. No new geometry engine, builder registry entry, template dispatcher or generation pipeline was added.

Bounded upper projections are now possible: every sampled upper boundary point must be inside or within 2m of the lower outline; at least 60% of each upper boundary must be inside. This is a geometric massing constraint, **not an engineering assessment**. Upper bounding envelopes must stay 0.65m apart to prevent intersecting shells. Existing simple-outline, wall-clearance, perimeter, area and combined 300 façade-bay limits still apply. Property bounds now include upper projections, so fixed-site and surrounding-object checks cannot overlook an overhang.

Legacy `upper` retains its inset validation and glass-railed roof terrace unchanged. New `volumes` deliberately do not place a continuous railing across projecting/intersecting wall locations; shaded outdoor rooms use existing recessed loggia/colonnade sections. Open lower roof areas are massing surfaces, not fully resolved accessible roof terraces. The study houses use independent façade sections for stone arrival walls, screens, glazing and deep shade. The Mediterranean house uses existing pitched roofs, arcades, shutters, balconies and galleries without construction changes.

A reversible **House only** button removes grounds and decorative components and frames architecture against a neutral plane. Normal estate rendering remains available by toggling it off. Existing Solana, retained responses and previous example IDs are preserved.

## 3. Three real houses, comparable presentation

All use ivory walls with warm stone/timber details, the same daylight, environment, exposure and camera offset (48,24,62) relative to the architecture target. Mediterranean roofs retain terracotta because roof type is part of the architectural difference. No gardens, drives, pools, beds or canopies are present in these studies. Images are actual Chrome WebGL screenshots, not generated illustrations.

| Study | Actual composition | Browser screenshot |
| --- | --- | --- |
| `dramatic-layered` | Folded base, tall screened offset west volume (5.8m), low splayed east volume (3.2m), recessed shaded living edges; 112 façade bays | [Layered modern](dramatic-layered.png) |
| `flowing-contemporary` | Continuous asymmetric curved salon, curved rear sky wing, deep shaded concave frontage; 232 façade bays | [Flowing contemporary](flowing-contemporary.png) |
| `grand-multiwing` | Tall central palazzo, low west arcade wing, two-storey east wing, separate hip roofs and gallery-connected open court | [Grand Mediterranean](grand-multiwing.png) |

Visual review: the modern study reads as unequal staggered volumes with different roof heights; the curved study has a flowing concave silhouette; the Mediterranean house forms a large open court with a visibly different roofscape. The curved example intentionally retains a smaller crown, but that arrangement is no longer imposed on every modern house. Fine glazing/furnishing repetition remains visible; these are bounded exterior studies, not bespoke Solana-level detailing.

These are editable offline proof configurations, not three complete templates Terra must select. [Configurations](configurations.json) can be opened through `/dev/villa-playground?composition=<study-id>`, or selected in Development Tools. No study IDs appear in the provider configuration contract.

## 4. Terra integration and verification

Terra's existing Zod provider schema inherits `volumes` directly from the shared footprint schema. Existing `forms:put` replaces an individual complete form, preserving stable IDs and unrelated property fields; no separate editing system was introduced. Prompt instructions explain multiple volumes, offsets, independent heights, mixed curves/angles, projections and façade selection. They prioritize the principal residence before estate amenities and discourage decorative canopy creation unless explicitly requested. The automatic-creation instructions carry the same priority, so they do not countermand the architectural prompt.

- 195 tests passed across 20 Villa/wing/model/API files, including provider schema/resolver/renderer assembly, finite geometry, upper-height edits, atomic invalid edits, projection bounds, overlapping upper-volume rejection and legacy retained configurations.
- Typecheck and targeted ESLint passed; `git diff --check` passed.
- [Browser checks](browser-checks.json): finite real scene meshes, no page errors and no AI/nonlocal requests. Captures include all three studies, both retained live estates and [unchanged Villa Solana](solana.png).
- Reproduce: `npx vite-node --config vitest.config.mts scripts/residence-composition-evidence.ts` and `node scripts/residence-composition-capture.mjs` with the local dev server on port 3000.

No fresh Terra generation was run: the new options are proven through its schema, resolver and editing executor, not claimed as demonstrated live model behavior.

## 5. What remains impossible

No third floor, stacked arbitrary levels, different ground-floor roof elevations within a single footprint, overlapping upper volumes, multilevel/diagonal galleries, shared walls between footprint forms and wing buildings, or pitched roofs on curved footprint forms. Upper projections exceed neither 2m nor the support-boundary limit. Conservative bounding envelopes still reject some physically feasible arrangements. No holes/courtyard voids inside a single footprint polygon, arbitrary roof surfaces, structural calculations, professional interiors, stair/access design or automatic safe roof-terrace detailing. Façade treatments vary by source edge; per-volume roof materials and arbitrary façade topology remain unsupported.
