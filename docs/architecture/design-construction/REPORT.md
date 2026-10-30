# Teaching design and coordinated construction — retained family case

The software now exposes construction dependencies and datums to refinement, requires a reason for architectural intervention selection in new provider reviews, carries the selected intervention into visual comparison, and reports independent rectangular flat-roof overlaps through the existing architectural review. **No improved model-produced house has been demonstrated. The immutable paid refinement remains rejected.** Its original geometry cannot be recovered as a successful response through a software correction alone.

No paid requests, credential access, retrieval, database writes, commits or deployment occurred in this task. No house geometry, historical response, programme evidence or historical screenshot was edited. Existing uncommitted work was preserved. The executable [offline replay](../../../scripts/design-construction-offline.ts) reads retained inputs and writes only this evidence directory. [Replay and input hashes](replay.json) distinguish original model evidence from developer diagnostics.

## Why this architecture was chosen

Evidence reviewed includes the final-family provider request/response, constructed scene and audits; the retained review/refine requests and responses; semantic-contract's schema diagnosis; and single-house's full diagnostic sequence and paired renders. Earlier preparation reports saying the paid run is pending are superseded by retained provider response files and the execution records.

The recorded concept explicitly chooses a single storey with a 12×8 m central living envelope and 6×12 m and 6×10 m private wings. It chooses a common enclosure head of 3.35 m and roof top of 3.51 m. This is why the roofline is uniform: the authored geometry follows the selected datums. Its description of the wings as “lower-profile” does not establish lower roofs. No richer geometry was lost in execution.

The brief requested four bedrooms, pool, private garden and covered outdoor dining; it did not prescribe this composition. Terra selected compact accommodation reserves and privacy-oriented small wing windows. The accommodation is not four finished bedrooms. The entrance has a real passage but a slight canopy and broad flanking opaque fields. The facade treatment uses limited depth and a pale wall/roof palette. These are visible underdeveloped design choices, not proof that the model lacked entrance, facade or roof operations.

The approximately 50,145-character recorded developer message already supplies design-before-parts, numeric datums, elevation composition, independent roof sections, openings, shading and materials. The original generation ceiling was 30,000 output tokens. The refinement used 17 operations against an 80-operation allowance, with ten existing targets against this house's limit of 23. Neither count demonstrates budget exhaustion. The one-finding transaction and majority preservation constrain whole-house change, but meaningful roof and arrival revisions were supported. More available operations alone would not guarantee better architecture.

Retrieved knowledge was present and partly applied: pool-garden-view relates to the basin/outlook; dining-transition to the garden threshold; covered-threshold to shelter; solid-glass-balance to controlled wing openings. Asymmetric-balance's retrieved placement guidance mentions a taller living volume and lower wing, yet the response explicitly selects a shared roof datum. Thus knowledge selected in narrative is not reliably translated into section. The unbuilt reading nook is marked considered and planting unsupported. These records show selections, not hidden reasoning or proof of causal influence.

The paid visual reviewer actually identifies the shared roof cap, weak entrance, underscaled windows, pale palette and bare garden. It chooses finding zero, rear-facade depth, and directs glazing replacement, a setback and a wider canopy. It leaves massing and arrival outside that transaction. The former schema required a selected finding but no explanation of why it outranked the roof and arrival findings. There is no evidence that the software forced the cheapest intervention, or that the model considered an unseen alternative. The demonstrable gap is unrecorded selection reasoning and incomplete transfer of the intended intervention into comparison.

## Application changes and their limits

1. **Construction context for refinement.** `refinementConstructionContext` derives world transforms, rendered top/bottom datums and recorded reference paths for selected elements. The actual route transmits this beside the scoped edit instruction. It exposes programme, legacy spaces/commitments, spatial relationships and knowledge-decision dependencies within the preserved architectural plan. It does not parse prose into geometry or map removed IDs automatically. The model is explicitly told that moving a post between changed supporting surfaces may require resizing; a threshold solid already inside a retained slab is redundant; and roof/soffit extents must be coordinated. These instructions are a focused response to retained failures, not a new design prompt or house template.

