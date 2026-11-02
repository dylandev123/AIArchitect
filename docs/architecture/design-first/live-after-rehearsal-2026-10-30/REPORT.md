# Reef Court Estate — design-first live experiment stopped after Call 1

**Terra did not produce a construction-ready exceptional mansion proposal. Paid execution stopped after one call. No construction request, retry, fallback, accepted house or new render was produced.** The harness completed real retrieval and provider submission correctly. The returned proposal failed the existing semantic spatial validation before the seven-criterion callback could run. Offline investigation confirms substantive missing architectural coordination beyond the first validation error.

## Actual execution and cost

| Item | Observed |
|---|---|
| Model | `gpt-5.6-terra` |
| Calls / retries | **1 paid call / 0 retries** |
| Provider result | HTTP 200, `completed`, normal stop |
| Route result | HTTP 422, inconsistent selected spatial relationships |
| Input tokens | 14,056; 0 cached-read tokens |
| Output tokens | 6,612, including 128 reasoning tokens |
| Total tokens | 20,668 |
| Estimated cost | **US$0.107456**, repository rates; excludes any cache-write premium |
| Construction operations / constructed scene | **0 / none** |

The provider also reports 14,053 cache-write tokens. That field is preserved; the repository estimator does not price cache-write premiums, so this is not an invoice total. [Exact response](design.provider-response.exact.json), [exact request](design.provider-request.exact.json), [HTTP metadata](design.provider-http.json), [usage and cost](usage-and-cost.json), [route result](result.json).

The original brief and prepared payload hashes were verified before execution. The unchanged request used the design-first workflow and normal architectural knowledge retrieval, provider-default reasoning, strict structured output, 30,000 maximum output tokens and zero retries. Real library reads returned 128 rows; the callback and Promise paths completed. PostgreSQL [reported read-only mode](database-read-only.json). Initializer DDL was suppressed, usage INSERTs were intercepted into local evidence, and no production database writes occurred. No credentials were printed or changed.

## What Terra actually proposed

**Reef Court Estate** selects a central living pavilion with two mirrored, two-storey suite wings, a broad ocean terrace, a rectangular pool court, a separate lounge pavilion and a planted waterfront reserve. The proposal contains **32 anchors, 11 spaces, 8 routes and 10 spatial relationships**. [Exact proposal output text](proposal.provider-output.exact.txt), [schema-parsed rejected proposal](proposal.REJECTED.json), [programme/spaces/routes/relationships](programme.proposal.json).

Committed occupied slabs are a 16 × 12 m central floor (192 m²), two 10 × 18 m ground wing floors (360 m² combined), and two 10 × 13 m upper floors (260 m² combined): **812 m² of gross slab rectangles over two levels**. This is proposed geometric capacity, not built or net usable floor area. It excludes terraces, pool, driveway and roof area. No completed room or usable suite is certified.

There are more explicit individual suite allocations than in the prior 776 m² attempt: two 90 m² ground suite zones and four 65 m² upper zones. There are upper floors, a clearer arrival screen idea, tall bronze-framed ocean glazing and a separate outdoor destination. These are real authored intentions. However, the underlying composition remains a central social rectangle with mirrored private rectangles; the crucial suite, circulation and envelope architecture is deferred rather than resolved.

## Stopping point and offline diagnosis

The JSON schema parsed successfully. The unchanged `validateDesignProposal` then found six inconsistent declared relationships and stopped before committing a proposal or invoking the checkpoint callback. The complete provider output was already retained. The extraction/investigation script is offline only and does not resume the route, repair geometry or call a provider.

| Submitted claim | Actual unchanged anchor evidence |
|---|---|
| Central floor-to-roof clearance 5.4 m | Current roof component bounds give **5.32 m**; the extra 0.08 m flat-roof underside extent explains this small discrepancy. It is not the central architectural failure. |
| Each upper wing roof is more than 3 m clear of central roof in plan | Roof rectangles **overlap by 1 m in plan**. They are at different heights, so this does **not** establish a physical roof collision; it contradicts the submitted plan-separation claim. |
| Terrace touches pool coping at zero clearance | **0.5 m gap** between committed slabs. |
| Pool faces living pavilion | Pool yaw 0 faces +Z, while the living pavilion lies toward -Z. The prose describes the pool being in front of the house; the relationship encodes the opposite direction. |
| Lounge deck touches coping at zero clearance | **1 m gap**, with connecting path left for later construction. |

These six findings include two roof-clearance findings. They are not six aesthetic ratings. [Full offline investigation and numeric metrics](offline-investigation.json) retain the existing checks without exemptions.

Further independently observed problems remain:

