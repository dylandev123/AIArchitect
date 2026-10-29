# Offline two-stage architectural construction experiment

No live OpenAI requests. No automatic paid staging, project mutations, migrations, commits, deployment, new recipes or new geometry engine. Existing dirty workspace changes were retained.

## Finding

Two coordinated passes are practical through the existing `/api/ai/scene` contract: a `generate` request followed, only after inspection, by an `edit` request carrying the accepted scene. The offline fixture produces a visibly stronger main residence, chiefly because the composition was revised before detail work. This does **not** establish that two Terra calls reliably produce better architecture. The fixture operations were authored locally; browser API responses were intercepted. A detail-only pass cannot rescue a weak agreed massing without reopening composition.

## Latest retained house

Source: `.data/scene-responses/eb6a91b2-dc5d-497b-9296-8fa53f612978.json`, accepted October 28. The retained prompt is redacted; the $25m context is corroborated by Terra's retained scale rationale, not recovered original prompt text.

Terra explicitly chose a single-storey residence of approximately 390 m², investing the budget in spans and shade rather than storeys. Floor footprints total 392 m² before wall deductions. It built two identical 10 × 10 m wings flanking a 16 × 12 m salon. Wing walls are 3.4 m high, salon walls 4.4 m: only a 1 m difference, despite the description “double-height”. Five broad roof planes dominate the image. There are 47 editable elements and 12 wall openings; the private-wing elevations are mostly solid except for isolated windows. The veranda is coherent, but neither entrance nor main house has enough depth or hierarchy to support the luxury identity.

There is no evidence the executor simplified Terra's geometry: resolving the retained response constructs the authored scene. The valid-scene checks accept geometry and contact relationships; they do not establish architectural quality, adequate budget/programme, a true double-height room or convincing asymmetry. The original intent calls the arrangement asymmetric even though the two wings mirror one another. IDs in a knowledge declaration establish references, not successful architectural application.

The library's 301 entries were not all supplied to the model. This response selected 12, from only 21 eligible entries, using 14,180 characters of an 18,000-character budget. It included estate composition, tropical envelope, covered threshold, asymmetric balance, deep overhang and solid/glass balance. It did not retrieve specialist window rhythm, deep reveals, terrace access or more developed residential compositions. More catalogue entries alone would not fix a concept Terra deliberately defended. Its 34,057-character final system prompt already demanded coordinated construction within one response.

## Experiment and visual assessment

The retained case has three saved states: untouched live output, revised composition, and developed composition. The revised composition is an **offline edit of the retained house**, serving as a stage-one proxy, not a fresh Terra generation. It preserves ground programme, pavilion, veranda and pool, and makes the west wing an inhabited two-storey anchor with an inset upper floor and smaller roof. The tall salon receives missing high enclosure bands. The east wing stays low. This creates an actual change of silhouette, setback and spatial hierarchy; it is more consequential than adding windows.

Development subdivides wing elevations into actual opening-bearing bays, develops upper-suite enclosure, provides a real terrace doorway and sea-edge rail, composes a stone arrival portal, and reduces the salon roof thickness/overhang while separating mineral residential roofs from timber outdoor canopies. The roof slab and upper rooms have validated contact paths. The result reads more clearly as a stepped residence. Its broad salon roof remains visually dominant; the upper-suite interior stair, comprehensive terrace edge guarding, full room programme and navigable internal connections remain unresolved. This is an improved exterior study, not a completed $25m mansion. More floors alone do not define luxury; here the setback and unequal heights address this particular weak silhouette.

The stronger baseline is the existing 174-element courtyard mansion in `terra-basic-diagnosis/study.scene.json`. Its development pass clarifies the tall central salon with stone frames, adjusts its roof edge, and relocates its entrance into a correctly fitted unglazed opening instead of leaving a solid door over an unrelated glazed bay. The visual benefit is modest: the strong baseline already has hierarchy and abundant façade articulation. Its repeated glass bays still risk a hotel/office character. This is evidence for selective development, not an argument to automatically detail every scene.

Matched, unretouched canvas captures (1800 × 1200 browser viewport):

