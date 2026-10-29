# Terra distinct-house live evaluation — 28 October 2026

**Verdict: compositional distinction demonstrated; sophisticated convincing $25m houses not demonstrated.** Both first-pass results are executable and editable, but architectural finish, circulation and spatial coordination remain materially below the original Playground studies. Both remain separate and unapproved. No generated geometry was repaired for this evaluation.

## Controlled method and preflight

The existing working tree was preserved. No commits, migrations, deployment, image generation, model visual reviews, retries or revision calls occurred. Exactly two OpenAI Responses Generate calls used the existing key and configured `gpt-5.6-terra` model. A completed and passed `resolveSceneResult` before B was submitted. Each was an independent empty-scene request; neither received the other result, a developer study or a supplied composition template.

The live harness invokes the same homepage `generationSceneRequest`, `architecturalRequestContext`, response schema, provider settings, 30,000 output-token cap and `resolveSceneResult` executor as `/api/ai/scene`. It uses an instrumented transport to preserve raw HTTP bodies and enforce one transport call per brief. It does not submit through the HTTP route or write usage database rows; retained local usage is authoritative for this evaluation. Knowledge was retrieved before calls using the normal builder against the existing database, with SELECT-only access and schema initialization bypassed for the existing table. There were 12 selected records per brief; complete retrieval traces and actual instructions are retained in each `context.json`. Sandbox DNS initially blocked preflight; authorized network execution completed it before any provider call.

Homepage source inspection confirms `page.tsx` creates a persisted direct-scene project, `WorkspaceShell` selects `OperationStudio`, and the studio uses the shared request builder. The direct-scene executor has no subsequent legacy house reconciliation. The 142 focused offline tests across 23 files passed, including actual homepage handler/provider-context regressions, assemblies, parent transformations, stable IDs, targeted edits, history and persistence. TypeScript passed before calls and after harness work. No actual integration gap was found and no product/engine source changes were necessary.

## 1. Model-facing construction capabilities

The system contains the renderer/design guide and a reference mechanically derived from executable Zod schemas. It exposes add, replace, remove, move, rotate, resize, finish, attach, place-on and set-terrain operations. Generate filters terrain changes and uses flat staging. Elements include plates, walls with one rectangular opening, separate or integrated glazing, doors, screens, solid volumes for posts/beams/detail, flat/gable/hip roofs, balcony railings, sofas, rectangular water and the approved version-pinned curved pavilion. Arbitrary yaw, elevations and recursive parent transforms permit manually composed wings and storeys. Maximum 400 elements and 800 operations are safety limits, not quality targets.

`residentialWingOperations` is **developer-only**. Terra cannot call it, execute loops or send a wing-assembly operation. It receives enough parameters and semantics to express equivalent assemblies explicitly. No hidden executor expands a wing. Parent transforms carry children; resize needs explicit dependent repairs. Parameterized roof/pavilion rendering is available, while stair flights, pool basins, corridors and room connections require explicit construction. The pavilion shell/furniture are not individually editable; it is editable as one component. Arbitrary arches/CSG, custom curved roofs, other pitched forms and automatic stair/room layout are unavailable.

Stable IDs survive generation/JSON roundtrip and browser selection/edit/history/reload. This does not prove that Terra automatically maintains semantic wing groups: in these outputs it did not create floor-root wing hierarchies.

## 2. Actual operations and capability use

Both responses used **only `add`**. A constructed 60 elements; B constructed 57. Counts describe the retained transactions and are not aesthetic scores. Neither used `place-on`, rotated wing composition, coordinated multi-part parent assemblies or an explicit detailed room/route model. A has one parent attachment (entry door to wall); B has nine door-to-wall attachments. Most geometry is world-positioned.

A uses five flat roofs, a supported upper floor/terrace with three glass guards, opened waterfront facade bays, a timber screen, separate canopy posts, eight explicit stair plates, rectangular pool bottom/walls/coping/water, and a curved pavilion. B uses four independently sized hip roofs and one flat entry canopy, opened walls and nine fitted doors, court/entry posts, two screens, courtyard and terrace plates, loose seating and the same curved pavilion component. Integrated wall glass is rendered inside its wall component, rather than carrying an independently selectable glazing ID.

