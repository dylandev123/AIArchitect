# Recovery of the retained first live semantic response

**Identifier recovery is implemented. The exact paid response still requires architectural decisions and cannot honestly be constructed as a valid house.** No AI, visual review, retrieval, database or credential request was made. No original evidence was overwritten. No design was manually improved or rendered.

## The sixteen findings

All sixteen original findings have one lexical cause: `L0`/`L1` fail `^[a-z][a-z0-9-]{0,39}$`. Two declarations and fourteen space references repeat that failure. Every such reference identifies one of the two declared levels without ambiguity. This is an input compatibility failure, not sixteen architectural defects. Levels subsequently feed floor elevations, boundary identity and construction provenance through their spaces; replacing declarations without references would break those relationships.

The exact retained JSON Schema contains the regex for declarations and references. The retained system prose did not spell out identifier spelling, and the provider format used `strict:false`. Thus the requirement was present but its enforcement depended on model compliance and local parsing. The response consistently used familiar uppercase level notation. That suggests a naming convention mismatch; we cannot establish the model's internal reason. The application conflated lexical rejection with the same `decision-required` outcome used for design conflicts and stopped before checking architecture. The new boundary accepts safe naming differences and still rejects substantive failures.

## General solution

`identifiers.ts`, called by `constructSemantic`, clones the input and canonicalizes identity fields only: trim whitespace, lowercase, and convert spaces/underscores to hyphens. It handles building IDs, level/mass/space/portal/stair declarations and every typed reference, including narrative mass relations, portal hosts/targets, stair endpoints, arrival and required access. It does not truncate, transliterate, invent prefixes or alter polygons, dimensions, modes, materials, uses or roof flags. Unsupported punctuation/length still fails the existing schema.

Canonical collisions across entity types, duplicate declarations and dangling/wrong-type references reject the entire transaction. References may use exact original spelling or the unique canonical spelling; no namespace guessing is allowed. A space called `ocean-terrace` cannot satisfy a mass reference. Successful sessions retain original input and path-by-path mappings alongside canonical compiler intent/provenance. Restore retains that input evidence, recomputes bindings, and validates the editable scene as before. Revision still requires existing topology identities and honors manual-edit conflicts. Production Generate remains untouched.

Future experimental prose now explicitly describes identifier requirements and metre-based offsets. The saved request was not regenerated or changed.

## Complete replay and independent failures

[Outcome](outcome.json) preserves the complete original proposal and the first newly exposed failure. [Identifier-only proposal](identifier-only-proposal.json) changes only the sixteen level spellings. [Diagnostic stages](diagnostic-stages.json) record compiler replays that bypass one conflict at a time **only for diagnosis**. Removing an invalid narrative relation or omitting a roof in these in-memory probes does not constitute a recovered design. No diagnostic variant becomes a session or render.

1. **Undeclared mass reference.** `social-belvedere.relatesTo` names `ocean-terrace`, which is a space, not one of the five masses. Choosing another mass, changing the contract or removing this relation would be a separate correction. The original is rejected atomically.
2. **Application defect: uncovered outdoor height.** The compiler imposed its 2.4 m indoor minimum on outdoor cells. Ocean and sky terraces have height 0.2 m and no roof. Uncovered exterior cells now require a positive bounded height; interiors and covered cells retain the 2.4–8 m check. This is an applicability correction, not an invented terrace enclosure. All overlap, roof, stair, portal, threshold, profile and reachability checks remain.
3. **Roof/floor conflict.** Guest suite 3 has a roof over its entire footprint at Y=4.00–4.18 m. The primary suite above has a floor at Y=4.00–4.20 m. These solids overlap. The compiler correctly requests an upper-floor-as-cover decision. Identifier recovery cannot decide roof membership.
4. **Unsupported partial adjacency.** Ocean terrace's east edge is Z=8–14 at X=12; guest suite 3's west edge is Z=8–16. They overlap only partially. Full-edge-only compilation cannot safely derive one shared wall from this topology. Segmenting or moving cells requires a topology/capability decision, not weaker tolerance. The original instructions explicitly disclosed this restriction.
5. **All twelve portal offsets fail metre-based margins.** Every offset is 0.5 m. Widths are 1.2–4.8 m; the resulting start margins are -0.1 to -1.9 m against required +0.18 m. [Independent checks](independent-checks.json) records each one. Repeated 0.5 values suggest normalized midpoint fractions, but the saved contract merely called these numeric offsets without describing units/origin. This is a real instruction ambiguity. Interpreting them as fractions would move architectural openings and is not a safe identifier repair. The new prose clarifies metres from the selected edge start.
6. **Stair geometry is unbuildable under the contract.** A 4.2 m rise / 24 risers gives a reasonable 0.175 m riser, but 3.6 / 24 gives only 0.15 m going, below 0.25 m. The lower landing extends to Z=7.5 outside the selected stair cells beginning at Z=8 (before the 0.09 m inset). At least 6 m run is required for these risers; run plus two 1.5 m landings would then exceed the 8 m cell. Resizing/repositioning cells or changing the stair arrangement is a genuine design decision.

