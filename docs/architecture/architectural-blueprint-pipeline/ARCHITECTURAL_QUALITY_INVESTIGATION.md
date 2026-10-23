# Recovered second-live estate: architectural quality investigation

21 October 2026 · Offline investigation · Original response `b78f82e1b55e`

The recovered property looks basic principally because Terra authored a minimally developed architectural composition. V3 largely built that composition faithfully. The contract further limits landscape design, material articulation and amenity detail, while presentation makes the result look more schematic. There is no evidence that an extraordinary, fully specified mansion was reduced wholesale to two boxes during construction.

This is a judgment about this recovered response and the inspected pipeline, not proof that Terra cannot design better. Architectural quality is not measured by building count, complexity, primitive count or mandatory amenities. A restrained rectangular house can be exceptional when proportion, depth, material, landscape and spatial sequence are resolved together.

## Evidence and identity

- [Exact recovered response](../../../.v3-debug/second-live-b78f82e1b55e/original/provider-response.json): 20,523 bytes; SHA-256 `b78f82e1b55e0ce9e78b01e40f2a4b0ed8d4841ac3e86f1b6b96923887fb94bb`. The [capture](../../../.v3-debug/second-live-b78f82e1b55e/original/capture.json) dates to 21 October, 09:16:37 Saint Lucia. This is the second-live estate, not the different 20 October mansion.
- [Recovered V3 scene](../../../.v3-debug/second-live-b78f82e1b55e/final/recovered-scene.json), [production API scene](second-live-production-webgl-verified/api-mansion.json), and [production capture manifest](second-live-production-webgl-verified/capture.json).
- Visually inspected six existing production screenshots: [initial overview](second-live-production-webgl-verified/api-generated-mansion.jpg), [property plan](second-live-production-webgl-verified/property-plan.jpg), [west/pool/guest view](second-live-production-webgl-verified/ocean-facades-pool-and-guest.jpg), [arrival/roofs](second-live-production-webgl-verified/entrances-and-roofs.jpg), [explicit window refinement](second-live-production-webgl-verified/service-windows-refined.jpg), and [refined reload](second-live-production-webgl-verified/edited-draft-reloaded.jpg).
- Read the [blueprint authoring instructions](../../../src/lib/v3/architecturalBlueprintGeneration.ts), [schema and lowering](../../../src/lib/v3/architecturalBlueprint.ts), facade/roof/pool builders, material shading and vegetation presentation.

A fresh execution of the existing offline recovery script, with fetch forbidden, produced a scene **exactly equal** to the saved recovered scene. Original and normalized blueprints are semantically equal, with zero identity changes. Production architecture and the recovered scene are equal in every top-level field except metadata. Production metadata contains the replay brief and synthetic usage; those are not the original paid request or billing evidence. The original complete request/system-prompt snapshot and historical token usage are not retained in this capture. Prompt conclusions below concern the available source, not a byte-exact reconstruction of the historical request.

No production code, original evidence or project was changed. Replay output went to a separate temporary directory. This investigation adds only this report and its [offline evidence record](ARCHITECTURAL_QUALITY_EVIDENCE.json).

## 1. What Terra actually designed

The concept is a tropical-modern Saint Lucian villa with an independent guest pavilion, controlled eastern arrival and west/southwest leisure views. Prose promises deep shade, volcanic-stone landscape elements, dark metal details, expansive glazing and resort character. The $15 million figure is an authored target, not a verified construction valuation.

| Element | Actual architectural specification |
| --- | --- |
| Site | Flat 120 × 90 m, 10,800 m²; one east boundary access; grass ground. “Cliff-garden,” sea and Pitons occur in prose, without corresponding site/context geometry. |
| Main villa | One unarticulated 24 × 18 m rectangle at (-8, 0), no yaw; identical outer envelope through two storeys, 4.2 + 3.6 = 7.8 m high. Ivory stucco throughout the exterior. |
| Guest pavilion | One 12 × 8 m rectangle at (-28, -13), no yaw; one 3.5 m storey, volcanic-stone exterior. |
| Roofs | Main: terrace family, 0° pitch, 1.1 m overhang, 0.28 m plate. Guest: mono-pitch, 8°, 0.9 m overhang, 0.24 m thickness. Both dark metal. No roof groups, sculpted crowns or separate outdoor roof composition. |
| Spatial program | 20 room intents: main ground has living/dining/lounge, kitchen, pantry, laundry, gallery and estate office; upper has two bedrooms, bathrooms, dressing, study and hall; guest has sitting room, bedroom, bath, closet and entry. One U-shaped stair. |
| Facades | Nine opening declarations, expanded to 14 apertures across floors/rhythm members. Broad west glazing on both main floors; two south sliding glazed doors; north upper windows; east main door/service windows. Guest south door, west glazing and north windows. No authored facade assemblies. |
| Outdoor living | One 23 × 10 m, 0.18 m high south terrace, no railing; one 15 × 5 m pool, 1.4 m high, to its west. No separate outdoor rooms, shade structures or entertainment equipment. |
| Landscape | Two rectangular grass zones: 24 × 15 m north garden and 34 × 62 m east arrival lawn. No explicit species, planting composition, garden walls, lighting or landscape structures. |
| Arrival/access | 5.8 m vehicle drive, 1.8 m terrace walk and 1.5 m guest walk. Gate is an access point, not designed gatehouse geometry. |

