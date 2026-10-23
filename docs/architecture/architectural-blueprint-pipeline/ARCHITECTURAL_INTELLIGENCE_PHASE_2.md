# Architectural intelligence — Phase 2

October 21, 2026 · America/St_Lucia

**Implemented a practical one-response architectural process, advisory floor-planning review and five-example offline verification. Exact approved geometry survives 2D drawing, save/reload, exterior handoff and V3 construction. Natural Terra design quality remains untested. NO-GO for a paid evaluation while the earlier HTTP 429 remains unresolved.**

This task builds on the working Phase 1 implementation. The repository already contained extensive uncommitted changes, including expressive geometry, recovery, authoring and earlier design guidance. Those are preserved; they are not all Phase 2 changes. No live Terra/OpenAI calls, new keys, credential-file changes, new AI agents, commits, pushes, deployment, V2 or advanced-terrain changes occurred. Isolated test processes use synthetic transport credentials only. Existing saved user projects and the usage database were not accessed or changed.

## 1. Files changed for this task

| File | Phase 2 change |
| --- | --- |
| `src/lib/v3/architecturalDesignGuidance.ts` | Organizes the existing shared one-response guidance into A–D; adds actual entrance contact, useful shared-edge access, circulation widths and explicit review of ambition against geometry. |
| `src/lib/v3/architecturalBlueprintGeneration.ts` | Corrects the full-property prompt's outdoor/route capability descriptions to include fountains, shaped surfaces and exact line/arc routes already implemented in Phase 1. |
| `src/lib/v3/architecturalPlanAuthoring.ts` | Describes the existing adjacency field as conceptual same-floor access with a useful geometric shared edge. No new mandatory schema fields. |
| `src/lib/v3/architecturalPlanReview.ts` | New pure review projection: objective observations, potential-access graph and separate unscored architectural review questions. |
| `src/lib/v3/architecturalPlanFirst.ts` | Runs the read-only review after existing acceptance and stores `metadata.planQualityReview`; new findings are advisory and do not authorize edits or alter acceptance. |
| `src/components/workspace/viewport/ArchitecturalFloorPlan.tsx` | Draws clearer solid conceptual room boundaries in 2D evaluation mode. They remain labeled conceptual zones. |
| `src/components/workspace/viewport/PlanEvaluationControls.tsx` | Shows current checkout findings after local edits and a compact architecture-review disclosure before approval. No workflow redesign. |
| `src/lib/v3/parity/architecturalIntelligence.ts` | Offline-only five-brief suite: reuses two independent Phase 1 capability references and adds three separately authored smaller layouts. Never used as generation templates. |
| `src/lib/v3/__tests__/architecturalPlanReview.test.ts` | Negative and correction cases for connected/isolated rooms, short shared edges, real/rotated entrance contact, missing landings, partitions/doors and narrow circulation. |
| `src/app/api/ai/plan/route.architecturalIntelligence.test.ts` | Extends existing real-SDK/offline-transport coverage to all five briefs, raw-response retention, saved-plan checkout and exact later construction. |
| `scripts/architectural-intelligence-phase2-evidence.ts` | Reproducible schema → real Planning Studio drawing → disk save/reload → exterior → V3 proof with network forbidden. |
| `scripts/architectural-intelligence-phase2-capture.mjs` | Isolated production-browser verification for all five saved blueprints and constructed scenes; blocks external requests and API writes. |
| This report and `phase-2/` | Evidence, drawings, response fixtures, isolated saved/constructed roots, test summaries, screenshots and the prepared unexecuted live evaluation. |

See [task change manifest](phase-2/change-manifest.json). Changes are measured against the working files at this task's start, not against an assumed clean Git checkout.

## 2. Terra's actual design process and execution strategy

The existing **Design 2D Plan** route sends `planEvaluationPrompt()` and the user brief to the existing Terra model. The prompt contains the compact authoring schema. The installed SDK serializes the prompt as a developer message and requests JSON mode; application Zod validation enforces the contract after receipt. There is one initial request, 10,000 output tokens, `maxRetries:0`, a 270-second abort and a 300-second route duration. No new reasoning/model settings or rollout flags were introduced.

The four logical stages occur within that response:

1. **A — Concept and estate composition.** Interpret explicit constraints, budget, site, climate, style and creative freedom. Choose a spatial idea; compose arrival, volumes, views, privacy and outdoor spaces before packing rooms. Identify assumptions instead of inventing surveyed facts. Budget guides ambition; no cost estimator exists.
2. **B — Floor planning.** Establish entrance/circulation first; place public, private, guest and service zones within the actual shell. Use useful shared boundaries, sensible proportions, outdoor access, aligned stair/landing reservations and deliberate storey relationships. Keep courts outside rooms and ground-only volumes ground-only.
3. **C — Architectural review.** Walk the proposed arrival and interior/outdoor sequence; compare the actual geometry with the brief's ambition. Correct weak proportions, connections, privacy, views and climate response before returning the document. Valid JSON or a generic rectangle is not evidence of exceptional architecture.
4. **D — Authoritative blueprint.** Emit one coherent plan. Expand omitted bookkeeping once into the existing V3 semantics; save those semantics as the editable geometry authority. Later exterior development must preserve them.

