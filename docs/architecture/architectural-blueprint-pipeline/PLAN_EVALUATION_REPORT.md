# Design 2D Plan evaluation

21 October 2026. Implemented and verified offline. No Terra/OpenAI calls, paid generations, commits, pushes or deployment. No environment file was changed and no evaluation flag was enabled in the workspace configuration.

## Inspection result

The existing Architectural Planning Studio had an authoritative plan-first contract and 2D/3D presentation views. Its production generation response included BOTH `plan` and `exterior`, then proceeded through massing and exterior construction. It did not provide a genuine plan-only provider response or stop for approval before exterior authorship. The previous plan-first report explicitly documented that limitation.

The evaluation adds a separate `/api/ai/plan` route and home-page entry, controlled by **`AI_V3_PLAN_EVALUATION=1`**. Only the exact server value `1` enables provider actions; default is off. It does not require changing either existing blueprint-generation flag. Normal generation retains its established Complete / Draft / Cannot Construct acceptance and repair budget.

## One controlled evaluation: exact UI steps

1. Start an isolated local app process from this checkout with `AI_V3_PLAN_EVALUATION=1 npm run dev` (or set the same server variable when starting an already built production server). This does not write an env file. Existing AI configuration is used only when the user explicitly runs generation.
2. Open the home page. In **Design 2D Plan · evaluation**, enter a short brief in **2D architectural brief**. For example: “A courtyard estate with a curved residence, detached guest pavilion, pool and private garden.” Do not use the normal Generate button for this evaluation.
3. Press **Design 2D Plan** once. It creates a fresh flat V3 project and makes **at most one provider call**, with a 10,000-output-token limit and `maxRetries: 0`. There is no automatic repair, exterior request or construction stage. Invalid or incomplete output reports diagnostics; it does not replace an existing design or trigger a retry.
4. The saved result opens in **2D Floor Plan**, initially **Estate master plan / Full estate**. Choose **Ground floor** or an upper level in **Drawing**, and optionally a building in **Scope**, to inspect conceptual room zones. Entrances, route corridors, stair reservations and outdoor features come from the same V3 geometry.
5. Open **2D diagnostics** for localized findings; target buttons select the associated identity. Use **Edit and save 2D plan** to edit the existing V3 plan JSON: footprints, room zones, locations, entrances, circulation, site and outdoor features. Press **Save 2D plan**. Local edits create ordinary undoable project versions, require zero provider calls and persist across reload. Core invalid geometry is blocked; supported localized room issues remain visible and editable.
6. Stop here to evaluate Terra's plan. Viewing, editing, saving, undo/redo and reload make **zero additional provider calls**. 3D view controls are disabled for this plan stage.
7. Only if development is wanted, press **Build in 3D**. This first opens a decision/cost panel and makes no provider call. Supply genuinely deferred roof/facade/material decisions, or explicitly delegate their choice to Terra. The original concept, brief and saved plan accompany those decisions.
8. Review the configured cost estimate, then press **Confirm Build in 3D · 1 AI call**. This makes **at most one separate provider call**, again with a 10,000-output-token limit and no automatic retry or repair. It elaborates the CURRENT saved plan, including local edits. Successful construction opens **3D Blueprint** and follows the existing Complete/Draft acceptance. A failed response preserves the saved plan.
9. Stop the opt-in server or unset `AI_V3_PLAN_EVALUATION` to disable new evaluation and elaboration requests. Existing saved evaluation plans remain available to inspect and edit locally.

**Call limit:** one explicit 2D evaluation = at most **1 provider call**. Optional confirmed 3D development = at most **1 additional call**. A user who manually starts another evaluation or manually retries a failed build is explicitly starting another action; this is not an account-wide quota. Ordinary AI chat edits/generation are blocked for saved evaluation plans, directing the user to local plan editing or the explicit Build action.

## Authority, validation and preservation

The author response is the existing `v3-architectural-plan-1` schema from the `v3-plan-first-1` contract. It is consumed by `prepareV3ArchitecturalPlan`, not a parallel or simplified scene format. Estate intent, named footprints/segments, storeys, conceptual rooms, entrances, route references and feature geometry lower into existing V3 semantic fields. Only those fields are saved; there is no stored second plan snapshot, mesh or construction model.

Plan checkout reconstructs the current contract from saved semantics, using reserved roof identities without requiring or inventing a roof design. This temporary adapter is never approved or compiled. A semantic round-trip comparison rejects unsupported loss. Saves rerun plan validation and persist recomputed diagnostics atomically with the scene. The evaluation viewport draws features, route corridors, room polygons and stair reservations directly from semantics; it does not mount the 3D Canvas or invoke the construction compiler for drawing or camera bounds.

