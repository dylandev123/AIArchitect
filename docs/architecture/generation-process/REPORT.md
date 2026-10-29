# Normal Generate: root-cause audit and offline verification

Implemented 2026-10-28. No OpenAI calls, migrations, commits or deployment. Existing projects and the retained mansion were not repaired. No production templates, new engine, agent, database or generation route were added.

## Findings and source evidence

The real path is `src/app/page.tsx` handleGenerate → direct-scene project + pending brief → `src/components/scene/OperationStudio.tsx` generateInitial/askTerra → `/api/ai/scene` → `generationKnowledge` → one `generateText` response with intent and operations → `resolveSceneResult`/`applySceneOperations` → existing project versions and viewer. The legacy house/plan/villa routes and optional composition/development requests do not author normal homepage Generate.

Demonstrated disconnects:

- `propertyValue.ts` defined nine recipes as **proposed**, and `retrieval.ts` correctly selected approved entries only. Previous property-value studies explicitly simulated approval in memory. Stored quantity was not production availability. Reviewed these qualitative recipes against the supplied request and enabled repository guidance with explicit provenance and valuation limitations. Approval checks for other proposed, retired and superseded entries remain active. User-stored revisions still override seeds; an explicitly proposed/retired stored revision is not silently promoted.
- `seeds.ts` restricted `mediterranean-courtyard` to estate/mansion scales although its own applicability included explicitly requested courts. A `$1m Mediterranean courtyard villa` is family context and lost the defining recipe. Removed this inappropriate scale restriction.
- `retrieval.ts` assigned short family-context briefs five slots/6,500 characters regardless of regional/style needs. Generic category coverage could displace identity. Style/site briefs now use the existing medium tier (8/12,000); explicit compact briefs keep their original budget, and estates retain 12/18,000. The chosen value profile and strongest applicable identity recipe precede category filling. No random geometry choices, automatic area inflation or mandatory amenities were added.
- `compact-family` received a baseline boost even for a `$5m contemporary tropical residence` lacking compact/family intent. This boost now respects compact/family intent and explicit value context. Price does not assign floors or floor area.
- `OperationStudio.tsx` re-executed response operations without forwarding server `scene.knowledgeEvidence`. Selection/application evidence disappeared from saved geometry and subsequent edits. The browser now supplies that evidence to the same resolver; geometry, transaction checks and versioning remain authoritative.
- The retained genuine diagnostic response `0bd8551e-ebcf-4685-8ee0-5aed50e7bea6` contains 55 authored elements, no architecturalPlan, and a redacted original prompt. Offline replay proves resulting element geometry equals the retained add operations exactly. The executor did not reduce a sophisticated mansion into a bungalow. That artifact predates retained knowledge traces: historical retrieval and exact brief alignment cannot honestly be reconstructed. Many other retained responses are offline mocks; their existence is not evidence of independent Terra design.

## Connected systems and instructions

The canonical design guide, architectural brain (including composable fragments and construction metadata), planning intent, direct-scene executor, evidence review and non-mock reviewed lessons already met in the scene route. They were not blindly merged. Room planning for the legacy blueprint workflow is a distinct representation and was not introduced as a second mandatory AI stage. Existing Refine/Redesign/Complete Architecture remain optional, with their existing permissions.

The weak link was translation: descriptive plan fields did not explicitly bind scale/programme decisions to dimensions, coordinates, floor datums and built relationships. The existing intent instructions now ask for explicit requirements versus assumptions, primary/secondary proportions, actual dimensions/datums, privacy/service adjacency, entrance/level access, view assumptions, roof sections and facade depth. The operations must implement these same decisions. No new plan schema or parallel measurement ledger was introduced. Existing completion guidance supplies the coordinated construction sequence in the same response.

Removed duplicated knowledge/application prose from the system prompt to offset that change. The resulting base prompt is 19,880 characters. The capability disclaimer now distinguishes unsupported **automatic** stairs/interiors from supported manually composed rooms, treads and landings. Existing documentation exposes segmented wall openings, glazing/door placement, posts/beams/reveals from volumes, separate roof sections, flat/gable/hip roofs, terrace slabs/guards and pool basin parts. No geometry capability or support rule was weakened.

