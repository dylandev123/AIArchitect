# Architectural intent → constructed architecture (2026-11-03)

Offline only. No paid model call, no new mansion generation, no commit/push/deploy, no database change. Every house below is a **developer-authored fixture** that tests software expressiveness; none is Terra output and nothing here shows Terra has become more creative (that needs a real-model test).

## 1. Why the thesis disappeared
`architectural-plan-1` carried the building's identity only as prose (`thesis`, `masses[].role`). Everything software could act on was room-level: one rectangle per space, one roof entry per space, one wall per room boundary, openings only as individually hand-placed portals. Nothing structured said "this is the primary volume", "these five rooms sit under one roof" or "this wall has a rhythm of bays", so nothing could be built from, or checked against, those ideas. Compilation therefore produced exactly what the room list implied: boxes, a flat slab per room (23 on the retained estate), bare walls, a door.

## 2. Terra's decisions vs compiler limits
| Failure in the retained estate | Origin |
|---|---|
| Repeated uniform bedroom module, nearly equal heights, generic symmetric block | **Terra's design**: the vocabulary already allowed varied rooms and heights. |
| Blank façades, one dark door | **Mostly Terra's omissions** (window portals existed), made likelier by **contract**: hand-placing every bay by alignment was the only way to compose a wall. |
| 23 flat roofs | **Contract limit.** The renderer already builds one gable/hip/flat roof over any rectangle (`buildSceneRoof` takes width × depth); the canonical contract and compiler only allowed a roof inside one room cell. The capability existed and was not exposed. |
| Thesis not checkable | **Contract limit**: no structured composition to verify. |
Genuinely unsupported (still): see §7.

## 3. Building-scale decisions now explicit (`composition`, optional, in `architectural-plan-1`)
- **volumes**: major forms, each owning whole wings (every wing must belong to exactly one), a **tier** (primary/secondary/subordinate), optionally one **roof**, and a **material** default (a room's own `facadeMaterial` still wins).
- **heightStep**: minimum built height difference between tiers (default 0.6 m).
- **roofSpans**: one roof (flat/gable/hip, rise, overhang, material) over several rooms.
- **facades**: n evenly spaced window or door bays on one room wall (software owns offsets and piers).
- **entrance**: the arrival door and the roofed porch that receives it.

## 4. How they drive geometry (`composition.ts`, small edits to `plan.ts`, `compiler.ts`)
Expansion happens inside the existing derive step; there is no second engine.
- A roof span becomes one ordinary roof entry on a lead room; the compiler emits **one** roof element over the members' combined footprint (`roofSpan` on `Space`); non-lead members emit none. The existing roof/eave/fascia/penetration checks run on it unchanged.
- Facade bays become ordinary portals, built by the existing wall/opening code.
- Volume material becomes the default room material.
- **Verification (reject, never repair):** members tile one rectangle; one envelope height; nothing stacked above; no room in both `roofs` and a span; each wing in one volume; built tops respect tier order by ≥ `heightStep`; a volume's claimed roof covers exactly that volume with no stray roof; the roof was built with the declared form and covers its members; entrance door → roofed porch that is the arrival space and clears the door. A declaration the construction cannot honour rejects the plan with an explicit message.
- `CANONICAL_INSTRUCTIONS` has a COMPOSITION FIRST paragraph (inserted before the frozen construction paragraphs, which stay verbatim as `mission.test.ts` requires). The wire schema gains one additive property (`providerCompatibility.test.ts` revert helper extended, as for earlier additive fields).
- Plans without `composition` compile byte-identically (all retained saved scenes recompile identically).

## 5. Implemented and tested
New: `composition.ts`, `compositionFirst.fixture.ts` (two fixtures), `composition.test.ts` (29 tests), dev page `src/app/dev/canonical-composition/`, `scripts/canonical-composition-{build.ts,capture.mjs}`. Edited: `plan.ts`, `compiler.ts`, `providerCompatibility.test.ts`.
Tests cover: strict parse, determinism, JSON round-trip, provenance for every element, access, physical evidence, rotation; one roof element per span sized to the combined footprint; tier ordering built and measured; façade bays evenly spaced and present in built walls; material default/override; 12 rejection cases (non-tiling span, mixed heights, stacked rooms, double roof, bare room beside a one-roof claim, inverted hierarchy, unassigned wing, unroofed porch, porch lower than door, bays that do not fit, door bays without outdoor target, bays on a shared wall); editability (resize roof span); **save → reload → Undo → Redo** through the real project store, with the stored plan recompiling to the stored geometry.
Full suite: **3733 passed, 3 skipped, 0 failed**; `tsc` clean for `src/`; ESLint clean on touched code. (12 pre-existing type errors in untracked `scripts/` are unchanged.)

## 6. What the browser shows (16 captures, `browser-result.json`)
Rendered element IDs, positions and yaw match the compiled scenes for every view; 0 page errors, no context loss, `/api` blocked. Same rooms, with and without composition:

| Fixture | Roof elements | Walls with openings | Result |
|---|---:|---:|---|
| hillcrest (2 storeys, 12 rooms) — baseline | 9 | 8 | White boxes, flat seamed slabs, tiny door (reproduces the original failure) |
| hillcrest — composed | 4 | 23 | Two-storey stone block under a bronze hip crown, timber bar under one gable, lower garden pavilion, three-bay rhythm on both storeys, tall door under a porch canopy |
| pavilion-court — baseline | 9 | 8 | Flat slabs, blank walls |
| pavilion-court — composed | 4 | 17 | Tall hip pavilion, detached long gable bar across a court, bays, sheltered entrance |

Files: `{hillcrest,pavilion-court}-{composed,roomwise}-{arrival,aerial,garden,poolside}.png`.
Visible weaknesses in the composed images: garden door bays render as dark opaque slabs (no glazed-door mode), the lawn reads as a teal rectangle (existing), no planting, and the result is still a clean massing study, not a finished premium house.

## 7. Still unsupported
Roofs over non-rectangular unions (L/U), spans of mixed height, or over rooms with an upper storey partly above; valleys/junctions between pitched roofs (overlapping roofs with overhang still reject, e.g. a gable bar with overhang beside a lower flat roof); a pitched roof's ridge direction is renderer-chosen, not declared; glazed doors, curtain walls, recesses/projections as façade depth (only via room placement), columns, guards, planting, grading; façade bays only evenly spaced and uniform; tiers measure wall/envelope tops, not roof ridges. Browser Undo/Redo was verified at the project-store level, not by clicking the studio UI. Model compliance with the new fields is untested: the instructions are written but never exercised against Terra.

## 8. Can canonical now express a sophisticated composition?
Physically, yes within the bounds in §7: a multilevel house with a hierarchy of volumes, single multi-room roofs of different forms, composed façade bays and a sheltered entrance now compiles to editable geometry and is verified against its declaration, which the old contract could not do. Whether Terra will *use* it to design well, and whether the output looks premium rather than competent, is unproven and needs a deliberately approved live test.
