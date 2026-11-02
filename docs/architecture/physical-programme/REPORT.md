# Physical programme, scale and architectural ambition

The confirmed failure is **underdeveloped programme and composition at authoring time**, rather than a renderer shrinking a developed mansion. The retained houses are not all tiny: one has 952 m² of principal gross shell plates. Neither that area nor a $25m label establishes a complete estate. New Generate now makes numeric accommodation demand explicit and compares it with actual floor capacity. **Improved live Terra design decisions remain unverified.** No new AI calls were made.

1. **Why have the houses been smaller or simpler than requested?**

   The normal path is brief → knowledge retrieval/request guidance → one provider response containing architectural intent and construction operations → assembly expansion → atomic construction/relationship gates → architectural audit → saved scene and `OperationScene`/`VillaScene` rendering. There is no separate room planner automatically constructing the narrative. Geometry belongs to the operations.

   The explicit $25m response recognized value as ambition, explicitly distinguished it from construction budget and chose six suite pavilions and an 18 m salon. Its own plan selected a low pavilion estate and described service within the salon; it did not budget room net areas, bathrooms/dressing, circulation, service and walls against the envelope. It claimed accessible viewing architecture, but authored the known unusable stair. The separate massive-mansion response explicitly planned one storey and roughly 950 m². Both simplified architecture **in the authored plan**, then constructed those shells with further omissions. There is no retained large, complete room plan subsequently reduced by assembly or rendering.

   The missing software relationship was measurable demand versus built capacity. The concise intent format required references but no numeric accommodation allowances. Existing reviews checked references, roof/enclosure/access evidence and legacy declared areas; they could not compare an intent-format six-suite allocation against a chosen spatial budget. Shared slab labels were capacity descriptions, not six rooms. This change addresses that specific gap.

   Helper convenience, the cost of coordinating many coordinates and conservative collision checks may encourage simple shells; these remain hypotheses about model choices. Prior evidence demonstrated uptake of a supplied concept example and equal-bay helper repetition; those restrictions/examples had already been addressed. This task does not claim those earlier fixes as new work.

2. **What dimensions and features did the retained attempts actually construct?**

   Measurements below use world transforms and explicitly selected residential floor parts. Sums are **gross rectangular plate evidence, before wall deductions**, not certified enclosed/net area. Bounds include gaps between wings; they are not occupied floor area. [Machine-readable measurements, input hashes and current audits](measurements.json).

   | Retained evidence | Principal physical floors | Gross plate sum | Principal floor bounds | Residential floor tops |
   |---|---|---:|---:|---|
   | Earlier Caribbean Horizon House, original brief redacted | 16×9 m central slab; 8×11 and 8×10 m wings; 7.4×6.4 m upper slab | 359.36 m² | 32×11 m | 0.20, 3.40 m |
   | Explicit $25m six-suite estate, rejected | 18×11 m salon; six 8×6.5 m suite shells | 510 m² | 38.72×23.34 m | 0.20 m |
   | Separate “massive Caribbean mansion on the water” | 28×14 m hall; two 14×20 m wings | 952 m² | 58×20 m | 0.20 m |
   | Four-bedroom family reference | 12×8 m living floor; 6×12 and 6×10 m wings | 228 m² | 24×12 m | 0.15 m |
   | Retained 8 m narrow-site residence | 7×10 m lower bounds; 6.3×5.7 m upper bounds | Withheld: profiled floor/void | 7×10 m | 0.15, 3.60 m |

   The $25m estate includes a 13×12 m pool, terraces, suite walks, open curved lounge and an elevated 7×4.5 m viewing deck. The deck is not an upper residential level; its stair, wall passages and several connections remain defective. Six 52 m² gross shells do not establish six completed suites with bathrooms/dressing. The massive response has an 18×10 m pool, terrace and subordinate entrance canopy, with symmetric, lightly developed wings. Its wall heights are 4 m at the hall and 3.5 m at the wings. More gross area did not produce differentiated accommodation or compelling vertical hierarchy.

   The family request was “Design a contemporary family house with four bedrooms, a pool, private garden and covered outdoor dining.” Its 47 elements were never a mansion requirement. Its prose says approximately 220 m²; its three selected plates sum to 228 m². Wing access and interiors remain unverified. The narrow response demonstrates two authored floor datums, but small upper capacity and a profiled void still need actual-surface/headroom review. Width bounds alone do not certify setbacks, eaves or routes.

   Current authored-operation replay matches the earlier Horizon House and massive-mansion element geometry exactly. The rejected estate has a historical pool-helper default difference: two side coping parts now expand to 0.6 m width at X ±6.8 m, versus retained 0.7 m at X ±6.85 m. This does not change residential floors or explain the architectural scale failure. All three retained expanded scenes replay exactly, including current safety rejection where applicable; captures use the original retained elements. No helper default or historical evidence was rewritten.

   Earlier Horizon House has a redacted retained prompt: its original $25m/suite requirements cannot be independently established. Its exact geometry replay now encounters current pool safety rejection; that rejection is recorded rather than exempted. The explicit $25m request is preserved [here](../terra-controlled-estate-2026-10-29/request.json). The separate massive-mansion wording is retained [here](../architectural-bottleneck/latest-evidence.json); it supplied neither a dollar value nor a suite count.

