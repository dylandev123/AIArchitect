# Programme-to-geometry coordination — 29 October 2026

Implemented in the existing direct-scene path. No additional design engine, knowledge store, geometry writer, model call, migration, deployment or silent scene repair. Existing workspace changes were preserved.

## Exact retained failure

Source: `.data/scene-responses/66c57386-4c5c-4f50-a97e-8ec0ec80588b.json`, Water Court Promenade Estate, rejected. Its 33 operations expand to 88 elements. Eleven knowledge selections and 8,311 output tokens were retained; neither the 400-element nor 800-operation budget was exhausted. The source SHA-256 and exact transformed geometry are in `evidence.json`.

Operation indexes below are zero-based.

| Component | World centre | Size | Relevant bounds |
|---|---|---|---|
| `salon` | [0, 0.1, 0] | [18, 0.2, 10] | Walking Y=0.2 |
| `salon-roof` | [0, 4.125, 0] | [20, 0.25, 12] | X=[-10,10], Z=[-6,6]; main solid Y=[4,4.25], rendered soffit/cap bounds Y=[3.92,4.3] |
| `upper-floor` | [0, 3.6, -1.8] | [11,0.2,7] | X=[-5.5,5.5], Z=[-5.3,1.7], walking Y=3.7 |
| `upper-roof` | [0,7.02,-1.8] | [12.2,0.24,8.2] | Main underside Y=6.9; soffit bottom Y=6.82 |
| `upper-landing` | [0,3.6,2.3] | [3,0.2,1.2] | Walking Y=3.7 |
| `upper-door` | [0,4.95,1.7] | [1.8,2.5,0.12] | Sill Y=3.7, head Y=6.2 |

Operation 0 assembles the one-storey `salon`, including its complete roof. Operation 11 adds the upper floor; operations 12–18 add upper enclosure/door and operation 19 adds its separate roof. The suite enclosure spans Y=3.7–6.9. The entire salon roof remains across the upper suite footprint, only 0.22 m above its walking surface at the soffit. The upper floor is also 0.3 m below the salon wall heads, which are at Y=4.0. The intended recessed upper owner retreat was added without revising the lower-storey section or reserving its occupied footprint. A clear upper roof cannot correct a lower roof running through the room.

The historical rejection used an elevation-independent assembly roof-footprint rule. It correctly refused the transaction, but its message did not establish this occupied-volume conflict: it also complained about the vertically separate `upper-roof`. The new replay identifies the actual salon/upper-floor conflict and attributes both assembly operation 0 and add operation 11, retaining all original elements in the recoverable draft.

## Missing relationships and accommodation

The eight entries name plausible architecture but leave bedroom/bathroom subdivisions explicitly unbuilt. Living/dining/kitchen is intentionally an open-plan shell; separate walls are not required merely to label these uses. The owner suite has no bath/dressing subdivision. No metadata now certifies these allocations as complete rooms.

The plan declares `upper-floor above salon`, but does not coordinate that floor with `salon-roof`, lower enclosure heads, the stair path or a roof/slab opening. Independent lower wing eaves also overlap the salon roof footprint. Wing, public/private and outdoor intentions use the existing programme and relationship IDs; they must be checked against the same transformed parts rather than separate coordinate plans.

The stair is present, but unresolved. Operations 22–31 build ten volume steps: walking tops 0.37, 0.74, …, 3.7 m, spaced 0.5 m in Z. The adjacent 0.37 m rises exceed the existing circulation evidence probe of 0.25 m; the upper floor remains reported as unreached. The flight crosses salon enclosure/roof probes; `stair-10` duplicates part of the landing walking surface. A solid landing support also obstructs part of the approach. These are actionable findings, not a certified route analysis. The final programme floor reference literally combines `stair-08`,`stair-09`,`stair-10`,`upper-landing` into a single string; those actual parts exist but that reference cannot resolve. Pool enclosure IDs also use nonexistent suffixes; the open lounge previously failed primitive-only evidence checks despite being a supported fixed component.

## Changes

- Occupied envelope evidence derives from programme/legacy space floor references and local enclosure heads using existing recursive transforms and oriented footprint utilities. Operations remain the coordinate authority. No persistent room-volume ledger was added.
- Flat roofs entering the near-walking portion of referenced occupied space produce an actionable roof/floor/enclosure finding with world centre, dimensions and Y bounds. Roof intersections higher in an enclosure remain review-only because canopies and lower ceilings may be intentional. The 0.5 m near-datum distinction, 0.15 m footprint inset and 0.1 m ceiling tolerance are conservative evidence tolerances, not design standards. Pitched roof bounding boxes do not certify solid collisions and are excluded from this occupied-solid gate.
- Assembly roof-junction checks now require overlapping elevation intervals as well as oriented eave footprints. Vertically separated layers are allowed; actual intersecting envelopes still require explicit junction construction. No union, trimming, relocation or deletion is automatic.
- The resolver stages schema-valid construction, attaches the returned plan, and runs the existing relationship assertion before accepting it. The assertion preserves incremental repair behavior for unchanged historical faults. Rejected drafts retain exact construction and responsible operation indexes, including ancestor assembly operations.
- Programme review exposes per-floor world allocation and walking datums. Circulation may cite volume treads and need not have room walls/roofs. Outdoor pavilion floors/roofs use their supported component semantics. Walls require a walking-height unglazed opening to count as access evidence. Shared slabs and limitations remain visible, never counted as proof of separate rooms.
- New intent-shaped provider Generate responses require programme. Legacy verbose plans already carry per-space construction references and remain supported; historical lean intents remain readable by the runtime. Existing edits retain compatibility. Semantic omissions remain review findings rather than metadata-driven geometry repair.
- Focused stair checks now inspect volume treads and report disconnected adjacent high-rise steps even when no connected tread group forms. Existing headroom, endpoint, slab opening and circulation probes remain active.
- Canonical instructions explain slab-top datums, all-level roof envelopes, explicit lower-roof splitting and final allocation checks. The base prompt remains below the existing 20,000-character ceiling.

## Verification

Run `npx vite-node --config vitest.config.mts scripts/programme-coordination-proof.ts` to regenerate evidence with fetch disabled. It asserts exact 88-element replay, roof IDs/elevations, assembly/add operation attribution, unchanged rejected geometry, programme evidence and stair omissions. It replays multi-level Playground Ladera plus tropical and Mediterranean retained studies without modifying geometry. The latter two have historical unrecorded programme; no missing metadata was invented.

Ladera's separated upper roof is accepted. Its lower entry-canopy bounds produce review-only findings, not rejection. Pitched and transformed-frame regressions are covered separately. A supported two-roof assembly study with explicit posts is included in the evidence and labelled **developer-authored capability proof, not Terra-generated success**. It demonstrates valid separated layers and a programme allocation referencing its actual slab, enclosure, roof and entrance, not a completed correction of the failed estate.

Existing primitives can construct coordinated rooms, split lower roofs, supported multi-level slabs and manual stairs/landings/openings. The single-storey residential-wing assembly does not generate upper rooms, automatically trim its roof, partition bedrooms or create stairs. Those architectural choices must be explicit ordinary operations. No new primitive is necessary for this rectangular estate's coordination failure. Arbitrary mesh/roof unions, certified navigation, structural engineering and code compliance remain outside this work.

No claim of improved autonomous model output is made: this is offline construction/contract evidence. No rendered visual review or new Terra generation was performed. Validation passed: 162 tests across 29 files, TypeScript and targeted core lint. Logs are recorded alongside this report.
