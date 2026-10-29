# Terra knowledge expansion — 28 October 2026

Implemented 301 catalog entries through the existing seeded knowledge records, revision schema, admin bulk-import endpoint and library backend. The 240 additions are individually authored relationships, patterns, material strategies, feature recipes and prevention lessons. No second database, renderer, geometry template or retrieval service was introduced.

## Audit and changes

- Initial catalog: 15 recipes in `seeds.ts` and 46 entries in `guidance.ts`. IDs, normalized titles and new placement texts have automated uniqueness checks. Conceptual overlaps remain intentional where one entry describes overall organization and another describes a particular junction; no automated test establishes semantic originality or architectural quality.
- Existing design guide remains authoritative about geometric relationships, scene freedom, support, climate assumptions and honest completion reporting. Its principles now inform explicit category coverage. The compact-family recipe preserves the requested bedroom count rather than prescribing three bedrooms for every compact home.
- Design lessons remain in their existing private store. Only validated summaries with non-mock origin enter their separate three-lesson retrieval path. Improved/rejected verdicts are user judgments, not independent construction certification; no lessons were promoted automatically or fabricated as empirical evidence. This change audits that code path, not the quality of every private lesson.
- Existing importer accepts 100 entries per atomic transaction, uses expected versions, retains history, checks normalized titles and supersession cycles. All 240 additions were imported in three batches into a temporary file backend and read back with two revisions each. These checks never changed the user's persisted library.
- Ten categories: composition, programme, tradition, arrival, envelope, roof-outdoor, amenity, climate-site, construction and materials. `kind` remains backward compatible; optional `recipeType` distinguishes feature, relationship, pattern, material and failure guidance.
- New recipe metadata supplies purpose/when, placement, material variations, primitive operations, necessary element kinds, supports and unsupported capabilities. Existing entries receive conservative backward-compatible construction metadata during retrieval. Stored corrections override these defaults and repository seeds as before.
- Architectural references are repository capability references. They verify primitive availability, not historical authenticity, climatic performance, regulations or engineering. New patterns are conceptual design options, not external research.

## Retrieval experiment

The old implementation required lexical tag overlap and independently ranked five entries under 6,500 characters. The replacement combines phrase relevance, explicit specialist-feature eligibility, residential programme priors and diminishing returns by category. It reserves available slots for complementary core categories and distinguishes explicitly requested amenities. It still uses a deterministic lexical/semantic rule system; it is not an embedding model or unrestricted natural-language reasoner.

- Compact generation: at most 5 entries / 6,500 characters.
- Medium generation: at most 8 / 12,000.
- Complex generation: at most 12 / 18,000.
- Scoped edit: normally 4 / 6,500; 6 / 9,000 for multiple positive requirements.
- Excluded requirements do not increase complexity. Single-window edits suppress unrelated programme categories and specialist use patterns require an appropriate brief.

`retrieval.json` records seven reproducible offline cases, selected IDs, scores, reasons, category coverage, actual characters and estimated tokens. Compact-home examples use approximately 6,100 characters versus roughly 14,000–15,000 for estates. These cases support retaining compact budgets and allowing more complementary estate entries. They do not establish that 18,000 characters is an optimal provider-token budget. The maximum remains provisional.

**No exact tokenizer or live provider benchmark was run.** Characters divided by four is explicitly an estimate. The canonical route now retains actual provider usage alongside selected IDs, budgets, base-system/lesson/final-system character counts and retrieval metrics. Provider input tokens include messages and output schemas as well as knowledge, so these totals cannot isolate knowledge-token overhead. Use a model-compatible tokenizer or paired live measurements before claiming measured isolated token overhead or optimizing these caps on quality/cost evidence.

## Construction evidence

The canonical route snapshots selected knowledge IDs, revision versions and required primitive kinds into the scene only when decisions cite knowledge. This small evidence manifest uses the existing scene persistence, edits and undo/redo path. Scoped edits retain previous cited revisions. It is audit metadata, not another geometry ledger or engine.

The scene audit checks missing IDs, necessary primitive kinds, remote references relative to cited floors, and unsupported decision limitations. A floor with an entrance-like name cannot substantiate entrance architecture. It warns when a door is attached to an uncut wall. Pool review now samples four water edges for actual perimeter walls; water plus a bottom alone is incomplete. That check exposed a pre-existing incomplete pool in the retained Ladera fixture. A regression test constructs four actual editable basin walls and verifies that this warning clears.

These checks are necessary conditions, not sufficient proof. Kind presence and coarse proximity do not verify room allocation, continuous enclosure, usable access, guard continuity, aesthetics or a complete facility. `verifiedComplete` stays false even when cited kinds exist. Valid geometry is preserved with visible warnings; no automatic repair, silent substitution or new architectural style gate occurs.

**Consistent Terra-generated knowledge-to-construction behavior is still unproven.** Existing construction evidence is hand-authored or mocked. This change does not relabel it as live Terra evidence. Establish consistency with repeated canonical-route runs across compact, estate, courtyard and feature-edit briefs; retain unmodified responses, provider usage, editable scene snapshots and identical-camera renders. Judge actual entrance openings, private-room enclosure/access, rooftop deck/access/guards/shade and pool bottom/perimeter/deck separately from prose. Record omissions and unsupported facilities as failures or partial results, not completed amenities.

## Reproduction

```sh
npx vite-node --config vitest.config.mts scripts/knowledge-expansion-evidence.ts
npx vitest run src/lib/villa/scene src/lib/library/architecture src/store/__tests__/directScenePersistence.test.ts src/app/api/ai/scene/route.test.ts
npx tsc --noEmit
```

The evidence command makes no network/provider calls and produces retrieval results and three reviewable bulk-import files. Those batches use expected version 1 because additions are already available as version-1 repository seeds. Import through the existing authenticated admin endpoint to persist reviewed revisions; inspect current versions before applying to a library with subsequent edits. Never overwrite version conflicts.

Validation: 79 focused tests passed; TypeScript and focused ESLint checks passed. Live provider quality, exact knowledge tokens and visual architectural acceptance remain outstanding.
