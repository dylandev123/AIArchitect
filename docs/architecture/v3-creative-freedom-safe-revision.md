# V3 Creative Design Freedom + Safe Revision

Implemented offline. No provider calls, commit, push or deployment. Existing workspace changes were retained; this milestone changes V3 prompting, review, ingestion of unsupported roof intent, revision acceptance and server-only diagnostics. No V2 or advanced-terrain implementation was edited.

## Design freedom

Generation and editing share the same principles: explicit user requirements constrain the design; unspecified choices are creative opportunities. Coherent proportions, intentional composition, believable construction, functional relationships and design consistency remain.

Removed mandatory dominant central pavilions, smaller/lower wings, prescribed setbacks and narrow connectors, opposite arrival/garden sides, stepped roof hierarchies, wing-enclosed courtyards, fixed glazing proportions and material-count limits. Compact, sprawling, symmetrical, asymmetrical, courtyard, linear, clustered and unconventional compositions are allowed. No random template selection was introduced.

Comparable mass scales, symmetry, aligned joints, recessed volumes and varied palettes are informational observations. They cannot request revision and are excluded from API warnings. Legacy diagnostic codes remain compatible, but their messages and guidance no longer prescribe a style.

## Review and revision

Only significant objective conflicts or missing explicitly requested supported features can trigger the single optional design revision. Review retains entry/access, shared-wall balcony and building/amenity checks. It uses clipped rotated footprints, host-local containment, vertical extents and actual balcony slab spans. Canopies, intentional mass overlaps, hosted architecture and shared roof-bearing slabs are not blanket collisions. A wrapping approach is not judged from its centroid alone. Tilted solids are conservatively excluded from plan-only collision proof; this is not a general 3D CAD collision engine.

A candidate must pass normal scene and compiled-geometry validation, resolve at least one targeted finding, introduce no new conflict, and pass semantic comparison against the original valid scene. Only the first twelve targeted findings grant repair scope, matching the bounded request.

All original object identities must survive. Scene/site fields, relationships, mass geometry, roofs, materials, unrelated facades, assemblies and support intent are protected. Collision counterpart IDs do not authorize remodelling that counterpart. A conflicting amenity may move/resize; an entry may change its door facade/arrival role; an identified balcony assembly may change its facade. Adding a missing supported feature is allowed only for that requested feature. Explicit labelled double-height intent can be completed without changing the mass geometry. Uncertain or more extensive repairs are conservatively rejected. Fewer warnings alone never establish acceptance. Invalid, failed, unchanged and unrelated revisions retain the original valid scene.

This guard applies to optional revisions of a valid scene. The existing initial-invalid-output validation repair still has no valid scene to fall back to and retains its one-call budget.

## Diagnostics

Development writes one fixed `.v3-debug/revision-latest.json` slot, capped at 1 MiB, alongside the two existing failure slots. It records authored and normalized initial/revised scene snapshots, targeted findings, acceptance reasons and changed paths. Existing redaction removes sensitive fields/credential patterns; private directory/file modes, atomic replacement and best-effort behavior are retained. Oversize snapshots are explicitly omitted. Production/test environments do not write artifacts. Snapshots and provider responses are never placed in the client response.

## Butterfly-roof evidence and root cause

Recovered the latest 19-object mansion from the Browser `[RENDER TRANSITION]` entry in `.next/dev/logs/next-development.log`, `to.configHash = fd1dc14c`. Its unchanged scene is now the offline fixture `src/lib/v3/__tests__/fixtures/butterfly-mansion.json`.

`primary-roof` has label `High floating butterfly roof`, `geometryKind: proxy`, pitch 12 degrees, height 1.75 m, and no `roofForm`. The successful provider response and initial scene from its earlier automatic revision were not retained. Therefore **the evidence cannot determine whether Terra omitted roofForm or authored an unsupported value that normalization deleted**. Claiming either as the historical fact would be unsupported.

The confirmed code defect was unconditional deletion of unknown roofForm values without a diagnostic, followed by the renderer's absent-form flat fallback. Descriptive values containing “floating” could also be mapped to floating-flat despite containing “butterfly.” The old scene only proves the missing canonical field and surviving label.

Explicit unsupported roofForm values now survive in `unsupportedIntent.roofForm`, including arbitrary unrecognized names. Known unsupported roof names in descriptions are also retained and diagnosed, even when roofForm is absent or inconsistent. Diagnostics distinguish authored roofForm from description-only intent. Canonicalization no longer maps butterfly/mansard/etc. descriptions to an unrelated supported family. Review reports these as capability gaps, not revision triggers. The preview is explicitly diagnosed as a preview, not implementation of the named roof. No new roof system was implemented.

## Offline acceptance

- Symmetrical/equal-mass aligned houses, compact residences, recessed entries, flat/gable/hip roofs and varied coordinated palettes are repair-free.
- Rotated disjoint objects, rotated pool containment, partial shared-wall balcony spans, canopies and hosted/stacked architecture have regression coverage.
- Targeted pool, entry and balcony fixes and explicit double-height completion pass preservation checks.
- Unrelated identity, mass, roof, material, facade, assembly and site changes fail even when conflicts decrease. Deleting the conflicting amenity and unsolicited additions fail. Mocked route tests prove fallback on invalid, failed and redesigning candidates, and no second call for coherent equal-height symmetry.
- Both captured mansion scenes replay through compilation and review without mutating source scenes or files; compiled output is identical before/after review. This is an offline compiler replay, not a new provider run or a new visual-quality rating.
- Broad offline suite: 60 files, 511 tests passed, one database-dependent test skipped. A first high-concurrency run hit an existing five-second mansion test timeout; the lower-concurrency run passed.
- Final focused regression tests, TypeScript, scoped ESLint and diff whitespace checks pass.

Fixture SHA-256:

- Earlier 25-object mansion: `f509b72ffeb2cec495bdc8e0b3e99a9a16e44511f79847f88703274c895b7b5b`.
- Latest 19-object mansion: `9005e65a235ed12bc436dda96b8359d5f2c7fdaeb29bff6955396bf0a0d30bc3`.

A later, separately authorized live generation is justified to evaluate whether the relaxed prompt produces more diverse, coherent designs. It is not needed to verify these deterministic protections, and one generation would not prove diversity. None was performed in this milestone.
