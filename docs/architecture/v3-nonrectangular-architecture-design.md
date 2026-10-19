# V3 Non-Rectangular Architecture: Freedom Audit and Design

Status: milestone 1 is implemented locally; see [v1 implementation and acceptance report](v3-nonrectangular-architecture-v1.md). The audit below records the pre-implementation restrictions; outline/arc and advanced pitched-roof milestones remain design only.

## 1. Architectural freedom audit

| Layer | Restriction | Kind | Evidence | Verdict |
| --- | --- | --- | --- | --- |
| Prompt | `V3_CREATIVE_ARCHITECTURE_PROMPT` tells Terra that polygonal, circular and curved buildings are unsupported. It asks Terra to preserve them as commitments, never as proxies. | Prompt (honest capability statement) | `estatePlan.ts:108` | Keep. It describes the real compiler capability. Removing it would invite boxes labelled "rotunda". |
| Prompt | Facade openings are addressed only by `facade: north/east/south/west` with 0..1 fractions. | Prompt and schema | `composition.ts:11`, `V3_COMPOSITION_PROMPT` | This is the root restriction on non-rectangular facades. It needs edge identities (§3). |
| Schema | `V3ArchitecturalGeometry` is `{x,z,baseElevation,width,depth,height,rotationY}`. There is no boundary field. | Semantic schema | `architecture.ts:10` | Root restriction on footprints. |
| Schema | `geometryKind` accepts `cylinder` and `extrusion` on any object. | Semantic schema | `schema.ts:34` | Terra can say "cylinder", but nothing honours it on a building. |
| Compiler | `building-mass` always dispatches to `compileBuildingMass`, which builds box slabs, box walls and four slab-edge bands. `geometryKind` is ignored. | Unsupported geometry plus silent fallback | `capabilities.ts:110`, `scene.ts:197-209` | A cylindrical building silently becomes a box. |
| Compiler | `compileV3Composition` hard-codes four rectangular `WallEdge`s. | Unsupported geometry | `composition.ts:170-175` | The shared `buildMassOpenings` already accepts arbitrary tagged edges. Only V3 restricts it to four. |
| Generic | `compileGenericGeometry("cylinder")` produces a 12-segment side mesh with no caps, floors, openings or roof. | Proxy only | `scene.ts:178-187` | Not a building. Do not reuse it as one. |
| Junctions | Joined masses need upright, relatively orthogonal yaw. Skew junctions are retained but not solved. | Unsupported geometry, diagnosed | `junctions.ts:91-124` | Correct and honest. Keep. |
| Review | Hierarchy and symmetry checks skip non-orthogonal masses. | Analysis limit | `designReview.ts:43,112,149` | Harmless. It skips analysis and never rewrites anything. |
| Repair | `safeRevision` protects all mass geometry, forms, roofs and materials. Only diagnosed routes, access openings and circulation may change. Unsupported forms never spend the repair attempt. | Repair | `safeRevision.ts`, `designReview.ts:reviewV3Architecture` | Repair does not simplify creative design. No change needed. |
| Diagnostics | Without an `estatePlan`, a building mass with `geometryKind: "cylinder"` or a name like "rotunda" got no finding. | Silent fallback | Previously there was no check | **Fixed this session:** advisory `UNSUPPORTED_ARCHITECTURAL_INTENT` (`designReview.ts`). It is advisory only, so it triggers no repair and changes no geometry. |

No other obsolete restriction was found that blocks valid architecture V3 can already build. Rotated masses, joined L/U compositions, dispersed estates and towers (tall rectangular masses, stacked masses) are already free. The real limits are the box footprint, the four-facade opening address and roof families that assume a rectangle.

## 2. Reusable existing geometry (verified)

The shared library under `src/lib/architecture/geometry/` already constructs non-rectangular rectilinear and chamfered buildings for V2. V3 already imports from it, so reusing it needs no V2 change.

- `footprint.ts:buildFloorFootprint(width, depth, operations, floor)` turns `notch | recess | projection | entry-recess | chamfer` operations into a clockwise `polygon`, tagged `WallEdge`s (facade, open, chamfer, entryRecess), slab `rects` and chamfer `wedges`.
- `footprint.ts:offsetFootprintOutline` grows the outline for roof overhangs. `pointInPolygon` and `decomposeToRectangles` are also available.
- `openings.ts:buildMassOpenings(taggedEdges, …)` already places openings on arbitrary tagged edges. `buildGlazedWallEdge`, `buildEntryRecessDoor`, `buildColonnadePosts` and `buildPlainWallEdge` build untagged and special edges.
- `roofPlate.ts:buildPolygonRoofPlate` builds a flat or floating-flat roof that follows any outline. `buildPolygonShedRoof` builds a mono-pitch roof over a polygon.
- `pitchedRoof.ts`: gable, hip and butterfly roofs need a rectangle. They use `hullPolygon`.
- `architecture/compiler.ts:260-330` is the working V2 reference for slabs from `rects + wedges` per floor and roofs from the grown polygon.

## 3. Proposed system

### Semantic representation

Add one optional field to a `building-mass`, `composition.footprint`, which is a single discriminated union:

```ts
footprint?:
  | { kind: "articulated"; operations: MassGeometryOperation[] }        // milestone 1: reuses the V2 vocabulary
  | { kind: "outline"; edges: Array<{ id: string; to: [x, z]; bulge?: number }> } // milestone 2: polygon + arcs
```