2. **Explicit intervention selection.** New provider review schemas require `selectionReason`: why this is the largest supported architectural correction, what prevents addressing more fundamental findings first, and what visible effect comparison should inspect. Historical reviews remain readable. This is a decision record, not an aesthetic score or a deterministic guarantee that Terra chooses well. No live output has tested compliance or improved design judgment.

3. **Review-to-comparison continuity.** Normal `runGenerationReview` now passes its validated review into the comparison request. The route validates it against the previous scene and sends the selected finding, instruction and selection reason with the matching before/after images. Previously comparison only received scenes, brief and images; it could prefer a local change without being explicitly shown the intended intervention. Legacy comparison inputs remain supported. The comparison prompt distinguishes a locally achieved effect from unresolved whole-house composition. Existing uncertain/regression rejection and atomic history behavior remain intact.

4. **Primitive flat-roof junction evidence.** The existing `generationQualityFindings` now detects positive penetration between primary rectangular flat-roof solids using world-space oriented footprints and vertical intervals. The retained diagnostic's main roof and canopy overlap by 0.04 m; this is now visible to review even though the assembly-only roof-junction check does not cover this pair. This remains an architectural review finding because an intentional detailed junction is possible. It neither certifies nor automatically unions roofs. Touching/separated solids are allowed; profiled roofs, pitched roofs, decorative trim and waterproofing remain outside this precise check. Existing no-new-finding refinement acceptance rejects a newly introduced unresolved overlap. No new scoring system or competing geometry engine was introduced.

These changes apply to arbitrary IDs, nested frames and yaw. Elements, supported operations, schema compatibility, scoped preservation, creation/removal budgets, edit history and rendering are unchanged. They improve information and reliability in the normal workflow; they do not constitute new model-produced architecture.

## Complete retained replay and outstanding issues

The [machine replay](replay.json) runs `stageGenerationRefinement` on both original paid output and the previously retained diagnostic, stages the diagnostic for evidence comparison, and fully stages the separate supported structural developer fixture. Tests additionally exercise the normal review/refine/compare orchestrator, mocked route transport and project history. There is no provider retry.

| Issue | Reproduction and ownership | Current result / coherent next step |
| --- | --- | --- |
| Ambiguous fascia | Paid operation 16 uses semantic `material` with renderer `volume`. The former schema permitted this; semantic-contract already corrected the provider schema. | Original remains correctly rejected. Neither label nor dimensions uniquely determines `mass`, roof or another semantic role. A new model-authored supported value is required. No conversion was added. |
| Post seating and duplicate threshold | The original moved posts penetrate the .15 m slab and retain incompatible heights; the new sill lies inside existing slab. These are authored dimensions, not parent-transform loss. | Existing gates stay intact. New refinement context exposes datums and the focused instruction addresses these failure modes. The six earlier diagnostic physical edits remain developer assumptions/corrections only. |
| Stale programme references | Removing the rear walls and garden door leaves programme access/enclosure, spatial and knowledge references stale. The original plan is explicitly preserved by the scoped contract. | No remapping or warning suppression. Retain an ID via replace only when the same identity truly survives. One-to-many facade recomposition requires an explicit bounded evidence-change contract, described below. |
| Occupied-space evidence | Entry vestibule cites the entire main-floor slab, not a bounded vestibule. The slab-derived envelope reaches the rear canopy after the facade moves. | Finding remains conservative and review-only. A front wall cannot establish a closed room boundary. Do not shrink the footprint or remove the warning without authored spatial evidence. |
| Canopy/main-roof junction | Diagnostic canopy Y=[3.21,3.39] crosses primary main roof Y=[3.35,3.51] over a .65 m plan strip. Earlier zero hard findings did not certify this junction. | Now explicitly reported in existing review. Recommend a genuinely subordinate canopy with a separately coordinated soffit/post height and clear roof edge; alternatively trim/split the main roof or author a detailed joint. Each requires a new architectural decision. No option was silently built. |

The original still fails semantic schema validation first. The diagnostic still fails full refinement acceptance. It now exposes an additional primitive roof-junction review finding alongside stale programme and occupied-envelope evidence. The supported developer structural fixture still passes full staging; it proves application support, not model design quality.

## Visual evidence and assessment

