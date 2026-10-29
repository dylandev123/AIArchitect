# Terra knowledge → construction update

## Implemented

The authoritative library now contains **61 entries**: the existing 15 contextual recipes plus 46 focused principles. The original design guide remains intact. Coverage includes massing and hierarchy; residential rooms, privacy and services; arrival and entrances; openings, screens, reveals and materials; flat/gable/hip roof relationships; verandas, loggias, balconies and pergolas; pools, wellness, gyms and waterside decks; tropical, minimalist and traditional character; site assumptions, coastal exposure, support, access and coordinated edits. Quality was prioritized over a nominal 100 entries.

Each addition records context, spatial relationships, combinations, mistakes, supported operations and implementation/review limitations. Repository sources verify operation availability. These are curated conceptual recommendations, **not externally researched regulations, certified construction details or verified historical/style references**.

Retrieval still uses the existing deterministic ranking and approval/version/supersession rules, capped at five entries and 6,500 characters. Integrated recipes receive a small ranking preference over isolated principles. Coordinated exclusions such as “without pool or gym” now suppress both terms. No embeddings, extra agents, API requests or complete-library prompt injection were added. Stored revisions continue to override bundled entries.

Retrieved context now explicitly directs construction rather than prose alone. The existing intent contract accepts an optional bounded `designDecisions` list (eight maximum), associating a selected knowledge entry and design choice with actual element IDs plus a limitation. The canonical resolver retains these decisions with the scene and its existing architecture review reports missing IDs or empty construction evidence as warnings. It never fabricates geometry, blocks renderable construction for prose discrepancies, or labels referenced IDs as verified architectural completeness. Existing detailed plans and older saved scenes remain accepted.

The construction contract already exposes floors, walls with real openings, separate glazing/doors, volume-based columns and trim, screens, flat/gable/hip roofs, decks and separate guards, five material finishes, parent-local attachments, `place-on`, and atomic editing operations. The additions explain their architectural application rather than exposing a second builder. Undo and persistence remain in the existing store. Reviewed learning already excludes mock origins and retrieves up to three relevant human judgments, including rejection reasons; this behavior was preserved. No mock fixture was promoted to successful-design knowledge.

## Offline evidence and practical limits

Run `npx vite-node --config vitest.config.mts scripts/architectural-knowledge-construction-proof.ts`. The script forbids fetch, exercises the canonical resolver, validates JSON round trips and targeted finish edits, and deliberately substitutes a missing entrance ID to verify a warning. It also re-audits the retained coordinated mansion scene from the existing plan-to-construction study.

| Brief | Relevant retrieval examples | Hand-authored geometry evidence |
|---|---|---|
| $25m Caribbean waterfront mansion | estate composition, tropical envelope, waterfront sequence, pool | distinct living/service/suite shells, separate openings and doors, flat roofs, covered terrace with posts, basin bottom/perimeter and water |
| Compact three-bedroom family house | compact-family, short circulation, room enclosure | three separate bedroom shells, living/kitchen/dining, bathroom and laundry shells, modest terrace; no pool or gym |
| Mediterranean courtyard estate | courtyard recipe, courtyard proportions, guest accommodation | wings around an open court, individual openings, hip roof sections, guest shell and sheltered court floor |

These intentionally small fixtures are **contract and rendering demonstrations**, not generated Terra designs, approved architecture, complete working floor plans or evidence that the model has become more creative. They do not verify circulation, room servicing, duplicated shared boundaries, spatial beauty or complete residential accommodation. Bathrooms and utility systems remain underdeveloped in the luxury fixtures. The audit honestly retains such unverified intentions. Existing retained Solana/Casa Ladera and mansion material remains unchanged; the retained mansion audit is evidence of compatibility, not a new assessment of its visual quality.

Browser reproduction: `node scripts/knowledge-construction-capture.mjs` against port 3000. Supply `PLAYWRIGHT_CORE_PATH` for a local playwright-core installation if needed. It uses a fresh isolated browser context, blocks external traffic and AI endpoints, imports each fixture into the existing scene renderer, captures aerial and arrival views and checks edit/undo/reload storage equality. Browser capture succeeded with zero AI requests and zero page errors; all three import/edit/undo/reload checks passed. See `browser.json` and the captured PNGs. Visual inspection confirms these are basic studies rather than finished luxury architecture. Local browser imports do not modify saved user projects or the server knowledge store.

## Validation and efficiency

81 relevant tests passed across the library, direct-scene engine, provider schemas/routes, planning, reviewed learning and project persistence. TypeScript and scoped ESLint passed. Offline scripts use zero provider calls. No migrations, commits or deployments were performed.

Measured retrieved-context lengths for these briefs are in `evidence.json`: approximately 3.6–3.9k characters (roughly 900–975 tokens at four characters/token, not tokenizer measurements). The hard retrieval cap remains 6,500 characters, roughly 1,625 tokens by that estimate. The new decision instruction adds a small fixed prompt cost; optional decision output adds at most eight short records, with real token usage dependent on descriptions and references. No additional generation round trip is introduced.

## Still requires live Terra verification

No live OpenAI call was made. Whether Terra consistently selects appropriate decisions, constructs all referenced features, develops a sufficiently substantial luxury programme and produces visually convincing architecture remains unverified. The implementation provides stronger guidance and inspectable evidence links; it does not guarantee semantic completeness from IDs or alter the underlying model.

Remaining engine limits include rectangular primitives except the pinned pavilion, only flat/gable/hip roof forms, flat new-generation sites, no automatic stairs or floor-plan/navigation solver, limited finishes, no dedicated sanitary/appliance/fitness assets, no structural/services/coastal simulation and no building-code certification. Architectural and engineering review is required. No fixed layout, mandatory amenity, minimum area or element count was imposed.
