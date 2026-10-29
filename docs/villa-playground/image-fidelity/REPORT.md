# First retained image response — offline fidelity audit

Result: a limited visible improvement in wall material and glazing subdivision. The reconstruction still does **not** faithfully reproduce the reference façade or patio. Valid geometry is not evidence of adequate resemblance. No new vision call was made.

## Inputs and preservation

Run: `7f6322d4-8b39-43fe-a10e-52a5e7b13686`. Compared the original concept, full retained response text, feature/evidence records, validated composition, and all four original baseline images. The original image, response, candidate, proof, reports and baseline captures were left in place and checked against [SHA-256 records](preserved-sha256.json); see [verification](preservation-check.json).

[Exact replay](exact-replay.json) is constructed from the retained response without an architectural edit. [Audited replay](audited-replay.json) then applies a separate [two-field local patch](local-patch.json). The patch does not alter the response, interpretation or exact replay. It is restricted to the exact first interpretation and rejects another interpretation. No free-text heuristic silently rewrites future responses.

## Attribution and result

| Mismatch | Evidence and cause | Action / remaining gap |
| --- | --- | --- |
| Dark articulated stone versus pale stucco | Retained prose says pale warm stucco **or** limestone; architecture chooses `warm-stone`. Validation preserves it; `Wall` correctly uses the stone finish. Interpretation-to-configuration conflict, not lost data or a broken material renderer. | Separately audited selection of existing `sand` render finish. Pale, uninterrupted walls are visibly closer. Exact material remains ambiguous; no claim of calibrated color matching. |
| Divided windows versus simple glazing | Retained prose says one large simple vertical blue opening; architecture selects property-wide `divided`. Renderer adds three panels and a horizontal bar per bay. | Existing `panoramic` selection reduces subdivisions. It still has a central mullion and green/transparent glass. This is partial improvement, not faithful single-pane blue glazing. |
| Wrong opening count, size and positions | No per-opening coordinates/count are retained. Wing schema has only property-wide glazing; `Facade` generates bays from width/3.5 for Tuscan style. A 23 m face gets seven bays, a 10 m face gets three. | Still 20 opening bays, including one generated door, instead of the one confidently identified near-end window plus uncertain other openings. Individual placement is unsupported by the wing contract. Footprint façade treatments exist elsewhere in Villa, but converting this hip-roof wing to a different form would change construction and cannot recover missing coordinates. Not attempted. |
| Unconfirmed entrance and shutters | Interpretation explicitly says entrance is hidden. `WingWall` nevertheless requests a ground-floor main-wing rear entrance. `Facade` also supplies shutters and sill caps for nonmodern styles. Neither is independently controlled by the existing wing configuration. | Remains builder behavior and schema restriction. No observed door position exists to substitute. Better interpretation alone cannot control these with the current wing contract. |
| Timber corners/edge trim | Visible in source and mentioned in prose, but retained feature explicitly discloses no separate trim control. | Remains unsupported by this wing configuration. No invented trim geometry added. |
| Patio beside short end rather than long-side paving | Exact retained patio is x=-14, z=1.5, 7×6 m. House spans x=±11.5 and z=±5. Patio spans x=-17.5…-10.5, z=-1.5…4.5: it is at the west short end and overlaps the footprint by 1 m. Translation and renderer preserve those values. Source visually has paving along the long side; retained prose itself alternates “west/left side” and “west end.” | No coordinate correction justified by the retained architecture. Terrace x/z/width/depth/timber now exposed through existing validated patches. Patio is deliberately unchanged in the fidelity replay. Needs a better orientation/relationship interpretation or explicit local placement measurements. |
| Grey patio paving and table/chairs | `timber:false` only chooses the builder's beige paving; it has no color/material or furniture field. | Still beige and unfurnished. Dedicated grey paving and patio furniture placement remain unsupported in this contract. |
| Roof pitch/ridge/eaves | Hip roof, 23×10 m massing and eave=1.4 reach construction unchanged. Builder expands plan to 25.8×12.8 m, fixes rise to 0.22×12.8=2.816 m and ridge length to 25.8−12.8=13 m. Interpretation lacks a measured pitch/ridge. | Preserved. Eave is now editable where present. Pitch, independent roof materials and ridge controls remain unavailable. No demonstrable roof translation error found. Source's receding long axis still differs from the estimated camera/orientation. |
| Pool and grounds | Pool x=10,z=13,12×5 m survives exactly. Generic pool furniture/planters, planting rows, paths and boundaries are builder additions, not interpreted placements. Trees/terrain/grid were explicitly unsupported. | Preserved; pool is not relocated. Single-image orientation/scale/camera and missing site placements require better interpretation; builder defaults also need separate controls to eliminate additions. |

No architectural dimensions, terrace coordinates or appearance selections were lost during validation or `buildComposition`. The reproducible problems are conflicting choices within the interpretation, missing detail, limits of the wing contract, and style-driven builder additions.

## Before/after evidence

The exact and corrected replays use the original 1600×1100 viewport, four existing view commands and retained estimated reference camera. Scene framing is unchanged between the new exact and corrected capture sets. The reference camera is an estimate, not calibrated photogrammetry. Original historical captures remain untouched.

| View | Original baseline | New exact response replay | Corrected replay |
| --- | --- | --- | --- |
| Aerial | [Before](../image-vision/7f6322d4-8b39-43fe-a10e-52a5e7b13686/reconstruction-aerial.png) | [Exact](exact/reconstruction-aerial.png) | [After](after/reconstruction-aerial.png) |
| Arrival | [Before](../image-vision/7f6322d4-8b39-43fe-a10e-52a5e7b13686/reconstruction-arrival.png) | [Exact](exact/reconstruction-arrival.png) | [After](after/reconstruction-arrival.png) |
| Poolside | [Before](../image-vision/7f6322d4-8b39-43fe-a10e-52a5e7b13686/reconstruction-poolside.png) | [Exact](exact/reconstruction-poolside.png) | [After](after/reconstruction-poolside.png) |
| Reference | [Before](../image-vision/7f6322d4-8b39-43fe-a10e-52a5e7b13686/reconstruction-reference.png) | [Exact](exact/reconstruction-reference.png) | [After](after/reconstruction-reference.png) |

Measured changes: wall finish class stone → render; glazing panels per bay 3 → 2; added horizontal division bars 20 → 0; mesh count 431 → 391. Opening bay count and positions, roof geometry, patio alignment and pool alignment have zero change. These measures substantiate a limited material/subdivision improvement, **not** an overall fidelity score. Roof and patio were not improved. Near-end opening mismatch remains conspicuous in Arrival/Poolside/Reference; the aerial view shows the unchanged patio layout.

## Controls and verification

Customize now exposes existing composition glazing, terrace position/dimensions/timber, and explicit wing eaves, alongside the existing exterior palette. All submit through `executeCompositionPatch`; there is no new schema, migration, V3 change or alternative builder. The UI explicitly states that individual wing windows/trim are unavailable.

42 focused tests passed (image fidelity, vision retention, composition). TypeScript and focused ESLint passed. Exact and corrected WebGL runs each captured all four views with finite geometry, no page errors, and zero attempted AI/external requests: [exact checks](exact/browser-checks.json), [after checks](after/browser-checks.json). No agents, API calls, commits or deployment.

Offline reconstruction: `./node_modules/.bin/vite-node --config vitest.config.mts scripts/image-fidelity-replay.ts`.

Exact page: `/dev/villa-playground/image-first?run=7f6322d4-8b39-43fe-a10e-52a5e7b13686`.
Audited local correction: append `&fidelity=audited`. The default exact replay remains available unchanged.