The building footprints total 528 m², about 4.9% of the site; gross floor plates total approximately 960 m² before deductions. The terrace is 230 m² and pool 75 m². These are substantial dimensions. The principal weakness is how these spaces are composed and inhabited, rather than uniformly undersized buildings or amenities.

The blueprint explicitly calls both building forms rectangular. It specifies no wings, recesses, loggias, balconies, layered facade screens or changing storey profiles. Those elements were not lost in transit. Their absence matters here because the remaining walls, openings, roofs and exterior spaces do not establish an equally convincing restrained design.

## 2. What V3 actually built, element by element

| Element | Construction and visible result | Assessment |
| --- | --- | --- |
| Main mass and storeys | Same location, 24 × 18 m footprint and 7.8 m total height; floors and facade infill, rather than a single solid proxy. | Basic envelope is Terra's choice. No supported articulated footprint was flattened. |
| Guest mass | Same 12 × 8 × 3.5 m stone pavilion and placement. | Faithful subordinate volume; limited architectural development is already in the blueprint. |
| Main roof | Roof plate plus four parapets; dark metal finish and authored overhang. | Terrace-family policy adds a fixed 0.6 m parapet. Reads as a dominant lid in aerial views. No authored roof access or occupied rooftop terrace exists. |
| Guest roof | Actual shed roof with infill, surface, seams and trim. | An 8° roof looks nearly flat from some angles, but is not replaced by a flat box. |
| West glazing | Main glazing spans 82% of its 18 m facade on both storeys, with the specified 0.12 m reveal; guest glazing spans 68% of its 8 m west facade with 0.10 m reveal. | Broad glazing is represented. Frames and recesses exist; aerial scale and shading limit their visual effect. |
| South glazed doors | Actual floor-level glazing and frames/mullions; spans 5.76 and 6.0 m, height 3.25 m. | Significant indoor/outdoor openings survive. Door operation influences leaf division; operable mechanisms are not detailed. |
| Main arrival | Door and two service-window members collide under centered-rhythm construction; all three cuts are withheld and amber wall cells remain. A small entry canopy still builds, projecting 2.4 m. | Real local loss of arrival expression, caused by incompatible declarations. The after-edit screenshot restores entry/windows but leaves the property equally basic. |
| Terrace | Authored paving rectangle against the south wall, with the chosen open edges/no railing. | No missing furnished entertainment area: none was specified and the contract cannot author its equipment. |
| Pool | Hollow shell, water and coping on all four edges; normal rectangular pool construction. | “Infinity” is only a name/role. No infinity-edge direction, overflow trough or catch basin can be conveyed. |
| Landscape | Grass geometry plus deterministic, presentation-only tree/shrub scatter. | The visible trees were not authored individually by Terra. Their species/layout do not substantiate the tropical garden prose. |
| Routes | Supported arrival/terrace ribbons; guest walk retained as unresolved guide where its authored route crosses the villa. | Incomplete garden connection, rather than a designed promenade that construction accidentally erased. |
| Interior | All 20 room intents, 14 partition records and 10 door intents persist; several partitions/openings cannot construct from incompatible room boundaries. Stair treads/landing/guards exist. | Named luxury rooms do not produce furnished spaces or resolved private suites. This compounds incompleteness, but is not the principal exterior silhouette problem. |

Existing production evidence records 209 compiler primitives and 208 mounted mesh IDs before the window edit; water has separate group ownership. This supports presence of the specified components, not an architectural-quality certificate.

Two proportion/relationship failures are especially visible at property scale:

- Pool east edge is x=-20.5; terrace west edge is x=-18.5: **2 m between their authored envelopes**, approximately 1.75 m even allowing the pool coping's projection. Both share z=14, but they do not form continuous dry poolside living. There is no designed connecting deck.
- Pool base 0 plus height 1.4 places its rim datum at 1.4 m, water at 1.36 m, versus terrace top at 0.18 m. The rim datum is **1.22 m above the terrace**, with no designed steps/access. V3 follows named base/height semantics; it does not infer an excavated infinity pool from the label.

## 3. What richness was lost, and what never existed

**Specified and substantially retained:** main/guest hierarchy, mineral material contrast, taller entertaining floor, broad west glazing, south sliders, modest opening reveals, entry canopy, distinct low roof families, terrace and pool dimensions.

**Specified but locally unresolved:** the main entrance and two service windows, several private/service partitions and doors, and the guest garden route. These impair usability and arrival quality. They do not conceal a missing exceptional facade design.

**Described in prose without an executable design:** deep tropical shade beyond the modest overhang/canopy, volcanic-stone landscape elements, resort outdoor living, infinity-edge swimming, and cliff/sea/Piton context. Stone is assigned to the guest building, not landscape construction. Broad west glass sits under a 1.1 m overhang on a two-storey wall, without a designed lower-storey shade layer. The prose is more ambitious than the drawing data.

**Unbound palette declarations:** `charcoal-metal` and `clear-glass` are not referenced by any materialId-bearing building, roof, feature or connection. The entry copies the charcoal hex through its separate color field; this does not bind the charcoal PBR material. Facade frames/glass use builder policies (`#263036` trim; `#8fbdc9` glass), with further glass shading adjustments. The schema has no per-opening material reference. A list of eight materials is therefore not eight coordinated architectural finish applications.

**Presentation substitution:** the north zone's text selects the temperate fallback; the east zone's “buffer” selects the screening palette. Palette selection reads zone label/role/material ID, not estate concept/character. The screenshots show oaks/cypresses and shrub scatter rather than a designed Saint Lucian landscape. This is a concrete style-fidelity loss, not merely insufficient plant count. Even correct palms would not establish a composed garden by themselves.

## 4. Architectural intelligence and contract limits

The independent blueprint prompt protects creative freedom: no fixed style, building count, pool or amenity checklist. It exposes rectangles, articulated plans, connected line/arc outlines, multiple masses, several roof families and host-relative slab/post/beam/rail assemblies. The recovered response used only the simplest mass plans and none of those assemblies. Richer supported architecture was available.

However, the instructions mainly explain coordinate ownership, capability restrictions and validation. They ask for creativity/completeness but do not make Terra resolve and reconcile a whole-property architectural argument: how arrival, built form, facade depth, climate, materials and outdoor rooms produce the promised experience. There is no explicit final comparison of the luxury prose against the actual authored components. The separate general composition prompt contains stronger coherence/proportion language, but this blueprint route sends its own instructions plus JSON schema, not that entire general prompt.

Current post-authoring brief review blocks a finite set of missing named features or unsupported intents. It does not certify that “extraordinary,” “resort,” or a budget target has been translated into convincing architecture. Budget has no cost model. There is no local aesthetic revision stage. The only bounded follow-up addresses diagnosed stair/route defects; expanding this into extra paid creative calls is not the recommended first move.

There is also a communication defect: space footprints expose generic x/z/width/depth fields without explaining center semantics in the blueprint prompt/schema. The room coordinates often resemble a minimum-corner tiling, while construction interprets centers. That is a plausible explanation for repeated room conflicts, not proof of the model's intended convention. Clarifying this is small and useful, but it will not transform the exterior architecture by itself.

The principal expressive limits are:

- One primary wall material per building; assemblies inherit prescribed slab/post/beam/rail finishes. No authored facade material regions, bespoke frame sections, louver systems or detailed classical orders.
- Independent unstacked masses, one host-derived roof each; no fully authored variable storey envelopes or complex joined roof groups. Articulated operations offer some floor scope, but not general per-storey building profiles. Courtyards cannot be holes in a single outline.
- Five admitted site-feature types: terrace, courtyard, pool, landscape-zone and canopy. No explicit planting schedule/layout, outdoor furniture/equipment, garden lighting or landscape-wall system through this adapter.
- Pool shell/coping and courtyard construction have fixed policies. Pool depth is not a dedicated excavation/infinity-edge contract. Surface-level transitions are not authored steps/ramps.
- Materials offer color/PBR family values, without a full material-layer/texture-scale/detail specification; rooms are rectangular allocations, not complete interior design.