These are practical **instructions**, not four instrumented model stages or proof of private model reasoning. The model's within-response review is not independently observable. The local review runs after receipt; it exposes findings to the user and does not ask the provider to repair or critique the response automatically.

One call is the simplest effective baseline: the current contract can express a complete estate and conceptual floor plan, and the offline examples demonstrate its handoff without splitting composition from rooms. There is no demonstrated natural-response evidence that extra design calls improve quality. No additional composition, floor-planning or aesthetic review calls are added. If later natural evaluations expose a repeatable specific weakness, propose a bounded same-agent revision against the same plan, including cost, before implementing it.

**Build in 3D remains the existing separately initiated exterior call after the user approves 2D.** It develops the current saved plan; it is not another initial-design stage. Offline tests mock this later call as well. No live exterior development was performed.

## 3. Supported architectural capabilities

The active compact prompt/schema expose rectangles, articulated recesses/projections/notches/chamfers and connected line/arc building outlines. L/U/H compositions and connected rectilinear wings remain available; multi-storey hosts and supported ground/upper operations retain their semantics. A single outline has no holes; enclosed courts need supported connected wings. A `connects` relationship does not cut an entrance through a wall.

Driveways and paths support segmented waypoints and exact continuous world-space line/arc centrelines. Circular motor courts, circular fountain basins with jets and shaped terraces, gardens, pools, paths and driveway surfaces use the Phase 1 builders. Basins cut islands from intersecting paving. Exact route endpoint contacts and rotation remain authoritative. The full-property prompt now describes these capabilities consistently with the compact route and provider schema.

The brief determines whether expressive geometry or an amenity is appropriate. No fountain, pool, courtyard, curve, wing count, style or mansion layout is mandatory. The compact example intentionally remains a simple rectangle. The independent fixtures are never sent as examples or imported by runtime generation.

## 4. Floor-planning improvements

Inspection confirms that room rectangles can form credible **conceptual** layouts inside articulated shells when they follow the wings, share usable edges and reserve circulation. The U estate and H residence contain distinct, nonoverlapping room zones, galleries and stacked landings. Smaller examples exercise a simple rectangle, a veranda layout and an L-shaped writer's home. Existing audits continue checking rooms against the actual shell, not just its bounding envelope.

The smallest justified improvement is guidance plus a read-only access analysis; no polygonal-room contract or CAD rewrite was necessary for these cases. The adjacency schema now explains its geometric meaning. Prompt guidance asks for entrance halls that meet real door contacts and for an aligned stair hall on every served floor. The 2D renderer draws legible conceptual boundaries, while detailed partitions and doors remain deferred.

The new review:

- Derives possible same-floor edges only from nonoverlapping rectangles sharing at least **0.8m** and having usable spans. A corner or a gap cannot connect rooms.
- Honors authored blocking partitions and fitting door widths/offsets when present. Without detailed partitions, a geometric edge remains only a **potential** connection.
- Resolves actual ground-entry contacts on rectangular, articulated or outline hosts, transforms them into the host's local frame and checks contact with a room edge. A `serves` label alone cannot establish access. Narrow addressed entries are reported.
- Links floors through a complete circulation reservation contained in a room zone on each adjacent served level. Missing landings are reported; a lift does not certify a good stair plan or replace later flight checks.
- Reports rooms lacking a potential entrance path and circulation zones narrower than **0.9m**.

The 0.8m/0.9m values are transparent schematic review thresholds, not regulations or accessibility guarantees. Rooms can intentionally leave unallocated circulation or curved perimeter space; the review reports that access as unverified rather than inventing it. No coordinate is changed. Local corrections trigger a fresh checkout/review; stored review metadata never governs acceptance.

## 5. Quality-review mechanism

**Objective checks** combine existing shell, overlap, entrance, route, level and circulation findings with `PLAN_NARROW_CIRCULATION`, `PLAN_ADJACENCY_PASSAGE`, `PLAN_ENTRY_NARROW`, `PLAN_ENTRY_ROOM_GAP`, `PLAN_ENTRY_ROOM_MISMATCH`, `PLAN_STAIR_LANDING_ZONE` and `PLAN_ROOM_ACCESS_UNVERIFIED`. Target IDs and explanations make findings actionable. The new observations are advisory and appear in the existing diagnostics panel. Existing construction blockers and recoverable-draft policies remain in force.

