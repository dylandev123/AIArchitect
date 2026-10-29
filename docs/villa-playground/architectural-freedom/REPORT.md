# Terra architectural freedom — offline implementation and evidence

Scope: Villa Playground only. No V3 changes, migrations, commits or deployment. Existing working-tree changes were preserved. No live Terra generation, review, component creation or provider simulation was performed.

## Audit and implemented freedoms

The limiting boundary was not Three.js triangulation: `footprint-building@1` already renders concave and quadratic outlines and edge-specific facades. Its legacy stack path required a rectangular base, inherited every upper material/opening, and could not express an irregular four-storey house. The alternate curved `upper`/`volumes` paths stopped after one upper storey. Wing appearance and roof selection were shared across the property. The experimental creation grammar only constructed outdoor ribbons.

The additive `forms[].levels` support graph reuses the footprint builder and validator. Each volume names a parent, authors its own ordered straight/quadratic outline, height, material, glazing rhythm, facade sections and rooftop treatment. Multiple siblings make unequal wings; parent chains make towers up to four storeys. Source coordinates and facade selections survive resolution. Elevations derive from parent height plus the existing .26m slab. A base or new level can be 3–9m high, allowing a double-height exterior entrance/salon without an intermediate slab.

Each wing can now override `{style,roof,exterior,glazing}` and specify `.3–3m` eaves. Existing hip/gable/flat roof, veranda and balcony builders render these values. Omitted fields retain legacy behavior. A single estate can combine pitched roofs and flat garden salons with different materials. The same overrides determine conservative clearance envelopes, derived garden bounds and compatibility validation.

New support graphs use sampled simple-outline checks, wall clearance, named-parent support/projection validation, cycle/identity/depth checks, sibling vertical-envelope separation and the existing combined 300-bay budget. Projection remains bounded to 2m and at least 60% of sampled boundary must be supported by the named parent. This is geometric exterior massing validation, not an engineering support calculation. Unsupported graphs fail atomically with diagnostics; they are not replaced with boxes or ovals.

Irregular roof terraces use their actual outline, clip rails against upper shells, and place lounge/pergola groups only where a clearance disk fits inside the terrace and outside upper footprints. Offline render inspection prompted two renderer fixes: coalescing short rail spans and centering the furniture search grid so valid small sky terraces are furnished. Tall entrance doors are capped at a human-scale 3.6m, leaving clerestory glazing in double-height volumes. An arrival render also prompted moving the study's entrance from a hidden face onto its arrival wall.

## Terra access and compatibility

All demonstrated architectural fields pass `villaProviderOutputSchema`, `resolveVillaResult` and the existing atomic `forms:put` / `wings:adjust` executor. Tests also perform real material/eave edits and a narrowly scoped visual-review facade edit. No study ID or topology is added to Terra's schema or prompt as a required choice. The studies are deterministic preview inputs, not generation templates.

The composable prompt advertises the graph, separate materials/facades, tall entries, mixed wing roofs and eaves. It distinguishes footprint design controls from raw mesh vertices and retains explicit missing-capability explanations. The versioned footprint component registry describes the expanded additive grammar. Legacy `stack`, `upper`, `volumes`, wing designs and saved response replay remain supported. Ambiguous combinations are rejected rather than silently ignored.

Visual Review still requires explicit paid-call authorization and uses its existing single manual evaluation/proposal workflow, immutable baseline and leaf-path scope checks. Its visual rubric now explicitly asks about silhouette, volume hierarchy, proportions, office-like glazing, entrances, shade and outdoor rooms. No automatic review/retry loop was added. This work does not establish live model design quality or paid-review effectiveness.

## Meaningful reusable architecture

The new enclosed-architecture candidate family extends the creation area with validated data snapshots of complete enclosed buildings, including their volume graphs. It uses the existing footprint validation, property edit executor and ReviewPreview screenshot capture rather than executing generated code. Ribbon candidates and their stored files are unchanged.

In Playground → Customize this villa → Experimental building library, a user can snapshot a selected form, save an immutable private browser version, export/import JSON, preview it on a selected destination building, capture/review three exterior views and apply the preview. Placement is separated from the normalized component. Reuse preserves unrelated property elements and revalidates the destination's site/collisions. A changed baseline disables applying a stale preview. Browser validation also exposed an existing preview-lifecycle issue: intentional WebGL disposal could overwrite the successful apply message with a context-loss error. The capture preview now removes its context listener before disposal. Three bounded screenshots are required for the `reviewed` status; this is visual evidence, not structural approval.

