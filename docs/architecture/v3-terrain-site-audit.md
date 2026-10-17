# V3 Terrain / Elevation / Site-Integration Audit

Offline only. No Terra/OpenAI calls, no V2 changes, no engine changes.

Artifacts:
- Fixtures: `src/lib/v3/parity/terrain.ts` (flat, gentle 5%, hillside 25%, cliff + ocean, stepped terraces)
- Measurement probe: `src/lib/v3/__tests__/terrainSiteAudit.test.ts` (prints all figures quoted below)
- DEV viewer: `/dev/terrain-audit?fixture=…`, using the production PrimitiveMesh, lighting and PostFx
- Captures: `scripts/terrain-capture.mjs` → `docs/architecture/parity/terrain/*.jpg`

## Verdict

V3 can place a house on a **flat lot or a gentle slope** credibly. It **cannot** reliably build a house into a hillside or onto a cliff. The terrain is a single heightfield made of box-shaped modifiers. Pads are blended into it, but nothing grades the ground, drapes a road over it, retains a cut, or models a cliff or the sea. Each Y value in the scene is authored independently, and the compiler never reconciles them.

## 1. Vertical authority

The intended chain is:

```
site.baseElevation
 → terrain-region modifiers (slope/raise/lower, applied in authored order)
 → site levels (highest containing region wins, hard overwrite)
 → ground pads (masses and pools pull terrain to their base, 1.5-cell shoulder)
 → pool carve (terrain min'd to pool bottom)
mass.architecture.baseElevation (absolute, authored)
 → storey.elevation (relative to mass base)  ✅ coherent
 → room (via storey)                        ✅ coherent
```

The storey and room part of the chain is clean. Above it there are **five competing Y authorities**:

| Authority | Authored by | Conflict |
|---|---|---|
| terrain-region centre Y + rise | AI | `lowerRegion`/`cutIntoSlope` are *relative* to whatever lies below, so the result depends on order |
| `siteLevel.elevation` | AI | Overwrites terrain with a hard step (no feather) wherever the region is the highest |
| `mass.baseElevation` | AI | If it is more than 0.45 m from the level, the mass creates its **own** pad at its base, so the building moves the terrain |
| connection `route[i].y` | AI | Rendered verbatim and never compared with or graded into the terrain |
| landscape / terrace / pool Y | AI | Flat boxes at authored Y. Landscape zones do not follow the terrain |

## 2–8. Findings per question (measured)

| Fixture | Steepest mesh triangle | Site-edge lip | Max driveway bury / float | Unretained level steps ≥0.6 m | Errors |
|---|---|---|---|---|---|
| flat | 0.83 | 0 | 0 / 0 | 1 | pool support |
| gentle 5% | 1.06 | 2.7 m | 0.04 / 0.2 | 3 | pool support |
| hillside 25% | 5.1 | **13.5 m** | **4.5 m buried** | 7 | pool, cantilever, retaining-edge |
| cliff | 13.3 | **36 m** | 0.09 / 1.24 | 9 | pool, gardens |
| stepped | 3.6 | 9.9 m | 1.3 / 0.1 | 1 | pool, wall, garden |

**Building integration.** Flat pads and stepped masses work. An embedded mass works with `grounding: "embedded"`, because the mass is excluded from padding and the terrain passes through it. The cut around it is a smoothed shoulder pit with no retaining wall (hillside lower-wing: 3.4 m of terrain above its base inside a 1 m ring). Exposed lower floors downhill work. A **cantilever from a storey is not expressible**: `getSupportSurfaceY` always returns the host's *top*, so a deck cantilevered at the lower wing's upper floor fails `UNRESOLVED_SUPPORT`.

**Driveways.** The ribbon is drawn at `route[].y` and ignores the terrain. On the hillside the switchback drive is buried up to **4.5 m** and is almost invisible in the render. The only check is that `maxGrade` is enforced on authored Y. Switchbacks, cut and fill, cross-slope and the parking-pad terminus are AI-authored or absent. Rerouting a driveway changes **0%** of the terrain.

**Site grading.** Cut and fill are only an implicit side effect of pads, a 2.5–3.75 m smoothstep shoulder. There are no batter slopes, no area-balanced cut/fill, and no explicit pool-terrace or parking-court primitive. A level is a hard rectangular overwrite, so neighbouring levels leave vertical mesh cliffs (5.1 on the hillside, 1.5–2.5 m cells).

**Retaining walls.** They are authored objects only. `transition.type = "retaining-edge"` never generates geometry. `terrainLine` then sizes each 1.5 m segment from the local grade, which is real derivation, but:
- A retaining edge can only sit *between two levels*. The commonest case, a fill terrace over falling natural ground, gets `RETAINING_EDGE_NO_GRADE_DIFFERENCE` (hillside pool wall).
- Segments vary in height from 0.35 to 3 m along one wall (stepped `wall-2`), which looks jagged.
- The audit samples the grade on each side at half the wall's **length** (`siteHierarchy.ts:271`), not its thickness, so it measures 17 m away on a 34 m wall. That is a bug.
- 7–9 unretained steps of 0.6–5 m per steep fixture are not detected anywhere.

**Cliff site.** It has no representation. A cliff has to be faked with stacked `slopeRegion`s. Each modifier feathers back to `baseElevation` at its own edge, which creates a **25.8 m curvature spike at the cliff lip** and a **36 m wall at the site edge** where the sea-floor region returns to datum. There is no ocean primitive: the fixture uses a generic `water` box. Fences have no "edge of drop" semantic, and the guard rail is a plain authored fence. In the render the cliff reads as a green ridge, and the ocean is barely visible from the house side.

