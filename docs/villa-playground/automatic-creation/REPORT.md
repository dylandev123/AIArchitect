# Automatic architectural component creation

Implemented and verified offline on 2026-10-26. A normal Villa Playground house prompt can now produce a new bounded architectural component, assemble it in the actual property, and save an experimental library candidate. The user does not need to open the Component Studio. No live OpenAI calls, key changes, migrations, commits, deployment, or V3 changes were made.

## Existing systems reused

- `src/app/api/ai/villa/route.ts`: existing Terra generation endpoint, model configuration, AI SDK structured output, zero retries, usage logging and timeout.
- `src/lib/villa/terra.ts`: existing mode-specific provider schemas, response normalization and property resolver.
- `src/lib/villa/creation/geometry.ts`: the existing Studio geometry grammar, proposal validation, mesh construction, sampling and rotated bounds, extracted unchanged from `creation/model.ts` to avoid a dependency cycle. The original module reexports these functions for existing callers.
- `creation/model.ts` and `composition.ts`: shared placement/property validation. Both manual previews and automatic assembly now use the same final property checks.
- `creation/candidate.ts`, `creation/store.ts`, and `/api/dev/villa-candidates`: existing immutable versioned local candidate library and reviewed approval process.
- `create-component/ribbon.tsx`: existing CreatedRibbon renderer, PrimitiveMesh, PBR material choices and four posts. ComposedVilla now renders these instances alongside existing wings and forms.
- `composition.ts`, `wing-composition.ts`, landscape acceptance and existing scene/cameras: composition assembly, derived grounds, fixed boundaries and editable landscape drafts.
- `responseArtifact.ts`: raw response retention before validation; an additional assembled snapshot supports exact offline recovery. Existing visual-review tools and optional Studio remain available.

## Trigger and lifecycle

Terra receives the approved builder registry, a bounded manifest of up to 24 approved private candidate versions, the existing creation grammar, and a small optional `componentRequests` contract in its normal generation response. It decides which architecture serves the brief and whether an existing builder suffices, an approved candidate should be reused, a new bounded proposal is needed, or a capability gap must be explained. Ordinary houses can omit requests or return an empty array.

`creation/automatic.ts` handles create/reuse/gap requests locally after that single provider response. It validates schemas, geometry parameters, identity, placement and the complete property before saving candidates. No generated code is executed. New candidates are experimental with zero reviewed evidence. Their proposal retains design intent, material details, parameters, exact `swept-ribbon@1` reference and the original house brief.

Each property instance embeds the proposal and pins its candidate ID/version/status. Normal output returns the complete assembled composition in `changes`, allowing the existing client resolver to render it. Placement edits and removals preserve unrelated fields and geometry snapshots. Approved reuse resolves an exact stored version; no proposal creation or candidate save occurs.

Automatic candidates appear in the optional Studio with a **Review candidate** button. Review in two different villas, retain evidence, save a reviewed experimental version, then approve that exact saved version. Approval creates a new immutable version. Unreviewed candidates cannot be approved; experimental candidates are excluded from Terra's approved catalogue. Designs stay development only and are not published.

Derived gardens include every new rotated component envelope. Explicit fixed boundaries remain authoritative. Minor conflicting routes/beds can remain visible as unresolved draft items while valid architecture renders; the existing landscape projection hides those draft features. Invalid architectural geometry or fixed-site overflow rejects the result without replacing the current property.

Raw provider responses and assembled recovery snapshots have separate hashes. Use `assembledDiagnostics.responseId` with `/dev/villa-playground?response=ID` to recover an accepted property containing created geometry. Recovery rejects an unresolved raw create/reuse response instead of silently dropping its components. Private generation manifests in `.data/villa-generations` record stages, usage, budgets and response references; existing API usage logging remains in place.

## Supported forms and limits

New creation is limited to the existing freestanding four-post swept ribbon: wave, sail, flare and banked canopy variations. Length 4–14 m; base width 1.5–5 m; height 3–6 m; thickness .12–.4 m. Four stations control lateral offset ±2 m, rise 0–3 m, width multiplier .5–1.5 and bank ±18°. Minimum soffit clearance is 2.6 m. Ivory, limestone and bronze finishes are supported. World position and yaw are validated; ordinary terrace paving may sit beneath the posts.

Existing rectangular/rotated wings, galleries, curved/articulated footprint buildings, inset upper floors, facade treatments, approved curved pavilions and estate landscaping remain available through their established builders.

