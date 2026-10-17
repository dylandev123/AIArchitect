# Architectural generation and V3 runtime audit

Decision: **C — reuse deterministic architectural construction inside V3**, while keeping direct V3 semantic authoring. Do not introduce a V2 document as the intermediate authority or a baked mesh as the editable model.

This is a source-level architecture decision with offline regression evidence, not a claim that generated V3 images now match V2 in a blind visual evaluation. No paid generation calls or matched-brief visual evaluation were run.

## What the code establishes

- `src/lib/v3/scene.ts` already expands building masses into slabs, walls, openings and roofs, with source-object identity. It already reuses V2's gable/hip geometry. Its previous facade vocabulary offered four treatments per side, essentially one opening per facade per floor. Prompt changes alone could not express V2's opening rhythm, reveals, floor-scoped entrances, and facade assemblies through those treatments.
- `src/lib/architecture/compiler.ts` has richer deterministic shell construction: footprint operations, facade-aware openings, additive assemblies, roof composition and material execution. `geometry/openings.ts` and `geometry/assemblies.ts` accept local geometry and materials; they do not require a V2 document, model call or persistence authority.
- V2 design quality is not all deterministic. The normal pipeline selects the single architect (`stages/generationMode.ts`); legacy staged generation is opt-in. `stages/compositionCompletion.ts` reviews authored composition rather than inventing it. Reusing compiler code does not replace architectural judgment about massing, arrival, circulation or views.
- `src/app/api/ai/house/route.ts` routes V3 ahead of V2, ingests raw JSON permissively, and permits one objective repair. `src/store/useProjectStore.ts` enforces the V3 root on commits and history restoration. Preserving those boundaries avoids reopening solved runtime problems.

## Comparison

Ratings are engineering judgments from these contracts, not measured visual scores. For B, distinguish a primitive bake from a semantic bake: they have very different editability.

| Criterion | A: improve direct V3 independently | B: V2 design → deterministic V3 bake | C: shared construction in V3 |
| --- | --- | --- | --- |
| Visual quality | Prompt improvements help composition, but the old vocabulary limits detail. Reimplementing features can eventually close that gap. | Strongest initial fidelity if all V2 primitives are retained. A semantic bake can lose unsupported details. | Proven construction details become available directly. Visual ceiling rises, but the architect must author good composition and remaining V2 features need adapters. |
| Semantic editability | Strong V3 ownership; limited to V3's implemented controls. | Primitive bake loses design intent; semantic bake requires a substantial mapping of openings, hosts, roofs and local frames. | Persistent local opening and assembly parameters recompile with their V3 owner. No reverse engineering of meshes. |
| Implementation complexity | Low initially, increasingly high if duplicating the mature compiler. | Medium for a visual-only bake; high for a faithful semantic converter, validation and migration. | Moderate: small adapters plus canonical contracts and regression tests; no whole-document conversion. |
| Runtime simplicity | One V3 runtime, but two separately maintained construction implementations. | Runtime can be simple if the source is discarded; regeneration and rich edits become complex. | One V3 runtime with pure shared geometry functions; no V2 orchestration during render or edit. |
| Persistence clarity | One scene. | Clear only if V2 is discarded or strictly inert provenance. Keeping both editable is ambiguous. | One scene; composition is nested semantic data, compiled children are derived. |
| Scalability | Compact authored objects, but growing duplicated maintenance. | Two generation representations and conversion; primitive bake increases persisted object count. | Compact semantic parameters and bounded local expansion. Geometry cost still grows with floors, openings and assemblies. |
| Interiors / physics / walkthrough | Good ownership foundation; existing envelope geometry is not an interior or physics model. | Meshes may be usable for collision, but lose room/door/support intent unless explicitly mapped. | Retains opening/floor/assembly intent and source ownership, suitable for later room and collision derivation. Does not yet implement navigable interiors or a physics model. |
| Duplicate authority | Low in stored data; higher risk of duplicated compiler logic. | High if both documents survive as editable sources; avoidable only with a strict one-way boundary. | Lowest: V3 authoring authority, one shared implementation for new construction capabilities. |

