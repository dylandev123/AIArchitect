# Terra architectural intelligence — offline implementation audit

2026-10-26. Zero live OpenAI calls. No V3 changes, migrations, commits or deployment. Existing uncommitted work was preserved.

## Root causes and changes

The investigation followed `image-first`, `image-vision`, retained image responses, `resolveVillaResult`, composition validation, wing and footprint renderers, Visual Review, component candidates and saved design snapshots. It also examined the retained estate and Solana arrival captures. The earlier [fidelity audit](../image-fidelity/REPORT.md) remains relevant: dimensions and placements were generally preserved through validation; the interpretation itself contained contradictory material choices, missing opening evidence and ambiguous orientation. Valid geometry alone was not the principal quality issue.

* **Builder defaults erased specificity.** A single observed short-wall window became repeated window bays, shutters and an automatic entrance. Wings now accept optional `facadeOpenings` for a named face/storey. Footprint levels accept `preciseOpenings` on original straight edges. Both reuse one `PreciseFacade` renderer with real masonry cutouts, individually sized glazing or timber doors, jambs, heads and sill frames. Unspecified wing faces retain existing behavior and must not be represented as observed evidence.
* **Roof proportions were style constants.** Pitched wings now have optional `roofRise` in metres above eaves, alongside existing eaves. Existing defaults remain unchanged. This enables estimated/intentional roof proportions; it does not solve roof junctions or prove an image's pitch.
* **Visual Review lacked the target image.** Image-first pages carry the retained concept into the existing review request as a separately labelled fourth image. The review instructions compare visible composition, proportions, openings, entrance, roof, materials and patio relationships with the reference and original brief. The source image remains subject to the existing retained-image hash check.
* **A proposal could be accepted without captured evidence of its result.** The review UI now captures all three proposed views using baseline camera poses before offering acceptance. It retains the existing scoped executor, stale-design checks and side-by-side previews. A specific visual judgment is required to save acceptance/rejection. It can also discard an experiment without saving a lesson.
* **Review forced criticism and spending.** A review can now return no supported improvement and skip the edit call. An evaluation remains bounded to one review and at most one edit, no retries. Paid controls remain opt-in. No provider was invoked in this work.
* **Reviewed outcomes were disconnected from later requests.** Immutable reviewed lessons now persist alongside existing local component-candidate storage. Small relevant summaries enter future Terra generation and the saved-image interpreter's explicitly authorized live path. Captures and full house geometry are retained for audit, not sent repeatedly or copied as templates.

The retained estate's long, uniform rows illustrate why more volumes and amenities do not automatically create residential character. Solana's unequal volumes, solid/glass contrast and material hierarchy are useful comparison principles, not a house to hardcode. This implementation supplies better control and feedback; it does not claim that prompting alone has cured the estate's design weaknesses.

## Architectural contract and compatibility

All additions are optional fields in existing version-1 configurations. Existing saved designs, Solana, component snapshots, atomic wing adjustments and form puts remain valid. No new house style, model-written code or generation-template collection was introduced.

* Wing groups select `face`, zero-based `level`, and `openings`. Each opening has stable `id`, `offset`, `width`, `sill`, `height`, `kind` and `frame`. Offset follows that outward-facing facade's local horizontal axis from its left endpoint. A selected empty group makes that face solid. Other faces are unchanged.
* Footprint openings add `edge`, the original outgoing straight-edge index. Offsets follow its point order. Level-specific arrays are independent. Explicit non-solid facade sections retain their existing loggia/screen/entrance treatments; precise openings cannot overlap those treatments on the same edge. Only edges with named openings are overridden. Every other edge, including curved edges, keeps its existing treatment. This was corrected after visual inspection of the first offline experiment exposed an overly broad override.
* Openings require corner/header clearance, masonry separation and valid door thresholds/heights. Connected wing faces reject this override rather than clipping or approximating gallery cutouts. Legacy stacks reject it because their edge order is derived; use architectural levels for independent per-level placement.
* A residence has a combined budget of 128 precise openings, in addition to existing geometry budgets. Roof rise is bounded and rejects flat roofs.
* The existing composition editor exposes dimensions for present individual wing openings and roof rise. Existing editor operations preserve the added fields. Adding or changing topology remains available through the existing declarative Terra/patch contracts.

## Actual browser comparisons

The browser script blocks every `/api/ai/` and external request. These captures are browser-rendered geometry, not generated pictures. Before/after pairs use the same viewport, daylight and baseline camera pose; mesh-bound auto-framing is explicitly overridden for the after capture.

