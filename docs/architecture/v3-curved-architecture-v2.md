# V3 Curved Architecture v2

Implemented and verified offline on 2026-10-18. V3 now constructs circular, mixed straight/curved and irregular buildings from editable semantic paths. No Terra/OpenAI calls, commits, pushes or deployment were performed. Existing working-tree changes were preserved. Shared V2 construction sources and terrain were not changed by this work.

## Authoring contract

`composition.footprint` retains the existing `articulated` operations unchanged. Its new form is:

```json
{
  "kind": "outline",
  "operations": [],
  "segments": [
    { "id": "rotunda", "type": "arc", "center": [0, 0], "radius": 8, "startAngle": 0, "sweep": 360 }
  ]
}
```

A line uses `{id,type:"line",start:[x,z],end:[x,z]}`. An arc uses `{id,type:"arc",center:[x,z],radius,startAngle,sweep}`. Coordinates are metres in the host's local plan frame; zero degrees points east, positive sweeps turn toward south. Connected segments form one clockwise, simple closed outline. Negative arc sweeps support concave sections. Irregular polygons use only lines. A circle requires one semantic arc, not a decorative cylinder attached to a box.

Openings and assembly slab/post/beam parts reference a stable `segmentId`. Their `start`, `end` and `at` parameters are fractions along that segment's length. The existing `facade` field remains as compass/design intent; it does not override physical segment placement. Railings reference their assembly slab. Main-entry canopies inherit the door's segment. Missing addresses produce diagnostics rather than relocation to the envelope.

The provider schema and architectural capabilities text describe these choices without selecting a template or injecting randomness. Rotundas, curved wings, sweeping glazing, towers, sculptural residences and classical/castle-inspired compositions are optional design possibilities. Conventional architecture remains valid.

## Construction

- Closed polygon slabs are triangulated from the resolved path, including concave plans; no bounding-box slab is substituted.
- Shared opening and facade-assembly builders construct components in straightened segment coordinates. V3 bends their walls, cutouts, glass, frames, doors, slabs, posts, beams and rails onto the authored line or arc. Adjacent wall endpoints use mitered thickness joins.
- Arc sampling uses at most 2 degrees and 0.35 metres per interval, with a 4096-sample total limit. Sampling is derived geometry; persistent scenes contain only segment parameters and semantic references. Child identities do not include arc tessellation indices.
- Flat, terrace and floating-flat plates follow the sampled outline and a general polygon offset. Floating-roof bearings are spaced by segment length rather than tessellation density. The existing mono-pitch builder also constructs a sloped plate and wall infill over curved outlines.
- Materials, semantic ownership, object yaw/placement and the existing V3 editing/persistence path are retained. Circulation containment uses the actual outline; the mixed fixture includes a working stair and a real upper-slab opening. Access auditing uses small tangent probes along segment-addressed doors and balconies instead of their compass bounding box.

## Offline acceptance

The fixtures are authored examples for testing, not generation templates. `/dev/curved` is development-only and uses production `compileV3Scene`, `PrimitiveMesh`, edge finishing, lighting/environment, shadows and `PostFx`.

| Fixture | Production overview | Section | Plan |
| --- | --- | --- | --- |
| Circular architectural pavilion | [Overview](parity/curved/circular-pavilion-overview.jpg) | [Section](parity/curved/circular-pavilion-section.jpg) | [Plan](parity/curved/circular-pavilion-plan.jpg) |
| Residence with sweeping curved glazing and shade canopy | [Overview](parity/curved/sweeping-residence-overview.jpg) | [Section](parity/curved/sweeping-residence-section.jpg) | [Plan](parity/curved/sweeping-residence-plan.jpg) |
| Two-storey mixed straight/curved mansion, irregular wing and stair | [Overview](parity/curved/mixed-mansion-overview.jpg) | [Section](parity/curved/mixed-mansion-section.jpg) | [Plan](parity/curved/mixed-mansion-plan.jpg) |

There are 13 captured views, including facade views and an [edited pavilion](parity/curved/circular-pavilion-edited.jpg). The capture script blocks provider requests. [Capture results](parity/curved/capture.json) show no browser errors and no footprint diagnostics in any fixture. Overview and section views were visually inspected: shells, slabs, roofs and glazing follow the curves; the mixed composition retains its concave wing cut. No unintended intersections were observed in those views.

Geometry tests verify circle radius/area, roof overhang radius, rays through actual wall openings and their glazing, empty envelope corners, concave footprint exclusion, unique IDs, local semantic editing, JSON and project-store reload, provider ingestion, malformed-outline rejection, unsupported roofs, hosted mono-pitch ownership, stair/slab clearance, curved rail radius and floating bearing count. These checks cover the acceptance fixtures and targeted edge cases; they are not an exhaustive collision proof for arbitrary future designs.

Validation results:

- Full Vitest run: **163 files passed, 1904 tests passed, 3 skipped**. The skips are existing optional/live integration cases.
- Final curved test run after the floating-bearing refinement: **12 tests passed**.
- Focused compatibility/persistence/completeness run: **68 tests passed**.
- TypeScript `--noEmit`, targeted ESLint and `git diff --check`: passed.
- Nine pre-footprint saved scene compilations remain byte-identical against their existing SHA-256 baseline; all 19 existing articulated-footprint tests pass. V2 and existing estate, landscaping, material, circulation and persistence regression tests also pass in the full suite.

## Remaining restrictions

- One closed boundary per mass; no holes, splines, ellipses, self-intersections, zero-width cusps or per-storey outline variants. Radius must be at least 0.5 m. The outline must fit its authored placement envelope and accommodate the 0.2 m wall thickness. Excessive sampling is rejected.
- Components cannot extend past their named segment or fold through an arc's centre. Such components are omitted with `FOOTPRINT_COMPONENT_UNSUPPORTED`; invalid outlines build no substitute geometry and fail validation, including provider ingestion.
- Gable, hip, butterfly, dome/cone and other unsupported curved roof combinations remain unbuilt with diagnostics. Mono-pitch is the available sloping construction, not a dome or vaulted roof. Overhangs that create invalid offset outlines are rejected.
- Terrace support here is an outline-following roof plate; guards, access and other terrace amenities still need explicit valid intent. Curved door leaves are fixed geometry, not an operable curved-door hardware simulation.
- General Boolean junctions between curved masses remain unsupported by the existing connected-mass compiler. Use valid non-overlapping compositions; no automatic wall removal or roof union is certified for curved mass intersections. Existing rectangular room partitions and broader estate relationship envelopes are preserved rather than converted into arbitrary curved interior planning.
- Editing is through semantic composition parameters and existing operations/persistence; this change does not add a graphical arc-handle editor.

A further live mansion generation is justified as a **focused next evaluation of Terra's use of the new contract**, after explicit authorization for provider calls. The offline evidence establishes construction and compatibility, but does not establish the quality of a new generated design. No live generation was performed here.