A and C both emit V3 scenes directly. The substantive difference is whether construction is rebuilt independently or reused. B is still a reasonable **future import path for existing V2 projects**, where preserving an existing design is the goal. It is unnecessary as the default for new V3 generation.

## Implemented boundary

`Terra → permissive V3 ingestion → persistent V3 objects → shared deterministic construction → derived renderer primitives`

- Added optional `composition` on V3 objects, consumed by building masses. `openings` supports glazing zones, opening rhythms and doors with facade and floor scope. `assemblies` supports slabs, posts, beams and slab-linked railings with stable local IDs.
- Reuses `buildMassOpenings` and `buildArchitecturalAssemblies` directly. V3 owns world placement, yaw, materials, source-object IDs and final primitive namespacing. No `ArchitecturalDesignDocument`, V2 generation stage or V2 persistence dependency is introduced.
- Explicit `openings` replaces facade presets for the whole mass; an empty list means solid facades. Omitting it preserves presets, including when only assemblies are supplied. Existing scenes retain their previous rendering.
- The model-facing description stays union-free. Canonical ingestion validates tagged composition data. Malformed generation composition produces `COMPOSITION_FALLBACK` and keeps a renderable preset facade. Invalid persisted composition or invalid edit payloads fail structural validation.
- `setComposition` atomically replaces composition on an authored object; `{}` restores preset behavior. Edit context includes the existing composition so requests can preserve unrelated details. Moving, rotating, resizing, recoloring, duplicating and deleting use existing V3 operations; parts are derived again from the owner.
- Generation guidance now describes the available construction vocabulary and asks for deliberate mass hierarchy, setbacks, arrival, view-facing facades and outdoor relationships. It does not inject a canned mansion or make aesthetic rejection a generation gate.
- Existing support inference, terrain, pool geometry, generic fallback, render-source integrity and persistence paths remain in place.

## Authority and future extension rules

1. Persist V3 objects and their semantic parameters. Never persist generated construction children as a second editable truth.
2. Changes target the owning object. Local opening/assembly IDs are scoped to that object; duplicated owners can retain them safely.
3. Keep independent structures as V3 objects. Nested assembly parts currently move/edit with their mass; independently selectable balconies, roofs or pavilions should be separate objects.
4. Shared builders may depend on construction types. They must not invoke V2 model stages, reconstruct a V2 document, or read a parallel project state.
5. Extend footprint articulation and roof systems through similarly explicit V3 contracts. Do not pass arbitrary V2 documents through an opaque metadata field.
6. Derive future colliders from construction roles and opening semantics. A mass's existing `solid` collision class alone is not sufficient for door traversal or interior navigation.

## Verification and limits

Focused regression run: **25 files, 142 tests passed**, covering V3 generation ingestion, compilation, support, coordinates, fallback, render identity, edits, persistence and API routing, plus shared opening tests. New tests exercise composition persistence, owner selection, facade/assembly output, geometry and material edits, duplication, clearing composition, malformed-generation fallback and atomic rejection. The full suite subsequently passed: **133 files, 1,489 tests passed; 2 files / 3 tests skipped**. Four V2 client response mocks needed `headers: new Headers()` to match the existing client response contract; production client behavior was not changed. TypeScript, targeted ESLint and diff whitespace checks passed.

This implementation intentionally adapts the reusable opening and assembly capabilities; it does **not** claim complete V2 feature parity. Articulated footprint operations, advanced roof assemblies/material systems, shared-wall removal, room layout, navigable doors and physics remain separate capabilities. Existing named geometry, roofs, terrain, pools and runtime safeguards are preserved. V2's compiler may clip overlapping or out-of-envelope opening requests; callers should treat authoring parameters as intent, not a guarantee of every requested pane surviving construction.

The next product-quality gate should use the same briefs and viewpoints for A, B and C: courtyard villa, hillside residence, compact house and multi-wing estate. Compare massing, facade rhythm, roof silhouette, ground contact, circulation and material legibility separately from primitive counts. Record latency, token cost and edit/reload behavior. Do not infer visual parity from the passing geometry suite. If C still underperforms mainly in design choices, improve its architectural planning context; if it underperforms in geometry, adapt the missing shared compiler capability rather than introducing a second authority.
