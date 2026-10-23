# Second-live mansion in the normal workspace — 21 October 2026

The saved mansion is now a separate, editable project in the user's existing Safari profile at `http://localhost:3000/workspace/e255970d-0a20-4bd1-93e2-3cb920ced3c0`, named **Second-live Mansion — Recovered Draft**. The normal home page and workspace Projects panel provide access. The 48 pre-existing projects were retained. No AI authoring, repair, or regeneration endpoint was invoked.

## Server stabilization

The original port-3000 process returned HTTP 500. Its development log contained missing Turbopack runtime chunks and missing workspace build manifests. The process was stopped before its development cache was moved to `.v3-debug/next-dev-cache-before-workspace-recovery-2026-10-21`; no source, projects, or original recovery evidence was removed. A fresh Webpack development server now serves port 3000, and `npm run dev` uses Webpack. Repeated home, workspace, asset, and recovery requests returned HTTP 200. The server remains running.

## Import and preservation

The development-only, localhost recovery endpoint reads the existing saved scene and verifies both file hashes. It does not reconstruct the mansion or import AI code. Import creates a new V3 Villa project with a matching initial version, reruns architectural acceptance, and retains the exact original blueprint text and hash separately from editable scene data. Reopening an already imported source returns that project without replacing later edits.

A first attempt to back up all browser projects in localStorage hit its quota and did not add a project. Backup now uses the separate IndexedDB database `ai-architect-recovery-backups`, object store `snapshots`, key `before-b78f82e1b55e0ce9e78b01e40f2a4b0ed8d4841ac3e86f1b6b96923887fb94bb`. The import then succeeded. No old projects, histories, or architecture were cleared to make room. New imports verify persisted data and preservation of existing records and roll back on failure.

Unchanged source SHA-256:

- Original blueprint: `b78f82e1b55e0ce9e78b01e40f2a4b0ed8d4841ac3e86f1b6b96923887fb94bb`.
- Saved recovery file: `38af84659ce9a14af0c71be5113d85c08acfe2f206d476f6988f838283dc2536`.

## Verification in the real Safari workspace

- Draft status and all 11 property records loaded through ordinary project storage. Both buildings and roofs, villa facade glazing, terrace, pool, arrival and landscaping were visually inspected from plan and orbit views. The live render transition reported 209 compiled primitives.
- The service-window opening inspector exposed the original ground-floor rhythm, width 1.1 m, height 1.4 m and sill 1.25 m.
- A reversible inspector step changed the sill to 1.26 m. The scene and diagnostics updated, Undo became available, and a full page reload retained 1.26 m in the opening diagnostics. This verifies an actual semantic edit, save and reload in the user's normal browser storage.
- Undo restored 1.25 m. Full architectural revalidation retained Draft status and visible geometry. The current design retains the original authored dimensions; test history is preserved.
- The new mansion and existing projects were visible together in the Projects panel.

Current checks passed: 14 focused tests across recovery import, facade recovery and Draft persistence; TypeScript; ESLint on changed files; and `git diff --check`. A new production build was not run for this local development import.

## Remaining localized defects

The Draft displays 85 findings, including repeated audit observations. Its original entry door overlaps two service-window cuts; affected wall areas remain amber and unresolved. Room footprints overlap or extend beyond hosts, some partition boundaries and door offsets do not resolve, reserved zones conflict with allocations, the secondary guest walk intersects the villa, and dry pool access is missing. Budget/style intent remains unverified. These findings do not suppress supported architecture.

Numeric inspector replacement can pass through an empty/NaN value and show an invalid-input message; stepping the number works and persists. The Design JSON panel still reports the secondary-route validation error even though architectural Draft acceptance correctly renders the estate. Some Elements controls remain oriented to legacy site settings. These local UI limitations were not allowed to block the recovered mansion.

Nonblocking runtime warnings remain for Three.js Clock/shadow-map deprecations and the existing PostgreSQL SSL-mode configuration. No further architectural correction was inferred or generated.
