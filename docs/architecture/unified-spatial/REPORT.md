# V3 unified spatial geometry and blueprint realization

19 October 2026. Offline implementation and replay of both recovered estates, including each original and repair response. No Terra/OpenAI requests, paid generations, commits, pushes or deployment. Existing uncommitted work and recovered evidence were retained. No V2, terrain, saved-project data or fixed architectural templates were changed.

**Recommendation: GO for a separately authorized, bounded live evaluation; NO-GO for broad activation or a claim of reliable luxury design.** The offline geometry-authority milestone passes. The original invalid generations still fail for real contradictions. Creative quality and natural provider reliability remain unmeasured. Nothing in this work starts a live generation or changes environment flags.

## Canonical geometry

`src/lib/v3/routeGeometry.ts` is the common interpretation of flat estate circulation. `resolveEstateRouteGeometry` resolves the path once into segment probes and the actual render triangles. Its consumers do not reconstruct circulation from an independent path rectangle.

| Authored authority | Derived result / consumers |
| --- | --- |
| `objects[].architecture`, `composition.footprint`, openings, roof and stair intent | Existing V3 architectural materialization and construction; no new massing or stylistic generator |
| `estatePlan.circulation[].spatial`, stable endpoint/opening ids, explicit bends and width | Canonical endpoints, adjacent-point deduplication, occupied strips, render triangles and compatibility bounds |
| Canonical occupied strips | Allocation checks, route obstacles, endpoint contact with other routed surfaces, door-contact completeness, consistency/repair evidence |
| Named entrances and compiled junction passages | Architectural access graph, without using the generic exterior node to imply an internal passage |
| Original decisions plus the same candidate geometry | Objective/design repair scope, width/destination preservation and candidate collision checks |

Construction directly consumes canonical route triangles. Width is `spatial.width`; an owner's envelope dimensions do not change the ribbon. Normalization derives owner compatibility bounds from those triangles, accepting an owner with only identity, type and material. Local V3 operations refresh those bounds after a route or named-opening edit. Independent move/resize/rotate edits of a derived route owner are rejected; `replaceEstatePlan` edits the actual route using its stable id. Materials remain on that owner. An invalid spatial route does not fall back to displaying its unrelated box.

Adjacent repeated coordinates, including repeated start/end waypoints, add no geometry. A 1e-8 m numerical tolerance also handles arithmetic roundoff from a derived door centre. Collapsed paths, genuine segments of 0.01 m or less, ambiguous owners, invalid widths, unsupported hierarchy/grade and missing endpoint choices remain rejected. The historical flat ribbon triangle order and butt-ended bend treatment are retained.

The blueprint index remains an index into **one V3 geometric planning representation**: the existing architectural fields plus estate routes, constraints and relationships. Supported route geometry now drives construction, allocation and contact instead of being checked against independently authored boxes. This is not a new scene system or a separate provider planning/elaboration call. One response still carries the plan and detail; the application cannot prove the chronology of Terra's private design process.

## Boundary access and endpoint decisions

Optional `estatePlan.siteAccess` records contain `{id,boundary,point}`. Boundary is `north`, `south`, `east`, `west` or `boundary`; coordinates must actually lie on the specified origin-centred site edge and ground datum. These are stable editable semantic identities, not fake scene objects. A side name alone never supplies a gate coordinate or a road.

A spatial endpoint may omit `point` when it names an explicit site-access record or an explicit ground door/glazed-door `openingId`. V3 derives the latter's exact addressed wall-span centre, including rotated, recessed, line and arc geometry. Explicit coordinates are preserved and validated, allowing intentional off-centre approaches. Missing opening choices, ambiguous wall addresses and unnamed surface endpoints remain errors. V3 does not pick a nearest door, a surface centre or a detour.

## Architectural access

Program entries support `access: required | inferred | optional`, with inferred behavior when omitted. Requirements apply to meaningful destinations, not every program member. Roof forms, planting, generic nonwalkable components and path ownership metadata are not separate estate destinations. Usable roof terraces retain their existing circulation/completeness checks.

Endpoint-valid estate routes seed access evidence. The existing completeness graph contributes real doors, contiguous dry surfaces, usable vertical circulation and shared-wing passages tested against compiled wall/glazing barriers. Its generic exterior node is excluded from this inference. Route collision validation is still mandatory; access evidence alone cannot approve a blocked route. Tests prove that an additional solid partition seals an otherwise connected shared wall despite touching masses and a `connects` declaration.

