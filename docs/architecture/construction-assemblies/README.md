# Construction assembly capability proofs

Developer-authored offline examples, **not Terra-generated architectural successes** and not an approved mansion repair. Zero provider calls. Original scenes/model responses remain untouched; source SHA-256 values are in verification.json. No migration, commit, deployment or saved project change.

## Findings and supported construction

The canonical engine is `src/lib/villa/scene/model.ts`, with `applySceneOperations` executing atomic transactions and the shared `OperationScene` renderer. Plate/volume solids can express individual steps, risers, landings, rectangular basin bottoms, coping and decks. There is no semantic staircase, stair solver, automatic riser generation, floor hole, Boolean subtraction or excavation operation. Tread plates can give an open-riser design; closed risers need explicit solids. A parent provides transforms, not a structural or circulation guarantee. `place-on` aligns bottoms/tops but cannot coordinate an entire assembly or preserve alignment automatically after height resizing.

**Coordinated floor segments work.** Replace only the selected host floor with nonoverlapping rectangular segments around a reserved void. Preserve the outside slab footprint, supports and children: a former slab child may need reattachment or world-coordinate preservation. Never remove a host with unhandled dependents, and never cut unrelated floors. Generation can author segments directly; completion can replace the stable host ID and add remaining segments in one transaction. Wall openings only apply to walls, one opening per wall, along local X; they cannot cut plates. Multiple openings require wall segments. Rectangular construction may rotate with its parent; all clearances must use inherited coordinates.

Doors are solid entrance panels. Their sill may correctly align within a taller/wider opening without completing its enclosure. Glazing is a thin panel; opening.glazed fills the whole opening. A smaller door must not be moved to the centre of an oversized opening merely to satisfy symmetry.

Pool water is a rectangular plane at at.y, not a filled volume; size.y does not establish depth. Walls are solids; four walls prove neither basin depth nor dry circulation. Pool floor, walls, water, coping and decks need shared coordinate datums. A below-ground basin can be represented, but surrounding terrain is not automatically excavated. Its submerged exterior may be hidden by ground in the viewer. Arbitrary curved shells/water, true infinity hydraulics, equipment, drainage and physical watertightness remain unsupported. Rectangular components can still vary in proportions, placement, yaw, material and composition; no fixed pool style is introduced.

## Offline evidence

Run `npx vite-node --config vitest.config.mts scripts/construction-assembly-proof.ts`.

- `stair.before.json` retains the intentionally uncut host; `stair.operations.json` demonstrates its explicit replacement through the existing executor. `stair.scene.json` is the resulting assembly.
- Lower walking datum 0.20 m, upper 3.60 m: 17 rises of 0.20 m, 16 treads at 0.30 m going, then landing. These are example choices, not rules. The full-width flight occupies X=0..4.8, Z=-0.7..0.7. The reserved slab void is X=0..4.8, Z=-0.8..0.8. No overhead geometry crosses it. Landing X=4.8..6 has zero positive-area overlap with any tread; upper exit X=6..7.2 and lower approach X=-1.5..0 meet their respective ends. Full rectangular footprint intersections are checked, beyond centreline probes.
- `pool.scene.json` and `pool.operations.json` contain the basin assembly. Basin top -1.20 m, water +0.20 m: 1.40 m depth. Walls span -1.20..+0.30 m; coping/deck tops are +0.30 m, giving 0.10 m freeboard. Basin interior X=-3..3, Z=-2..2 remains uncovered. Coping touches the deck at X=±3.6 / Z=±2.7. A closed dry circuit is verified on deck surfaces at both boundaries of its 1 m width, including corners, in verification.json. It is an isolated poolside circuit; no house connection is claimed.
- Both examples pass the existing relationship and focused construction checks. The script asserts original-file hashes, exact interval relationships and sampled dry-route coverage. Neither is a guard/handrail, engineering, code or certified navigability proof.
- `stair-stair.png`, `stair-section.png`, `pool-pool.png`: actual canonical workspace viewer screenshots, visually inspected. `browser-result.json` records rendered element IDs, finite mesh coordinates, cameras, errors and blocked requests. API and nonlocal requests were blocked during capture. The original saved project was replaced only in this isolated browser context's local storage.

Capture with the dev server running: `node scripts/construction-assembly-capture.mjs`. Its Playwright installation path follows the existing developer capture harness and is machine-specific.

## Smallest changes and integration

No new operation, geometry engine, schema or AI call was necessary. The shared architectural design guide now describes assembly datums, floor segmentation, tread/landing separation, headroom and dry access. Existing knowledge entries for vertical access and pool construction now carry the same relationships. The generation instruction no longer forces water exactly flush with coping. These instructions reach both initial direct-scene generation and completion through the existing prompt/knowledge path; completion already authorizes coordinated local slab/wall/dependent edits.

The existing focused verifier is retained rather than adding a broad validator. Low headroom under its 2 m heuristic remains a review finding, not an arbitrary mandatory dimension or code claim. Actual solid intersection at the walking datum remains confirmed. Regression assertions distinguish those cases. Existing overlap, endpoint, upper-passage, shallow-basin and perimeter checks remain limited evidence, not proof of a complete assembly. Their sampled/label-based coverage cannot certify arbitrary paths, stairs or pools.

The existing prompt budget test remains below 20,000 characters by tightening duplicated prose rather than raising the limit. Focused construction, guide, Terra contract, completion and knowledge tests are run alongside the offline proof.

## Loggia choices and mansion repair

The existing ocean-loggia door sill is correct. Keep its alignment. Supported alternatives are:

1. Retain an intentionally open loggia: preserves openness and views but leaves an outdoor/weather-exposed enclosure condition; identify the actual interior boundary.
2. Reduce the portal with designed solid returns/lintel and a fitted opening around the retained door: greater enclosure/privacy, changed facade proportions and daylight.
3. Compose separately fitted sidelights and a transom around the retained door: preserves a large glazed elevation but changes solar exposure, privacy and weather enclosure. Use actual panel sizes and avoid superimposed opaque wall solids.

The scene does not establish which is intended. Record the alternatives and implications; do not automatically insert generic walls/glazing. No enclosure choice has been applied to the mansion.

**The mansion's geometric stair/pool defects can be repaired without another paid call**, using deterministic local operations and design assumptions. The 0.40 m stair clearance requires segmenting the guest slab around the flight (and checking its wall crossings), not merely trimming the final tread. Retain/reconfigure supports and align upper passages at the walking datum. The previous final-tread surface-union repair alone does not resolve these issues. Pool repair can lower the basin floor, extend walls down to it, align rim tops with coping and bridge the 0.40 m dry gap with a connected deck segment. Intended swimming depth, room/void consequences and loggia enclosure need explicit design judgment. The proofs establish the available construction method; they do not claim the existing mansion was repaired or approved. No paid call is needed for a developer-authored candidate, but a future Terra-authored result still needs geometric review.
