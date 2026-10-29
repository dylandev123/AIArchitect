# Flat sites and retained main-house audit

Source: `.data/scene-responses/0e79fe9c-8e2e-4b6c-a11e-22b1dd146ae2.json`, accepted Caribbean Threshold House response, 42 elements. The source was read only. Original and corrected scene JSON are separate offline artifacts, not changes to saved user projects.

## Terrain diagnosis

The retained output explicitly requests elevation 4m, grade 18%, and a 10m cliff drop. Architecture is authored independently: arrival plinth bottom 5m, arrival court bottom 7.75m, main terrace bottom 7.925m, lower decks bottom 5.75m. The terrain operation creates natural ground, not foundations, cut/fill or terrace supports. No such supports were supplied. The original browser replay visibly reproduces daylight underneath the plinth and decks. Camera clipping cannot explain those authored elevation differences; this is a terrain/placement mismatch. The close original arrival framing exaggerates its appearance but does not cause it.

## Production changes

New generation discards terrain operations, uses a single default ground plane at Y=0, and rejects elevated-only floor/foundation candidates. Loading, import, persistence and editing do not run this policy. Existing terrain scenes retain their data and render through the same terrain engine. No new selector was added. Default direct-scene staging now uses the existing natural-ground compiler with zero grade and elevation rather than Casa Ladera's decorative grounds.

Terra's instructions now specify slab and entrance datums, water/coping relationships, explicit balcony slabs, local axes, flat-roof overhang semantics, all-elevation facade design, entrance hierarchy and connected subordinate masses. These instructions have not been tested against a new provider response: zero OpenAI calls were made. The foundation check detects elevated-only scenes; it is not a general structural-support or collision solver and cannot guarantee every individual upper terrace is supported.

## Design decisions versus vocabulary

Terra chose three nearly equal rectangular roofed zones, long blank arrival/end walls, no wall openings, a freestanding curved lounge beyond the pool, and split terrace levels without stairs/support. All are explicit response decisions. Richer rectangular massing, openings, screened galleries, overhangs and loggias were already representable; their absence was not an engine restriction.

Several authored elements also misuse the vocabulary: side glazing is only 0.16m wide because its intended 5.8m span was put into depth; screens distribute slats over widths of 0.22–0.28m while using depths of 4.6–6.3m, creating nearly solid fins. Balcony means railing only, so a 2.1m depth does not create a terrace slab. Flat roof overhang metadata does not enlarge flat geometry. Those semantics are now explicit in the prompt. Existing saved elements are not silently reinterpreted.

The curved pavilion is a pinned complete open-lounge component. It cannot become an enclosed luxury wing or accept separately editable facade details. Arbitrary polygon/curved shells, complex roofs, multiple openings in a single wall, automatic circulation, foundations and pool excavation remain unavailable or require explicit primitive assembly. The five-material palette is restrictive. The renderer reuses existing Solana glazing, finishes, slats and roof components; no construction engine was added.

## Offline architectural revision

`flat-main-house-replay.ts` creates a separate 53-element study: common ground slabs at 0–0.2m, enclosure starting at 0.2m, aligned roof datums, corrected side glazing/screens, real arrival/end-wall openings, a glazed entrance gallery, deep continuous ocean loggia with piers, pool coping split around the water, and a laterally connected pavilion. It retains the original primary massing rather than claiming a newly designed $20m mansion. Main-house hierarchy and articulation improve, but its long single-storey composition remains conservative. Water remains a surface, not a fully modeled excavated basin. Additional architectural design work is still needed to reach the requested quality.

## Browser evidence and validation

Local Chrome rendered the exact original and corrected artifacts. All `/api/ai/*` requests and external page requests were blocked. `browser-checks.json` records zero AI requests and no page errors. Screenshots: original-front.png, front.png, rear.png, poolside.png, aerial.png. Poolside uses an explicit camera facing the source's -Z pool; the viewer's generic Poolside preset faces +Z and cannot infer this scene's pool direction.

The browser imported the corrected scene, moved only grand-entry, verified all unrelated elements stayed identical, undid the change, reloaded and verified exact corrected JSON. It then imported/reloaded the original terrain scene and verified it remained identical. Normal project-history persistence/undo/redo was additionally covered by the existing store regression.

14 focused tests passed across scene generation, model transactions, homepage regression and project persistence. `tsc --noEmit` passed. No migration, commit or deployment was performed.