Construction safety budgets remain 400 elements and 800 operations; no minimum counts or forced floor/wing/roof templates were added. New Generate still omits terrain operations and stages at Y=0. This is a real hillside limitation, not evidence of forcing all buildings to one storey. Response geometry is otherwise executed as authored, subject to existing atomic checks. Intent/aesthetic incompleteness remains warnings rather than a new rigid rejection engine.

Future retained requests now include the actual composed `requestSystem`, selected recipes, explicit budget omissions, provider usage and raw model output. This closes a diagnostic gap without another model call. Retention uses the existing redaction and private artifact path. No historical artifacts were rewritten.

## Four offline studies and visual assessment

Run `npx vite-node --config vitest.config.mts scripts/generation-process-offline.ts`, then `node scripts/generation-process-capture.mjs` with the local dev server. The capture script supports `PLAYWRIGHT_CORE_PATH`; its default reuses the existing local browser installation used by repository captures.

These are **existing developer-authored studies**, replayed through production retrieval and execution. They are not new Terra responses, production presets, trained examples or evidence that the changed instructions will independently generate this geometry. Knowledge decisions were not fabricated to make the examples pass. Evidence records their unresolved findings.

| Brief | Actual study differences | Visual/functional limitations |
| --- | --- | --- |
| $250k compact modern family home | Compact single-storey footprint, separate bedroom/shared/service shells, simple flat roof | Still boxy; repetitive facade and weak arrival expression. Interior allocation/access needs review. |
| $1m Mediterranean courtyard villa | Inward court organization, larger perimeter arrangement, hip roof sections with flat sheltered court | Hip character and court differ from compact study, but exterior is blank and regional detailing is shallow. It is not a convincing finished Mediterranean villa. |
| $5m contemporary tropical residence | Broad stepped living/suite/service footprint, view-side sheltered terrace and pool assembly | Different spatial organization, but low roof articulation and weak arrival facade; luxury completeness is unproven. |
| $25m Caribbean waterfront mansion | Unequal stacked residential volumes, taller salon composition, colonnaded loggia, roof belvedere | Stronger vertical hierarchy, yet repeated glazing and broad roofs remain; manual level access and pool basin are incomplete. Not a finished $25m mansion. |

Eight browser screenshots use the same viewport and identical absolute camera position, target and field of view for each corresponding view. This preserves true scale comparison; the compact study consequently appears smaller. See `browser.json` for recorded cameras, no page errors, zero AI requests, and import/edit/undo/reload checks for all four scenes. The source geometry signatures differ in dimensions, placement, roof form and composition, not merely names or colors.

- [Compact arrival](compact-arrival.png), [aerial](compact-aerial.png)
- [Mediterranean arrival](mediterranean-arrival.png), [aerial](mediterranean-aerial.png)
- [Tropical arrival](tropical-arrival.png), [aerial](tropical-aerial.png)
- [Mansion arrival](mansion-arrival.png), [aerial](mansion-aerial.png)

## Verification and live readiness

Offline verification covers actual four-brief production endpoint requests with mocked provider output, relevant guidance in the actual composed request, one call each, retained exact instructions, geometry preservation, knowledge evidence, retrieval exclusions/budgets, existing executor/relationships, persistence and undo. Final verification: all 137 tests across 21 targeted files passed. TypeScript and ESLint checks on changed implementation files and the offline evidence script passed. Browser verification recorded zero AI requests and no page errors.

The offline work fixes demonstrated process defects but **does not prove that autonomous first-pass visual quality has improved**. A controlled paid homepage Generate is justified as the next measurement, not performed or automatically scheduled. Start with the original $25m Caribbean waterfront brief, retain its full request/response and compare actual arrival, view-side and aerial geometry against scale, identity, programme, access, roof hierarchy and completeness. No automatic repair or second paid call should mask that result. The four-brief live comparison remains unverified.

Remaining engine limits: rectangular editable primitives except the pinned curved pavilion, flat/gable/hip roofs, five material finishes, flat new-generation ground, no arbitrary arches/CSG, automatic interior/stair builder, engineering/services/hydraulics or certified navigability. Support checks verify contact relationships, not aesthetic quality. Modelling a door or listing a suite does not prove a usable complete house.
