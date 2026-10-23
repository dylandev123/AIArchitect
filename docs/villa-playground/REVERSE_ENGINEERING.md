# Villa Solana: source audit and smallest reusable system

Source: `src/app/dev/villa-playground/{architecture,grounds,scene,tropical-palm}.tsx`.
The rendered benchmark is `TropicalVilla`, not `public/models/villa-playground/villa.glb` (a historical candidate).

## Assembly and coordinates

Coordinates are metres, Y up, positive Z toward pool. Every box uses its centre and full size. Solana is directly authored JSX, without a blueprint, mesh generator, CSG, or AI geometry.

- Salon: 14.4 × 11.8 m plinth centred (-7.4, .24, -.5), glazing at Z=3.2 and -5.5, west stone blade at X=-14.25.
- Upper suite: 13.5 × 9.9 m slab centred (-7.6, 4.75, -1.1); front glazing Z=2.2, balcony glass Z=3.72; roof at Y=8.53. This gives a real balcony setback, layered edges and a slight cantilever.
- Entrance: 4.6 m wide, 8.8 m tall portal around X=2.2. Thin rear wall and four blade piers surround the atrium. A 2.65 × 4.1 m timber pivot door, sidelights, transom, canopy, stair and pendants supply scale and depth.
- Dining: 9.4 × 13.5 m plinth at (9.2, .24, -.1), glazing Z=4.55/-6.55 and X=13.65. A low roof at Y=4.63, raised belvedere and slatted pergola create a different height and silhouette from the suite.
- Garden stair: 24 individually placed treads rise .18 m and advance .36 m each. Interior atrium stair: 22 treads rise .194 m and advance .31 m.

## Construction details

Walls are thin finished boxes around actual unfilled openings. Glass is not overlaid onto solid walls. `Glazing` is a thin transparent reflective box, edge rails and repeated mullions; `side` rotates it 90 degrees. Balcony mode reduces opacity and uses slender cap rails and clamps. Standard shadow maps cannot transmit glass, so these meshes do not cast opaque shadows.

`Roof` layers a .22–.30 m finished slab, slightly inset teak soffit and inset top finish. Generous overhangs make shadow lines. Balconies are extended floor slabs with glazing set back and separate edge guards. Terraces are separate paving pieces, leaving a true pool opening. The entrance is individually coordinated masonry, glazing, joinery and canopy, not a solid tower.

`FinishBox` delegates to existing `PrimitiveMesh`, with metre-scaled PBR textures, .018 m bevel and roughness .82. Stone and paving currently map to the concrete finish, so their labels alone do not provide distinct masonry texture. `Box` supplies inexpensive furniture/metal/joinery and optional emissive strips. `Slats` uses an InstancedMesh with translated matrices; it is a reusable screen/pergola technique, not hundreds of scene objects.

## Grounds and rendering

Pool: basin at (-2,-.2,12.4), 17 × 6.2 m. Animated `WaterSurface` at Y=.17, separate coping, shallow shelf, submerged steps, spill wall and narrow lower water channel. Terrace strips surround rather than cover it. Loungers, parasols and raised planters give foreground scale. Roof planters are currently fixed to the Solana floors and must not be reused at those elevations for another house.

Palms have curved feathered fronds (`TropicalPalm`), shrubs use existing `Vegetation`. Positions and variants are deterministic. Low distant palms, clustered borders and restrained foliage tint frame the building. The lawn is a large PBR slab.

The existing Canvas uses soft shadows, Neutral tone mapping, capped device pixel ratio, a 39-degree camera, animated OrbitControls presets, procedural Sky and SceneEnvironment, SunLight, ambient/hemisphere/fill lights, fog and PostFx (AO/antialiasing). Golden hour changes light, sky and environment together. Sofas, tables, bed, pendants and joinery remain visible through glazing, avoiding empty black windows.

## What is reusable / what is fixed

Reuse unchanged: Box, FinishBox, Glazing, Slats, Sofa, roof slab assembly, planter, pool furniture, palm, water, scenery, lighting, camera and postprocessing. Expose existing local components rather than replacing them. Preserve `TropicalVilla` and default grounds as the exact benchmark.

Hardcoded: all room extents, floor heights, glazing positions, stair endpoints, portal dimensions, bed/dining arrangements, roof levels, balcony footprints, garden beds, paving and pool. Moving a suite box alone does not move its windows or planters. These cannot honestly be offered as independent editable building parameters without coordinating their derived parts.

## Smallest useful extension

One bounded local configuration selects style, compatible composition, scale, wing proportion, one/two levels, finish, roof, glazing, veranda/terrace depth, landscape and pool. One local layout function derives connected bays. A bay derives floor, pierced facade, side/rear openings, furniture and roof from its own dimensions. Reusable porch/loggia, real semicircular arch spandrel, gable/hip roof and balcony/stair families provide meaningful style distinctions. This is a presentation configuration in the development playground, not an additional authority for V3 geometry.

Quality comes from coordinated negative space, thickness, shadow depth, asymmetric height hierarchy, occupied interiors, restrained warm/cool finishes and a composed foreground. A catalogue of coloured solid boxes would lose those qualities.
