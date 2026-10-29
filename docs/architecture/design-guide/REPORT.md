# Terra architectural design knowledge

## Change and integration

`src/lib/villa/scene/designGuide.ts` now provides one reusable conceptual architectural guide. It distinguishes geometric relationships, architectural principles, context-dependent climate/site recommendations and user preferences. It covers purposeful volume hierarchy, coherent massing/roof/facade composition, proportions and rhythm, entrance emphasis, privacy and public/private/service zoning, kitchen/dining relationships, light/views, multi-level access, usable outdoor rooms, load paths, openings/clearances, railings, pool basins, tropical shade/ventilation/weather protection, arrival/parking, material coordination and luxury residential craftsmanship. Terra must match the brief's scale and programme and describe only geometry actually authored.

The guide is interpolated once into `SCENE_SYSTEM_PROMPT` in `scene/terra.ts`. Homepage Generate creates a direct-scene project and pending brief; the workspace's `OperationStudio` posts to `/api/ai/scene`. That route sends this prompt (plus existing retrieved lessons) to its existing single model invocation. Mocked route tests verify the exact guide reaches that invocation. The guide also instructs scoped edits to preserve unrelated architecture.

Removed the old prompt paragraph prescribing connected subordinate wings and layered roof datums for luxury houses, and removed a duplicate conceptual composition paragraph from planning instructions. The planning block retains output-contract, coordinate, geometry and honest-review guidance. Principles do not require wings, symmetry, pitched roofs, front driveways or columns under every terrace. No new agent, call, review pipeline, validator, template, engine, budget change or persistence change was introduced.

## Capability audit

All executable element kinds and operations already appeared in model-facing instructions; a regression now compares those instructions with the actual schema unions. Existing detailed construction guidance is retained: floors/decks, segmented walls with real openings, separately editable doors/glazing, multiple roof sections and canopies, columns/beams/piers/trim as volume solids, supported balcony slabs with separate rails, vertical screening, horizontal pergola members as solids, and coherent pool construction. All add/replace/remove/move/rotate/resize/finish/attach/place-on/set-terrain operations remain exposed. Terrain is for existing projects and explicit edits; new designs remain flat.

The guide uses the existing coordinated passes within one atomic response: resolve programme/hierarchy/datums/circulation, then enclosure/openings, roofs/support, entrance/outdoor/shade details and final comparison with the brief. No minimum part count is imposed. New guidance clarifies that rectangular stair treads and landings can be manually composed, but no automatic stairs or verified navigation exists. Capabilities in other villa registries are not advertised as direct-scene tools.

## Restrictions and judgment

Existing limits remain: 400 final elements, 800 operations, 40 panels per part, bounded finite dimensions, positive sizes, unique IDs and acyclic attachments; one opening per wall is overcome by segmentation. Relationship checks require grounded contact for elevated slabs, supported railing spans and correct facade axes/attachments. These do not prescribe an architectural style, but they limit representable geometry. Contact checks cannot certify a cantilever or structural system. No restrictive geometry rules were added or relaxed.

Arbitrary mesh/CSG/polygonal solids, curves beyond the approved open pavilion, roof forms beyond flat/gable/hip and the pavilion roof, pitch/roll of arbitrary parts, custom materials and automatic interiors/stairs remain unsupported. The approved pavilion is an open lounge with inseparable subparts. Existing terrain must be respected, while new hillside briefs must disclose flat-site staging. Site orientation, climate performance, drainage, room usability, structure, local codes and architectural beauty require informed human judgment; no engineering or code approval is implied.

## Offline verification

- Focused Vitest run: 14 files, 72 tests passed. Covers schemas, relationship checks, mocked canonical API, every operation, 174-part construction, edit integrity and persisted history. The route suite was rerun after adding an explicit guide-delivery assertion: 17 tests passed.
- TypeScript `npx tsc --noEmit` and targeted ESLint passed.
- Existing `scripts/direct-scene-detail-audit.ts` replay: retained 50-part and 55-part responses remain accepted without element loss; 174-part study accepted with all 70 openings and no geometric relationship issues. A separate retained response with two unsupported terrace rails remains rejected atomically. Valid geometry does not certify completeness.
- `node scripts/design-guide-capture.mjs`: fresh browser contexts start at the real homepage, intercept all AI endpoints, render the retained 55-part basic house and 174-part advanced study in Arrival, Poolside and Aerial views, then edit one finish and verify unchanged unrelated parts, undo/redo and reload. All 55/174 operation groups appear in actual WebGL scenes (271/974 meshes respectively). Four mocked requests, zero provider calls, no page errors or external requests. See `browser-checks.json` and six PNGs in this directory.
- Visual inspection: the basic control shows broad simple masses, sparse bays and limited facade depth. The advanced control demonstrates individually articulated bays/piers, deeper loggias, stepped volumes and multiple roof sections. It still lacks evidenced complete pool basin and rooftop access; neither control should be certified as a finished luxury mansion. These preserved fixtures test capability and regression, not improvement in model-authored architecture.

Zero live OpenAI calls. Future generation quality remains unproven by offline mocks. No migration, commit or deployment was performed.