Unsupported creation includes enclosed/glazed ribbon rooms, wall/roof/gallery attachment, branches, holes, intersecting ribbons, arbitrary surfaces, imported meshes, arbitrary code and new geometry builders. Terrain, professional floor plans and engineering/fabrication certification remain outside this V1. Conservative bounding boxes can reject close placements that might be physically feasible. Creation during conversational edits is deliberately excluded; existing created instances can be moved, rotated or removed.

V1 makes at most **one provider call per normal generation**, with zero automatic retries and the existing 12,000 output-token limit and 160-second provider timeout. There is no multi-call premium workflow. `VILLA_MAX_NEW_COMPONENTS` accepts 0, 1 or 2 (default 1); at most two created-component placements/requests are allowed. Invalid budget settings fail before a provider call. No environment files were modified.

Costs remain token based. The repository's configured Terra rates are $2/M input tokens, $.20/M cached input tokens and $12/M output tokens; these are local accounting settings, not independently verified provider prices. An illustrative additional 1,000 uncached input tokens and 1,000 output tokens costs $.014 at those settings. The grammar and approved catalogue add prompt tokens even when no new form is needed; larger catalogues add more. Creation adds proposal tokens, without an extra call fee or a second generation request. Actual configured-model usage/cost is recorded; unknown model pricing remains unknown. All implementation tests cost $0 in provider usage.

Storage is local development filesystem storage. Saving two candidates is not a filesystem transaction: a later storage failure can leave an unused experimental candidate, but it cannot partially replace the displayed property. No real candidate was approved during this implementation. The reuse evidence uses synthetic review fixtures in isolated temporary storage, which is removed afterward.

## Validation and browser evidence

- **200 tests passed across 21 files** covering villa libraries, creation, the villa/creation/visual-review endpoints and playground model/wing composition.
- `npx tsc --noEmit` passed.
- Targeted ESLint across all files changed for this integration and both evidence scripts passed.
- `git diff --check` passed.
- Real AI SDK tests use MockLanguageModelV3, forbid fetch, retain original responses, exercise the normal endpoint, persist candidates, recover assembled geometry and reject invalid soffit clearance without retries.
- Assembly tests cover approved reuse with no creation/save call, ordinary generation with no creation/library read, unsupported gaps, budgets, unknown builders, forged snapshots, fixed sites, derived grounds, collisions, editing, storage failure and nonblocking landscape drafts.
- Browser checks inspect the actual R3F scene: 702 meshes including one created sail, all finite, correct world position and 25°/35° orientations. Normal generation has no created component. Original Solana has 572 finite meshes. Browser API responses are intercepted; endpoint/SDK behavior is verified separately. No page errors or external requests occurred in the final browser run.

Actual browser screenshots:

- [Automatic generation and experimental status](automatic-created-status.png)
- [Created canopy in the house, poolside](automatic-created-poolside.png)
- [Full composition from above](automatic-created-above.png)
- [Approved version reused](approved-reuse.png)
- [Failed generation preserves the property](failure-preserves-property.png)
- [Ordinary generation without creation](normal-house-no-creation.png)
- [Experimental candidate in the optional Studio](experimental-candidate-review.png)
- [Original Solana preserved](solana-preserved.png)

[Browser assertions](browser-checks.json) and [offline generation fixtures](offline-fixtures.json) preserve the evidence. Reproduce with:

```sh
npx vite-node --config vitest.config.mts scripts/villa-automatic-evidence.ts
node scripts/villa-automatic-capture.mjs
```

The browser script expects the local development server at port 3000 and the existing local Playwright/Chrome installation used by the repository's capture scripts. It blocks external requests and intercepts all AI endpoints.

## One separately authorized live generation

After explicit authorization for one paid end-to-end test, start or use the existing development server and open `/dev/villa-playground`. Keep the existing key/model configuration. Use **Terra → New design**, enter “Design an extraordinary Caribbean estate with a new freestanding bronze sail canopy beside its garden terrace,” then click **Generate villa** once. No Component Studio step is required.

Inspect the returned property and experimental status. In the network response, verify `providerCalls: 1`, `componentStages`, `generationBudget`, usage/cost, and the pinned `config.createdComponents` entry. Confirm the matching experimental JSON in `.data/villa-component-candidates` and the stage manifest in `.data/villa-generations`. Terra's live creative choice and provider-schema acceptance remain unverified until this authorized test; it may honestly report a capability gap or choose existing builders. Do not submit again automatically if it fails. Human review and later approval are separate from this one generation.
