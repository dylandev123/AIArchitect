# Flexible footprint façade articulation

The latest retained Terra response inspected was `1b1a4c3a3770dd1fc0b790dcf26c5fd4504b524e0191c8296d746e05d0f70034`, Saint Lucia Horizon Estate. Its principal form is `horizon-residence`: eight original outline controls, 4.5m ground floor, six-control 3.8m inset upper floor. A sanitized architectural fixture is retained in `src/lib/villa/__tests__/fixtures/horizon-estate.response.json`.

Before this change, a single material and `openings` value drove every sampled façade segment. Solid/glass selection used sample-index modulo arithmetic, the upper floor inherited the same pattern, all mullions were timber, and the entire lower roof perimeter received glass railing. The result was essentially two uniformly extruded shapes. The retained response is unchanged and remains replayable.

Solana's `FinishBox`, `Glazing`, `Slats` and timber/stone palette are reused. Solana itself and the V3 renderer were not edited for this task.

## Authoring

Optional `facades` on the ground level and independently on `upper`:

```json
{"edges":[4,5,6],"treatment":"loggia","material":"ivory","terraceEdge":"glass"}
```

An edge index selects the entire outgoing edge of an ORIGINAL footprint control, including its curve. It never selects a tessellated window. Up to 16 sections per level; duplicate, overlapping and nonexistent edge selectors reject the transaction. Omitted sections retain legacy behavior. A full form `put` uses the existing atomic generation/edit executor; unrelated forms and landscape remain preserved. Terra's existing provider contract and system instructions expose these options without window coordinates.

| Treatment | Physical result |
| --- | --- |
| solid | Full-height masonry surface |
| glass | Broad glazed opening with sill/header |
| loggia | Glazing recessed 1.5m under existing roof, timber soffit and spaced timber supports |
| screen | Glazing recessed .8m behind deep timber fins |
| colonnade | Glazing recessed .8m, masonry piers and .75m deep perimeter beams |
| entrance | Centered timber door zone, masonry flanks and stone header |

Each section optionally overrides material and chooses glass or solid lower-roof terrace parapet. Upper façades do not inherit lower selectors. All horizontal shade geometry stays within the original roof envelope; original footprint collision bounds are preserved.

## Browser evidence

Open `/dev/villa-playground?composition=` with `tropical-loggia`, `sculptural-horizon` or `mediterranean-rhythm`. These studies use identical lower and upper outlines, the same placement, grounds, guest retreat and pool. They are deterministic examples, not mandatory Terra presets.

`node scripts/facade-articulation-capture.mjs` captures actual R3F/WebGL views from aerial, arrival and poolside angles, plus the unmodified retained design. The script blocks all AI endpoints and external hosts, checks finite mesh coordinates, and records browser errors and network attempts in `browser-checks.json`. Detail screenshots adjust only the real orbit camera.

Visual review led to removal of per-bay recess returns and wider loggia support spacing; Mediterranean arrival side wings also received colonnades to reduce blank walls. The studies visibly differ in actual depth, opaque wall distribution, timber screens, pier/beam rhythm and parapets.

## Validation and limits

- Villa suite: 130 tests passed, including generation/provider acceptance, source-edge selection, independent upper selectors, atomic invalid-selector rejection, and preservation of estate configuration.
- TypeScript `tsc --noEmit`: passed.
- Broad V3 regression run: 1014 passed, three failed in unedited modules: `planRecovery` (`window` absent in Node), `productionRouteDiagnostics` (fallback diagnostic expectation), `supportCapabilities` (fountain support expectation). No V3 implementation files were changed.
- No live AI calls, migrations, commits or deployment.

This remains an exterior model: no interior room planning, functional entry route/stairs, structural design or cost certification. Recess depth is fixed per treatment. Very narrow or sharply concave outlines need further offset-intersection validation before deep recesses are suitable; this is not a general polygon-offset solver. Curves remain faceted at existing sampling resolution. Pier spacing derives from sampled bays, so it can vary between differently sampled source edges. Entrances derive door panels from the center bays rather than constructing one continuous custom portal. Mediterranean character here comes from masonry loggias and parapets; arches and pitched roofs on these flexible forms remain unsupported. No projecting balconies or cantilevers were added. Existing landscape draft warnings remain visible and are outside façade scope.
