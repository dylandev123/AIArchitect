# Flexible footprint buildings

`footprint-building@1` extends the existing version:1 Villa composition, provider output schema, resolver, atomic edit executor and R3F renderer. Terra authors bounded architectural controls; the browser derives triangles. Existing wings, curved-pavilion@1, estate builders, lighting, glazing, facade finishes and V3 remain intact. No provider calls, database migrations, deployment or commits were made.

## Construction boundary audit

The retained responses and resolver findings are in `geometry-checks.json` (reproduce with `npx vite-node --config vitest.config.mts scripts/footprint-evidence.ts`). These are retained live outputs, not new model results:

- `garden-boundary.response.json`: four rectangular wings, two galleries and a rectangular pool. The current derived garden resolves the previous fixed-boundary failure. Rectangular massing is representable; garden policy was the issue, not a missing architectural mesh.
- `long-summary.response.json`: six rectangular wings and a curved sunset pavilion. The builder accurately implements the described **open garden lounge**. It cannot turn that lounge into an enclosed curved main residence. The retained response does not itself request an enclosed crescent; it would be misleading to claim it did.
- `expanded-limits/original.response.json`: rejected walking routes crossing building/pool reserves and a planting bed obstructing circulation. Those are spatial decisions within existing capabilities. More flexible building geometry does not repair them.

The actual missing capability is visible in the old contract and builders: each ComposedWing has four rectangular facade runs, rectangular floor plates and a rectangular roof; the only curved building builder hardcodes an ellipse, annular wall and open entrance. Even rotated detached wings cannot preserve a continuous curved enclosed perimeter, an asymmetric crescent, or an oblique articulated outline. The old Terra prompt explicitly prohibited curved enclosed buildings. New examples demonstrate the new capability without claiming an unmeasured improvement in live model quality.

## Supported parameters

Use optional `forms` beside existing `wings` in a composition. A forms-only residence uses `wings:[]`, `connections:[]`; at least one wing or form is required. Existing wing hierarchy rules apply whenever wings are present.

| Field | Supported values |
|---|---|
| builder | `footprint-building@1` |
| id | Stable lowercase slug, at most 48 characters |
| x, z | Placement centre, −200…200 metres |
| orientation | 0…359 degrees about Y |
| points | 3…16 ordered local `{x,z,curve?:{x,z}}` controls, each coordinate −40…40 m |
| curve | Optional quadratic control on the **outgoing** edge to the next point; final edge closes to first |
| height | 3…6 metres, one storey |
| material | ivory, sand, limestone, warm-stone |
| openings | panoramic, rhythm, private (progressively more solid facade bays) |

Each footprint drives the floor slab, closed roof extrusion, timber soffit and every facade bay. Straight edges are divided into bays up to 2.4m; curved edges use bounded sampling based on control-polygon length / 1m. Glazing uses the existing transparent glass and bronze frame component; opaque panels use existing PBR facade finishes. The repeated timber jambs support the visual roof rhythm. The floor is at the existing 0.47m playground datum, with a 0.3m slab and 0.26m roof. Roof and floor share the exact sampled concave boundary; no convex-hull shortcut or independent elliptical roof.

Limits: at most three forms, 180 sampled bays per form, 300 combined; footprint area >=24m², perimeter <=180m, adjacent controls >=1m apart. Sampled boundaries cannot cross or touch; nonadjacent edges need 0.3m clearance. Fixed sites remain authoritative. Conservative rotated bounding boxes reserve walls, roofs, pool furniture, pavilion approaches, open courtyards and landscape circulation. Derived gardens include the new envelopes.

Edits use `forms:[{type:"put",form:COMPLETE_FORM}]` or `forms:[{type:"remove",id}]` through the existing transaction executor. A put with the same stable ID replaces that form only; preserve its other parameters for targeted edits. Invalid edits reject atomically, preserving the displayed property.

## Three offline studies and visual checks

Open these local URLs after `npm run dev`, or choose their named study buttons:

- `/dev/villa-playground?composition=ocean-arc`: four controls, 86 facade bays. Broad concave ocean-facing glazing along local +Z; ocean orientation is design intent on the existing flat landscape, not a new ocean simulation.
- `/dev/villa-playground?composition=asymmetric-crescent`: six controls, 125 bays. Unequal arms and concave inner garden edge with rhythmic masonry/glazing.
- `/dev/villa-playground?composition=articulated-house`: eleven controls, 46 bays. Stepped recesses and an oblique end within one continuous contemporary shell.

`examples.json` contains the complete accepted payloads. Poolside, Above and Garden PNGs are actual local Chrome WebGL screenshots. Visual inspection checks continuous roof coverage over concave edges, alignment to facade heads, glazing continuity, material/scale consistency and the articulated recesses. All three plates have finite vertices and closed topology (every welded undirected triangle edge occurs twice); tests additionally compare roof triangulation area to the concave footprint area.

`browser-checks.json` records scene mesh counts and browser animation-frame timing during an orbit drag. All AI routes are blocked; errors and AI requests must be empty. Frame timing is a local development-browser measurement, not a hardware-independent performance guarantee. Postprocessing resets renderer counters, so `postprocessCalls` is not the building draw-call count. Existing four style buttons and three wing study buttons are exercised before the preserved Solana capture.

Reproduce screenshots with `node scripts/footprint-capture.mjs`. Set `PLAYWRIGHT_MODULE`, `CHROMIUM_EXECUTABLE`, `VILLA_URL` if needed. Default output is `/private/tmp/footprint-browser` to avoid evidence writes triggering development reloads; copy completed captures into this directory.

## Limitations

Single-level conceptual shells only: no room layouts, furniture placement, stairs, explicit entrance scheduling, services or construction certification. Glazed bays are conceptual opening patterns rather than operable door models. Curves are faceted at the declared sampling density; glass follows chords. Flat roofs follow the footprint with no overhang offset, pitched roof, holes, courtyard cutouts, variable heights, stacking, shared-wall joints or gallery attachments. Multiple forms must remain detached; conservative bounding boxes may reject otherwise nonintersecting arrangements inside a crescent. Use the preserved rectangular builders for two-storey wings, interiors, balconies and pitched roofs. The examples prove renderer variety, not the success rate of future paid Terra requests.

## Manually authorized Terra generation

No paid generation was performed. When you explicitly choose to authorize one, open the playground, select **New design**, leave the fixed site unchecked for a fictional property, and enter:

> Design an original single-storey ocean-facing modern residence with a continuous gently curved footprint and panoramic sea-facing glazing. Use one footprint-building@1 form as the main building, with a coherent enclosed strip, a flat outline-following roof and warm limestone accents. Orient the concave facade toward south (+Z). Keep the architecture spacious and legible; omit pools and detached amenities unless they improve the design. Do not substitute rectangular wings for the curved residence. Explain any unsupported request honestly.

Click **Generate villa** once. This uses the existing Terra route and your configured provider credentials. Inspect the result, supported controls and any validation diagnostic. A rejected result preserves the previous property; do not retry automatically. No further call or deployment is implied.

## Final verification

- Typecheck passed (`npm run typecheck`).
- 123 tests passed across 10 Villa/wing test files, including existing retained-response and estate regressions. Registry expectations now include the new versioned builder.
- Focused ESLint and `git diff --check` passed.
- Browser: zero page errors, zero AI requests; 711 / 819 / 343 total scene meshes for Ocean Arc / Crescent / Articulated. Median frame intervals were 16.7ms for all three during the orbit measurement, with p95 16.8 / 16.8 / 16.7ms.
- Nine form screenshots plus preserved Solana; all three outline roof extrusions verified closed and finite.