There is real advanced feature use, especially independent pitched roofs and upper-level construction, but much of the available assembly/detail capability remains unused. The model's knowledge-decision prose sometimes cites incomplete element sets: missing required-kind findings are evidence-link failures, not automatically proof that the corresponding kind is absent from the whole scene.

## 3–5. Actual architecture

| Aspect | A — Luminous Reef Estate | B — Casa della Corte Ombrosa |
|---|---|---|
| Composition | Asymmetric main hall/guest wing, offset upper suite, waterfront loggia, pool and detached pavilion | Four low residential wings enclosing a central court; axial entry and rear garden pavilion |
| Roofs | Layered flat planes with timber canopies and an elevated suite roof | Four intersecting hip roofs with modest height variation, plus a flat canopy |
| Brief resemblance | Recognizably contemporary tropical, but sparse and underdeveloped for a remarkable estate | Recognizable courtyard/pitched-roof intent; Mediterranean character weakened by plain walls, broad brown roof planes and minimal stone/arcade detail |
| Visual strengths | Upper/lower hierarchy, glazed waterside elevation, sheltered loggia, independent garden destination | Genuine central void, inward orientation, consistent warm material palette and sheltering eaves |
| Visual weaknesses | Almost blank arrival and side walls, minimal entrance hierarchy, sparse furnishing, little facade depth/detail, buried invisible water | Roof-dominated squat massing, blank arrival, weak wing hierarchy; posts only suggest an arcade, with no arches or rich covered gallery |
| Shared weakness | Both reuse the identical modern elliptical pavilion, limiting stylistic originality. Neither has developed grounds, site identity or estate-level residential programming. | Same |

These are substantially different topologies and roof systems, not material variants of one layout. Nevertheless B reads as a simple inward-looking roof ring and A as a modest stacked house. Neither reads as the exceptional $25m estate requested.

### Confirmed/likely functional problems in A

- The eight stair treads rise roughly 0.4 m between adjacent walking surfaces. They are not a realistic residential flight. The solid main roof and upper floor remain uncut over the run; measured clearance drops from 1.6 m at tread 4 to zero at tread 8. There is no usable ascent through these slabs.
- The upper waterfront wall has raised-sill glazing rather than a terrace door. The upper terrace's floor adjacency does not establish accessible circulation.
- `living-west-wall` is a continuous unopened wall along the guest wing interface; guest north/south walls and bedroom divider are also unbroken. The guest rooms are not furnished with actual access routes. Only one entrance element exists in the entire design.
- The upper floor extends beyond the main hall east edge. The existing relationship validator accepts a geometric contact path; it does not establish engineered cantilever capacity.
- The loggia floor overlaps the living floor. The loggia ends at Z=11.5 while the near pool coping begins at Z=12.3, leaving a 0.8 m break in the intended continuous raised dry route.
- Pool water is centred at Y=-0.45, with its top below the Y=0 staging ground. The renderer does not excavate automatically, so the captures show lawn through the intended pool. There is also a 0.175 m plan gap between water edge and inner basin-wall face. The pool needs coordinated construction/site treatment; its walls and bottom alone do not resolve the visible result.
- The curved pavilion overlaps the approach/deck region and the declared setback is not supported by the spatial audit. It is a reusable component, not evidence that Terra designed bespoke curved architecture.

### Confirmed/likely functional problems in B

- Four pairs of wing floor plates overlap at corners. Perimeter walls also intersect there; those junctions need explicit room/connection planning rather than summed floor area.
- Each side wing has one courtyard door and a divider at its centre. The divider meets the court door's centreline, creating an awkward ambiguous room junction rather than a resolved private-suite corridor. Bathrooms, closets, kitchen equipment and complete service arrangements are absent.
- Roof footprints are already larger than their wings (e.g. west roof width 7.6 m over a 6 m wing), then use an additional overhang parameter. This produces broad overlapping roof masses and consumes much of the claimed 10 × 8 m open court in roof projection. The roof ring visibly dominates the house.
- Court posts have no separately constructed connected gallery roof/beam system; they cannot substantiate the richly developed arcade programme. No true arches are supported, and the model disclosed that limitation.
- Nine fitted door components provide more credible passage intent than A, but a renderable door panel is not a navigability or complete room-programme certification.
- There is no pool in B. Its fourth matched camera is the same positive-Z poolside view used for A, looking toward B's garden. B's brief did not mandate a pool.

