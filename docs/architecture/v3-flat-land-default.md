# V3 flat-land generation default

The home generation form places **Advanced Terrain & Elevation** beside the V3 checkbox. It starts unchecked and is disabled for V2. New V3 projects persist `v3TerrainMode: "flat" | "advanced"` in their project settings. The client sends it only for initial generation. The API defaults omitted settings to flat and rejects unknown values. Successful scene metadata records the generation's `terrainMode`; failure artifacts record it in diagnostics for offline replay.

Flat mode uses the existing V3 scene and compiler. Its system contract prioritizes connected architectural masses, roofs, entrances, facade variation, coordinated finishes, indoor-outdoor living, pools and landscaping. Site hierarchy is optional in the provider schema. It is only needed for explicit ground-level paths/driveways, not building storeys.

Generation normalization fixes natural ground to elevation 0 and grade 0, removing profiles, ridge, cliff and sea intent. It never moves authored architectural geometry. Missing unhosted architectural bases default to 0. Structural validation then enforces:

- All authored site levels and route elevations are 0 (1e-6 numerical tolerance).
- No slope/graded/retaining transitions, terrain-region objects, terrain operations or retaining-wall objects.
- Unhosted building-mass/volume foundations stay within 0.5 m of ground; architectural hosts and intentional floating/suspended/cantilevered supports preserve elevated architecture.
- Ordinary unhosted pools (rim datum), decks, terraces, courtyards, gardens and driveways/paths stay within 0.5 m of ground. Hosted upper-floor amenities remain supported. Unhosted paths/driveways cannot tilt in pitch/roll.

Violations enter the existing single repair attempt, then fail without returning a saveable scene if unresolved. Geometry is never flattened or discarded to force compliance. A terrain-incompatible failed preview is withheld. Compatible flat previews use the same generation normalization. Pool excavation remains supported; flat natural ground does not mean filling pools.

Advanced mode uses the previous prompt and canonical ingestion unchanged, including cliffs, ocean, retaining systems and stepped sites. Both captured cliffside fixtures preserve all 18 objects. No terrain/grading algorithms, scene format, compiler, V2 pipeline or architectural schema fields changed.

Preferences apply only to new generation. Opening, rehydrating, duplicating, editing, undoing or restoring existing projects never invokes flat normalization. Legacy project settings are not migrated into a terrain policy. Low-level ingestion without an explicit policy keeps legacy behavior for stored fixtures and offline replay; the generation API always passes its selected policy.

Offline checks cover complex architecture and amenities, flat terrain sampling, driveway connections, both captured advanced fixtures, repair/rejection, preview consistency, settings round trips, existing elevated edits, and V2 regressions. Flat-land mansion generation is ready for a live quality test; these checks establish deterministic contract behavior, not the aesthetic quality of a future provider response. No Terra/OpenAI calls were made.

Validation: full offline suite **1,715 passed, 3 skipped** (151 passing test files); `tsc --noEmit`, repository ESLint and `git diff --check` passed.
