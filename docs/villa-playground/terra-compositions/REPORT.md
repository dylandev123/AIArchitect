# Terra composable villas — implementation and verification

Implemented locally on October 22, 2026. No live OpenAI requests, credits spent, new services, agents, migrations, deployment or commits during this work. Earlier unrelated working-tree changes were preserved. V3 blueprint/construction code was not changed by this task.

**What Terra controls**

New generations use a complete, strict `version: 1` component configuration, rather than a composition preset. Terra authors one to eight building wings, their main/living/guest roles, parent hierarchy, dimensions, positions, cardinal orientation, one/two storeys and storey heights. It chooses attached wings, derived straight connecting galleries or detached pavilions. A one-wing house is valid; complexity is not mandatory.

Appearance includes the existing Modern, Caribbean, Spanish and Tuscan styles, compatible flat/hip/gable roof choices, ivory/sand/limestone/warm-stone finishes, panoramic/divided glazing and tropical/Mediterranean landscaping. Each wing can have its own veranda depth and balcony inset. Appearance is shared across wings; galleries retain the existing lower flat roof.

Terra places rectangular terraces and open courtyard regions, chooses paving/timber, positions and sizes an optional rectangular pool, and sizes/positions the garden. Courtyard enlargement is a coordinated edit to open paving and surrounding wings, not a preset switch. The existing renderer supplies façades, arches, shutters, roof details, slabs/stair openings, stairs, furnishings, vegetation and pool components. Presentation cameras fit the authored garden while the preset cameras keep their existing framing.

**Editing and shared execution**

`executeCompositionPatch` is the common executor for the manual composition form and Terra edits. It supports wing add/adjust/remove, connection put/remove, terrace/courtyard put/remove, partial appearance/pool/garden changes and pool removal. Wing adjustment covers roles, parenting, detached status, dimensions, positions, orientation, heights, storeys, verandas and balconies. Galleries regenerate through the existing `operateWings` builder after the final candidate is assembled. Wing deletion removes dependent galleries; children must be reparented in the same transaction.

The manual form stages positions, dimensions, orientations, heights/storeys, verandas/balconies, courtyard sizes, exterior and roof changes, then submits one atomic patch. Terra can also add a guest, extend a wing, raise it, move a detached building, or expand an entire court. Validation failure leaves the accepted design intact, including unrelated components and manual changes. Both server and client validate; provider schema failures also recover local field diagnostics when the SDK supplies parseable output.

**Supported limits and validation**

| Area | Current support |
| --- | --- |
| Wings | 1–8 rectangular buildings; exactly one main; acyclic parent paths to main; unique IDs across wings, links and terraces |
| Dimensions | Local width/depth 4–32 m; two-storey wings require local width ≥8 m for the existing stair |
| Height | 1 or 2 storeys; 3–4.5 m per storey |
| Position/orientation | Centre x/z −30…30 m; 0/90/180/270°; x east, z south; local front faces south/east/north/west respectively |
| Outdoor rooms | Front veranda 0–3 m; two-storey balcony 0–min(2.4 m, depth/3); one-storey balconies must be zero |
| Connections | At most 8; straight aligned galleries 1.2–5 m wide; derived gallery dimensions also obey the existing ≤32 m builder limit; hosts need overlapping alignment spans at least as wide as the link |
| Gallery height | Existing derived height = min(3.3 m, host storey heights); each host total height must exceed it by ≥0.3 m to clear the gallery roof |
| Direct attachment | Flat-roof buildings may share ≥1.2 m of wall; pitched buildings use separated roofs and lower galleries because arbitrary pitched roof junctions are not implemented |
| Clearances | No building overlap; separated roof/veranda envelopes require ≥0.2 m gap; non-host wings cannot obstruct galleries |
| Roof envelopes | Conservative eaves: modern 0.7 m, Caribbean 1.15 m, Spanish/Tuscan 0.65 m; veranda front reserves depth +0.4 m |
| Terraces/courtyards | At most 16 rectangles, each dimension 0.6–64 m; courtyards cannot contain building/gallery footprints; ordinary paving may extend under elevated slabs |
| Pool | Optional rectangle, east–west length 8–18 m, north–south width 4–6.4 m; paving leaves water opening +0.15 m |
| Pool surroundings | Reserve west 2.2 m, east 3.5 m, north 1.2 m, south 2.2 m from water edges to building envelopes/site edges for existing coping, furniture, planting and spill channel |
| Garden | 12–80 m each dimension; contains roofs/verandas, galleries, terraces and pool surroundings |