`audit.json` in each folder preserves all automatic findings. Both have zero hard `sceneRelationshipIssues`, while the architectural audits remain incomplete. This clearly demonstrates the distinction between geometric acceptance and usable architectural design. Some warnings are conservative knowledge-evidence or intent-completeness findings; the concrete problems above were checked against coordinates and renders.

## Editability and captures

Eight canvas images capture identical arrival, aerial, entrance and poolside camera positions/targets/FOV for both houses. `browser-result.json` records all rendered IDs, finite geometry, zero page errors and the matched cameras. All API/external requests were blocked during inspection. A local roof-finish edit, Undo, Redo and reload passed in the actual workspace for each house. Those ephemeral browser edits did not change the retained originals. The isolated browser storage reused a workspace shell; designs on disk remain distinct.

`offline-inspection.json` additionally verifies exact ID preservation, JSON roundtrip, a local door-finish change leaving every unrelated element unchanged, and a parent-wall move preserving the door's local attachment. Whole-wing coordinated editing is supported by the engine's preflight tests, but these model outputs lack wing parent groups, so moving a floor alone would not carry its walls and roofs. A model-authored localized edit was not evaluated because additional calls were forbidden.

Images: [A arrival](A-arrival.png), [A aerial](A-aerial.png), [A entrance](A-entrance.png), [A poolside](A-poolside.png); [B arrival](B-arrival.png), [B aerial](B-aerial.png), [B entrance](B-entrance.png), [B poolside](B-poolside.png).

## 6. Actual tokens and estimated cost

| Brief | Input | Cache read | Cache write | Output including reasoning | Reasoning subset | Total | Configured-price estimate USD |
|---|---:|---:|---:|---:|---:|---:|---:|
| A | 9,412 | 0 | 9,409 | 7,264 | 1,498 | 16,676 | $0.105992 |
| B | 9,543 | 0 | 9,540 | 7,692 | 2,040 | 17,235 | $0.111390 |
| Combined | 18,955 | 0 | 18,949 | 14,956 | 3,538 | 33,911 | **$0.217382** |

Provider usage is actual, retained in `provider-response.raw.json` and SDK `result.json`. Reasoning is already included in output and must not be counted twice. Cost uses this application's existing configured rates: $2/M input, $0.20/M cached input and $12/M output. This is a local estimate, not a verified invoice or independently verified current provider tariff. The pricing implementation does not price cache-write surcharges separately; actual billing may differ. No cost claim is inferred from the architectural $25m brief.

## 7. Comparison and conclusion

Compared visually with the original Solana overview (`../code-driven/original-solana-overview.png`), both new outputs lack the original's layered entrance, facade depth, glazing/solid balance, differentiated volumes, visible pool, terrace development and coordinated detail. Landscaping and furnishings give Solana an advantage, but even accounting for those differences the architectural gap is substantial. Earlier retained Terra technical-review output (`../../villa-playground/redesign-technical-review/terra-poolside.png`) already had an upper volume, pitched-looking flat timber canopies, screens and a visibly rendered pool. A is not clearly more sophisticated; B proves different composition rather than superior detail. These historical images were not generated under the matched cameras, so this is a qualitative comparison, not a controlled improvement score.

**Terra can independently choose and construct two distinct architectural concepts using the unified engine and retrieved knowledge. It has not yet demonstrated convincing, sophisticated, highly coordinated luxury houses approaching the original Playground studies.** The principal observed bottleneck is choosing and coordinating the available geometry and circulation, not lack of access to the developer wing helper. The explicit success criterion is therefore only partially met.

Reproducibility: `scripts/distinct-houses-evaluation.ts` contains briefs and durable no-retry guards; it refuses rerunning recorded attempts. `scripts/distinct-houses-inspect.ts` performs offline inspection. `ARCHITECTURE_PREVIEW_URL=http://localhost:3000 node scripts/distinct-houses-capture.mjs` renders retained scenes with API access blocked. Capture requires the existing machine-local Playwright and Chrome installation. Raw instructions/knowledge, wire requests, raw responses, provider request IDs, outputs and unapproved scenes are preserved separately under A/ and B/.
