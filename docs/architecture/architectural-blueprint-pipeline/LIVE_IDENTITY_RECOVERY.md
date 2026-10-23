# Live blueprint identity recovery — 20 October 2026

The full blueprint from the reported 75-second failure was recovered. No Terra or OpenAI calls were made during investigation, replay, or verification. Identity recovery does **not** yet produce a constructible house: three other planning findings remain. No architecture was moved, simplified, deleted, or invented.

## Evidence and provenance

- Source: `.v3-debug/failed-attempt-0.json`, captured at `2026-10-20T19:12:58.684Z` (15:12:58 Saint Lucia time), attempt 0, provider output, 20,357 bytes. Neither redacted nor omitted.
- SHA-256 verified against the stored `rawResponse`: `9733be300b2fbb316ea248201c4af87df86665fb63fb9c6d63012aa49f1af9ed`.
- Preserved separately in `.v3-debug/recovery-2026-10-20-9733be300b2f/original-capture.json` and `original-blueprint.json`. These copies are independent of the rotating diagnostic slots.
- Exact captured blueprint JSON is also retained as the offline regression fixture `src/lib/v3/__tests__/fixtures/architectural-blueprint-live-2026-10-20.json` (one added trailing newline; hash verified after removing that newline).
- Local `.data/ai-usage.jsonl` had no corresponding blueprint record because this environment uses Postgres. A read-only Postgres query found usage record `66f1be4d-ed27-434f-833f-3f1aec4ef1f8`, timestamp `2026-10-20T19:11:45.126Z`, stage `v3-architectural-blueprint`, retry 0, latency **72,617 ms**, finish `stop`, 7,599 input and 7,672 output tokens. Provider success is recorded separately from subsequent architectural rejection.
- There was one initial authoring call and no blueprint-repair record in the surrounding 19:00–19:20 UTC window. The attempt-1 file dates from **19 October** and belongs to an older failure. It is not a repair of this blueprint.
- The capture contains the SDK's parsed JSON output, serialized before architectural normalization; it is not a claim of preserving the provider's original whitespace or HTTP envelope. No separate HTTP response capture was found in the workspace. The saved diagnostics reproduce the reported rejection.

## What Terra designed

| Component | Count | Detail |
| --- | ---: | --- |
| Buildings | 2 | Belvedere House (`main-villa`); Garden Guest Pavilion (`guest-pavilion`) |
| Storeys | 3 | Two villa storeys; one guest storey |
| Rooms / functional spaces | 17 | Villa 7 ground + 6 upper; guest pavilion 4 |
| Roofs | 2 | One independently authored roof per building |
| Outdoor features | 5 | Arrival court, ocean-view terrace, infinity pool, guest terrace, tropical garden reserve |
| Routes | 4 | Arrival drive, guest walk, ocean-terrace walk, pool approach |
| Designated entrances | 2 | One per building |
| Facade opening records | 16 | Includes glazed doors, glazing zones and opening rhythms |
| Vertical circulation | 1 | U-shaped villa stair |
| Partitions | 9 | Explicit interior partitions |
| Interior doors / passages | 8 | Explicit partition cutouts |
| Facade assemblies | 0 | Main-entry canopy intent is separately retained in `mainEntry` |

There are also eight materials, three requirements, three program entries, three reserved zones, two form commitments, four relationships, four considerations, and nine room-adjacency records. These are authored intentions; their presence is not proof of valid geometry or of constructed equipment/planting.

## Why identity validation rejected it

Every literal `id` declaration in the captured document is unique. The old validator also counted **`connection.surfaceId` as a declaration of a new runtime object**, although the schema and instructions did not clearly distinguish it from a reference to an existing surface.

| Value | Existing feature | Reused route-owner declarations |
| --- | --- | --- |
| `arrival-court` | `features.0.id` | `connections.0.surfaceId` (`arrival-drive`), `connections.1.surfaceId` (`guest-walk`) |
| `view-terrace` | `features.1.id` | `connections.2.surfaceId` (`ocean-terrace-walk`), `connections.3.surfaceId` (`pool-approach`) |

Each value occurs three times in the flattened semantic identity pool. There is both an object/route-owner namespace collision and reuse within the exclusive route-owner namespace. Terra authored these values; parsing/normalization did not create them. Lowering would otherwise create terrace/path/driveway objects with identical IDs, making map-based object lookups unsafe. The validator correctly refused that runtime state, but its generic message hid the recoverable contract mismatch.

The surface endpoints explicitly reference the named terrace features. Feature IDs and all references to those declared features can remain intact. Each route already owns explicit endpoints, bends, width, use and material, so separating its implementation owner identity needs no new architectural decision.

