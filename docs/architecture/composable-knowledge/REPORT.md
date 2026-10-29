# Composable architectural knowledge integration

## Result and limits

The existing homepage direct-scene path now keeps every retrieved selection visible, including uncited selections. Terra receives explicit instructions to choose compatible ideas, construct supported geometry, and check its decisions against actual element IDs. No live OpenAI calls, migrations, commits, deployments, new engines, agents or databases were used.

This establishes an auditable integration, not proof that Terra independently produces beautiful complete houses. Offline fixtures and mocked responses cannot establish that success criterion. The retained Caribbean scene is schematic, with broad continuous roof planes and limited architectural articulation; it does not demonstrate a finished $25m estate.

## 1. Reusable fragments

All 301 existing entries remain available with their original IDs. Existing entries already cover composition, programme, styles, entrances, façades, roofs, outdoor rooms, amenities, site, construction, materials and failure lessons. Their purpose, applicability, placement, mistakes and primitive limitations are retrieved as small knowledge records, never predefined scene templates.

Refined five existing pool fragments with specific compatible variations and construction relationships: shallow shelf, separate spa, infinity-edge limitation, dry deck and submerged steps/seating. Phrase aliases include sun shelf, tanning ledge, hot tub and submerged seating. These refinements extend existing repository-derived conceptual guidance; they introduce no claimed researched facts, new approvals or successful learned designs. New user knowledge still uses the existing atomic bulk importer, revision history, approval and supersession rules.

## 2. Retrieval and creative combination

The existing scale-aware, category-diverse ranker continues to retrieve approved current revisions only. It applies exclusions and specialist relevance and sends selected records rather than the entire catalog. For five-entry budgets, category reservation now prioritizes composition/programme instead of reserving every slot for general categories and excluding explicitly requested pool features. Larger budgets retain broader category coverage. User choices and unsupported features remain explicit; no automatic amenity bundle or component minimum was added.

Canonical instructions now require brief interpretation, relevant reviewed knowledge, original concept development, purposeful compatible choices, supported-operation planning, complete architectural construction and a final geometry check. Decisions may declare constructed, guidance, considered or unsupported. Those declarations are intent and do not certify geometry.

## 3. Real homepage and editable construction path

`src/app/page.tsx` creates a persisted direct-scene project, stores the brief and opens its workspace. `WorkspaceShell` selects `OperationStudio`; its initial brief invokes `/api/ai/scene`. That route calls `generationKnowledge`, retrieves reviewed learning, and adds both to `SCENE_SYSTEM_PROMPT`. The response passes through `resolveSceneResult` and the existing atomic `applySceneOperations` validator. `OperationScene` renders the same persisted element records. Editing calls the same route with mode edit and the current scene; no separate construction engine is introduced.

Slabs, walls, openings, doors, glazing, roofs, water, screens, railings and rectangular detail solids remain individually editable. The existing permanent design guide remains in the canonical system prompt. Reviewed lessons retain their existing provenance filtering; mock studies are not approved as successful learning.

## 4. Gaps fixed

- Retrieved entries previously disappeared unless Terra cited them. All selections now persist in the bounded scene evidence ledger, merged through scoped edits.
- The audit now covers uncited entries as selected-missing and distinguishes partial construction, construction evidence, guidance, deliberate consideration and unsupported capabilities. The editor exposes this audit.
- Geometry evidence checks actual referenced IDs, primitive kinds and existing proximity checks. Renaming a slab cannot manufacture a door, basin or roof. Deleting referenced geometry downgrades its evidence on re-audit.
- Guidance and deliberately omitted ideas no longer generate false missing-geometry warnings solely for having no IDs.
- Pergola requirements now identify plates and post/beam solids; pool-bottom requirements identify plates, walls and water rather than roofs.
- Small-budget retrieval no longer reserves every slot for general architectural categories at the expense of requested features.

Kind presence and proximity remain necessary checks only. They cannot prove a true infinity edge, a functional sun shelf, complete navigation, aesthetic quality or feature completeness. Audit results therefore always keep `verifiedComplete: false`. Planning discrepancies remain warnings; invalid operations still fail atomically.

## 5. Unsupported capabilities

True overflow hydraulics, filtration, spa heating/jets, dedicated lighting/equipment, arbitrary curved or polygonal pools/solids, arbitrary meshes/CSG and curved roofs outside the approved pavilion remain unsupported. Gable/hip and flat roofs remain supported. Automatic stairs, services, engineering, navigation and code certification remain unavailable. New generation retains the existing temporary flat-site policy. Rectangular visual basin studies do not represent working hydraulic systems.

## 6. Offline and browser evidence

`evidence.json` records five hand-authored contract studies: Caribbean waterfront estate, compact three-bedroom villa, Mediterranean courtyard mansion, family pool with a raised submerged shelf, and separate-spa pool composition. The Caribbean study supplies the third pool arrangement: a bounded view-facing basin with infinity limitations disclosed. These are capability studies, not generated designs or approved learning examples.

`browser.json` records all five imports, targeted edits, undo and reload checks, zero page errors and zero AI requests. Each has aerial and arrival screenshots. The capture blocks AI endpoints and external browser requests. Store regression tests separately verify undo, redo and persistence. Mocked canonical-route tests exercise all three house briefs and pool editing; geometry remains accepted with actionable missing-evidence warnings when the mock provides no citations.

## 7. Efficiency

Adaptive limits are unchanged: compact generation 5 entries/6,500 chars; medium 8/12,000; complex 12/18,000; scoped edits 4/6,500 or 6/9,000. Evidence history remains capped at 24 entries. No extra provider calls are introduced.

| Study | Retrieved entries | Knowledge chars | Estimated tokens |
| --- | ---: | ---: | ---: |
| Caribbean | 12 | 15,264 | 3,816 |
| Compact | 5 | 6,088 | 1,522 |
| Mediterranean | 12 | 14,289 | 3,573 |
| Family pool | 5 | 6,327 | 1,582 |
| Separate spa | 12 | 14,438 | 3,610 |

Token counts use chars/4 and are estimates, not provider measurements. The canonical system prompt is 19,877 chars, including the permanent guide. Knowledge dispositions add a small bounded response cost, sharing the existing maximum twelve design decisions. More library entries do not increase the per-request limits.

## 8. Readiness

Ready for one controlled live integration evaluation once explicitly requested. No such call was made. Evaluate whether Terra constructs the selected features, develops all elevations and roof/entrance relationships, and improves architectural quality beyond these schematic fixtures. A successful parser response or kind inventory alone must not be reported as a successful architectural design.

Reproduce with `npx vite-node --config vitest.config.mts scripts/composable-architecture-evidence.ts` and, with a local development server, `node scripts/composable-architecture-capture.mjs`. Browser capture uses the existing Playwright location or `PLAYWRIGHT_CORE_PATH`.