3. **Was the plan too small, or did construction fail to realize it?**

   Both planning incompleteness and construction omissions occurred. The $25m plan selected six relatively small private shells without a full quantified accommodation budget and did not deliver requested multilevel residential composition. Construction also failed its promised stair/access and omitted interiors. The 952 m² plan was already broad, single-storey and symmetric; the builder faithfully realized it. Its failure cannot be diagnosed as insufficient total square metres alone. There is no justified universal minimum estate size or price-to-area ratio in this evidence.

4. **Which software limitations contributed?**

   Confirmed: no numeric demand in the current intent contract; generous shared floors could be assigned multiple labels without an area budget; exterior-first scope deliberately defers interior subdivision; shell helpers make a repeated one-storey envelope cheap to author. Geometry safety acceptance does not mean programme completion or aesthetic quality. A new render cannot supply absent rooms. Camera auto-fit normalizes frame occupancy, so screen size is not a ruler; the measured 58 m house can occupy a similar frame to a much smaller house. No renderer geometry reduction was found.

   Existing limits remain 400 elements, 800 authored/expanded operations and the route's 30,000 output-token ceiling. The rejected estate used 36 authored operations/128 elements and stopped normally with 9,047 output tokens including reasoning; the massive response used 20 operations/76 elements and 5,217 output tokens. Neither exhausted capacity. Arbitrary dimensions, multiple elevations, facade parts, supported stair helpers and split roofs already exist. No new engine or geometry kind was warranted by this evidence. There is no automatic complete room/route solver; planting, surveyed slopes, specialist systems and engineering verification remain limitations. Current editable profiles exist, but their bounds do not certify usable area.

5. **What changed in normal Generate?**

   `physicalProgramme.ts` adds a small demand contract: property type, brief/site/value reasoning and grouped allocations with quantity, net area per unit, additional allowance and final floor IDs. New Generate provider schemas require it; historical plans remain readable. The model chooses sizes from accommodation and site, not a mansion preset. Guidance now requires suite bathrooms/dressing, living/service space and gross allowances, then resolves demand into footprint and reachable levels before details. Failure to fit must be disclosed, not silently reduced.

   `reviewSceneArchitecture` now exposes `physicalProgramme` and includes its discrepancies in existing architectural findings. Shared/partially shared floor references are merged transitively: each physical slab can be spent once. Rectangular capacity uses actual dimensions and world datums. Missing/non-floor references, coincident or rotated overlapping floor bounds and profiles withhold capacity. Underprovision reports required versus available m². This never changes geometry or relaxes a construction gate. Visual review now explicitly prioritizes property scale/programme, connected composition, exterior identity, then component refinement; broader redesign requirements must be reported before local cosmetic work.

   Existing local recovery of historical/malformed intent remains: usable geometry may be retained with incomplete architectural findings. Missing numeric demand is reported as unrecorded, never inferred or fabricated. A provider contract is not a room solver. Ordinary Generate construction acceptance still does not certify a successful mansion.

6. **Can the software represent and verify appropriate programmes now?**

   It can express numeric demand and detect insufficient gross floor capacity without trusting room counts. A 650 m² developer demand fails on 198 m² of floor; repeated/shared references cannot make it pass. Adequate capacity is deliberately labelled `capacity-only`. It is an upper bound: enclosure, distinct suites, living-space quality, usable stairs, connected wings, requested amenities and visual presence still require the existing construction/programme/visual evidence. The model could still choose implausibly small allowances or omit a requirement; there is no new natural-language brief certification or automatic aesthetic score. Actual-surface profile area and full navigation remain unverified. This is a useful necessary check, not complete architectural verification.

