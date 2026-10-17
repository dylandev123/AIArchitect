# V3 Graded Site v1

Offline only. No Terra/OpenAI calls, no V2 changes. Follows `v3-terrain-site-audit.md`, using its five fixtures and probe as the acceptance test.

- Engine: `src/lib/v3/grading.ts` (new), wired through `elevation.ts` (sampler, grid), `scene.ts` (compile), `derivedSupport.ts` (terrace dependants), `siteHierarchy.ts` (audit)
- Acceptance probe: `src/lib/v3/__tests__/terrainSiteAudit.test.ts` (hard assertions + locality tests)
- Renders: `docs/architecture/parity/terrain/{fixture}-{aerial,downhill,side,arrival,coast}.jpg`; the previous captures are in `parity/terrain/before/`

## Height authority

```
site.naturalGround (fall, grade | profile, ridge, cliff)   continuous to the site edges
 + legacy terrain-region modifiers (no feathering on sides that reach the site edge)
 → connection corridors   driveway/path profile derived from endpoints + ground, cut/fill
 → pads                   pad/terrace/slab levels own their elevation; batter < 0.6 m, derived wall ≥ 0.6 m
 → pool excavation        inside the shell only
 → decks on a level       base = level elevation (derived, not persisted)
 → pools in a deck/level  rim = deck top (embedded), dependants resting on them follow
 → masses                 authored base (never rewritten). A mass on a graded level no longer makes its own pad
site.sea                  independent water plane, never shapes terrain
```

Terrain-type levels (for example the road strip) no longer overwrite the ground. Their elevation is informational.

## Mechanisms

- **Natural ground.** A planar fall (`fall` + `grade`), or a monotone smooth `profile` of control heights along the fall axis. A cross-fall `ridge`/valley term and an explicit `cliff` (`at`, `drop`, `run`) complete the model. One analytic function covers the whole site, so there is no box stacking and no edge lip.
- **Pads.** A pad is flat at its elevation. At each edge, sampled every 1 m: a step under 0.6 m is battered (smoothstep, run 2.5× the step). A step of 0.6 m or more becomes a derived retaining wall that follows the actual break. Open edges (`level.openEdges`) are battered instead. When an authored retaining wall stands parallel within 5 m outside an edge, the pad flat extends to it, because that wall is the designer's grade break.
- **Mesh.** The uniform lattice gains paired feature lines (±2 cm) on aligned pad edges and pool shells. Grade breaks are therefore near-vertical, and the terrain never enters a pool shell.
- **Driveways/paths.** Stations every 1 m along the authored X/Z route. Stations on a pad, or whose shoulder reaches an endpoint pad, are pinned to that pad's elevation (a level landing). Free runs follow the smoothed ground with a linear correction to their pinned ends, then a max-grade clamp (driveway default 15 %). The corridor core (half-width plus one diagonal mesh cell) is level crosswise; overlapping cores blend. Shoulder steps under 0.6 m are battered; larger cut/fill becomes corridor retaining walls, including arcs around hairpin caps. The ribbon is draped on the final mesh. A route that would jump between two adjacent pads keeps its authored profile and is reported as "level step needs a stair". So do `stair`/`ramp` connections and `profile: "authored"` (an explicitly elevated route).
- **Retaining walls.** Each wall is compiled as a tri-mesh with a per-sample coping height. Ids are stable (`v3-retaining-{level|connection}-{side}-{n}`), and walls are never persisted.
- **Sampling bug fixed.** The audit's `RETAINING_WALL_NO_GRADE_DIFFERENCE` now samples across the wall's thickness, one mesh cell beyond each face, on the graded surface before pool excavation. Previously it sampled half the wall's *length* away. A `retaining-edge` transition between equal-height levels is valid when its wall, or a derived wall, actually retains grade. Self-transitions are always invalid.
- **Supports.** A pool inside a deck on a level is `embedded-in` that deck, so its support errors are gone. A deck `cantilevered-from` a mass is valid on any storey datum of that mass. Retaining walls bear on terrain deterministically.
- **Cliff + sea.** The natural cliff renders as a rock face: the same heightfield, with triangles steeper than about 50 % whose *natural* ground is steep split into `v3-terrain-rock`. `site.sea` renders `v3-ocean-water` from the first shoreline downhill to beyond the site edge.
- **AI contract.** Flat optional site fields (`naturalFall`, `naturalGrade`, `cliffAt`, `cliffDrop`, `seaLevel`) normalize to `naturalGround`/`sea`. A prompt sentence asks for high-level intent, not stacked terrain regions. Levels take an optional `openEdges`, and connections an optional `profile`.

## Before → after (probe figures)

| Fixture | Edge lip* | Edge jump† | Unretained steps‡ | Driveway float/bury | Drive grade / max cut | Derived walls (max h) | Errors |
|---|---|---|---|---|---|---|---|
| flat | 0 → 0 | 0 | 1 → 0 | 0/0 → 0/0 | 0 / 0 | 0 | pool → none |
| gentle 5 % | 2.7 → 0.37 | 0 | 3 → 0 | 0.2/0.04 → 0.01/0.01 | 7 % / 0.26 | 1 (0.68) | pool → none |
| hillside 25 % | 13.5 → 5.3 | 0 | 7 → 0 | 0/**4.5** → 0.06/0.10 | 15 % / 5.4 | 36 (6.6) | pool, cantilever, retaining-edge → none |
| cliff | 36 → 0.55 | 0.04 | 10 → 0 | 1.24/0.09 → 0.01/0.01 | 11 % / 0.73 | 24 (1.0) | pool, 2 gardens → 2 gardens |
| stepped | 9.9 → 1.5 | 0 | 1 → 0 | 0.1/1.3 → 0.03/0.04 | 15 % / 1.5 | 18 (2.4) | pool, wall, garden → garden |

\* The old metric (edge vs 6 m inside). It includes the natural slope itself, so a 25 % site reads 1.5 m with no lip at all.
† New: change in the last metre at the boundary beyond the natural trend. Graded corridors that reach the boundary are excluded.
‡ Before: the audit's level-edge check. After: mesh cells rising ≥ 0.6 m steeper than 45° that are not a natural cliff, a pool shell, or within one mesh cell of a wall. (The old level-edge check still reports one 5 % gentle edge, which is the natural slope over its 4.2 m sample.)

Locality (hillside, analytic graded surface):
- Raise the pool terrace +1 m: the deck and pool move exactly 1 m; masses, gardens and the arrival court are unchanged; terrain changes only in x ±20, z 6..30.
- Move the masses: 0 % terrain change.
- Reroute the driveway: only the north corridor band changes, and the new route stays within 0.15 m.
- Widen the pool terrace: landscape zones are unchanged and the change stays local.

## Known limits

- The remaining errors are authored landscape-zone Y values on sloped ground (gardens/vineyard). Landscaping was deliberately not moved.
- Paths between adjacent pads at different heights keep their authored profile. A stair compiler is not part of v1.
- Hillside: the arrival pad is authored about 4 m into the hill, so the last switchback leg runs in a 4–6 m retained cut. The fixture's hairpin was given a short turning leg, because the original legs were 6 m apart for a 5 m drive and could not be graded.
- Diagonal fill walls can still show small mesh "teeth" at their foot. Rotated pads have no feature lines, so their breaks are one mesh cell wide.
- No erosion, sculpting, civil road optimisation, bridges or infinity-edge hydraulics.