- **Four upper suites have empty `accessIds`.** No stair, landing, stair opening or upper entrance anchors exist. Routes refer only to upper and lower slabs and promise later stairs. Suites 03 and 06 have no route entries at all.
- **The four wing-shell anchors are solid `wall` blocks**, 10 × 18 m or 10 × 13 m in plan, with no openings. The text asks construction to split them into facade bays and suite partitions, while the construction contract requires retaining every anchor unchanged. These are not already hollow or partitioned envelopes.
- **All 11 spaces use floor-top Y as their centre Y.** The contract uses centre-origin space boxes. For example, the great room's centre is Y=0.2 with height 5.4 m, putting its bottom at Y=-2.5 rather than the floor top Y=0.2. The unchanged fidelity check reports walking-datum mismatches for all spaces.
- **Important arrival and garden links are absent.** The forecourt ends at Z=-8 and the main entry is near Z=-6.19. The living floor ends at Z=6 and the terrace begins at Z=8. Each private wing is 2 m from the central floor. No committed bridging floors resolve those gaps.
- **The pool coping is a filled 20 × 9 m plate**, not a perimeter with a hole. The water is beneath it at Y=-1.15; a basin, segmented coping and dry paths are deferred. Replacing the plate with segments conflicts with the immutable anchor commitment. No actual infinity edge is selected.
- **Programme detail remains incomplete.** Kitchen, service, bathrooms, dressing, suite divisions and much facade detail are deferred; two ground suites are explicitly `allocated-capacity`, four upper suites `planned-accommodation`.

Some additional contract issues are narrower than architectural defects: ground suites reference upper plates as roofs, and the lounge references a pavilion as its roof. Those may be physically reasonable overhead elements, but the current proposal validator requires `roof` kinds. They were recorded as contract mismatches, not used as proof that a ceiling slab or pavilion cannot shelter space. The 8 cm roof-bound discrepancy and directional relationship semantics also do not by themselves explain the architectural failure. Missing access, solid shells and unresolved commitments do.

## Seven existing criteria, exact proposal hash

The live callback was **not reached** because semantic validation failed first. To satisfy the requested criterion evaluation without resubmission, a single offline assessment applies all seven unchanged criteria to the exact rejected proposal. It cannot release construction: the live process has terminated. No additional model review was requested.

Proposal SHA-256: `130df7f794eb661206ec3974b900a26e1949ab2c3c70c89a4854bae857cc1760`.

| Criterion | Verdict | Decisive evidence |
|---|---|---|
| Distinctive massing | Fail | Repeated central-and-mirrored-wing composition; wing architecture remains solid envelope blocks and deferred articulation. |
| Volume hierarchy | Unresolved | Wider social pavilion is legible, but “lower” private wings have roof centres Y=7.16 versus central Y=5.72; claimed tall-centre hierarchy is not coordinated with the section. |
| Six individual suites | Fail | Six named zones, four missing access anchors, shared undivided shells and deferred suite divisions. |
| Circulation and arrival | Fail | No stairs, landings or upper doors; missing routes and connecting slabs. |
| Waterfront and outdoor relationships | Fail | Promising sequence but disconnected dry slabs, filled coping plate and no committed infinity edge. |
| Construction precision | Fail | Six relationship mismatches, all space datums incorrect, and incompatible split-shell/preserve-anchor instructions. |
| Estate ambition | Fail | Estate-sized allocation and luxury materials do not establish a complete, sophisticated accessible mansion. |

[Full exact-hash assessment](checkpoint.assessment.offline.json). Six criteria fail, one remains unresolved, none passes. Call 2 was prohibited independently by semantic rejection and the architectural evidence.

## Answers to the requested evaluation

1. **Exceptional luxury mansion or another generic arrangement?** Another underdeveloped central-pavilion/mirrored-wing arrangement, now with upper floors and a poolside destination. An exceptional mansion is not established.
2. **Sophisticated coordinated architecture before construction?** No. There are useful intentions and numeric anchors, but access, actual wing enclosure, suite boundaries, floor datums and outdoor connections are unresolved or contradictory.
3. **Six suites, circulation, entrance, volumes and exterior spaces meaningfully developed?** Six suite zones are named and sized; four lack committed access. The entrance has a real door and screens, but its approach is disconnected. Volumes and exterior sequence exist as bounds; important architecture is deferred.
4. **Did construction faithfully reproduce the proposal?** Unassessed: construction was never requested. There is no translation or rendering loss to attribute in this run. The failure already exists in the proposal.
5. **Does the finished house look substantially better than the previous 776 m² and 952 m² attempts?** Unassessed: no finished house or new renders exist. A proposed 812 m² and two levels do not establish visual improvement. The additional suite labels, upper levels and lounge are observed differences, not proof of accomplished architecture.

## Preservation and verification

[Verification manifest](verification.json) records one call, zero construction operations, the exact proposal hash, cleanup, usage and artifact hashes. [Historical preservation](preservation.json) confirms all **237 checked historical files remain byte-identical**. Every source file captured before live execution remains unchanged. [Cleanup](cleanup.json) confirms fetch/query prototypes restored and database pools closed. All original failure and rehearsal evidence remains intact.

Only an offline investigation script and new evidence files were added after execution. No Terra guidance, knowledge, contracts, criteria, model settings, operation limits or construction geometry changed. No manual replacement house, speculative render, retry, fallback model, production database write, commit or deployment occurred. The experiment is closed after its architectural validation failure; no automatic continuation is authorized.
