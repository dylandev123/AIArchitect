# V3 Blueprint-Driven Construction v1

20 October 2026, America/St_Lucia. The entrance → authored pedestrian approach → destination relationship now has an opt-in blueprint construction contract. Terra chooses the existing entrance and route design; V3 derives contact and optional wall-normal approach geometry. **NO-GO for another paid generation.** One explicitly corrected recovered estate passes production ingestion; the other retains independent contradictions. This is a bounded horizontal access-construction proof, not certification of estate quality or step-free access.

No Terra/OpenAI calls, paid generations, V2/terrain changes, project writes, commits, pushes or deployment occurred. Prior uncommitted work was retained. All recovered raw responses and saved-mansion fixture files remain unchanged. Tests use offline fixtures and mocked provider calls. The browser capture blocks AI and project APIs.

## 1. Geometry duplication traced and removed

The reports were checked against the present implementation, including `routeGeometry.ts`, `estateSpatial.ts`, `estateAccess.ts`, `completeness.ts`, `zoneGeometry.ts`, `blueprint.ts`, `blueprintApproval.ts`, `safeRevision.ts`, `operations.ts`, `generation.ts`, roof planning and production compilation. Earlier work already established canonical route ribbons, optional named-opening endpoint derivation, measured zones and explicit boundary access. This change builds on those systems.

| Relationship | Existing repeated authorship / independent constraint | Safe derivation and remaining architectural decision |
| --- | --- | --- |
| Door and walkway contact | Opening wall/segment span, blueprint entrance entry, route openingId and optional world point; terminal waypoints may repeat that point. `serves` also names an outdoor destination. | **Implemented:** a route references the blueprint entrance entry. Its contact is derived from the actual opening. An optional authored approach distance yields an exact outward wall-normal anchor. No second endpoint coordinate or openingId is allowed in this mode. `serves` remains a semantic claim, not a source of route coordinates. |
| Connected outdoor spaces | Surface placement/footprint, route surface endpoint points, scene `connects` edges and planned connections. | Existing spatial access reuses physical geometry. Which surfaces connect, where on a surface, route bends, width and level transitions remain decisions. A surface centre, shared edge or outdoor sequence cannot be chosen from a textual `connects` claim. |
| Pool/deck boundary | Pool and deck footprints, `contains`/`connects`, program membership and route destinations. | Existing measurement proves dry perimeter containment/contact. It cannot derive a deck size/shape or swimmer access equipment without an explicit design. Canopy's terrace does not enclose its pool; that claim remains false. |
| Site access | Route endpoint ID, explicit boundary record and sometimes repeated point. | Existing site-access references derive the declared point. Boundary side alone cannot choose a gate or road. Cloister's separately corrected fixture explicitly supplies the missing `siteNorth` identity. Site dimensions remain constraints. |
| Building-to-building circulation | Doors on both buildings, route from/to identities, endpoints, bends, owner box and graph declarations. | **Implemented at both ends:** blueprint entrance references and optional approach distances derive contact and departure/arrival anchors. Canonical ribbons already derive owner bounds, occupancy, allocation and compiled triangles. Entrance choice, width and intervening bends remain authored. Shared-wing passage construction stays with existing junction systems. |
| Roof/host | Implicit host roof intent or separate roof geometry; host aliases, support, placement/envelope and repeated `hosts` claims. | Existing implicit roofs and supported hosted footprint roofs derive from their host. Explicit host relationships need no redundant mirror. Independent roof family, pitch, overhang, unusual separation and composition remain design choices; separate roof geometry is not automatically relocated or merged. |
| Zone/member measurements | Actual object/ribbon footprints versus legacy reservation rectangles. | Existing `allocationMode:"derived"` measures members; reserved/legacy rectangles remain constraints. This slice measures the newly resolved route through the same system and never redraws reservations. |

The new path removes independent contact coordinates and the opening identity repeated on the route. It also removes the need for Terra to calculate the exact anchor of a perpendicular entrance approach. It does not claim to eliminate legacy fields or every estate geometry duplication.

## 2. Blueprint authority and construction behavior

Estate-plan and blueprint versions remain 1. The new endpoint uses the existing semantic entrance ID:

```json
{
  "id": "route-entry",
  "purpose": "Principal pedestrian approach",
  "from": "arrivalCourt",
  "to": "mainResidence",
  "via": ["entryWalk"],
  "spatial": {
    "from": {"point": [0, 0, -16]},
    "to": {"entranceId": "bp-main-entry", "approachDistance": 3},
    "use": "pedestrian",
    "width": 3
  }
}
```