- The bounding `width × depth × height` stays authoritative for placement, selection, support, collision broad-phase and persistence. The footprint is inscribed in that box, so existing transforms, edit operations and support graphs keep working.
- Outline edges carry stable ids such as `entry-arc` or `e3`. `bulge` (tan of ¼ of the arc angle, as in DXF) expresses a circular arc. A circle is two half-circle arcs, and an ellipse or oval is a scaled arc pair. Arcs are sampled deterministically at compile time, for example every ≤ 1.5 m of chord, and samples are never persisted.
- Openings gain an optional `edge` in place of `facade`. On an articulated footprint, `facade` keeps its V2 meaning: a fraction of the original facade, with operations carving it. On an outline, `edge: "<id>"` with `start/end` fractions along that edge's arc length.
- No absent `footprint` means today's rectangle. That branch is byte-identical and needs no migration.

### Compiler integration

There is one integration point: `compileBuildingMass` in `scene.ts`, plus `compileV3Composition` for openings.

1. Resolve per-floor footprint. An articulated footprint goes through `buildFloorFootprint`. An outline is sampled into a polygon with `WallEdge`s whose `facade` is set to the nearest compass normal for facade-role heuristics, and which carry `edgeId` and arc-length parameters.
2. Slabs: rectangles stay boxes. Otherwise, `rects + wedges` for articulated footprints (the V2 recipe) and `extrudeOutline(polygon)` triMesh for outlines.
3. Walls and openings: pass the resolved edges to the existing `buildMassOpenings`, instead of the four hard-coded edges. Each sampled arc segment is a planar wall panel. An opening on an arc is split across the panels it spans, with frames per panel. That gives a faceted curved facade with true openings, built from the existing band builder.
4. Semantic ids: keep `${mass}:${opening}:level-n…` exactly. Panel parts append `-seg-k`. `semanticCompositionChildId` needs one more suffix rule for this, like the existing mullion rule. Selection and edit targets then stay the authored opening.

### Roof compatibility

| Roof family | Rectangle | Articulated (rectilinear/chamfer) | Outline (polygon/arc) |
| --- | --- | --- | --- |
| flat / floating-flat / terrace | yes | `buildPolygonRoofPlate` on the grown outline | same |
| mono-pitch | yes | `buildPolygonShedRoof` | same |
| gable / hip / butterfly | yes | Pitched over `hullPolygon` only when hull equals polygon. Otherwise `ROOF_FOOTPRINT_UNSUPPORTED`, with a flat-plate preview | same diagnostic |
| conical / domed | no | no | Later milestone: a cone or dome over a circular outline. Already named in `UNSUPPORTED_ROOF_NAME` (`dome`). |

A pitched roof never silently becomes a different family. Following the existing unsupported-roof rule, the intent is preserved and reported.

### Joined and stacked masses

- **Stacking:** `circulation.ts:footprintInside`, `stacking.ts` and rooftop terraces must test containment against the host's polygon, not only its box. Use `pointInPolygon` on the transformed corners. Until then, a non-rectangular host with circulation reports `CIRCULATION_OUTSIDE_HOST` conservatively.
- **Junctions:** `junctions.ts` keeps its rectangle-only solver. A non-rectangular mass in contact gets `JUNCTION_SKEW_UNSUPPORTED`-style retention, so walls are kept and nothing is erased. An L or U built from a single articulated footprint needs no junction at all, which is the main practical win of milestone 1.
- **Estate and completeness:** obstacle tests (`estateSpatial`, `completeness`) keep the bounding box. That overestimates the solid area, which is conservative: no route can be certified through a notch. Door contact (`estateSpatial.endpointFits`) must use the resolved edge, not `±w/2`.

### Validation and editing

- Validation (`validation.ts`) checks the footprint for a simple non-self-intersecting polygon, inscription within `width × depth`, minimum edge length, arc bulge in (-1, 1) and opening edge ids that resolve. A malformed footprint is dropped with a `FOOTPRINT_INVALID` advisory and the mass falls back to its rectangle. That is the existing "optional intent is diagnosed, never fatal" contract.
- Edits: `operations.ts` treats `composition.footprint` as one patchable field. Resizing the mass scales outline vertices proportionally. `safeRevision` adds `composition.footprint` to its protected set, so repair can never simplify a curved building into a box.
- Persistence: the footprint is plain JSON on the object, and derived samples are never stored. Existing scenes have no field and compile unchanged.

### Backward compatibility

The rectangle path is untouched. Every saved scene, parity fixture and mansion snapshot compiles identically when `footprint` is absent, which is a test requirement. V2 is consumed read-only, and the terrain code is not involved.

## 4. Smallest safe first milestone

**Articulated V3 footprints (rectilinear plus chamfer), flat and mono-pitch roofs.**

1. Schema and prompt: `composition.footprint: {kind:"articulated", operations}`, reusing the existing V2 operation schema subset (notch, recess, projection, entry-recess, chamfer; no balcony).
2. `compileBuildingMass`: per floor `buildFloorFootprint`, slabs from rects and wedges, walls and openings via the existing `buildMassOpenings(edges)`, and a flat or shed roof via `buildPolygonRoofPlate` / `buildPolygonShedRoof`. Gable and hip roofs only when hull equals polygon, otherwise diagnosed.
3. Containment: polygon test in circulation and rooftop-terrace containment.
4. Tests: rectangle scenes byte-identical; an L-shaped single mass, a U-court mass, an octagon-like chamfered tower (four chamfers), openings on a notched facade, persistence round-trip, and a safe-revision guard.

This delivers single-mass L/U plans, recessed entries, colonnades and angled prows without a new engine. It almost entirely reuses code already proven in V2. Circular and curved outlines (milestone 2) then extend the same edge pipeline with sampled arcs and `edge`-addressed openings. Conical and domed roofs and non-orthogonal junctions are milestone 3.