| Case | Before | After | What this establishes |
| --- | --- | --- | --- |
| Retained concept, poolside | [Before](reference-window-before-poolside.png) | [After](reference-window-after-poolside.png) | A manual evidence-guided edit replaces repeated short-wall bays with one framed window and corrects pale render/simple glazing. The visible window count and finish are closer to the actual [source](../../../public/inspiration/villa.jpg). Dimensions/placement are estimates, not recovered measurements. |
| Angular residence, arrival | [Before](angular-volumes-before-arrival.png) | [After](angular-volumes-after-arrival.png) | Existing angular outlines, upper volumes and view-side articulation remain editable while explicit entrance/private-window positions replace a procedural arrival treatment. No concept reference exists for this case: it tests control and compatibility, not image fidelity or proven beauty. |
| Branching levels, arrival | [Before](branching-levels-before-arrival.png) | [After](branching-levels-after-arrival.png) | Independent opening placement in an existing multi-level support graph. No source image or architectural-quality score is claimed. |

Final browser run: 18 captures across three before/after pairs and three views, no page errors, no attempted AI/external requests, and zero provider calls. The mock review/rejection workflow saved both three-view capture sets with matched cameras and retained the current original. Both locally saved mock rejections are excluded from generation retrieval.

Each case also has aerial and poolside captures. See [offline inputs and exact configuration changes](offline-manifest.json) and [browser checks](browser-checks.json). These are private deterministic development experiments, not generation presets or approved learning examples.

The source comparison still shows conspicuous mismatches: the long elevation remains overly repetitive, source camera/orientation and apparent proportions differ, the patio remains at the interpreted end rather than a reliably reconstructed side relationship, and timber wall-edge detailing is missing. The new near-window control is a real, limited improvement. It is not a faithful reconstruction of the whole concept. No roof/patio coordinate correction was invented to conceal uncertainty.

## Persistent learning

`POST /api/dev/villa-design-lessons` is development-only, same-origin and makes no provider calls. Records live under `.data/villa-design-lessons/` using exclusive creation; existing design files and prior records are never overwritten. Each stores:

* original brief, accepted/rejected visual judgment and specific feedback;
* full original and proposed configurations, including pinned component snapshots;
* three before and three after captures with matching view names and camera poses;
* concept source and actual image bytes when available;
* origin `terra` or `mock`, plus immutable record ID and timestamp.

Validation rejects unchanged snapshots, invalid compositions, missing viewpoints, unsupported capture dimensions and mismatched cameras. A saved verdict is explicitly a user's visual judgment, not structural certification or an objective learned quality score. No unreviewed historical design is silently promoted. Failed provider responses remain in the existing retention/recovery system; this does not automatically turn their speculative explanations into proven lessons.

Retrieval reads at most the latest 200 small validated summary files, ranks overlap between the new brief and saved briefs/feedback, requires relevance and sends at most three summaries. It includes failure lessons as well as improvements, marks whether a reference was compared, and sends field paths and principles rather than house geometry. Mock records are excluded. Future image interpretation uses a generic reconstruction query because its existing CLI has no original-brief input; brief-specific text generations have more precise retrieval. This is application-level retrieval, not retraining.

Storage failures leave the original current design intact. Full evidence survives a summary-write failure for manual recovery; there is no automatic paid retry. Rejections preserve the original and retain the failed proposal. Existing component approval/export requirements remain separate and unchanged.

## Verification and remaining limits

Offline unit/integration suite: **250 tests across 29 files passed**, covering Villa contracts/builders, image replay/evidence, immutable staging, review bounds, provider-mocked routes, individual openings and learning validation/relevance. TypeScript passed. Focused ESLint passed for the changed implementation and evidence scripts.

Not yet verified: new live vision output, live use of roof/opening controls, AI recognition of the largest mismatch, live review/edit quality, improvement across novel concepts, retrieval improving future architecture, or user-reviewed successful lessons. A deterministic rejection is an audit of workflow behavior, not an architectural success.

Still unsupported or approximate: hidden geometry and measured scale from a single image; dependable rooms, stairs, privacy/circulation plans or structural engineering; arbitrary sloping/curved roof junctions; curved-edge individual openings; precise openings on connected wing walls; complete trim/material palettes; exact patio geometry/materials; and automatic pixel-based similarity scoring. The review executor deliberately restricts edits to an existing component/field group and preserves collection sizes/identities, so some large compositional revisions require an explicit ordinary edit rather than this narrow review experiment.

Reproduce offline with:

```sh
npx vite-node --config vitest.config.mts scripts/terra-intelligence-offline.ts
node scripts/terra-intelligence-capture.mjs
npx vitest run src/lib/villa src/app/api/ai/villa
npx tsc --noEmit
```

The browser script uses the same local Chrome/Playwright installation as the existing capture scripts. Stop after offline validation. A separately authorized live test can assess one retained-reference interpretation, or one opt-in review and at most one targeted edit. Its output must be retained, rendered and compared before any success is claimed.