Exterior output uses the existing exterior schema, which permits host-relative roofs, facade detail and finishes while excluding plan coordinates. Existing elaboration checks protect hosts and access openings. Both elaboration and completed construction must pass `sameArchitecturalPlan` against the saved source. No model-authored alternate footprint, height, room layout, entrance address, circulation or major outdoor geometry is accepted. The actual existing blueprint planner/compiler supplies subsequent construction and Complete/Draft/Cannot Construct diagnostics.

The only normal-route functional addition rejects ordinary AI generation/edit requests for saved plan-evaluation projects before using a provider. Production validation also exposed pre-existing exported helpers/constants that Next.js disallows in route modules: shared constants moved to `v3GenerationLimits.ts`, the diagnostic helper became private, and its test import was updated. Values and generation behavior are unchanged.

No V2 or terrain implementation changed. Existing recovered blueprint bytes retain their recorded SHA-256 values:

- 20 October: `f489d79d6830a9787ae173fdd012a459b36edbc93b638219f94bc454dbb1e394`
- 21 October: `b78f82e1b55e0ce9e78b01e40f2a4b0ed8d4841ac3e86f1b6b96923887fb94bb`

## 3D cost

A plan-only response deliberately contains no complete exterior design, so creative 3D elaboration requires another AI response. It is never automatic. The UI uses the configured model/pricing table, estimates input tokens as schema + saved plan + decisions characters / 4, and shows the cost with the full 10,000-output-token allowance. This is an estimate, not tokenizer evidence or a guaranteed billing cap. Unknown configured prices are explicitly shown as unknown.

In the production fixture run, the app's configured `gpt-5.6-terra` rates ($2/M input, $12/M output) produced an estimate of approximately **$0.130** for ~5,004 estimated input tokens and the full output allowance. Those are local application rates, not independently verified current provider prices. Actual usage, reasoning/output length, tokenization, latency, provider pricing and billing can differ. No natural-model cost or creative quality was measured.

## Verification and evidence

- Full offline suite: **194 files passed, 2 skipped; 2,370 tests passed, 3 skipped**. This includes existing normal generation and V2/terrain regressions.
- Final focused normal-route/plan-first regression run: **113 tests passed** before the final additional chat-guard test; the final dedicated evaluation route run passed **11/11**, including retryable provider failures with no retry.
- Four provider-shaped designs (crescent, circular, courtyard and conventional villa) pass real SDK parsing and route validation, then save through the actual project store without invoking construction.
- Local footprint edit, saved semantic checkout, undo/redo and separate exterior response preserve current geometry. Core invalid geometry, truncation, malformed output, retryable provider errors, exterior geometry injection, existing-project replacement, stale revisions, advanced sites and ordinary chat on a saved plan are checked offline.
- TypeScript, repository ESLint with zero warnings, and whitespace checks passed.
- Optimized **`next build --webpack`** passed in an isolated source copy with no credentials copied. The build used an offline Google Fonts response fixture backed by existing local font files; no font network access was needed.
- The optimized production workspace was exercised end to end with isolated browser storage and fixture responses at the actual provider HTTP transport. It checked flag-off UI, one explicit plan call, 2D master/room drawing, no evaluation Canvas, localized diagnostics, edit/save, undo/redo, reload, the separate exterior-decision/cost panel, and one confirmed exterior call.
- Production evidence: [proof](plan-evaluation/proof.json), [provider-call log](plan-evaluation/provider.jsonl), [estate plan](plan-evaluation/01-estate-plan.jpg), [ground zones](plan-evaluation/02-ground-zones.jpg), [local diagnostics](plan-evaluation/03-local-diagnostics.jpg), [cost/decision panel](plan-evaluation/04-explicit-cost-and-decision.jpg), [constructed result](plan-evaluation/05-built-exact-plan.jpg).
- Browser page errors, unexpected requests and external provider/socket traffic: **0**. Existing user browser sessions were never opened or written. An unrelated project in the isolated test storage remained byte-for-byte unchanged.

Reproduce the dedicated tests with `npx vitest run src/app/api/ai/plan/route.test.ts --maxWorkers=2`. Reproduce the browser proof after building with `PRODUCTION_ROOT=/path/to/production-copy PLAYWRIGHT_MODULE=/path/to/playwright-core CHROMIUM_EXECUTABLE=/path/to/chrome node scripts/plan-evaluation-integration.mjs`. That script starts and stops its own localhost server, injects offline fixture responses, sets a dummy provider credential before dotenv loading, and blocks external fetches/sockets.

The JSON editor is intentionally minimal; this does not add a CAD drawing tool. Validation concerns supported geometry and software construction, not architectural quality, code compliance or engineering certification. A later live evaluation, started by the user, is needed to assess Terra's creativity on a natural brief.