Terra can author every geometric capability in these candidates directly. Automatic discovery/reuse of this new browser-private library is **not** connected to Terra's existing server-side ribbon candidate discovery. Manual import/reuse is available; automatic library orchestration remains a limitation. No executable code or arbitrary builder name is accepted.

## Browser evidence and comparison

[Comparison sheet](comparison.png) contains actual unmodified WebGL house-only renders of all four studies, Solana, and the retained Cascade response. Each case has [arrival](freedom-sky-arrival.png), [poolside](freedom-sky-poolside.png) and [aerial](freedom-sky-aerial.png) screenshots. Direction and daylight are consistent; fitting distance adapts to each house's architecture bounds, so these are composition comparisons, not equal-metre scale comparisons.

| Study | Demonstrated architecture | Visual finding |
| --- | --- | --- |
| [Sky Court Mansion](freedom-sky-poolside.png) | Four-storey stone tower, double-height base, splayed salon, independently treated upper wings, shaded roof lounge | Stronger vertical/low-volume hierarchy than Cascade's full-width repeated tiers; arrival wall remains deliberately restrained. |
| [Palm Court Estate](freedom-estate-poolside.png) | Three unequal wings linked by lower galleries; hip, deep-eave gable and flat roofs; independent palettes | Broad open-court composition distinct from either vertical study. Mixed roof character is visible and geometrically separated. |
| [Folded Ridge House](freedom-fold-poolside.png) | Concave angular base, offset polygonal stone library, loggia/colonnade edges | Splayed silhouette avoids an ordinary rectangular stack; upper glazing can still read as a repeated band. |
| [River Ribbon House](freedom-river-poolside.png) | Non-elliptical concave curved base and asymmetric curved library with independent material | Genuine curved outline follows the living edge; dense sampled mullions remain a visual limitation. |

Solana still has richer bespoke detailing and more composed arrival furniture than these reusable exterior studies. The new system demonstrates materially broader geometric expression; it does not claim that every generated design will exceed Solana's finish quality. Cascade replay retains its original four rectangular tiers and makes the old inherited repetition visible.

[Configurations](configurations.json), [geometry/schema checks](geometry-checks.json) and [browser checks](browser-checks.json) are retained beside the screenshots. Browser automation blocks every `/api/ai/` request and all external requests; the recorded blocked-attempt and page-error lists are empty. No external provider endpoint was contacted.

## Remaining limitations

- New outline-volume roofs are flat and follow the footprint; pitched/mixed roofs are available through wings, not arbitrary curved roof surfaces or complex roof junctions.
- No enclosed interior atrium holes, professional floor plans, stair/lift access or functional roof-access circulation is generated. A tall glazed entrance is exterior double-height massing, not a fully planned atrium.
- Graph volumes use the form's common coordinate system; independent rotation can be expressed in outline coordinates, but there is no separate per-level rotation field.
- New graph roof terraces are supported; independently projecting arbitrary balcony geometry is not. Existing wing balconies and recessed loggias remain available.
- Conservative bounding boxes can reject close concave/diagonal neighbours. Graphs have one named support parent per volume; multi-parent bridge spans, free-floating volumes and structural certification are absent.
- Reusable façade detailing remains coarser than bespoke Solana. Curved glazing density and restrained entrance walls merit further artistic development.
- Live Terra behavior is untested by design. Offline schema/executor coverage establishes expressibility, not model reliability.

## Validation

- 234 relevant tests passed across 26 files, including existing Villa schemas, creation, metadata, lifecycle, rendering model and AI routes with mocked providers, plus ten new architectural freedom/candidate tests.
- `npm run typecheck` passed.
- `npm run lint` passed with zero errors and two pre-existing unused-variable warnings in unrelated capture scripts.
- Four studies × three exterior views, plus three views each for Solana and retained Cascade; finite geometry, intact WebGL context and no browser page errors.
- [Library browser checks](library-checks.json) passed snapshot versioning, immutable overwrite rejection, validated preview, three reviewed bounded captures, private save and atomic apply. [Reusable reviewed building snapshot](reviewed-building.architecture.json) and [workflow screenshot](library-workflow.png) are retained.
- Zero live OpenAI calls. Stopped after offline validation.
