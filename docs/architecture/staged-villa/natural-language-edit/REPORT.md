# Accepted-house natural-language editing: offline proof and first live packet

**The mocked edit succeeds on the actual accepted Terra Stage 5 villa, updates its authoritative saved specification, reloads and visibly moves the pool in the normal renderer. No live AI edit has run.** The original Stage 5 save/checkpoint remains the accepted baseline. The rejected roof candidate stays rejected and was not refined.

## Roof experiment closed

The accepted baseline's three renderer-built pitched-roof eaves agree with their source wall-top datums to floating-point precision. The rejected candidate alone has the 0.5 mm eave drift associated with its two newly reported seam crossings. Independently rounding centre and height is a generic compiler risk for future fractional roof inputs; this check does not certify every historical model.

The accepted baseline's previously disclosed fascia corner overlap at the abutting hip/east-gable seam remains. It is not the pair of new submillimetre slope/fascia crossings and was not repaired or relabelled. No roof-junction engine or precision correction was implemented. [Read-only closeout measurements](roof-closeout.json).

## Exact instruction and physical interpretation

> Move the swimming pool two metres closer to the veranda without changing the building.

The semantic pool is **`pool`**, with water element **`pool-water`**. The reference is **`veranda:south-veranda`**. The reference must be the water/basin, not the pool assembly's dry front apron or root transform.

Baseline veranda edge: z = **12.5 m**. Baseline water near edge: **15.3 m**. Requested water edge: **13.3 m**. Thus water-to-veranda clearance changes **2.8 → 0.8 m**, exactly a two-metre move. Pool width/depth/basin depth remain **12 × 4.5 × 1.4 m**.

A rigid translation of the old pool assembly would push its 1.5 m near apron through the veranda, even though the water still fits. The semantic edit instead retains coping and shortens only the dependent near apron to **0.1 m**, meeting the unchanged veranda at a shared dry edge. Combined apron/coping clearance remains 0.8 m. This is a model geometry/route result, not a pool-code or engineering certification.

## Implemented path

`move-pool-relative` identifies the pool/reference and a direction/distance. Software derives the coordinates and related geometry; AI is not asked for mesh coordinates. Existing generic `move-pool` remains readable for legacy edits; it did not offer the required relative-water semantics or rich-site dependency update.

- `poolGeometry.ts` centralizes the existing assembly's water/apron/reservation datums. The optional `nearDeckDepth` source field opts edited saves into apron sizing; absent values keep historical compilation unchanged.
- `poolEdit.ts` derives a bounded south-veranda-relative movement, clips only overlapping terrace paving, fills the vacated pool reservation and preserves existing path IDs where retained. It never moves plants or furniture or invokes the legacy deletion/trimming reconciliation.
- Normal `edits.ts`, compiler and full staged/site/relationship validators apply the semantic transaction. The existing pool assembly and renderer are reused; no new generator or rendering feature was introduced.
- `naturalLanguageEdit.ts` accepts a valid **completed Stage 5 saved house**, verifies its baseline hash, applies an injected semantic plan, checks preservation and returns the changed source, scene, diff and reloadable save. Invalid changes return the original save without promotion or a repair call.
- **`POST /api/ai/scene/edit-staged`** exposes this accepted-save proof in development/test only. It is distinct from the existing rejected-plan revision endpoint and does not require a rejected plan. It has no provider, database, persistence or paid branch. The supplied proposal is explicitly labelled mocked/injected.

The route passed both an HTTP-handler test and an **actual local HTTP POST returning 200**. Its returned source/scene exactly match the separately saved offline candidate. [HTTP evidence](pool-offline-2/http-route-check.json).

## Offline result and preservation

The AI proposal is deliberately mocked, operating on the real Terra house rather than a developer-authored replacement. [Proposal/result](pool-offline-2/mock-result.json), [verification](pool-offline-2/verification.json), [authoritative candidate save](pool-offline-2/candidate.save.json), [candidate scene](pool-offline-2/candidate.scene.json).