**Architectural judgment** is separate: `architecturalJudgment.status` is always `requires-design-review`, with questions about composition/proportion, arrival, room relationships, privacy, climate/views, storey coherence, style and ambition. The Planning Studio exposes those same questions. There is no aesthetic score, amenity quota or automatic excellence label. A valid rectangular plan can be appropriate; an unconvincing composition remains unconvincing even with no objective findings.

This mechanism helps inspect and revise the same drawing. It cannot independently judge elegance or guarantee that Terra followed the review instruction. It also does not turn conceptual adjacency into constructed doors or certify a walkable finished house.

## 6. End-to-end offline evidence

All responses are hand-authored mocks. The first two examples reuse independent Phase 1 capability references; the other three are new layouts. **None is a natural Terra response, and none proves improved Terra creativity.**

| Brief/example | Distinct layout | Rooms | Emitted primitives | Save/reload + exact construction |
| --- | --- | ---: | ---: | --- |
| [Luxury Caribbean estate](phase-2/caribbean-estate-master.svg) | Two-storey U residence, low guest pavilion, curved arrival, fountain court, shaped garden/terrace/pool | 45 | 216 | PASS |
| [Multi-storey wings](phase-2/multi-storey-wings-floor-0.svg) | Two-storey H residence with aligned stair bridge/galleries and separate ground-only library wing | 23 | 117 | PASS |
| [Compact home](phase-2/compact-home-floor-0.svg) | Simple 10×8m shell, entry hall, living, bedroom, kitchen, bath | 5 | 29 | PASS |
| [Requested Caribbean vernacular style](phase-2/specific-style-floor-0.svg) | Veranda gallery, separate private/service sides; pitched metal roof and host-derived shade in the mocked exterior | 6 | 22 | PASS |
| [Creative writer's brief](phase-2/creative-freedom-floor-0.svg) | L-shaped line outline framing a pocket garden, reading studio and private wing | 6 | 28 | PASS |

For each example, the script validates the **advertised compact provider schema**, expands into the real production authoring contract, draws using the actual `ArchitecturalFloorPlan` React component, writes/reads an isolated saved V3 root, checks out the current plan, merges a mocked exterior by identity and constructs through `planV3ArchitecturalBlueprint`/`constructV3ArchitecturalBlueprint`. All five return complete construction; `sameArchitecturalPlan` is true and construction-fidelity findings are empty. No room overlaps/outside-shell findings or unresolved plan objects occur in these controls. New access observations are empty for these deliberately connected layouts; that is not a subjective quality pass.

Separately, the real `POST /api/ai/plan` handlers, production model factory and AI SDK parse provider-shaped responses through an entirely mocked transport. Tests verify one initial request, the actual developer/user prompt, response text retention, the saved-plan round trip, the original brief and exact later 3D geometry. The later exterior request is a separate mocked request, matching the existing approval boundary.

An optimized isolated **production build** was opened in a fresh headless Chrome context. All five saved plans rendered in the actual Planning Studio, survived reload without changing geometry or version history, and their constructed scenes mounted in WebGL. The browser blocked external requests and API writes; it accessed no existing browser projects. There were no page errors or forbidden requests. [Browser proof and 17 screenshots](phase-2/ui/checks.json), [machine pipeline proof](phase-2/checks.json), [compact UI review example](phase-2/ui/compact-home-floor-0.png), [constructed style example](phase-2/ui/specific-style-constructed.png).

The production build used an isolated source copy, cached local font data and a transport guard; no environment files or real credentials were copied. Localhost/browser process permissions were needed after sandbox restrictions; external provider transport remained blocked. Generated disk roots and fresh browser storage are test artifacts, not edits to saved user projects.

## 7. Remaining technical and creative limitations

- Rooms and partition derivation remain rectangular. Curved shells can leave perimeter space not represented by room zones; the review does not clip rooms, draw curved partitions or invent circulation. Detailed interior walls, door scheduling, furniture and decoration are outside this phase.
- Potential access is a conservative conceptual graph, not a path planner. It cannot establish clearance around furniture, a travel distance, privacy, usable door swings, headroom, facade-to-room daylight or an actual built passage. Unknown program labels remain valid; width classification uses familiar circulation words, not a closed program vocabulary.
- Stair reservations can be accepted conceptually and still fail later flight-fit/headroom/approach construction checks. A containing room zone does not certify an accessible landing. Structural alignment, wet/service stacking, views and climate response require architectural judgment beyond the existing geometric checks.
- Outline holes, splines, overlapping curved mass unions, arbitrary independent storey polygons and nonrectangular standalone canopies remain unsupported. Narrow/folded basin/perimeter offsets can fail; curves use existing shared sampling tolerances.
- A test initially placed a route beneath a standalone canopy. The existing route audit treats its envelope as a solid obstacle. The final veranda control uses already-supported host-relative shade instead. That construction limitation is documented, not bypassed by relaxing route safety or changing the renderer.
- Landscaping zones are schematic surfaces; vegetation scatter is presentation behavior, not a fully authored horticultural plan. No measured climate, survey, structural engineering or construction-cost model exists. Budget and “extraordinary” language are not verified performance claims.
- Mock exteriors intentionally use minimal finishes/openings to test handoff. Their schematic elevations are not finished architectural proposals; the estate reference has generously scaled room allocations that require actual architectural judgment. Successful V3 geometry is not a luxury-quality endorsement.
- Prompt self-review remains unobserved. No natural response generated under these revised instructions exists from this task, so creative improvement remains an empirical question.
- The broader suite has three pre-existing failures, reproduced in the starting-code copy; they are detailed below rather than hidden or relabeled as passes.

## 8. Test results and reproducibility

[Verification summary](phase-2/verification.json) records commands, results and starting-code comparisons. The focused production-route, authoring, review, recovery, handoff, client and persistence selection passes **121/121 tests across 13 test files**. TypeScript, focused ESLint, `git diff --check`, the isolated optimized Next.js build, the five-example evidence script and the five-example production browser verification pass.

The initial unconstrained full-suite run also encountered three timing failures near the default timeout under high concurrency. The failed subset rerun with two workers passes all timeout cases and reproduces only these three assertion failures, which also fail in the isolated starting-code copy:

1. `productionRouteDiagnostics.test.ts`: expects a fallback-render warning for a malformed route, although the current route type remains recognized; invalid estate schema is still reported.
2. `supportCapabilities.test.ts`: a historical deterministic-support type list omits Phase 1's fountain capability.
3. `terraFreedomAudit.test.ts`: expects 16 specialized/14 generic objects; fountain support yields 17/13.

Those tests and underlying Phase 1 behavior were not rewritten to make Phase 2 appear green. The constrained full suite reports **2,478 passed, 3 failed, 3 skipped across 206 test files**; its three failures match the starting code. Final seam-tolerance and legacy `serves` refinements were subsequently verified by the final 121-test focused run and rebuilt production app. Exact run scope is recorded in the verification artifact. Do not interpret “focused PASS” as a clean whole-repository suite.

Reproduction commands from the repository:

```sh
npx vite-node --config vitest.config.mts scripts/architectural-intelligence-phase2-evidence.ts
npx vitest run --maxWorkers=2 src/app/api/ai/plan/route.architecturalIntelligence.test.ts src/lib/v3/__tests__/architecturalPlanReview.test.ts
npx tsc --noEmit
git diff --check
```

The browser capture script expects an isolated local build and an installed Playwright-compatible module/Chromium executable supplied through `PLAYWRIGHT_MODULE`, `CHROMIUM_EXECUTABLE` and optional `PHASE2_STUDIO_URL`. It must not be pointed at existing user storage; it creates its own fresh context and uses only `phase-2/` fixtures. The isolated build's font/network setup and the complete verification commands are recorded in the verification artifact.

All **239 pre-existing paid/recovery/fixture files** inventoried at task start remain byte-identical. [Preservation verification](phase-2/preservation.json). Existing response hashes, recovered designs and user projects were not overwritten.

## 9. Controlled paid evaluation: NO-GO pending provider availability

The full [prepared 2D evaluation](phase-2/CONTROLLED_2D_EVALUATION.md) contains one high-quality prompt, the exact route/call boundary, subjective review criteria, failure conditions and retention locations. It has **not been executed**. Repository-configured example pricing is approximately **$0.082–$0.084** for 5–6k input/6k output, or **$0.132** for 6k input and the full 10k output budget. These are estimates, not verified provider rates or guaranteed caps. Exterior/3D development is excluded.

The earlier [failed evaluation investigation](FAILED_PAID_2D_RECOVERY.md) establishes HTTP 429 before a completed response, with no original error body/provider code retained. It does not establish whether the cause was rate limiting or quota exhaustion. The existing application now distinguishes those when an actual provider code is available and retains completed response text before validation. No historical design can be recovered from a missing response.

**Offline pipeline readiness: GO for inspecting a future 2D response. Paid execution now: NO-GO.** Resolve configured-project quota/billing/model access and request/token limits from existing account/admin evidence before recommending the single evaluation. Do not use an automatic retry or new generation as a diagnostic. Once provider availability is established and a future evaluation is authorized, run only the prepared 2D request, retain the complete response and review its actual drawings before deciding on exterior development or any additional paid design stage.
