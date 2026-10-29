# Terra estate integration

Terra's normal composition contract now exposes the existing versioned `estate-landscape@1` and `rotated-detached-wing@1` capabilities alongside `curved-pavilion@1`. No estate preset selector, geometry engine, migration or persistence format was added.

## Controls

- Optional winding driveways and pedestrian paths: width, 2–8 centreline controls, avenue/border/no planting. Local builders interpolate curves and construct paving and planting.
- Optional circular/oval motor court: position, dimensions, none/planted/fountain island, island dimensions.
- Courtyard gardens: bounded planted beds, paths, terraces and surrounding building placement.
- Detached secondary wing orientation in 15° increments, with existing roofs, facades, verandas and interiors rotating together.
- Landscape margin and automatically derived fictional sites include all arrival, planting and amenity bounds. Explicit fixed sites remain authoritative.

The prompt asks for original compositions proportional to the brief, allows extensive grounds for an ambitious fictional estate and avoids compulsory grandeur for modest houses. Examples are not templates.

## Editing and compatibility

`estateLandscapeChanges` edits court fields and puts/removes individual routes or beds by stable ID. Complete landscape replacement remains accepted for existing manual controls and new landscape creation. Replacement and targeted operations cannot occur together. Both manual and Terra edits pass through `executeCompositionPatch`, which clones the current property and validates the completed transaction before applying it. Unrelated architecture and landscape features remain intact under targeted edits. Unknown removals, geometry failures and fixed-boundary violations reject the transaction.

Existing version:1 records, cardinal wings, Solana, shared style builders, previous compositions and legacy villa edits remain supported. Experimental pavilion fields stay excluded from provider generation output.

Limitations: non-cardinal rotations require detached secondary wings; main/attached wings and galleries remain cardinal. Conservative rotated envelopes can reject close placements. A fountain is the motor court's central island; moving it moves the host court and may require coordinated route edits. No independent fountain offset, diagonal gallery, arbitrary garden polygon, terrain modification or vehicle turning simulation. Routes have at most eight controls, ten routes and twelve beds per estate. Connectivity validation verifies gallery joins and driveway-to-court contact; pedestrian destination completeness is design guidance rather than a semantic guarantee. Legacy non-composition villa edits retain their earlier limited contract; generate a composition to use estate systems.

## Verification

- `npm run typecheck` passed.
- Focused Villa library and wing/model suites: 105 tests passed across 9 files.
- Offline tests exercise all three estates through the provider response schema and resolver, JSON Schema conversion, arrival creation, targeted fountain movement, courtyard bed/path edits, detached rotation, shared manual/AI executor output and rejection preservation.
- Existing geometry tests cover route widths, self-crossings, islands, pool/building clearance, fixed boundaries, derived sites, finite geometry and previous generated compositions/styles.
- `browser-checks.json`: nine estate camera views plus Solana, six passing manual control checks, zero browser errors and zero AI requests. Inspected refreshed above views of all three estates visually.
- `offline-responses.json`: eight intercepted responses; all three compositions accepted, targeted court movement preserved unrelated wings/routes, invalid edit and generation preserved the prior scene. Zero provider calls and zero browser errors.
- `styles/browser-checks.json`: modern (588 meshes), Caribbean (863), Spanish (980), Tuscan (897), Solana benchmark and unchanged project-storage sentinel; zero browser errors. AI endpoints blocked.
- Focused ESLint and `git diff --check` passed. Screenshots show actual local Chromium WebGL output; AI endpoints are blocked or fulfilled locally.
- Browser harness output was captured outside the development workspace, then copied here after completion to avoid hot reloads from evidence writes. Earlier interrupted harness runs were rerun successfully; their failures were not counted as passes.

## One manually authorized live generation

No live AI generation was performed in this work. After explicitly authorizing one paid generation, start `npm run dev`, open `http://127.0.0.1:3000/dev/villa-playground`, select **New design**, leave the fixed boundary unchecked and enter:

> Design an original $15 million Caribbean oceanfront estate on an unconstrained fictional site. Give the buildings, landscaped grounds and amenities generous space. Consider a winding landscaped drive, circular fountain arrival, walking connections and a detached guest pavilion oriented toward the ocean. Choose the composition freely; use these features only where they improve the estate.

Click **Generate villa** exactly once. Inspect the result and any precise validation diagnostics. If it fails, the existing property remains; do not retry automatically. No follow-up edit is included in that single-call authorization.

The existing `scripts/villa-terra-check.mjs --live-generation` can instead run a guarded single generation with `VILLA_URL`, `VILLA_BRIEF`, `PLAYWRIGHT_MODULE` and `CHROMIUM_EXECUTABLE` set appropriately. Do not run it without manual authorization.
