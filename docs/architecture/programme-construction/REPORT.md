# Architectural programme and construction contract — 28 October 2026

The change addresses an authoring gap, not an executor simplification. Zero OpenAI calls, migrations, commits or deployment were performed. Existing unrelated workspace changes were preserved.

## Retained evidence

All five original source files were replayed by `scripts/generation-diagnostics-offline.ts`, with fetch disabled and source hashes checked. Updated evidence is in `../generation-diagnostics/`.

| Case | Consequential missing commitments | Replay |
|---|---|---|
| Basic bungalow | Explicit accommodation allocation, upper access and inter-wing passage; original brief redacted, so estate-scale alignment is unknown | Current pool validator rejects; staging still exactly preserves 55 adds |
| Coordinated tropical | Living/dining/kitchen, suites, sanitary/service allocation; sheltered inter-wing access and actual terrace doors | 16 operations expand to 73 elements; accepted |
| Mediterranean | Individual room allocations, developed arcade/gallery, coordinated wing junctions; roofs dominate and floors overlap | 57 adds accepted; courtyard identity retained |
| Failed redesign | Concept never translated into operations | Contract rejected; no built candidate |
| Successful redesign | Functional room allocation, access and correctly aligned doors | 100 operations yield 57 elements; no retained post-response render |

All five now expose `programme.status = unrecorded`. This means historical evidence is absent, not that all their accommodation is absent. No historical programme was invented. Their distinct original geometry, acceptance outcomes and operation counts remain unchanged.

## Cause and implementation

Previous instructions requested descriptive intendedSpaces while explicitly forbidding per-space construction ID lists. Knowledge decisions could cite parts, but accommodation had no equivalent accountable construction map. Assemblies construct enclosed wings, not automatic room programmes, inter-wing passages or stairs. Narrated access and a nearby glazing insert could therefore survive without an actual route. Strict technical acceptance could be mistaken for architectural completion.

`planning.ts` now instructs Terra to establish programme before parts, considering scale, public/private/service organization, living/dining/kitchen, suites and guests, entrance hierarchy, circulation and upper access, outdoor entertaining and pool connections as appropriate. Estate ambition is explicit without a mansion template, fixed area, bedroom count or floor count.

The compact `programme` array uses names, zone, a short construction strategy and floor/enclosure/roof/access IDs, plus limitation. Operations remain the only coordinate ledger. Strategies describe volume/level and adjacency; existing spatialRelationships carry critical ID-to-ID relations. Assembly-generated IDs can be cited. Related accommodation can be grouped; no separate measured-area ledger is required. Five intent strings are reduced to brief sentences and intendedSpaces to names. Existing 400-element, 800-operation and 30,000-output-token limits and model are unchanged. The base system instruction remains below its existing 20,000-character test limit; knowledge context is additional as before.

`programme.ts` checks IDs and kinds against final elements, reports missing floor/enclosure/roof/access evidence, full floor overhead bounds, nearby enclosure and access at floor datum, shared slabs and intendedSpaces absent from the map. Areas are labelled floor surfaces, not net room area. Every result retains verifiedComplete=false. Bounds and referenced IDs cannot certify room enclosure, stair usability or navigation. Existing circulation/opening/spatial reviews remain necessary.

`reviewSceneArchitecture` includes these warnings in the existing audit. Generation diagnostics expose the programme, and components list their programme spaces alongside existing operation indexes. This links selected accommodation → volume strategy/relationship → final IDs → actual accepted operation changes. Removed or nonexistent IDs become visible; rejected operations cannot establish construction. No geometry is manufactured, resized or accepted because of metadata.

The provider-facing schema includes the compact field with explicit Generate guidance. It is optional for compatibility with retained outputs and edits; omission is always visible as unrecorded. This is a soft authoring contract, not a new rejection gate. The older verbose plan branch remains readable. These choices avoid discarding valid construction or forcing a large mandatory planning ledger at the expense of operations.

## Validation and limits

Validation: 154 tests passed across 26 files; TypeScript passed. The focused suite covers real SDK mocked transport/schema, atomic operations, assemblies, multiple concepts, geometry coordination and normal project editing/Undo/Redo/serialization. New tests prove missing commitments, dangling IDs, absent access and duplicate slab allocations remain observable without geometry mutation. Retained replays do not regenerate concepts, so they establish preservation of distinct concepts, not that future Terra layouts will be more diverse or less repetitive.

The browser smoke script `scripts/programme-export-smoke.mjs` opens the local existing Ladera scene, blocks every AI endpoint and external browser request, exports four actual rendered PNGs and verifies the download, camera data and PNG payloads. It passed with zero AI requests and no page errors. See `browser-result.json`, `screenshot-export.json` and `export-smoke.png`. Its response ID is null because this developer fixture has no generation response ID; linked production-response export remains untested. The downloaded artifact contains its actual scene snapshot. This smoke test does not claim a new Terra design or production deployment.

No live architectural improvement is established. Programmes may still be omitted, underdeveloped or dishonestly referenced; spatial checks are necessary evidence, not proof of a complete room. True arches, automatic interiors/stairs, certified navigation, structural engineering and code compliance remain unsupported. Room partition quality, meaningful entertaining area, suite completeness and architectural hierarchy require measured and visual human review.

Ready for one controlled first-pass test after explicit authorization for a paid call. Keep model, engine and budgets fixed; record the exact brief and chosen programme, then inspect every selected space, actual access to occupied levels, functional openings, volume proportions and four matched views. Compare allocations and omissions, provider usage/status and repeated-layout tendencies; do not score acceptance as design success. No live test was run here.
