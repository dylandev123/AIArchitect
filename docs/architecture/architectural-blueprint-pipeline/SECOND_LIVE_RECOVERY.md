# Second live blueprint recovery — 21 October 2026

The exact paid blueprint is recovered, unchanged, and constructs as an editable **Draft — Needs Refinement** through the production SDK, API, project store and WebGL renderer. No real provider requests were made. Existing user projects were not opened or modified. No commits, pushes, deployment, V2 or terrain changes were made for this recovery.

## Original evidence and correlation

- Capture: `.v3-debug/failed-attempt-0.json`, preserved byte-for-byte at `.v3-debug/second-live-b78f82e1b55e/original/capture.json`.
- Captured at `2026-10-21T13:16:37.584Z` (09:16:37 Saint Lucia).
- Generation ID: `520936d4-62b4-4ed2-9f96-f83552b59763`; attempt `0`; phase `ingestion`; source `provider-output`; decision `rejected`.
- Captured response: 20,523 UTF-8 bytes, not redacted or omitted. SHA-256: `b78f82e1b55e0ce9e78b01e40f2a4b0ed8d4841ac3e86f1b6b96923887fb94bb`.
- Capture-envelope SHA-256: `005958fb4aed9bc0747a14080719e14b4cdfc2420314293f22bf8fc563fd046c`.
- Immutable response: `.v3-debug/second-live-b78f82e1b55e/original/provider-response.json`. Identical regression fixture: `src/lib/v3/__tests__/fixtures/architectural-blueprint-live-2026-10-21.json`.
- The captured response is the SDK-parsed blueprint serialization retained by the existing capture path. The original HTTP envelope and its whitespace were not retained; no claim is made to have recovered those transport bytes.
- `failed-attempt-1.json` dates to 19 October (`2026-10-19T20:18:50.098Z`) and is **not** a correlated repair response. No repair was invoked for the new capture: its decision is `rejected`, and `repairTargets` only permits diagnosed stairs/routes, not facade-opening contradictions. The replay confirms one authored response and zero repair responses for this estate. Historical billing telemetry was not used to infer an unrecorded call.

## What Terra authored

A tropical-modern Saint Lucian estate targeting a $15 million brief on a 120 × 90 m flat site. The concept names sunset, sea and Piton-facing views; no terrain or ocean geometry is inferred from that prose.

| Component | Original design |
|---|---|
| `main-villa` | Piton View Main Villa, 24 × 18 m at x=-8, z=0; 4.2 m entertaining/service storey and 3.6 m private suite storey; 15 rooms |
| `main-villa-roof` | Terrace roof, pitch 0°, 1.1 m overhang, 0.28 m thickness |
| `guest-pavilion` | Garden Guest Pavilion, 12 × 8 m at x=-28, z=-13; one 3.5 m storey; 5 rooms |
| `guest-pavilion-roof` | Mono-pitch roof, 8°, 0.9 m overhang, 0.24 m thickness |
| Outdoor features | Sunset terrace, west-edge infinity pool, north garden lawn, east arrival lawn |
| Circulation | Arrival drive, terrace walk, guest garden walk; one U-shaped private stair; two entrance declarations |
| Interior | 20 rooms; 14 partitions (11 wall, 2 open, 1 glazed); 10 interior door intents |
| Facade openings | 9 declarations: 2 doors, 2 glazed doors, 2 glazing zones, 3 rhythms; 14 aperture instances across storeys/rhythm members |
| Palette | Ivory stucco, volcanic stone, charcoal metal, roof metal, terrace paving, pool water, lawn grass and clear glass declarations |

Original materials, building placements, room footprints, partitions, doors, reserved zones, connection endpoints/bends and all opening records remain preserved. Unused material declarations remain in the unchanged original blueprint. No room coordinates are recentered to guess a different convention.

## Exact opening conflict and classification

Host: `main-villa`; east facade; ground level 0. East facade length is the 18 m building depth. Fraction 0 is local z=-9 m; fraction 1 is local z=+9 m. The east wall is at world x=4 m before the normal wall inset.

| Identity | Type/function | Fraction span | Local/world z span | Height above facade wall datum |
|---|---|---|---|---|
| `main-entry-door` | Door; serves `entry-gallery`; designated main entrance | [0.42, 0.52] | [-1.44, 0.36] m | sill 0, head 3.10 m |
| `service-window-rhythm` member `-0` | First service window; count=2, width=1.1 m | [0.4266666667, 0.4877777778] | [-1.32, -0.22] m | sill 1.25, head 2.65 m |
| `service-window-rhythm` member `-1` | Second service window | [0.5122222222, 0.5733333333] | [0.22, 1.32] m | sill 1.25, head 2.65 m |