**Pools on slopes.** The shell is grounded and the terrain never cuts through the water (0 m above the rim in every fixture). However, every pool fails `UNRESOLVED_SUPPORT`: support derivation picks `terrain`, not the deck's level. The terrain is also pulled down to the pool *bottom* with a shoulder, so the ground falls 1.5 m right outside the rim, and a pool without a full deck sits in a pit. The downhill edge (infinity/vanishing edge, catch basin) is not modelled.

**Terrain continuity.** The flat lot is clean. Elsewhere there are site-edge lips (2.7 / 13.5 / 9.9 / 36 m), cliff-lip spikes, pits around pads, floating paths (up to 2.1 m on the cliff walks) and buried driveways. Modifier conflicts depend on order.

**Local edits** (hillside, share of terrain samples that change):

| Edit | Changed | Locality |
|---|---|---|
| Move house 4 m downhill with pads | 5% | ✅ local |
| Move masses only uphill | 1% | ⚠ masses create their own pads, levels stay behind, `UNRESOLVED_SUPPORT` |
| Enlarge pool terrace | 1% | ✅ local |
| Reroute driveway | **0%** | ❌ no re-grading |
| Raise pool-terrace level by 1 m | 2% | ⚠ deck stays at its old Y → `UNRESOLVED_SUPPORT:pool-deck` |

Locality is good because everything is local. The problem is that nothing *propagates* along the dependency chain level → deck → pool → wall.

## 11. Production renders

`docs/architecture/parity/terrain/{flat,hillside,cliff,stepped}-{aerial,downhill,side,arrival}.jpg`

- **Flat:** good grounding. Driveway and court are clean. Landscape zones render as flat pale slabs.
- **Hillside:** stepped masses read well. The cantilever deck reads well. The pool terrace on fill has a credible wall. **The driveway is invisible (buried).** There is an open cut pit around the arrival and upper pad with no walls.
- **Stepped:** the most convincing site. Wall-1 is a clean 3 m retaining wall. Wall-2 breaks into fragments.
- **Cliff:** not readable as a cliff. Region seams show as a sawtooth, the site-edge wall rises 36 m, and the ocean sits outside the house's view. The guard fence is credible only as a thin line.

## Answers

1. **Realistic elevation now?** Flat and gentle sites yes. Steep sites no.
2. **Hillsides fail on:** buried or floating drives, unretained cut pits, hard level steps, site-edge lips, pool and deck support errors, and no storey-level cantilevers.
3. **Cliffs fail on:** no cliff or coast primitive, modifier feathering spikes, no ocean, no drop-edge guard semantics.
4. **Built into mountains?** Partially. Embedded and stepped masses render, but the cut is a smoothed pit with no walls and no consistent grading.
5. **Driveways climb naturally?** No. The ribbon is independent of the terrain, and switchbacks are hand-authored.
6. **Multiple flat terraces?** Yes, when walls are authored (stepped fixture). The edges between them are not derived.
7. **Pools on steep sites?** The water is safe, but support always fails, there is a pit around the rim, and there is no downhill edge condition.
8. **Missing semantics:** access/road edge, view/downhill direction, natural-grade definition (slope/contour/cliff line), coast/ocean, level-to-natural-grade transitions, drop-edge guarding, a driveway route-intent preset (direct or switchback), and an arrival/parking pad role.
9. **AI authors:** site type and natural fall (direction + grade or a few control heights), road edge, view side, cliff line + sea level, building placement + finished-floor per mass, terrace list (role, rough region, relative level), and driveway intent (from road edge to arrival, preferred max grade). **V3 derives:** the heightfield, pad grading and batters, retaining walls from grade differences, the driveway alignment, profile and cut/fill, pool shell/deck support, guard-rail placement at drops, landscape draping, and all absolute Y values downstream of the levels.
10. **Foundational fixes** (in order):
    1. A **natural-grade model** (site-level slope/contour/cliff + sea level) that replaces stacked box modifiers. Modifiers must compose without feathering to datum.
    2. **One Y authority:** levels own terraces; mass, deck and pool Y derive from levels. Edits propagate along that chain.
    3. **Terrain-conforming connections:** grade the corridor to the route profile (cut/fill + batters) and derive the profile from the max grade.
    4. **Derived retaining edges** wherever level-to-level or level-to-natural steps exceed about 0.6 m, with a uniform per-run height. Fix the sampling bug at `siteHierarchy.ts:271`.
    5. **Pool support** resolves to its deck or level, and pool excavation stops shaping the terrain outside the shell.
11. **Ready for a live cliffside mansion test?** **No.** It would reproduce the edge lips, the unreadable cliff and the buried/floating access already measured here, and the live output would mostly diagnose known terrain gaps.
12. **Single next terrain milestone:** **"Graded Site v1": a derived natural-grade + level-grading pass.** AI authors natural grade (fall, cliff line, sea level), levels and route intent. V3 compiles one continuous heightfield in which levels cut and fill with batters or derived retaining walls, connections are graded into the terrain, and mass, deck and pool Y follow their level. Exit criteria use this audit's probe: site-edge lip 0, no unretained step ≥ 0.6 m, driveway bury/float ≤ 0.15 m, zero pool/deck support errors in all five fixtures, and a readable cliff + ocean render.
