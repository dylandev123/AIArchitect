# Direct-scene detail utilization audit

Scope: `/api/ai/scene`, its provider contract, primitive renderer and atomic executor. Offline only. No new builders, templates, planning gates, staged provider pipeline, saved-design changes or budget increases.

## Findings

The evidence supports under-authoring, not a 50–70-element runtime ceiling. It does not prove the model's internal motivation or that a prompt change will improve future live outputs.

| Evidence | Elements / operations | Construction evidence | Current offline result |
| --- | --- | --- | --- |
| Retained `437d25b1-ff69-462c-ab34-a8deb7861c67` | 50 / 70 (50 add, 20 place-on) | 24 walls, 18 openings, 7 roofs, 4 glazing, 2 screens, 1 door | Accepted unchanged through current executor, 19 architectural warnings |
| Retained `0bd8551e-ebcf-4685-8ee0-5aed50e7bea6` | 55 / 55 | 21 walls, 14 openings, 7 roofs, 6 solids, 1 door; includes pavilion and grounds | Accepted; all emitted elements preserved |
| Existing manually authored courtyard study | 174 / 174 | 70 walls/openings, 72 solids, 10 roofs, 14 plates | Provider schema and relationship checks accept all parts |
| Retained `ed0d5d1e-a7f5-4e39-99b3-d203f5b63393` | 67 / 67 | Two terrace railings fail deck alignment/span checks | Still rejected atomically, recoverable draft available |

For the 50-element response, parsed raw-response operations equal retained structured operations after schema defaults. Its historical rejection names inaccurate area, missing plan IDs and mismatched commitments, rather than missing engine support. The current warning-only planning path already resolves that historical restriction; this task did not add it. The 55-element artifact has no rawResponse, so its evidence is the retained structured output and exact replay. Do not interpret all retained artifacts as independent live generations: the directory also contains repeated 78-element fixtures and one-element rejection probes.

`docs/villa-playground/terra-basic-diagnosis/scene-usage.json` records normal stop at 5,970 and 3,005 output tokens against 30,000 allowed (66s and 29s respectively). The artifact does not link response IDs to usage rows. These records support substantial unused output allowance; they do not establish timing/token usage for every retained response. The route uses 30,000 tokens, zero retries, a 170-second abort and one provider call. Raising tokens is not supported by this evidence. The timeout can constrain future longer responses, but the recorded calls did not exhaust it.

## Actual restrictions versus perceived restrictions

- `scene/model.ts`: 400 final elements, 800 operations, 40 panels, finite bounded dimensions, one rectangular opening per wall. Multiple wall segments permit multiple independent windows/doors on any elevation. No minimum count or facade-bay quota exists.
- `scene/terra.ts`: provider operations use the same union as execution. Every kind and operation is exposed, including place-on, replace, attach and terrain edits. Current intent is descriptive; the legacy detailed plan remains accepted for compatibility. No plan warning vetoes valid construction.
- `scene/relationships.ts`: grounded contact for elevated plates; full railing span at deck level; thin glazing/rail depth; wall-parallel attached screens/glazing; correct screen axes. These constrain invalid relationships, not architectural richness. Attachment alone supplies transforms, not support. Edits preserve unchanged pre-existing faults while preventing new ones.
- `scene/model.ts`: attachments must exist and be acyclic, IDs unique, openings fit walls, pitched roofs have adequate rise. Atomic failures do not silently discard individual detailed parts. New generation filters terrain intentionally and requires ground contact; edits/load preserve existing terrain.
- `components/scene/OperationScene.tsx`: openings already build jamb/head/sill solids, optional glass and panel framing; roofs include soffits; entrance includes a handle. Element counts understate rendered mesh detail. A balcony is glass railing, not a deck; volume is a rectangular solid, not a furnished/enclosed house.
- The provider schema repeats element shapes across add/replace and accepts both intent and legacy plans. This adds response/schema complexity, but no retained evidence ties it to a count ceiling. Earlier tuple-schema rejection is a real historical provider failure, already fixed by homogeneous fixed-length arrays. No new schema abstraction or format change is warranted here.

The prompt did not ask Terra to minimize elements. It already asked for quality and all elevations. However, capability names did not fully explain that `volume` supplies columns, beams, lintels, fins and trim, or how to build independently editable window/door assemblies. The brief can be superficially satisfied by broad glazed openings, few roof slabs and a descriptive summary. This is an authoring-guidance gap; validator compliance is not a guarantee of architectural completeness.