The shared rhythm policy centers a sequence with a gap of 0.4 × window width. Both members intersect the entry door in horizontal span **and** vertical height. No blueprint relationship selects new service-window positions or grants the door priority. `serves:entry-gallery` identifies function; it does not authorize moving or deleting another opening.

This response is **case C**, a localized ambiguous conflict under V3's centered-rhythm interpretation. The original and normalized blueprint contain the same opening records; identity normalization reported zero changes. It is not a normalization-induced collision. Terra's combined declarations are incompatible under that construction rule. V3 additionally had two limitations: its old preflight checked only horizontal projections, and it rejected the entire estate for this localized defect.

The neighboring cases are now distinguished:

- **A:** Vertically separated apertures with the same horizontal projection use two-dimensional infill tiling and retain both independent cuts/frames.
- **B:** Explicit segment addresses govern physical host selection; equal compass roles on different outline segments do not conflict. No heuristic relocation is introduced.
- **C:** Every intersecting cut is withheld symmetrically. Supported wall cells remain in the original wall plane and are visibly amber, labelled unresolved; independent opening/member cuts still build. Original intent records remain editable.
- **D:** Malformed primary geometry, missing main components, unsupported roofs, broken primary arrival and unknown blocking findings still return Cannot Construct. Draft metadata never overrides these checks.

All 3 conflicting aperture instances are withheld. The other 11 facade aperture instances construct. No door wins through author-array order; no unrelated windows are merged.

## Recovery implementation and additional findings exposed by this exact response

`facadeOpeningRecovery.ts` shares plan-only band resolution between preflight and the V3 blueprint construction adapters. Normal spans retain shared builders and semantic identities. Recovery uses those builders for supported frames/leaves and tiles only original wall infill around admitted cuts. Reversed spans, clipped sizes/sills, oversized rhythms and invalid local targets retain intent and a local diagnostic rather than silently clamping or discarding the whole property. Shared V2 opening code is unchanged.

The opening inspector exposes span/height or rhythm count/width/height/sill, facade and floor scope. Diagnostic links select opening intent directly. Changes run normal scene operations and full current-semantic revalidation; status and scene/version persist in one project-store write.

Passing the original facade gate exposed other findings in this response, which are preserved rather than silently repaired:

- Room allocations outside their host and overlapping room allocations; unresolved partition boundaries and interior door offsets.
- Reserved zones with incompatible allocations.
- Missing dry pool access.
- `guest-garden-walk` travels through `main-villa` along its authored bends. This secondary pedestrian connection is an amber translucent **unresolved route guide**, preserving its exact coordinates and material intent. It is not presented as a completed accessible path. No detour was invented. The exception requires independently supported principal site arrival and cannot admit a failed primary approach, water crossing or missing endpoint.

Some newly exposed missing-object findings were actual lookup limitations. Estate commitments can reference declared route IDs, rooms, storeys and the stair. The semantic route relationship is projected to its uniquely declared `surfaceId`; original estate commitments stay intact. Existing identities are resolved, never replaced with guessed architecture.

The store and viewport both previously enforced strict scene acceptance ahead of the Draft audit. In particular, the secondary route finding could cause a successfully saved Draft to render an empty site. Both paths now rerun the full architectural audit for such a Draft; they do not trust its metadata marker. Production mesh assertions caught and verified this final viewport correction.

## Actual production evidence

Reproduction script: `scripts/second-live-blueprint-integration.mjs` with `scripts/offline-blueprint-provider.mjs` as a process-only transport preload. `next start` runs the optimized production build. The real provider adapter and AI SDK parse the untouched original response text; the ordinary landing-page Generate action, `/api/ai/house`, client revision checks, atomic appendVersion and real renderer all execute. No constructed scene is seeded into browser storage.

Artifacts: [verification manifest](second-live-production-webgl-verified/capture.json), [original API Draft](second-live-production-webgl-verified/api-mansion.json), [estate overview](second-live-production-webgl-verified/ocean-facades-pool-and-guest.jpg), [entry/roofs and amber placeholder](second-live-production-webgl-verified/entrances-and-roofs.jpg), [opening inspector](second-live-production-webgl-verified/unresolved-opening-inspector.jpg), [refined windows](second-live-production-webgl-verified/service-windows-refined.jpg), [reloaded Draft](second-live-production-webgl-verified/edited-draft-reloaded.jpg), [independent Complete after correction](second-live-production-webgl-verified/unrelated-complete-reloaded.jpg).