A pool can receive its dry approach through a reached, walkable containing deck at the pool-rim level. Water never becomes a transit edge between disconnected decks. Swimming entry equipment and a step-free transition are not certified. An isolated pool still reports missing access.

A physically evidenced connection and an explicit roof host no longer require redundant mirrored scene edges just to pass planning. Missing aesthetic `aligns` mirrors are advisory when both identities exist. Dangling references and real geometric contradictions still block. Views/privacy/style remain unverified aesthetic considerations.

## Confirmed bugs corrected

- The eight inappropriate destination requirements: five roofs, two internally connected wings and a deck-accessed pool.
- The five repeated-endpoint route failures, preserving the earlier audit's correction and extending it for derived-coordinate roundoff.
- Route allocation and door contact using unrelated object boxes instead of the ribbon.
- Canonical path owners without box geometry being omitted during normalization.
- Building/site endpoints requiring an object even when a separately authored boundary identity is appropriate.
- Repairing the redundant owner box instead of the actual route, and accepting route corrections without checking preservation and corridor safety.
- Owner bounds becoming stale after local route edits; independent box transforms pretending to edit a derived path.
- Extra mirrored declarations blocking already evidenced roof hosting and physical connectivity.

The failed-preview identity fix that recovered all 23 objects was existing uncommitted work and is retained, not claimed as a newly introduced fix.

## Exact failures in the untouched recovered generations

`live-replay.json` records full production ingestion and clearly separated investigative downstream compilation. `remaining-failures.json` lists every blocking issue, exact target ids and messages. The raw provider fixtures were not edited.

| Recovered response | Retained objects | Accepted | Blocking findings |
| --- | ---: | --- | ---: |
| Cloister initial | 23 | No | 11 |
| Cloister repair | 23 | No | 5 |
| Earlier Canopy initial | 19 | No | 25 |
| Earlier Canopy repair | 19 | No | 22 |

Both Cloister responses retain these real route failures:

- `ESTATE_ACCESS_POINT_MISSING`: `siteNorth`, `driveway`. An endpoint at `[0,0,-60]` is authored, but neither original explicitly declares the boundary identity. Production does not invent it.
- `ESTATE_ROUTE_BLOCKED`: `guestPath`, `guestPavilion`. The 2 m route follows the west wall at x=38 instead of approaching it externally, occupying about 5 m² of the pavilion footprint.
- `ESTATE_ROUTE_BLOCKED`: `wellnessPath`, `wellnessPavilion`. The mirrored approach follows the east wall at x=-38, occupying about 6 m².

The repair additionally has two `ESTATE_ALLOCATION_CONFLICT` findings: `zone-guests/guestPath` and `zone-wellness/wellnessPath`. Both zones stop at z=-23, while their full 2 m ribbons reach z=-24. The old box-based audit missed these real 1 m overruns. Initial Cloister also has `BLUEPRINT_SITE_BOUNDS/palmGarden` and seven allocation findings: arrival/driveway, arrival/entryWalk, water-garden/palmGarden, guests/eastGarden, guests/guestPath, wellness/westGarden, wellness/wellnessPath. These eight plus the three route failures total eleven.

Both earlier Canopy responses retain the following 22 blockers:

| Code | Exact affected relationships / targets | Count |
| --- | --- | ---: |
| `ESTATE_FORM_UNBUILT` | `arch-water-garden`: poolTerrace, reflectionPool, sunsetLawn do not form the declared touching composition | 1 |
| `ESTATE_ALLOCATION_CONFLICT` | arrival: arrivalDrive, entryWalk, arrivalGarden; residence: poolTerrace; water: poolTerrace, sunsetLawn, southGarden; guests: westGarden, guestWalk; wellness: eastGarden | 10 |
| `ESTATE_ACCESS_DISCONNECTED` | entryWalk→mainResidence; mainResidence→guestWalk; guestWalk→guestPavilion; mainResidence→wellnessWalk; wellnessWalk→wellnessPavilion | 5 |
| `AUTHORED_ACCESS_DISCONNECTED` | mainResidence/entryWalk, mainResidence/wellnessWalk, mainResidence/guestWalk, guestPavilion/guestWalk, wellnessPavilion/wellnessWalk | 5 |
| `AUTHORED_SITE_OVERRUN` | southGarden extends to z=67 on a site ending at z=60 | 1 |