## Targeted change

Added a component-utilization section to `scene/terra.ts` explaining:

- Independent facade bays, individual glazed openings and separately editable glazing; centre coordinates, automatic framing and avoidance of duplicate glass.
- Actual door openings and door children, sidelights, thresholds, recessed returns, portal piers/lintels and sheltered approach.
- Columns, posts, beams, fins, sills, reveals, cornices and parapets assembled from existing solids.
- Multiple coordinated roof sections, setbacks, canopies, soffits and the difference between flat and pitched overhang semantics.
- Supported balcony decks with separate rails, loggias, terrace doors, vertical screens and individually authored horizontal pergola members.
- Coordinated design passes within the existing single response, followed by checking omissions against the brief. Concise intent leaves detail in geometry. Hundreds of justified parts are allowed; no minimum, filler decoration or compulsory house layout.

No validator, schema shape, operation, engine budget, renderer, edit path, persistence or undo implementation changed. No unsupported component has been advertised as available.

## What the study proves—and does not

Compared with the failed 50-element mansion, the study demonstrates room for many more separate glazed bays (70 versus 18), piers/fins/posts/beams (72 volume solids versus none), additional coordinated roof sections (10 versus 7), stepped residential wings and a supported roof belvedere. Its 16.05m maximum architectural height also exceeds the 55-element house's 6.925m; no two-storey rule caused that simplification. These are available construction choices, not a required replacement layout.

The study is a hand-authored capability control, not evidence of Terra's improved output quality. It also is not a completed mansion: its pool lacks a basin bottom, and circulation/enclosure completeness needs review. It should not become a production template or quality benchmark based on count alone. Individually placed doors, balconies and shading are additionally exercised by existing scene integration/relationship tests.

## Remaining inaccessible capabilities

The direct-scene contract exposes only the approved pavilion among versioned whole-component builders. `component-registry.ts` also lists footprint-building, rotated-detached-wing and estate-landscape for the separate villa configuration pipeline; their parameters/geometry are not represented by direct-scene elements and the direct renderer has no adapter for them. Their registry availability does not mean they are direct-scene operations. Integrating them would require schema/renderer/relationship work beyond explaining existing primitives, and would introduce builders into this scoped task. They remain inaccessible here.

Other limits remain: arbitrary curved/polygonal solids and CSG, curved roofs outside the pavilion, pitched forms beyond gable/hip, true sloping/rotated-about-X/Z parts, automatic stairs/room layouts/interiors, custom materials, and structural/code analysis. Rectangular step treads, furniture-like solids and horizontal pergola members can be manually composed; there is no semantic stair generator or automatic navigability guarantee. New generation remains flat-site only. Pavilion subparts are not independently editable.

## Coordinated stages

A future multi-response construction sequence could materially help complex briefs by allowing each facade/detail pass to inspect actual accepted massing and use smaller local coordinate contexts. It could also avoid making intent, support, openings and all detailing compete for attention in one response. This is a plausible quality benefit, not demonstrated by these offline mocks, and additional calls may cost more or fail inconsistently. More tokens alone do not address premature normal completion. Staging is not required to execute the 174-part study. This change keeps the one-response atomic transaction and teaches coordinated passes within it; no stage orchestration was introduced.

## Verification

- `npx vite-node --config vitest.config.mts scripts/direct-scene-detail-audit.ts`: actual retained-response replay and existing study comparison, zero provider calls. This local audit requires the retained `.data/scene-responses` files and prints only metrics/diagnostics, not briefs or raw responses.
- `npx vitest run src/app/api/ai/scene/route.test.ts src/lib/villa/scene src/store/__tests__/directScenePersistence.test.ts`: 12 files, 66 tests pass. Includes updated instructions reaching the mocked provider, 174 unchanged study elements through the real output schema/API, every element kind/operation in the provider wire schema, every operation executed through a mocked edit request, and existing edit, failure, undo/redo, persistence and renderer regressions. New detailed-scene mock forbids network calls.
- Targeted ESLint on changed TypeScript files.

Offline verification proves availability and preservation, not that the model will choose a richer design on its next live call. No live OpenAI calls were made.
