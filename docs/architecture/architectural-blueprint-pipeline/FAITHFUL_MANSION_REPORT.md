# Faithful construction of the recovered Belvedere House blueprint

Follow-up: [Production recovery integration](PRODUCTION_RECOVERY_INTEGRATION.md) verifies the landing/workspace Generate action through the running production API with an offline provider transport, atomic draft acceptance, semantic inspector editing, reload and unrelated-design promotion. Its captures do not seed a constructed property into browser storage.

20 October 2026, America/St_Lucia. Offline replay; no provider calls or paid generations.

V3 could not execute the three reported decisions because its own construction contract was narrower than the architecture Terra supplied. None of those three decisions is contradictory. The exact recovered design now produces an editable **Draft — Needs Refinement**, with both residences, both roofs, both glazed main entries and their canopies, all five outdoor features and four route owners. It is not a claim that the unresolved interior and access design is complete.

| Reported issue | Evidence in the original | Cause and construction change |
| --- | --- | --- |
| Unequal villa storeys | Ordered heights 4.2 m and 3.5 m, giving total height 7.7 m | V3 rejected unequal heights and used total height / level count in several downstream paths. The existing stack resolver now supplies the canonical semantic floor datums to rectangular/outline/articulated slabs, facade openings, assembly attachments, circulation, junction checks, completeness and construction receipts. No mass was split, averaged or resized. |
| Villa glazed main entry | `villa-south-entry`, south, ground, span .43–.57, height 3 m; canopy depth 2.4 m | Composition refinement accepted only solid doors; both canopy adapters also checked only solid doors. Both now construct the existing glazed-door capability, including frames in the authored main-entry color, mullions, transparent panel and derived canopy. |
| Guest glazed main entry | `guest-south-entry`, south, ground, span .22–.38, height 2.7 m; canopy depth 1.8 m | The same inconsistent solid-door requirement. The authored door, operation, span, reveal and main-entry reference are retained. |

## Authoritative geometry and compatibility

The villa structural slab datums are **0, 4.2 and 7.7 m**. Finished floors are **0.26 and 4.46 m** using the existing 0.26 m slab. The guest floor is 0.26 m, with a 3.6 m host height. Roof bases follow the summed authored heights. Interior partitions meet actual slab undersides; a floor-to-floor height no longer adds another slab above the building and creates false storey-overrun warnings.

The existing U-stair builder unnecessarily filled its entire 5 m reservation with two 2.5 m flights, leaving only 1.5 m of run inside the authored 4 m depth. It now permits a central well. The same riser/going policy derives 24 risers, equal 1.58 m flights, 2.42 m runs and a 1.84 m well, with guards. The original reservation, direction, turn, storey endpoints and identity do not move. Its unresolved screen-door approach remains a Draft finding.

A designer's shared-partition label can now resolve through its two authoritative room references when they have one real shared boundary. It does not need separately authored line coordinates or V3's internal spelling. Explicit canonical references to the wrong boundary still reject. When the named rooms do not share a boundary, no wall location is invented.

An explicit vehicle approach to a pedestrian entrance describes drop-off access; V3 no longer requires a 4.8 m driveway to fit through the villa's 3.36 m pedestrian door. The declared gate boundary clips the terminal ribbon cap through the existing V3 clipping code, preserving its centreline, route width, endpoints and bends. The separate western pedestrian route still has an editable ribbon-edge clash with its own entrance host; a centreline through a building remains blocking.

The raised pool basin is constructed at its explicit base elevation 0 and height 1.5 m. Its water is not silently lowered to imply an excavated pool. Flat-site acceptance distinguishes that basin from an elevated site platform; no terrain code or terrain geometry changed. Pool access remains unresolved.

Explicit `assemblies: []` survives normalization. Explicit material opacity 1 is equivalent to an opaque default and no longer rejects groundcover. Reserved-zone membership may reference the blueprint's declared entrance or site access without constructing a duplicate object.

Complete finished-floor stacks control exterior construction. Older saved semantic room overlays beginning at structural elevation zero retain their prior exterior behavior. No new persisted height array, copied blueprint or second geometry engine was introduced. Existing V3 scene semantics and component builders remain authoritative.