The last two checks are independent arithmetic inspection of the original values, not claims that the sequential compiler reached those branches. This list does not certify that hypothetical architectural repairs would expose no further failures. It establishes several independent reasons why normalization alone cannot yield a valid proposal.

## Architectural meaning and comparison

The proposal contains meaningful architectural intent: five named masses, fourteen explicit cells, two levels, six suite allocations, an owner suite larger than the other suites, a social salon/kitchen, terraces and an explicit stair/portal network. Selected interior polygon areas total **832 m²** (416 m² per level), plus **240 m²** outdoors. These are gross authored cell areas, not verified habitable or constructed areas. The main vertical extent is approximately 8 m before roof thickness. The rectangular organization is asymmetrical, with an elevated private pavilion and lower guest wing; it is more than a list of luxury room names.

But guest suite 2 and 3 are accessed through guest suite 1; family suites 5 and 6 are accessed through the primary suite. A graph may connect such rooms while private-suite circulation remains poor. Baths, dressing rooms and service rooms are unpartitioned promises. The only route upstairs goes through the kitchen and lower stair cell. The described covered forecourt has `roof:false`. There are no window-mode portals, ordinary facade windows, shade devices, pool, planting or site grading. Flat cell roofs and material labels cannot establish sophisticated tropical architecture. Actual facade/roof composition, completed circulation and appearance are **not verified**.

Compared with [earlier Terra/Sol proposals](../../../design-first/sol-planning-comparison-2026-10-30/REPORT.md), this response makes explicit cell and stair selections rather than relying on solid suite shells or an unresolved stair reservation. Its 832 m² interior allocation is close to the earlier Terra 812 m² and substantially smaller than Sol's 1,620 m² (different representations; neither is net area). Sol selected more facade/roof detail. This semantic response offers a clearer machine-readable spatial plan, but its stairs, privacy, openings and roof junction still fail. None establishes a complete premium estate.

Shared walls, matched door cuts, floor datums, tread generation and provenance would be deterministic compiler coordination **if valid inputs reached compilation**. They are not improvements already demonstrated in this response. Unequal suite areas, the mass arrangement, materials and selected uses belong to Terra. No rendered architectural superiority or causal model improvement can be claimed: the schema/instructions differ and this is one stochastic response.

## Construction, preservation and verification

No valid session, editable live-response geometry, physical acceptance, live-response Save/Reload/Undo/Redo or exterior captures were produced. Those downstream steps are conditional on valid non-speculative construction; rendering a modified diagnostic house would misattribute decisions to Terra. Existing family/luxury mock tests still exercise actual geometry, physical checks, save/reload, revisions and project Undo/Redo; they are application regression evidence only.

[Preservation](preservation.json) verifies every original file against the pre-existing 15-file SHA-256 manifest. [Source hashes](source-hashes.json), [original schema findings](original-validation.json), and [isolated mapping evidence](diagnostic-identifier-mappings.json) are retained separately. The mapping isolation removes the invalid narrative relation only in memory; all sixteen mapping entries are identity adaptations, not architectural corrections.

**28 tests pass across three files** ([results](tests.json)); focused ESLint passes. Full typecheck remains blocked by the pre-existing archived `experiment-script.as-run.ts` imports/types and duplicate property in `sol-planning-comparison-review.ts`; no diagnostic points to the recovery changes ([typecheck](typecheck.txt)).

Recovery adds normalization tests for uppercase/underscore/space conventions across all entity/reference types on the unrelated family fixture, identical geometry/provenance, evidence-preserving reload, collisions, wrong-type references, invalid punctuation, retained geometry failures, outdoor height applicability and the exact paid response. Original fixtures and source response remain unchanged.

Reproduce without a network:

```sh
npx vite-node --config vitest.config.mts scripts/semantic-generation-recovery.ts
npx vitest run src/lib/villa/experimental/semantic-building
```

The recovery script replaces fetch with a throwing function and performs only local reads/writes. It does not invoke the live runner. No commits or deployments.
