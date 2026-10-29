# Offline image-first proof

Open http://localhost:3000/dev/villa-playground/image-first with `npm run dev`.
The existing text-first route remains available at `/dev/villa-playground`.

This is a bounded offline proof, not a finished automated image-to-3D product. No paid API calls were made. A saved repository image was visually inspected and manually annotated; the fixture is explicitly `manual-offline`, never a claimed Terra vision response. It tests the downstream contract, existing Terra result resolution, construction validation, editable controls and real browser rendering. It does not establish autonomous vision accuracy or architectural originality.

## Preserved artifacts

- `concept-original.jpg`: byte-for-byte copy of `public/inspiration/villa.jpg`.
- `proof.json`: source SHA-256, full analysis, confidence/uncertainty, proposed architecture, validated editable configuration, explicit limitations, disabled concept-stage model and prompt.
- `reconstruction-aerial.png`, `reconstruction-arrival.png`, `reconstruction-poolside.png`: actual unedited browser screenshots.
- `browser-checks.json`: three real scene inspections, each 373 meshes with finite geometry, no browser errors and no intercepted AI/external requests.
- `terra-analysis-instructions.txt`: proposed Terra vision instructions incorporating the current existing construction capabilities.

## Visual fidelity review

Manual comparison of the original saved image and actual rendered aerial/poolside views:

| Feature | Fidelity | Evidence and mismatch |
| --- | --- | --- |
| Massing and levels | Moderate | Single elongated rectangular one-storey residence retained. No scale reference; dimensions are estimates, not measured reconstruction. |
| Roof | Moderate | Terracotta hip silhouette retained. Existing pitch, eave proportions and ridge differ. |
| Glazing and materials | Low | Pale walls retained; repeated large divided windows and shutters replace sparse blue windows. Exact dark timber surrounds/frame are missing and declared unsupported. |
| Terrace and pool relationship | Moderate | Side terrace and detached foreground pool retained; dimensions and offsets are inferred. |
| Entrance and hidden surfaces | Unverified | Tree occlusion prevents confident inference. Builder defaults must be treated as assumptions. |
| Site | Low | Flat bounded garden, walls, planting, loungers and parasol are builder defaults; original topography, tree placement and paving are not reconstructed. |

No numerical similarity score is asserted: cameras are not registered, original geometry is unknown and a single occluded view cannot support one. This modest saved reference was selected for offline verification, not as an example of the desired future concept-image beauty.

Supported improvements: manually adjust wing width/depth/height, explicit eave, terrace dimensions and pool position through the current composition editor; use material/glazing controls to reduce broad mismatch. These are proposals, not applied changes or evidence of improved fidelity. Roof pitch, sparse per-opening placement, exact timber framing and matched site geometry require additional builder controls. Do not replace unsupported roofs or sculptural volumes with rectangular wings.

## Boundary and blockers

The proof adds isolated files only. It reuses `resolveVillaResult`, composition schemas/builders, the existing `VillaPlayground`, renderer, cameras and composition editor. Unsupported features cannot carry substitute geometry targets; approximate features require explicit limitations; supported targets must exist. Invalid architecture is rejected, not repaired into a preset. These guards check declared mappings, not semantic truth of model output: a future reviewer must verify coverage against the image.

The offline adapter currently translates explicit wing architecture only. Curved footprints, stacked volumes and created components already present elsewhere in the playground still need a general specification-to-builder adapter. The disabled concept stage records a free-form architectural prompt and `gpt-image-2.5-sunburst` selection; there is deliberately no new live endpoint or paid action. Existing text-first Terra controls remain the existing live functionality.

Before live testing: connect the existing image/vision transport to the specification schema, generalize mapping across approved builders, validate complete feature coverage and cross-field level/roof consistency, preserve the raw image and provider outputs with durable identifiers, and pass both concept and camera-matched render captures into comparative review. The present retained JSON/source image are local proof artifacts; subsequent manual edits use the existing playground lifecycle and are not automatically appended to this proof file.

## Estimated paid stages

A minimal future run needs three paid requests if analysis returns the supported structured architecture directly:

1. Concept image generation: one high-quality image, unconstrained by builder templates (`gpt-image-2.5-sunburst`).
2. Existing Terra vision analysis: image → structured observations, uncertainty and supported architecture. If interpretation and translation are separated, add one Terra request (four total).
3. Existing vision review transport: original concept plus three rendered views → major mismatches and supported improvements. Local validation, 3D construction, captures and manual edits cost no API calls.

An optional supported refinement adds one Terra edit request; repeat visual review adds another. No retries or automatic improvement loops are proposed. Dollar cost depends on image quality/resolution, model and token usage; no dollar estimate is fabricated.

Model selection reference: https://developers.openai.com/api/reference/resources/images/methods/generate (checked 2026-10-26).

## Reproduce and checks

- `npx vite-node --config vitest.config.mts scripts/image-first-evidence.ts`
- `npx vitest run src/lib/villa/image-first.test.ts` — 3 passed: editable construction/source preservation; rejected substitutions/missing mappings/undisclosed approximations; invalid geometry rejection.
- `npm run typecheck` — passed, including installed Next.js route type generation.
- With local dev server running, `node scripts/image-first-capture.mjs` — passed, all three views. Script blocks AI routes and external browser requests. Local Chrome needed execution outside the filesystem sandbox after sandboxed startup failed.

No V3 files changed. No commits, migrations or deployment. Existing unrelated working-tree changes were preserved. Stopped before live generation.