`bp-main-entry` already selects `{objectId:"mainResidence",openingId:"mainEntryDoor",level:0}`. The opening's facade/segment and span are the geometric authority. Route from/to object identities still describe the intended connection and must agree with the referenced entrance's host. They contain no independent geometry.

`entranceId` forbids `point` and `openingId` on that endpoint. `approachDistance` is optional, finite and 0.02–100 m, and requires `entranceId`. No default distance is invented. With no distance, the polyline reaches the resolved contact directly from the authored bends/start. With a distance, the ordered polyline is:

1. From contact, then its outward anchor if explicitly requested.
2. All authored intervening waypoints, unchanged.
3. To outward anchor if explicitly requested, then its contact.

The endpoint resolver requires one matching blueprint entry, the correct host, local ground level and one actual door/glazed-door opening. Invalid outlines, duplicate host/opening identities, missing segments, invalid spans and multi-plane addresses cannot supply new-mode contact geometry. The existing line/arc segment normal or planar facade normal determines the anchor, including host rotation. Recess contacts use the actual inset wall rather than the placement envelope. Normal derivation reuses `segmentNormal`, `segmentPoint` and the existing addressed-wall construction; it adds no scene engine.

`estateRoutePoints` feeds the existing `resolveEstateRouteGeometry`. Its same points/width generate construction triangles and collision strips. Access auditing uses the same resolved entrance identity and contact; completeness and allocation use the same strips. Compatibility/selectable owner bounds are projections of those triangles. The compiler, resolver and audits do not write resolved endpoint/anchor coordinates into `estatePlan` or blueprint. Existing normalized owner transform/dimensions remain compatibility projections and never override canonical route geometry.

The endpoint resolves to the building's ground base datum under the existing flat-route contract; it does **not** raise a route to the constructed interior floor, build a step or certify a flush threshold. Existing finished-floor/route height observations remain applicable. That vertical transition requires a separate authored architectural choice. Existing butt-ended ribbon joins also remain; the new path uses the current route construction system.

## 3. Editing, persistence and repair

The existing `setComposition` operation changes an authoritative opening. Contact, wall-normal anchor, ribbon and selectable bounds recompute in the same atomic edit. JSON persistence retains the entrance reference and authored distance, without contact/anchor snapshots. Reloading through production ingestion constructs the same mesh. Moving an arc opening updates both its contact and its normal without changing the arc footprint or introducing a waypoint.

Invalid references and blocked approaches fail edit validation and return the original scene. Editing an already approved entrance is explicit replanning; the approval/elaboration guard continues to reject unnoticed spatial drift.

Repair keeps entrance references, approach distances, route width and destination identities protected. Existing diagnosed local bend corrections still work; wall/water crossings, remote detours and unrelated building/door changes still fail. A diagnosed opening-span correction may refresh its dependent canonical owner bounds even when the route record is unchanged. The opening itself must independently pass the existing narrow repair allowlist, and the resulting corridor must pass the same spatial audit. This permits derived projection updates, not new permission to move entrances or architecture.

## 4. Offline recovered-mansion proof

[proof.json](proof.json) records all four untouched recovered inputs beside separately authored variants. [blueprintConstruction.ts](../../../src/lib/v3/parity/blueprintConstruction.ts) contains the explicit offline decisions; it is never invoked by generation or saved-project loading.

| Input / variant | Result |
| --- | --- |
| Untouched Canopy initial and historical repair | Both remain rejected, including their genuine access/site/planning contradictions. |
| Untouched Cloister initial and historical repair | Both remain rejected; missing boundary identity and pavilion wall intersections remain visible. |
| Canopy access-only blueprint variant, based on historical repair | Three authored pedestrian routes close **five** physical door/route gaps. Principal contact is **[0,0,−9.6]**, on the 2.4 m recessed north wall; guest and wellness paths contact existing doors at both ends. Route and addressed-door disconnection findings clear. Buildings, roofs, finishes, gardens, reservations, pool and unrelated claims remain as recovered. The whole estate remains rejected. |
| Cloister blueprint construction variant, based on the prior explicit corrected proof | All five canonical routes construct; three building routes reference blueprint entrances and use 3 m approaches. Corrected gate identity, local external detours and reservation corrections are explicit inherited test-author choices. Production ingestion with blueprint and design consistency enabled accepts it and issues blueprint approval. Buildings, openings, stairs, roofs and finishes are preserved. |
| Circular pavilion variant | Existing arc geometry and segment-addressed opening construct a real curved entry approach; rotating the host and moving the opening derive updated contacts/normals. |