| Result | Observed |
|---|---|
| Construction/site/relationship findings | Zero |
| Elements | **377 → 379**, within 400; 21 slots remain |
| Existing changed elements | **15**: all 14 pool assembly elements and `path-terrace-1` |
| Added dependent paving | `path-terrace-1-pool-1`, `path-pool-edit-infill-1` |
| Removed elements | **Zero** |
| Existing unchanged elements | **362** |
| Original house | **All 314 elements byte-identical** |
| Programme | 23 rooms, four bedrooms, five bathroom rooms unchanged |
| Existing IDs | All retained; ownership unchanged for unaffected components |
| Pool dimensions/materials | Unchanged; only position and dependent apron geometry change |
| Palms, beds, hedges, lawn masks, furniture | Unchanged |
| Roofs, stairs, circulation, doors/windows, walls/materials | Unchanged |
| Save/reload | Source recompiles into the same serialized edited scene |
| Subsequent edit | Reloaded edited save accepts a further mocked 0.2 m away move in tests |
| Invalid edits | 3 m and 10 m closer moves reject atomically; stale hashes, unsupported targets/operations reject |

Shortening the apron changes the pool root frame differently from the water's displacement. The source reservation edge is z = **12.5 m**, while the world-space water edge is **13.3 m**. Local child coordinates also change to preserve the exact basin translation. Measuring only the root transform would incorrectly characterize the result. Every existing pool component identity remains intact.

Related paths are recomputed rather than left crossing the new reservation. Unrelated paths remain fixed. The actual scene/rendered pool has moved two metres; this is not a narrative-only or JSON-only update. No changes were written to the accepted Stage 5 files. Prior room-plan warnings remain applicable; none were claimed fixed by moving the pool.

## Visible result

All four before/after camera positions and targets match within 0.00000001 m. The same normal OperationScene/VillaScene renderer, daylight, materials, viewport/crop and fixed water phase are used. The pool visibly sits nearer the veranda in garden/poolside views, while the house and furniture retain their positions. The old pool's far-side space becomes dry paving.

[Interactive before/after comparison](pool-offline-2/comparison.html).

| View | Baseline | Mocked edit | Side-by-side |
|---|---|---|---|
| Arrival | [Before](pool-offline-2/before-arrival.png) | [After](pool-offline-2/after-arrival.png) | [Compare](pool-offline-2/comparison-arrival.png) |
| Aerial | [Before](pool-offline-2/before-aerial.png) | [After](pool-offline-2/after-aerial.png) | [Compare](pool-offline-2/comparison-aerial.png) |
| Garden | [Before](pool-offline-2/before-garden.png) | [After](pool-offline-2/after-garden.png) | [Compare](pool-offline-2/comparison-garden.png) |
| Poolside | [Before](pool-offline-2/before-poolside.png) | [After](pool-offline-2/after-poolside.png) | [Compare](pool-offline-2/comparison-poolside.png) |

All eight captures verify their exact element IDs, local positions/yaw, finite geometry and no WebGL loss. There were zero page/console errors, request failures or HTTP errors. The unrelated catalog request is stubbed locally; other API/external browser requests are blocked. The separate explicit editing-route POST was the only route mutation test and has no persistence/DB behavior. The comparison's eight before/after toggle checks passed. Existing THREE deprecation warnings remain.

These renders prove the requested spatial edit is visible; they do not establish a premium aesthetic improvement or a live AI interpretation. [Before browser evidence](pool-offline-2/before-browser.json), [after browser evidence](pool-offline-2/after-browser.json), [comparison checks](pool-offline-2/comparison-checks.json).

## Verification and limitations

**1,142 tests passed across 119 files**, including six new accepted-house edit tests, retained stage/scene/compiler tests and mocked provider-schema route tests. New tests include a renamed veranda reference rather than a hardcoded Breezeway component name, subsequent edits, preservation and atomic rejection. An early renamed-ID test omitted the linked open-space rename and correctly failed source validation; it was corrected without weakening validation. Typecheck and focused ESLint passed. [Passing test report](verified-tests.json).