Verified:

1. HTTP 200, architectural pipeline, outcome Draft, 11 persistent property objects; exact building/roof/feature dimensions, materials, room footprints, stair, partitions, door intents and opening records.
2. 209 compiler primitives and 208 mounted, semantically identified WebGL meshes before refinement. The mounted-mesh assertion independently requires both buildings, both roofs, terrace, pool and supported facade openings. The remaining water rendering uses its existing group ownership rather than a mesh `id`.
3. Actual Chromium WebGL 2 at 1224 × 847 canvas resolution, with nine screenshots; each manifest entry records mounted mesh IDs and screenshot hash. Screenshots were visually inspected, including the amber unresolved wall.
4. Every constructed browser-storage write has Draft metadata, all 11 objects and a matching latest version JSON. Reload retains the saved JSON exactly. An isolated unrelated sentinel project stays unchanged.
5. Normal inspector edit changes `service-window-rhythm.floors` from ground to upper. This is an explicit test-user correction, **not** an inferred recovery edit. Both windows and main entry then construct; the opening overlap and wall placeholder disappear. All other semantic fields are unchanged. The real estate remains Draft because its other findings still need refinement.
6. An independent curved estate with a separate rectangular atelier starts as an opening-conflict Draft. A facade edit moves its window to an unoccupied wall; full revalidation promotes it to Complete and reload preserves it. No additional authored response or repair is needed for either edit.
7. Two mocked transport responses total: one exact recovered estate, one independent regression property. Zero real provider calls, zero estate repair responses, no unexpected external browser requests or page errors. Real shared persistence is disconnected; the production usage-telemetry storage warning is expected in this isolated replay. Synthetic mock token usage is not billing evidence.

The final deterministic recovery artifact is `.v3-debug/second-live-b78f82e1b55e/final/recovered-scene.json`. The production response above additionally includes normal route/client metadata. Existing real browser projects and account databases were not modified.

## Separate ECMAScript investigation

The preserved development log reports:

```text
footprintConstruction.ts:169:1
'import', and 'export' cannot be used outside of module code
export function compileFootprintRoof(...)
Parsing ecmascript source code failed
```

The log records the time-only timestamp `18:03:57.618`; that line does not retain its calendar date. The source file's pre-task modification time was 20 October 19:43:41 UTC, and the new paid capture is 21 October 13:16:37 UTC. The log does not correlate this parser event to the new generation. The new capture records a normal architectural validation rejection, not a compiler exception.

Current source already had the required closing brace around the nested authored-assembly/part loops. Before recovery edits, `tsc --noEmit` passed. Next's own SWC parser also parses current source successfully. Removing just that loop-closing brace in a temporary in-memory variant reproduces the same export/module error. This identifies the missing-brace mechanism; the exact malformed historical source snapshot was not retained, so attributing that exact old edit is an inference. There is no confirmed active source syntax defect to patch independently. The clean production build passes.

Saved error excerpts and SWC reproduction are in `.v3-debug/second-live-b78f82e1b55e/original/compiler-errors.jsonl` and `syntax-reproduction.json`. Old generated build output was moved aside before the clean build. The first sandbox build could not fetch existing Google Fonts; the authorized build with font access succeeded. No provider calls were used by either build.

## Verification and paid-call decision

Final checks: **51 focused tests passed; 2,334 full-suite tests passed, 3 skipped; TypeScript, ESLint, production build and whitespace checks passed.** See `SECOND_LIVE_RECOVERY_CHECKS.json` for command outcomes. Focused SDK/local-recovery tests cover A/B/C/D, untouched response hashes, unaffected rhythm members, local malformed openings, strict primary access, correction and promotion. The normal production replay verifies atomic persistence and actual mounted WebGL geometry.

One full-suite run overlapped a production build and hit 5-second test timeouts under load (including unchanged legacy tests). The suite was rerun with four workers after production work finished; no test timeout thresholds or architectural assertions were relaxed.

**Paid-call decision: NO-GO for another paid generation in this task.** Recovery and local correction need no provider call. This recovered property is an editable architectural Draft, not Complete; its room/partition, allocation, secondary path and pool-access decisions remain unresolved. Supported primary geometry remains visible and editable while those decisions are refined.