Canopy's variant is deliberately **not** a full corrected mansion. It retains legacy allocations, including a new reservation conflict exposed by the replacement wellness ribbon, the disconnected water-garden joined claim, the garden overrun, the false pool containment claim and incomplete dry outdoor access. No automatic zone reclassification or estate redesign hides them. Adding spatial access also subjects its outdoor destinations to the existing physical access audit. These findings are not claimed as new independent defects in the recovered raw response.

Regression cases prove successful construction, actual recessed contact, moved entrance/arc updates, host rotation, rejection of missing/wrong-host/upper-level/duplicate/multi-plane destinations, conflicting endpoint coordinates, blocked route edits, obstacles and water crossings, local repair, protected architecture and JSON reload behavior. The saved-scene compilation baseline test requires all nine existing outputs to remain byte-identical, including the three original saved mansions and their functional variants; the baseline file was not changed by this task.

## 5. Production WebGL verification

[Nine captures](webgl/capture.json) use production `PrimitiveMesh`, edge finishing, materials, environment, sun/shadows and `PostFx`, with genuine WebGL 2 contexts. Whole-estate views and y=3.4 m entrance sections show Canopy, its moved recessed entry and guest connection, Cloister and its guest entry, the original/moved curved entrance, and a visibly blocked route. All nine screenshots were inspected. There were zero page errors and zero attempted AI/project API requests. Existing renderer deprecation console warnings remain. These are construction views, not a luxury-design certification.

## 6. Validation and compatibility

**Final verification: 189 focused tests passed in 8 files; 2,129 full-suite tests passed, 3 skipped, across 177 files (175 with executed tests and 2 with only skipped tests). The new construction regression file contains 24 passing tests. TypeScript, ESLint with zero warnings, `git diff --check` and new-source whitespace checks pass.**

See [checks.json](checks.json), [focused-tests.json](focused-tests.json), [full-tests.json](full-tests.json) and [preservation.json](preservation.json) for final results. The new regression file covers the new contract; existing blueprint, geometry authority, unified spatial, recovered live failure, mocked API and compilation-baseline tests remain part of verification. Legacy explicit-point/opening and non-spatial routes are supported; no stored scene migration or endpoint conversion occurs.

```sh
NATIVE_LIVE_QA=0 TEST_DATABASE_URL= BLUEPRINT_CONSTRUCTION_PROOF=docs/architecture/blueprint-construction/proof.json npx vitest run src/lib/v3/__tests__/blueprintConstruction.test.ts src/lib/v3/__tests__/unifiedSpatial.test.ts src/lib/v3/__tests__/geometryAuthority.test.ts src/lib/v3/__tests__/blueprintLiveFailure.test.ts src/lib/v3/__tests__/blueprint.test.ts src/lib/v3/__tests__/blueprintGeneration.test.ts src/lib/v3/__tests__/footprintBaseline.test.ts src/app/api/ai/house/__tests__/route.v3.test.ts --maxWorkers=2
NATIVE_LIVE_QA=0 TEST_DATABASE_URL= npx vitest run --maxWorkers=2
npx tsc --noEmit
npm run lint -- --max-warnings=0
git diff --check
PLAYWRIGHT_DIR=<existing installation> node scripts/blueprint-construction-capture.mjs
```

## 7. What remains authored and the next vertical slice

Terra still decides entrance identity, wall/segment address and span, building placement/envelope/outline, roof intent, route graph, width, optional approach distance, every intervening bend, off-centre/surface endpoints, gate location, pool/deck composition, reservations and vertical transitions. V3 does not invent doors, select a replacement entrance, route around obstacles, move architecture, flatten curves, add amenities or impose an estate template. Ambiguous decisions remain rejected with explicit diagnostic guidance.

Recommended next slice: **authored entrance threshold transition → exact floor/route contact**. Terra would choose a landing/step/ramp and its reservation; V3 could derive its precise start/end elevations from the actual constructed floor and canonical route. It must reject insufficient space/grade and never choose a step-free design or add construction without intent. This would extend the current horizontal contact proof into a physical vertical transition while preserving creative authority. Pool/deck boundary composition remains a separate future relationship.

## 8. GO / NO-GO

**NO-GO for another paid generation.** The new relationship is authored once and resolved consistently throughout the existing pipeline, with offline and visual evidence. It does not resolve Canopy's independent site/outdoor/planning decisions, certify threshold transitions, prove subjective luxury quality or establish generation success rates. No paid evaluation is needed or authorized by this milestone.