7. **Does it generalize to modest houses and estates?**

   Deterministic capacity mocks cover an affordable three-bedroom home (90 m² demand/90 m² floor), a six-suite waterfront estate (650/720 m²), and an 8 m site with 1 m side reserves (135/144 m² across two 6×12 m floors). These run the normal provider adapter and executor; every intentionally unenclosed mock remains architecturally incomplete. They are numeric regression fixtures, not manually reconstructed reference houses or successful model architecture. Tests also cover shared/partially shared slabs, yaw, nested transforms, missing floors, profiles, required provider fields and legacy reads. There is no minimum size rule forcing a compact home to grow. Site reservations in this fixture are explicit; general site/eave fitting is not newly automated.

8. **What remains unverified?**

   Whether Terra will choose credible allowances, preserve all requested accommodation and actually author a connected, distinctive estate under the changed contract. Offline mocks cannot answer that. Neither a larger shell nor fewer warnings demonstrates accomplished architecture. No historical scene was remodeled or relabelled successful.

   Sixteen new offline captures render four unchanged retained scenes through normal `OperationScene` and `VillaScene`. Every capture verifies rendered element IDs/local positions/yaw, no page errors and no WebGL context loss; APIs and non-local resources are blocked. The renders show repeated shell composition, limited entrance hierarchy and unfinished landscape. They demonstrate the diagnosis, not improved live output.

   | Scene | Arrival | Aerial | Garden | Poolside |
   |---|---|---|---|---|
   | $25m rejected estate | [View](estate/arrival.png) | [View](estate/aerial.png) | [View](estate/garden.png) | [View](estate/poolside.png) |
   | 952 m² massive house | [View](massive/arrival.png) | [View](massive/aerial.png) | [View](massive/garden.png) | [View](massive/poolside.png) |
   | Family reference | [View](family/arrival.png) | [View](family/aerial.png) | [View](family/garden.png) | [View](family/poolside.png) |
   | Narrow-site reference | [View](narrow/arrival.png) | [View](narrow/aerial.png) | [View](narrow/garden.png) | [View](narrow/poolside.png) |

9. **What exact test should run next?**

   Only after separate authorization for a paid call: run **one normal Generate with the exact retained $25m request**, unchanged configured model/reasoning/token limit, zero retries and current retrieval. Preserve the exact wire, raw response, original operations and scene, usage and all findings. Do not send a manually designed layout or a mandatory mansion footprint. Before judging details, compare its six-suite plus living/service/circulation demand against distinct floor geometry and inspect its room/wing allocations, occupied levels, actual supported access and site/outdoor composition. Render arrival, aerial, garden and poolside unchanged. Require credible suite capacity, substantial living/service space, coherent connected architecture and convincing presence, with every omitted requirement explicitly recorded. If it only supplies larger repeated shells, it fails the milestone even if area and hard gates pass. Unresolved safety findings remain failures; minor component refinement is evaluated after the whole-property result. This single run would be a diagnostic, not reliability evidence. Nothing was called or scheduled here.

Verification: **353 tests pass across 52 files**, typecheck and focused ESLint pass. See [tests](tests.json) and [verification manifest](verification.json). No paid calls, new live generations, production database operations, migrations, credential changes, commits or deployments. Original scenes/provider responses and pre-existing uncommitted work were preserved. The dev preview is read-only and disabled outside development.

Offline reproduction:

```sh
npx vite-node --config vitest.config.mts scripts/physical-programme-offline.ts
npx vitest run src/lib/villa/scene src/lib/library/architecture src/app/api/ai/scene/route.test.ts src/app/api/ai/scene/route.providerSchema.test.ts src/app/api/ai/scene/visual-review/route.test.ts
npm run typecheck
npm run dev -- --hostname 127.0.0.1 --port 3015
node scripts/physical-programme-capture.mjs estate
node scripts/physical-programme-capture.mjs massive
node scripts/physical-programme-capture.mjs family
node scripts/physical-programme-capture.mjs narrow
```