These are **existing, unchanged paired captures** from single-house, hashed again in this task. They are not fresh renders or an after-result of the software changes above. Renderer and geometry did not change, so presenting newly captured identical pixels as architectural improvement would mislead. The existing browser record verifies normal `ReviewPreview` → `OperationScene` → `VillaScene`, matching cameras, actual element transforms, no page errors and live WebGL. After views depict the rejected developer diagnostic, not an accepted model revision.

| View | Original Terra family house | Rejected developer diagnostic |
| --- | --- | --- |
| Arrival | [Before](../single-house/before-arrival.png) | [After](../single-house/after-arrival.png) |
| Garden | [Before](../single-house/before-garden.png) | [After](../single-house/after-garden.png) |
| Aerial | [Before](../single-house/before-aerial.png) | [After](../single-house/after-aerial.png) |
| Poolside | [Before](../single-house/before-poolside.png) | [After](../single-house/after-poolside.png) |

Inspection confirms that the diagnostic gives the garden facade a clearer centered door and paired broad glazing. Its improvement is local. Arrival remains weak; the pale, nearly continuous roof cap still dominates; small wing openings sit in broad plain walls; and landscape and interiors remain unfinished. The aerial makes the unchanged roof hierarchy particularly clear. This does not meet the requested premium architectural standard.

[Retained Solana aerial](../intelligence-comparison/solana-aerial.png) shows substantially stronger vertical hierarchy, an expressed entrance portal, layered roofs and deep glazing. Its scale, planting and presentation differ. It is a quality reference, not a template or evidence that the family model has improved.

## Smallest credible next workflow change

The current response cannot become a successful model refinement without new model decisions. Stop accumulating manual geometry repairs here. The next substantial capability should be a bounded **construction-and-evidence revision transaction inside the existing executor**, rather than a new generation engine:

- The model identifies each affected programme/reference path and supplies explicit final referenced IDs with a reason. Restrict changes to commitments dependent on scoped geometry; preserve user requirements, provenance, unrelated programme and knowledge records.
- Validate proposed evidence together with final operations atomically. Every mapped role must resolve to supported final kinds and pass existing physical checks. No empty-reference erasure, narrative relabelling, baseline-warning pre-seeding or blanket old-to-new string substitution.
- Represent an explicitly authored occupied region in the existing floor's local frame, bounded by its actual surface, when a space uses only part of a shared slab. For this house the model must decide whether the rear strip is exterior loggia or interior; the application cannot infer that from a vestibule label. Such regions remain evidence, not duplicate slab geometry or generated rooms.
- Let the reviewer select a coordinated massing/section intervention with necessary wall/roof/access dependents and a visible acceptance intention. Preserve current bounded scope; if the dependency closure cannot fit, disclose that rather than choosing decoration by default.

This is a significant semantic-contract change requiring explicit design and adversarial regression work, not a safe patch to fabricate the current model's missing decisions. The present changes make these dependencies visible and carry the selected intent through visual comparison. They do not implement evidence rewriting or occupied-region authoring. A new separately authorized model run is then needed to demonstrate that Terra can use the improved contract and actually produce a stronger roof/arrival composition. No paid run was made or assumed authorized here.

## Verification

**223 tests pass across 42 files; typecheck and focused ESLint pass.** See [test results](tests.json), [typecheck](typecheck.txt), [focused lint](eslint.txt), [final route rerun](route-final.json), and [input hashes/full replay](replay.json). Coverage includes the retained family rejection, flat-roof penetration with nested/rotated frames and touching/separated controls, exact dependency paths/datums, provider selection explanation with historical compatibility, comparison intent transport, scoped structural construction, atomic failures and edit/save/Undo/Redo regression suites.

Reproduce offline:

```sh
npx vite-node --config vitest.config.mts scripts/design-construction-offline.ts
npx vitest run src/lib/villa/scene src/lib/semantic src/app/api/ai/scene/visual-review/route.test.ts src/store/__tests__/directScenePersistence.test.ts
npm run typecheck
```

The key remaining obstacle is coordinated architectural revision with trustworthy spatial evidence, followed by actual rendered verification of model-authored design choices. Passing tests and a better local canopy do not establish that capability. The 47-element original remains the permanent model regression case; the 49-element diagnostic remains separately labelled and rejected.