Failures identify component/field paths and the violated relationship. Validation is conservative component compatibility checking, not construction-code, structural or room-plan certification. Curved/diagonal wings, bent/multilevel links, domes/turrets, per-wing roof/material systems, more than two storeys, custom floor plans, garages, terrain changes and exact cost estimates remain unsupported. There is no automatic repair call, preset conversion or hidden fallback.

Solana and all four legacy style demos retain their existing renderer and customization executor. The three original wing presets remain unchanged visual examples and regression fixtures. Their refine button is disabled: new composable generations have the full wing editing flow, while legacy style demos retain their legacy style/pool edits. Selecting an example does not substitute that preset into a Terra composition.

**Library preparation**

`VillaComposition`, `compositionSchema` and `validateComposition` define the reusable JSON payload. IDs are stable across edits and `version: 1` is required; unknown versions and unknown fields are rejected. The API returns the complete accepted configuration alongside the applied patch. Future saving/loading can serialize this payload, validate it on import and call `buildComposition` to render it; approval/provenance metadata can wrap it later. Validation does not confer library approval. No library management system or project persistence migration was added.

**Deterministic verification — no live model results**

- Focused Vitest: **68 tests passed across 5 files**, including composition contracts, route mocks, existing styles, presets and Solana model tests. Coverage includes every style × cardinal orientation × storey count, supported dimension/height extrema, hierarchy/roof/pool failures, SDK diagnostics, atomic rollback, gallery regeneration and preservation of unrelated choices.
- `npm run typecheck`: passed (`next typegen` and `tsc --noEmit`).
- `npm run lint`: passed with zero errors; one pre-existing unused `label` warning in `scripts/villa-compositions-capture.mjs:37`.
- Real local Chromium/R3F checks: three newly authored configurations with **1/2/4 building wings**, **0/1/2 galleries**, **430/697/1245 mounted meshes**, expected positions/orientations and finite geometry. Poolside/Above screenshots were inspected. These are deterministic fixtures, not evidence that a live model understood different briefs.
- Browser edit checks: manual height/material preserved through AI-shaped fixture patches; guest addition; courtyard enlargement; invalid overlapping edit rollback; pool removal/restoration; unchanged project storage; zero runtime page errors. Eight requests were intercepted and fulfilled locally; **zero provider calls**.
- Existing browser regression: Solana, all 4 styles and all 3 original presets passed, with manual customization/pool toggles, unchanged project storage, zero page errors and **zero AI requests**.

Evidence: [deterministic configurations](deterministic-configurations.json), [composable browser results](browser-checks.json), [legacy regression results](../compositions/regression-checks.json), [single-volume render](horizon-house-poolside.jpg), [Caribbean pair](breeze-pair-poolside.jpg), [courtyard estate](olive-court-poolside.jpg), [rejected edit preserves design](rejected-edit-preserves-composition.jpg).

**Reproduce locally, without credits**

With the existing development server running, execute:

```sh
npx vitest run src/lib/villa src/app/dev/villa-playground/wing-composition.test.ts src/app/dev/villa-playground/villa-model.test.ts src/app/api/ai/villa/route.test.ts
npm run typecheck
npm run lint
node_modules/.bin/vite-node --config vitest.config.mts scripts/villa-composable-evidence.ts
node scripts/villa-composable-check.mjs
node scripts/villa-compositions-regression.mjs
```

Browser scripts default to `http://127.0.0.1:3107/dev/villa-playground`; set `VILLA_URL` for another port. They reuse the existing local Playwright/Chromium installation; `PLAYWRIGHT_MODULE` and `CHROMIUM_EXECUTABLE` can override those paths. The composable harness intercepts every AI request, and the legacy regression blocks every AI request.

**One manually authorized live generation — not run during implementation**

Open `/dev/villa-playground` on the local development server. Existing server-side `OPENAI_API_KEY`, model selection and usage logging are reused unchanged. Choose **New design**, enter a brief, and click **Generate villa** once. That submission makes one real provider attempt with `maxRetries: 0`, no geometry tools and no repair call. A rejected design shows diagnostics and keeps the current scene. Refining afterward would be a separate paid request.

Suggested first brief: “Design an elegant asymmetric Caribbean villa with a two-storey main hall, a lower living wing connected by a shaded gallery, one detached guest pavilion and a long rectangular pool. Use generous clearances and an open garden terrace.”

Alternatively, explicitly invoke the gated browser helper:

```sh
node scripts/villa-terra-check.mjs --live-generation
```

It makes **one generation only**, blocks any unexpected second AI request, and records the live response/screenshot separately as `manual-live-generation.*`. It performs no automatic edit or retry. Without that flag it exits before starting the browser. Live composition quality and prompt adherence still require that authorized evaluation; all implementation results above are deterministic.
