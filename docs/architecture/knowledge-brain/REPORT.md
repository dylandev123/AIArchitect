# Terra architectural knowledge library

Implemented 2026-10-27. Zero live OpenAI calls. No migrations, commits, deployment, new construction engine or project format changes.

## Architecture

Universal principles remain in `src/lib/villa/scene/designGuide.ts`, unchanged. Detailed contextual guidance lives under `src/lib/library/architecture`. Existing Knowledge Needs measure missing asset/recipe coverage; they are not encyclopedic content. The new `architecturalKnowledge` document kind extends the same library snapshot and `library_docs` store, preserving the existing Needs, recipes, capabilities, approved components and reviewed lesson records. There is no second provider or AI engine.

The 15 checked-in seed entries are persistent version-one defaults. Stored revisions override matching IDs. Editing a seed materializes its original version and the new revision together in the existing store. Local JSON uses the existing serialized atomic writer; configured Postgres uses the existing transaction/lock and document table. Older snapshots load without a migration. Production still requires the existing shared-persistence configuration; no new storage fallback was introduced.

Each entry has applicability, combinations, placement, principles, actual construction capabilities, tags, relevant scales, sources, verification flags, review notes, proposed/approved/retired status and explicit supersession links. IDs are stable; versions and timestamps are server assigned. Full revision histories remain inspectable. Approval requires a review note and at least one verified source. Human review remains necessary to establish whether source verification is deserved.

## Initial collection and sources

The initial collection covers:

- `estate-composition`: residence hierarchy and complete large-estate programme.
- `compact-family`: three bedrooms, daily-use rooms, efficient circulation and privacy.
- `mediterranean-courtyard`: courtyard, loggia and entrance relationships.
- `tropical-envelope`: Caribbean shade, rain protection and potential ventilation.
- `waterfront-estate`: shore relationships, privacy, arrival and unknown setbacks.
- `infinity-pool`: basin, edge, terrace and view relationships.
- `outdoor-entertaining`: outdoor kitchen, dining and bar combinations.
- `rooftop-lounge`: access, edge protection and structural assumptions.
- `wellness-suite`: spa/gym rooms and quiet/wet adjacency.
- `cinema`: private entertainment and acoustic limitations.
- `guest-house`: independent access and privacy.
- `garage-arrival`: pedestrian/vehicle/service relationships.
- `sports-court`: site area, noise and access.
- `boat-dock`: marine access and unsupported technical systems.
- `facade-materials`: contextual roof, enclosure and material identity.

Seeds are repository-derived editorial guidance, not external research or certified construction advice. Their source records cite the design guide and explain checks against `scene/terra.ts` and `component-registry.ts`. No internet material was fetched or silently approved. Curators can import source-backed web proposals using `kind: "web"`, `verified: false`, `status: "proposed"`; these never reach generation until explicitly reviewed and approved.

The existing immutable improved/rejected design lessons still enter through `learningContext`: non-mock, relevant user judgments, maximum three. Existing tests verify their reuse. Captures and learning records are not converted into seed facts or rewritten. A curator may distill verified experience into an `experience` entry with a `reviewed-design` source referencing its original record; automatic promotion is intentionally absent. Retrieval is learning from stored knowledge and reviewed experience, not retraining.

## Retrieval and homepage integration

Homepage creates a `direct-scene` project (`src/app/page.tsx`); WorkspaceShell selects OperationStudio, which posts to `/api/ai/scene`. That actual route now retrieves knowledge before its existing single provider call, alongside the unchanged universal guide and reviewed lessons. Generate and edit use the same executor. Editing receives a scoped-edit reminder; no knowledge code alters scene operations, validators, saved projects or construction budgets.

Retrieval deterministically derives scale using the existing scale inference plus compact/budget hints, records location/style/use/requirement signals, matches contextual tags, applies scale applicability and prioritizes site/climate relevance. It filters proposals, retired entries and approved supersession targets. Exact ID/title deduplication, explicit correction links and optimistic version checks support ongoing curation. Retrieval selects at most five entries; the complete library is never injected. Explicit feature negatives receive basic lexical filtering; the instruction context gives the complete brief and site constraints priority.

