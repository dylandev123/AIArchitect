# Programme-to-construction changes

This change adds executable construction helpers to normal Generate, not a new planner or renderer. It does **not** demonstrate the requested outcome of complete, sophisticated houses on the first request. No new model output was obtained; there is no evidence yet that Terra reliably selects these helpers, preserves every requested space, coordinates a complete house or produces better architecture. The original retained estate remains unchanged and rejected.

## Where the handoff fails

Production still runs `OperationStudio` → `/api/ai/scene` → one provider response containing intent/programme and operations → `resolveSceneResult` → `stageSceneOperations` → relationship gates → ordinary scene/history/rendering. Programme is evidence attached to the geometry, not an instruction executed by the assembler. An entry could previously identify only a shared slab, enclosure, roof and generic access, with a limitation saying that the interior was omitted. No construction obligation followed from the name “suite” or “kitchen”. Both legacy detailed plans and intent plans remain readable; runtime compatibility also permits historical output without programme. This change does not disguise those compatibility paths as strict completeness enforcement.

The retained response made the accommodation downgrade itself: six shells and a salon allocation for kitchen/service. Assembly expansion faithfully built those shells. There was no missing renderer or executor that should have supplied the omitted interiors. The response then independently authored incompatible roofs, water crossings and stair datums. Existing instructions already warned about these faults. Adding another completion paragraph would not resolve their coordinates.

Read for this work: system-repair report, retained estate diagnosis and controlled-generation report; planning/programme/terra contracts, operation staging, assemblies, relationship geometry, provider route and strict adapter; Solana's `TropicalVilla`, `UpperSuite`, `Entrance`, `Roof`, `Glazing` and `Slats`. Existing uncommitted work was preserved.

## Functional changes

`assemblyContract.ts` and `assemblies.ts` now expose three explicitly selected helpers through the existing `assemble` operation:

| Helper | Explicit design input | Deterministic construction | Does not supply |
|---|---|---|---|
| `doorway` | Partition location/orientation/width/height and opening location/size | Wall with a real sill-zero opening and a fitted, independently editable door | Other room boundaries, privacy, access route or removal of an existing shell wall |
| `kitchen-run` | First cabinet base, orientation, length/depth/height and unit count | Separate cabinet solids, separate worktop and shared datum | Appliances, sink, plumbing, service room or a working aisle |
| `straight-stair` | Lower start edge, orientation, total rise/run, width and riser count | Equal rises, solid support down to the base plane, exact final elevation and endpoint | Landings, base structure, guards, slab voids, roof/headroom clearance or a destination route |

All helpers accept an optional existing parent frame. For a floor slab, base Y is its local half-thickness. The caller chooses the architecture and spatial reservation. The helper resolves only the selected component's internal coordinates. No geometry is inferred from room metadata. Expansion is one-time; ordinary add operations, stable IDs, 800 expanded-operation and 400 final-element limits, validation, save, edits and Undo/Redo remain in use. No fixed house dimensions, style, region, floor area, room count or luxury amenities are imposed.

Invalid opening fit, rise above .2 m per riser or tread depth below .25 m is rejected rather than silently resized. These are helper limits, not jurisdictional building-code certification. Primitive authoring remains available. Solid stairs deliberately occupy the full space below the run and cannot stand in for open lightweight stairs.

`programme.ts` adds optional historical-compatible fields: `requirement` distinguishes user-required spaces using an exact retained-brief excerpt from design choices; `purpose` distinguishes accommodation roles; `construction` references partition IDs, fit-out IDs, related bathroom programme names and level-access IDs. Shared bathrooms remain possible. Review identifies missing physical kitchen fit-out, absent bedroom bathroom provision, invalid references, remote interior evidence and unsupported provenance. A label still never yields `verifiedComplete:true`. These fields improve traceability, not comprehensive natural-language extraction or automatic room verification. A model can still omit the fields; compatibility remains a known limitation.