Canopy initial additionally has three `FOOTPRINT_FACADE_AMBIGUOUS` failures on mainResidence: southDiningDoor, southLivingDoor and southUpperDoor cross different recessed wall planes. The historical repair fixes those three. The remaining approach gaps are 1.4, 3.5, 3.5, 3.5 and 2.5 m respectively. These are real authored gaps in standalone rectangular surfaces; they are not silently converted into newly chosen routes.

Advisory threshold heights, removed shared-wall opening observations, budget/style verification and entrance-index coverage remain visible separately. They do not become new external route demands.

## Repair preservation and deterministic proof

The historical repair widened guestPath and wellnessPath from 2 to 23 m because box-based contact/containment diagnostics contradicted the intended 2 m bent routes. Enlarging those boxes appeared to enclose the approach region while leaving the actual route unchanged. This never fixed the wall-following paths.

Now those boxes are derived compatibility envelopes. A bent path can legitimately have a wide envelope while retaining a 2 m corridor. A box edit cannot enlarge the corridor. Direct unrelated owner geometry edits fail preservation; changing actual route width from 2 to 23 m is rejected independently by objective and design repair. Candidate routes must retain endpoint identities, use and width, stay within local scope and pass the same obstacle/boundary/endpoint checks. The local path comparison samples both old and new paths, preventing a distant detour or a long shortcut hidden between unchanged vertices. Standalone flat paths also reject enlargement beyond 1.5 times an original dimension and new obstacle intersections; larger corrections require explicit replanning.

An explicit missing boundary record may be added only for a diagnosed missing endpoint id at its **already authored coordinate**. No repair can choose a new gate/road position. Valid route geometry, building positions and dimensions, curves, roofs, openings and materials remain protected by the existing preservation rules and blueprint approval snapshots.

`parity/unifiedSpatial.ts` contains clearly isolated **test-author decisions**, never runtime repair rules. Starting with Cloister repair, it adds the explicit siteNorth record, moves the existing pavilion approach bends to x=±35 before perpendicular approaches to the unchanged doors at x=±38, and extends the two diagnosed allocation boundaries by 1 m. It changes no buildings, roofs, materials or unrelated objects. This scene passes blueprint approval, ingestion, consistency, geometry and the objective preservation assessment. The actual API route accepts these explicit local corrections within its existing single mocked follow-up. It also accepts identity/material-only path owners and derives their geometry locally.

The original historical repair still fails preservation because of protected relationship-plan and scene-relationship changes. Its redundant box inflation is neutralized by canonical normalization, not treated as an architectural success.

## Verification and visual evidence

Final results are recorded in `checks.json`. Regression coverage includes the four untouched recovered responses, explicit local corrections, all five boundary forms, constructed cardinal entrances, stable-id edits, rotated/recessed/curved endpoints, duplicate waypoints, isolated pools, sealed shared walls, invalid enlargement/collisions/detours, and production API replay with mocked providers. Existing saved-mansion SHA-256 construction baselines and the diverse blueprint/curve/roof corpus remain intact.

Ten screenshots in `webgl/` use the production PrimitiveMesh, edge finishing, environment, sunlight, shadows and PostFx through the existing dev-only read-only fixture viewer. `webgl/capture.json` records initialized WebGL 2 contexts, full canvas sizes, zero page errors and zero attempted provider requests. The capture script blocks provider endpoints. Plan, arrival and pavilion views show the unchanged architecture and the explicitly corrected external approaches; earlier Canopy overview views retain its real authored gaps. These are production-renderer captures, not a deployed production build. Initial blank captures were discarded and replaced after fixing the capture hostname and waiting for actual renderer initialization.

## Remaining limits and next evaluation

Flat estate routes still require one exclusive surface owner, no site hierarchy, and a flat site datum. Advanced terrain connections retain their existing implementation. There is no automatic routing, bridge invention, arbitrary curved route spline, mitered bend/clear-width certification, general roof intersection construction, engineering/code certification or luxury-quality scoring. Pool equipment and finished doorway steps remain separate architectural decisions. Legacy non-spatial routes retain their actual authored surfaces; an ambiguous missing door or architectural replan is not automatically repaired. Invalid canonical route previews intentionally omit their former unrelated fallback boxes.

The plan and detail still arrive in one provider response, and broad subjective requirements can remain advisory. The implementation proves deterministic supported construction and rejection of real contradictions; it does not establish a natural-provider success rate or extraordinary originality. A bounded, separately authorized live evaluation can now measure first-attempt/final acceptance, repeated geometric errors, preservation, token/latency headroom and human architectural quality. Keep the one-follow-up limit and require human review of the resulting architecture before considering broader activation.