The response-retention artifact records project context, selected IDs, versions, reasons and character count. Entries are guidance, not fixed coordinates or geometry templates. Legacy component approval does not imply that every builder is exposed in direct scene operations. Each recipe distinguishes conceptual intent from the current contract and missing equipment/services/simulation; unsupported work must remain disclosed.

## Offline proof

`retrieval-proof.json` contains the exact injected text, entry versions and per-entry reasons, reproducible with:

```sh
npx vite-node --config vitest.config.mts scripts/architectural-knowledge-proof.ts
```

| Brief | Entries received, in order | Why | Characters / estimated tokens |
| --- | --- | --- | --- |
| A $25m Caribbean waterfront estate | estate-composition; tropical-envelope; waterfront-estate; infinity-pool; outdoor-entertaining | Estate hierarchy; stated Caribbean climate and water edge; suitable optional pool and outdoor hospitality relationships | 3498 / 875 |
| A compact three-bedroom family home | compact-family; facade-materials; garage-arrival | Compact family programme and bedrooms; coherent enclosure and everyday arrival; no resort amenities | 2334 / 584 |
| A grand Mediterranean courtyard mansion | mediterranean-courtyard; facade-materials; estate-composition; garage-arrival | Explicit style/court/scale; roof/material identity, large residence hierarchy and arrival; no sports court inferred from courtyard | 2938 / 735 |

New knowledge context has a hard 6,500-character ceiling including its instructions (approximately 1,625 English tokens, not a tokenizer measurement). Selected snippets omit full sources and histories; these remain available through inspection. Existing guide and lesson overhead is separate and unchanged. No embedding or retrieval provider calls are made.

## Import, search and editing workflow

Existing admin access checks protect `/api/admin/library/architecture`.

1. `GET ?q=waterfront` searches latest content and returns matching entries with full revision history; empty query lists all entries, including proposals and retired records.
2. Copy the latest revision, omit server fields `version` and `updatedAt`, and edit its content. Keep its stable ID for a correction.
3. POST an array of `{ "entry": { ... }, "expectedVersion": 1 }`. Use expectedVersion zero for a new ID. Maximum 100 records per atomic batch. Validation failures write nothing; stale versions return 409.
4. Research imports should start proposed and carry source references and provenance notes. Review the content, capability claims and conflicts, then submit an approved revision with a review note and verified source. Retire outdated knowledge or use `supersedes` to replace another ID.
5. Duplicate IDs within an import and duplicate normalized titles under different IDs are rejected unless explicitly replacing the old entry. Unknown and cyclic supersession links are rejected. Repeated imports cannot silently create or overwrite revisions.

The management surface is an API; no separate admin dashboard was added. Sources/review notes are supplied by authorized curators, not automatically verified against the web.

## Verification and limitations

75 deterministic tests passed across nine suites: architecture model/retrieval/persistence, admin API validation/access, actual scene route and provider schema, homepage regression, reviewed design learning, direct-scene project undo/redo/serialization, existing Knowledge Needs and library plans. The scene provider is mocked. Tests use temporary file storage or mock reads; no production library or project was edited. TypeScript (`npx tsc --noEmit`) and scoped ESLint pass.

The lexical retriever is intentionally small and explainable. It is not a geocoder, semantic deduplication engine, complete natural-language negation parser, building-code researcher or site survey. Novel synonyms and complex constraints may need better curated tags or future retrieval improvements. The full user brief still governs generation. Approval/provenance records aid review but do not prove technical truth. Postgres integration was extended through the existing backend contract but was not exercised against a live database. No new visual quality claim is made from deterministic mocked output: tests prove selection, delivery, persistence and unchanged execution/edit behavior, not how a live model will interpret the guidance. Architectural quality, site engineering, compliance and unsupported amenities still require review.