| Case | Arrival | Poolside | Aerial |
|---|---|---|---|
| Retained live | [Before](retained-original-arrival.png) | [Before](retained-original-poolside.png) | [Before](retained-original-aerial.png) |
| Composition revision | [Stage 1](retained-composition-arrival.png) | [Stage 1](retained-composition-poolside.png) | [Stage 1](retained-composition-aerial.png) |
| Developed residence | [Stage 2](retained-developed-arrival.png) | [Stage 2](retained-developed-poolside.png) | [Stage 2](retained-developed-aerial.png) |
| Stronger study | [Before](study-composition-arrival.png) | [Before](study-composition-poolside.png) | [Before](study-composition-aerial.png) |
| Developed study | [After](study-developed-arrival.png) | [After](study-developed-poolside.png) | [After](study-developed-aerial.png) |

Cameras are fixed per case and view, including target, position and field of view; no fit-to-bounds change between states. Study orientation is reversed relative to the retained residence. Full camera and renderer-ID records are in `browser-evidence.json`.

## Underused existing capabilities

Existing operations already support recessed upper floors, staggered volumes, independent roof sections, hip/gable alternatives where appropriate, supported terraces, real door openings, segmented façade bays, reveals/piers/lintels, slatted shade, material changes and hierarchical attachments. The live output uses few of these in a coordinated way. A pavilion's sophistication is encapsulated in an approved builder; it does not imply the main residence received comparable design development. There is no need for a second building engine.

## Stability and recovery

`two-stage-offline.ts` exercises the canonical resolver, schema, operations, relationship validation and scoped seed-library retrieval. Both developed scenes have zero relationship issues. It asserts unchanged elements remain equal, JSON round trips, atomic rollback on an unknown ID, and recoverable drafts for unsupported elevated geometry. Knowledge retrieval uses the checked-in seed entries, not the inaccessible connected library; it does not write library data. The first attempted library read failed DNS and was replaced with offline seed retrieval.

`two-stage-capture.mjs` uses the existing browser workspace and intercepts recorded edit results. It verifies actual edit application, logical ID preservation, renderer object stability except an intentionally reparented study door, Undo, reapplication, reload persistence and a failed response preserving the accepted scene while exposing a recoverable download. These run in an isolated browser profile; user project data is untouched. Existing scene and project persistence suites: 50 tests passed. TypeScript passes.

## API usage and bounded integration

The current route already supports generate/edit, scoped retrieval (normally 4 entries / 6,500 characters), retained responses, usage logging, 400 elements, 800 operations, 30,000 output tokens, no retries and a 170-second provider timeout. Development sends the complete current scene, so detail is not necessarily a cheap call. The prototype `src/lib/villa/scene/twoStage.ts` only prepares requests: it imports no provider, performs no network I/O, changes no UI and starts no automatic calls.

Observed original provider usage: 7,789 input + 6,137 output = 13,926 tokens, including 1,328 reasoning tokens. A second pass adds **one** call. With the current system prompt, scoped knowledge, schema and a 50–180-element scene, plan for roughly **9k–18k input and 3k–10k output tokens**; reasoning and full-scene size make this uncertain. The existing hard output ceiling is 30k, not the planning estimate. Latency can add up to another 170 seconds. There is no verified Terra dollar tariff in this experiment: additional cost is `(uncached input × input rate + cached input × cache rate + output × output rate) / 1,000,000`. Do not assume caching or that two passes cost exactly twice one pass. No live pricing lookup or billable experiment was performed.

One controlled live two-stage experiment is justified **as an evaluation**, with the same brief, one reviewed composition and at most one optional development call, no retries, no automatic chaining, and the same fixed camera rubric. Require a visibly convincing stage-one composition first; otherwise stop or explicitly revise composition. Include the brief's scale/climate in development scope because retrieval otherwise infers scale from the edit prompt rather than from scene geometry. Track actual tokens, latency, unsupported items and unchanged IDs. Judge silhouette, hierarchy, entrance legibility, enclosure, façade depth and roof proportions before component counts. Automatic paid staging is not justified by this authored demonstration and remains disabled.

## Reproduce

- `npx vite-node --config vitest.config.mts scripts/two-stage-offline.ts`
- With the existing local app at port 3000, `PLAYWRIGHT_CORE_PATH=/path/to/playwright-core node scripts/two-stage-capture.mjs`
- `npx vitest run src/lib/villa/scene src/store/__tests__/directScenePersistence.test.ts`

Capture code blocks external traffic and all unmocked AI requests. It does not need an API credential.
