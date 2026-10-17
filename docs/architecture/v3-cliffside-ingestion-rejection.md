# Cliffside V3 ingestion rejection

## Evidence and limitation

The existing Safari workspace for project `53755afa-a5c9-4278-a2ce-6a850ecf4275` showed **15 recoverable objects**, an empty persisted V3 scene, and:

`V3 scene could not pass objective validation: upper-road-drive has invalid transform or dimensions.`

No original `upper-road-drive` payload was found in `.data`, `.next`, or temporary logs. Safari's retained Network list did not contain the generation request. The 422 handler returns a recovered scene, not the raw response; failed-preview recovery discards objects with invalid boxes. Its store is ephemeral. Therefore the exact original malformed field/value is **unknown**. Neither zero height nor a missing position is asserted as historical fact. The fixture explicitly documents this limitation and reconstructs the failure using the reported id and existing offline cliffside terrain/architecture.

## Trace

`generateText` parsed JSON → `ingestV3GenerationOutput` → `normalizeV3GenerationOutput` → `repairV3GeneratedScene` → `validateV3Scene({lenient:true,requireObjects:true})` → compiled geometry audit. Previously, normalization derived runtime geometry from named architecture, coerced numeric arrays and defaulted absent rotation/scale, but did not derive connection-surface bounds. Repair handled support/references, not site geometry. `validateV3Scene` classified any invalid position, rotation, positive scale or positive dimensions as fatal `INVALID_TRANSFORM`. The API retried once through the model, then returned 422 before persistence.

The error did not distinguish these four predicates. It now names the invalid fields.

## Authority and repair

For explicit `path`/`driveway` owners referenced by exactly one `siteHierarchy.connections[].surfaceObjectId`, a valid route, positive width and finite endpoint levels derive finite positive compatibility bounds, identity rotation and unit scale. No new route, endpoint, footprint or grading intent is invented. Route and width remain unchanged; existing deterministic grading and connection ribbon compilation remain authoritative. A driveway owner no longer also compiles a generic box. Building masses cannot gain this exemption by being referenced as a connection surface.

Preview applies the same site geometry normalization, after named architectural normalization and before its object safety filter. Canonical validation still requires valid runtime data; it receives derived metadata rather than trusting provider-authored boxes. Legacy unlinked objects retain their valid authored boxes.

Audit of other site types: terrace/pool/deck, landscape-zone, retaining-wall and terrain-region compilers consume authored footprints/height. A support level is not sufficient authority to invent their dimensions. Valid named architectural geometry already supplies deterministic runtime geometry. Without either usable geometry or explicit supported route intent, an optional malformed site object is omitted with `SITE_OBJECT_OMITTED`. Objects explicitly hosting other authored objects remain structural and are not silently removed. Ordinary building-mass geometry, duplicate identities, invalid site/root/interior and other fatal validation remain blocking. Persistence and its atomic commit gate are unchanged.

The provider-facing V3 contract and prompt now allow linked path/driveway owners without box geometry. No V2 code or terrain/grading algorithm was changed by this fix.

## Offline proof

`siteObjectIngestion.test.ts` covers zero/missing dimensions, malformed position/scale, absent box metadata, driveway type, optional site omissions, protected structural hosts and precise field diagnostics. It verifies semantic identity, unchanged routes and unrelated objects, successful grading/compilation, idempotence, and preview compatibility. `v3ScenePersistence.test.ts` saves/reloads the repaired scene and proves a subsequent invalid building commit leaves the saved scene intact. The mocked API regression returns 200 after exactly one mocked provider result.

The same prompt is reasonable to retry for this repaired failure class. This is not an exact replay or a guarantee that another stochastic response cannot contain a different structural failure. No live Terra/OpenAI request was made.

Validation: 327 tests passed across 42 V3-related files (`--maxWorkers=2 --testTimeout=30000`), including 15 site-object regressions and 14 mocked V3 API tests. `tsc --noEmit`, ESLint and `git diff --check` passed. The initial run exposed a preview normalization-order regression (fixed) and three parallel-load timeouts; the final complete run passed.