These limits affect modern, Mediterranean, tropical, classical and curved designs differently. Supported curved/irregular footprints remain legitimate. Elaborate historical detailing or unsupported roofs cannot honestly be promised merely by naming a style.

## 5. Bottleneck classification

| Class | Finding for this recovered estate | Weight |
| --- | --- | --- |
| **A — Terra chose an uninspiring design** | Two unarticulated blocks, no explicit facade assemblies, a single bare terrace, disconnected raised pool and grass rectangles. Richer supported composition tools are unused. Ambitious prose is not matched by designed relationships. | **Primary immediate cause.** This response underdevelops its own concept; not a general verdict on all future model output. |
| **B — Contract cannot express enough richness** | No structured tropical planting, infinity edge, facade finish zoning or custom assembly finishes; restricted site features and roof/mass relationships. | **Major systemic ceiling.** Particularly severe for complete-property landscape and material quality, but does not explain all unused existing capabilities. |
| **C — V3 cannot faithfully construct specified detail** | Entry/window conflict and unresolved interior/route intent remain incomplete; generic pool/frame/railing policies provide limited detail. | **Secondary/local.** Most unresolved cases originate in contradictory input. No evidence of a richly articulated authored mansion being flattened or stripped of assemblies. Fixed detail policies largely belong to B/C's shared boundary. |
| **D — Rendering/materials worsen good architecture** | Distant elevated framing emphasizes roof area; glass looks pale/opaque at that scale; pronounced repeating textures and stylized foliage create a model-like appearance. Climate-inappropriate scatter visibly weakens the concept. | **Meaningful amplifier.** PBR, recesses, roof seams, bevels, shadows and AO already exist. No evidence that missing lighting alone hides an extraordinary estate. Exact texture-load success is not established by the saved manifest. |

The screenshots after the local window correction are a useful existing control: fixing that real defect does not change the envelope, exterior-room relationships or landscape design. More validation repairs and primitive counts alone will not deliver the intended improvement.

## 6. Smallest high-impact development milestone

**Improve whole-property authoring with the current construction contract, and prove the visual ceiling offline before expanding it.** This is a focused authoring-and-evaluation milestone, not a new mansion generator or renderer rewrite.

1. Update the blueprint authoring instructions to make Terra reconcile its chosen concept with actual geometry, climate response, material assignments, arrival sequence and usable outdoor-space relationships before returning the same single blueprint. Explain centered room coordinates and pool base/rim semantics. Require truthful claims, rather than more objects, particular shapes or amenities. Keep all supported styles and restrained designs valid.
2. Add a local, advisory quality review that exposes concept claims lacking executable support and distinguishes deliberate simplicity from missing design decisions. It must not impose numeric aesthetic thresholds, a required composition or automatic design substitutions.
3. Establish a whole-property visual acceptance comparison using a separately authored offline copy of existing recovered data and existing supported capabilities. Review arrival, principal outdoor living and overall composition at comparable views, including human-height views. Demonstrate a coherent property improvement, not just a decorative part. Any such design copy remains separate from the recovered original and is not a production template. This investigation has not made that redesign.

This directly targets A using capabilities already present. If the offline reference still cannot achieve the intended result, the next bounded contract work should address the demonstrated obstruction—most plausibly structured planting intent/placement and explicit facade/assembly material bindings—rather than a broad collection of new primitives. A real infinity-edge system remains necessary before making that particular claim, but would not by itself transform the whole estate.

Prompt changes cannot improve this frozen blueprint without a new design decision. They also cannot be proven to improve future Terra authorship without later controlled provider evaluation. No such evaluation or spending is authorized or performed here.

## 7. What existing recovered blueprints can prove offline

**Proven in this investigation:** exact response identity; unchanged normalization; deterministic replay to the saved scene; equality of production and recovery architectural fields; quantitative scale/spacing; lack of assemblies and unbound materials; capability limitations in executable schema/builders; and visible appearance in the existing production captures. The replay remained Draft, with 209 primitives and zero provider calls.

**Possible without credits, as a later milestone:** compile separately edited copies; render identical camera/material controls; isolate camera, planting, glass and texture effects; compare footprint/facade/outdoor-space composition changes; use existing independent curved/classical/courtyard examples as capability controls. Such controls prove construction capability and visual effect, not Terra's probability of choosing a good design. Existing [independent blueprint examples](../../../src/lib/v3/parity/architecturalBlueprint.ts) are offline references, not generation templates.

**Not provable offline from these captures:** future natural-model quality or consistency, the exact historical full request, physical construction value, actual Saint Lucian site/views, or general architectural excellence from validation status. The recommended next step should preserve that distinction.