## Unresolved decisions retained in the Draft

- **Room coordinate convention / layout:** the original does not label region coordinates as centre or corner. Under V3's centre interpretation several spaces overlap or extend outside the host. A corner interpretation explains much of the tiling, but does not resolve every connection: the kitchen ends at z=1 while the foyer starts at z=3. The original room rectangles, nine partitions, eight doors and adjacency records remain intact. Unresolvable partitions are retained as intent, with no fabricated walls or door coordinates.
- **Reserved-zone boundaries:** the explicit reserved rectangles conflict with several member footprints and/or the site boundary. Neither zones nor buildings were moved to choose a priority. The outstanding choice is how the reservation is intended to relate to the already placed architecture.
- **Local access details:** the stair's screen opening does not align with its walking approach; one interior door clips its screen head; the western route's ribbon edge clips the villa; the guest terrace and raised pool lack verified dry approaches. All remain editable and visible as unresolved evidence. No new entrance, garage door, route bend, pool deck or stair relocation was invented.

These are design decisions or local construction refinements, not reasons to discard both buildings. Draft eligibility retains original severity and stable target IDs. Missing essential buildings/references, malformed footprints, unsupported primary geometry, route centrelines through buildings, absent guards and missing construction components remain blocking. Current-scene revalidation runs after editing and at persistence; a stale or removed Draft label cannot authorize a broken commit.

## Exact original and offline replay

The preserved source is `.v3-debug/recovery-2026-10-20-9733be300b2f/original-capture.json`. Its blueprint SHA-256 remains:

`9733be300b2fbb316ea248201c4af87df86665fb63fb9c6d63012aa49f1af9ed`

The regression fixture is `src/lib/v3/__tests__/fixtures/architectural-blueprint-live-2026-10-20.json`; its sole trailing newline is excluded from the original-response hash. The original and verified recovery copies remain unchanged. The existing identity normalization changes only the four exclusive route-owner IDs; no architectural coordinates change.

```sh
npm run recover:blueprint -- --source .v3-debug/recovery-2026-10-20-9733be300b2f/original-capture.json --output .v3-debug/faithful-mansion-verified
```

The replay imports deterministic planning/construction only and forbids fetch. It writes a separate preserved original, normalized blueprint, diagnostics and recovered V3 scene. It refuses to overwrite differing previous evidence. Repeating the exact input constructs equal scenes and equal production primitives.

## Verification and production images

The exact fixture is exercised through the actual API route and real SDK parsing with an offline model; fetch is forbidden. Independent regressions verify cumulative slabs, stair floors and well guards, both glazed entries/canopies, receipts, outline construction, blueprint checkout/revision, concurrent local finish retention, rejection without storage writes, saved-version consistency and rehydration without affecting an unrelated project.

[Production WebGL capture manifest](faithful-mansion-production-webgl/capture.json) records the ordinary `next start` workspace with real WebGL 2, production meshes, PBR materials, edge detail, lighting and PostFx. Images include the [whole property](faithful-mansion-production-webgl/whole-property.jpg), [ocean facades, pool and guest residence](faithful-mansion-production-webgl/ocean-facades-pool-and-guest.jpg), [entrances and roofs](faithful-mansion-production-webgl/entrances-and-roofs.jpg), [plan](faithful-mansion-production-webgl/property-plan.jpg), and [reloaded Draft](faithful-mansion-production-webgl/reloaded-mansion-draft.jpg). Browser storage is isolated; provider/project API requests are blocked. Reload preserves the saved scene exactly. The production JSON editor also changes a guest-building finish, revalidates and saves a consistent version, and retains that edit across reload without changing architectural geometry; two additional captures record that check.

The full suite passed **2,320 tests, with 3 skipped** across 188 test files. Nine focused construction tests and the exact-fixture production-route test also passed after the final glazed-frame finish correction. TypeScript, repository-wide ESLint and whitespace checks pass. The optimized production build and seven inspected WebGL captures are recorded in [FAITHFUL_MANSION_CHECKS.json](FAITHFUL_MANSION_CHECKS.json).

No commits, pushes, deployment, V2 changes, terrain changes, environment-file edits or saved-user-project changes were made. Terra's prompt was not modified for this work.