All prior checkpoint/response/capture evidence remains unchanged. The six existing source files intentionally changed are staged spec/compiler/site/validation/editing infrastructure and the developer viewer mapping. Other pre-existing work was preserved. `pool-offline-1` retains the first direct existing-editor rehearsal; `pool-offline-2` is the final accepted-save service/route/render proof, not a second AI design. [Final preservation and camera checks](pool-offline-2/final-checks.json).

The new operation supports an existing rich-site staged save with one semantic pool and a **south-facing veranda**. It uses measured source geometry and semantic references, not the villa's house name, but it is not a universal site solver. Other orientations, multiple pools, arbitrary terrace redesign, broader architectural editing and production UI/auth/billing/persistence integration remain unproven. The route is developer-only and returns a save; it does not write a hosted project. A user-facing chat planner has not run live. No claim of generalisation to every style/house follows from one actual house and renamed-ID tests.

The reusable pattern is authoritative source → constrained semantic edit → deterministic dependencies → validation/preservation → scene/diff/save → render. Extending that pattern to more supported buildings/operations is subsequent work; this task adds no architectural generator or unrelated visual feature.

## Exact first live test — prepared, not sent

**[Approval packet](live-prepared-1/approval.json)** · [exact provider body](live-prepared-1/wire-request.json) · [strict response schema](live-prepared-1/schema.json) · [measured context](live-prepared-1/context.json) · [pinned source hashes](live-prepared-1/source-hashes.json).

| Setting | Proposed |
|---|---|
| Original accepted source | Actual Terra Stage 5 save; not the mocked edited candidate |
| User instruction | “Move the swimming pool two metres closer to the veranda without changing the building.” |
| Provider/model | OpenAI Responses, **`gpt-5.6-terra`** |
| Expected semantic interpretation | `pool` toward `veranda:south-veranda`, distance 2 m |
| Output cap | **2,000 tokens**, including reasoning; medium effort |
| Paid request limit | **One**, zero retries/repair/fallback calls |
| Proposed cost cap | **US$0.06** |
| Conservative cost bound | **US$0.044835** |
| Current provider calls | **Zero** |
| Request storage/tier/tools | `store:false`, standard/default tier, no tools, truncation disabled |

Exact compact body SHA-256: `c5ef1b7615f09e96f08c3c32d4bed066b8dd4685cf6325c66a0ba073aea12132`.

The strict schema permits only a short summary and one `move-pool-relative` operation. Software, not model coordinates, handles the apron, terrace and relationships. The first live test must compare returned pool/reference/direction/distance to the exact requested scope before execution. Record raw response/usage/finish before parsing, then run this same accepted-save path, save the result separately and verify the normal renderer. Invalid or incomplete proposals stop without a repair call or baseline replacement.

The bound reserves **8,334 input tokens** (UTF-8 wire bytes plus 4,096 framing reserve) at the worst-case cache-write input rate of US$2.50/M plus all 2,000 output tokens at US$12/M. Published model pricing/Structured Outputs support was rechecked on 2026-11-04. [Official model documentation](https://developers.openai.com/api/docs/models/gpt-5.6-terra). Actual provider usage/invoice is unknown until an approved call; there is no per-request dollar-cap field, so a future runner must recheck and enforce the pinned preflight/model/token/single-request controls. The US$5 experiment ceiling is unchanged; historical failed-call cost remains unknown.

The preparation script has no live branch and refuses overwrite of an existing packet; both refusals were checked. A live runner must be added only within new approval, with sticky attempt/network markers and no database bookkeeping. Production API access is not activated here. No credential was read or changed for preparation.

**Stopping point:** offline source/route/render editing is proven with a mocked proposal. The exact live semantic-planning test is ready for approval; it has not been sent. The accepted villa and rejected roof experiment retain their statuses. No paid calls, commits, pushes, deployments or database changes occurred. The isolated local server was stopped.