The normal provider schema derives the helpers and new fields from these same runtime schemas. Its nullable strict adapter is tested with new helper parameters. Focused helper instructions describe base origins, expanded IDs, extents and unsupported work. Existing generic checklist text was shortened to keep the base system prompt below its existing 20,000-character test limit. No provider default, timeout, retry policy or API implementation changed.

## Reusable construction examples

These are developer-authored component examples, not generated houses or repairs to the retained mansion. Coordinates are in a selected floor's local frame; assume its thickness is .2 m, so its top is Y=.1 locally.

```json
{"op":"assemble","assembly":{"kind":"doorway","parameters":{"id":"bath-partition","parent":"selected-floor","at":[0,0.1,0],"rotation":0,"width":4.2,"height":2.8,"thickness":0.15,"openingX":0.8,"openingWidth":0.9,"openingHeight":2.1,"material":"ivory"}}}
```

This makes the partition and `bath-partition-door`; the door base equals the floor top. It does not establish a bathroom until its other boundaries and provision are constructed. At an exterior shell boundary, remove/replace the existing uncut wall rather than overlaying this helper.

```json
{"op":"assemble","assembly":{"kind":"kitchen-run","parameters":{"id":"service-run","parent":"selected-floor","at":[-2,0.1,-2],"rotation":0,"length":3,"depth":0.6,"height":0.9,"units":5,"material":"timber"}}}
```

The first unit is centred at X=-2; the run extends +X. The worktop top is local Y=1.0. Unit and worktop IDs remain separately editable. The architect must reserve a clear aisle and disclose unsupported equipment.

```json
{"op":"assemble","assembly":{"kind":"straight-stair","parameters":{"id":"level-stair","parent":"selected-floor","at":[0,0.1,-3],"rotation":0,"width":1.2,"rise":2.8,"run":4.8,"risers":16,"material":"limestone"}}}
```

Sixteen solid steps rise .175 m each with .3 m treads. The last tread top is local Y=2.9 and its far edge Z=1.8. A separately supported upper landing must meet that edge/datum. A route, slab void and guard are still explicit construction obligations.

Solana's transferable lesson is shared datums and deliberate boundaries: its entrance separates walls, door, glazing and canopy; its upper suite distinguishes floor, sill, header, glass, roof and guard. The doorway helper resolves one such fitted relationship, while existing primitives retain freedom to compose large portals, asymmetric volumes, facade layers, setbacks, terraces and pergolas. Solana's arbitrary pitch/roll, decorative meshes and opaque component interiors remain outside this change. No Solana layout was copied.

## Verification and remaining work

`interiorConstruction.test.ts` covers rotated/nested floor frames, fitted openings/door bases, cabinets/worktop, three different stair rises/orientations including a single step and the retained 3.425 m rise, exact final endpoints, invalid selections, atomicity, Generate resolution, strict adapter normalization, independent edits, JSON reload, actual project store Undo/Redo and required/suggested provenance. It makes no claim of a complete suite or generated house. Existing retained estate replay continues to compare all 128 elements and reject real faults.

Commands:

```sh
npx vitest run src/lib/villa/scene src/lib/library/architecture src/app/api/ai/scene/route.test.ts src/app/api/ai/scene/route.providerSchema.test.ts --reporter=json --outputFile=docs/architecture/programme-construction/tests.json
npm run typecheck
npx eslint src/lib/villa/scene/assemblyContract.ts src/lib/villa/scene/assemblies.ts src/lib/villa/scene/model.ts src/lib/villa/scene/programme.ts src/lib/villa/scene/planning.ts src/lib/villa/scene/terra.ts src/lib/villa/scene/capabilityReference.ts src/lib/villa/scene/interiorConstruction.test.ts
```

Final checks: **205 tests pass across 46 files**, typecheck passes and focused ESLint passes.

The central unresolved task is still model-selected whole-house coordination and complete accommodation. Component helpers do not enforce brief coverage, design differentiated suites, choose roof cuts or reserve circulation. First-request uplift across affordable homes, family houses, varied styles/climates/site dimensions and distinct luxury concepts is unmeasured. No paid provider calls, external research, database access, migrations, deployment or commits were performed. No before/after architectural render is claimed.