## Local recovery and reference policy

Only four fields change:

| Field | Previous | Recovered |
| --- | --- | --- |
| `connections.0.surfaceId` | `arrival-court` | `route-arrival-drive` |
| `connections.1.surfaceId` | `arrival-court` | `route-guest-walk` |
| `connections.2.surfaceId` | `view-terrace` | `route-ocean-terrace-walk` |
| `connections.3.surfaceId` | `view-terrace` | `route-pool-approach` |

All building/room/feature identities, endpoint references, coordinates, route waypoints, widths, uses, materials, relationships, partitions, door links, requirements and zones remain equal. Lowering derives each route's `via` from its recovered owner ID; feature endpoints and estate references continue to name the existing court/terrace. The new owners do not imply movement or additional amenities.

Recovery is pure, deterministic and idempotent. New IDs respect schema limits and reserve existing declarations before allocation. Literal namespace collisions in architecture remain blocking errors with exact declaration paths; no building, room, roof, material, stair, entrance or partition is silently renamed or merged. Equal material/object IDs and equal facade-child IDs on different hosts remain valid independent namespaces. Reused owner IDs without a feature target are refused when external references cannot identify one route. No generic global string replacement or first-match retargeting is used.

Identity recovery runs locally before architectural lookups. The one existing bounded objective repair remains restricted to diagnosed stair/route geometry. It is not spent on recoverable identity aliases and no additional authoring stage was added. In this failed attempt it was never eligible: duplicate IDs, facade contract failures and unsupported storey heights are outside that repair scope.

## Remaining construction blockers

The exact replay now has no identity failures. It still returns `cannot-construct` at planning, before scene compilation:

1. `ARCHITECTURAL_ASSEMBLY_INPUT` for the villa's `mainEntry`: the current composition schema requires a `door`, whereas Terra chose a `glazed-door`.
2. `ARCHITECTURAL_STOREYS_UNSUPPORTED`: the villa's authored storey heights are **4.2 m and 3.5 m**; this slice requires uniform heights within one mass.
3. `ARCHITECTURAL_ASSEMBLY_INPUT` for the guest pavilion's glazed `mainEntry`.

The glazed-entry failures expose an application contract inconsistency: blueprint instructions call for a ground door, while the broader facade/access system supports walkable glazed doors. Existing canopy derivation also checks `type === 'door'`, so merely relaxing validation would omit intended canopy construction. This recovery does not change door types or discard canopy intent. Unequal storeys likewise need actual construction support or an explicitly authored architectural revision, rather than averaging heights.

Later spatial/interior validation has not run for this exact design because these earlier checks block lowering. Clearing these three findings is not evidence that all remaining relationships are valid. The recovered original and normalized blueprint remain available for further offline work. There is no recovered saveable scene, and no empty placeholder house is committed.

## Replaying without a generation

From the existing preserved capture:

```sh
npm run recover:blueprint -- --source .v3-debug/recovery-2026-10-20-9733be300b2f/original-capture.json
```

Or from the committed regression input, with a separate output directory:

```sh
npm run recover:blueprint -- --source src/lib/v3/__tests__/fixtures/architectural-blueprint-live-2026-10-20.json --output .v3-debug/live-fixture-replay
```

The CLI imports only deterministic planning/construction code, disables `fetch`, and never imports an AI author or API route. Capture replays verify the original hash and refuse redacted/omitted inputs as exact recovery. The default output directory is `.v3-debug/recovered-9733be300b2f/`; it contains `original-input.json`, `original-blueprint.json`, `normalized-blueprint.json`, and `recovery-report.json`. Files use private permissions. Existing different output files are never silently overwritten. A `recovered-scene.json` is written only if construction actually succeeds.

Future development artifacts now preserve each attempted original, the normalized blueprint, exact rename records, target-specific diagnostics and the decision before the existing repair advances. A shared generation ID also correlates both attempt slots with usage `operationId`. Rejected out-of-scope repair output is retained. A pipeline exception retains any completed provider candidate. Derived evidence is dropped before original output when bounding artifact size. Retention remains development-only and the fixed slots still rotate; copy important evidence or run recovery before another generation overwrites it.

## Verification

Offline regression tests cover the exact source hash, four field-only changes, immutability, idempotence, ambiguous references, local namespaces, ID length/collision handling, successful construction of an otherwise valid estate, preservation of both bounded-repair attempts, and SDK/production-route behavior with network-forbidden mocked providers. Architectural blueprint, full-property, draft acceptance and artifact regressions also pass. TypeScript and targeted ESLint checks pass. No live generation endpoint was invoked.
