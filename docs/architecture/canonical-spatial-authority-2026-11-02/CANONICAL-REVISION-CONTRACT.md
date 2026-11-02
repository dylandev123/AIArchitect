# Minimum contract for canonical plan-level revision (not implemented)

Today a canonical house is edited only as scene elements (move/resize/finish of individual compiled parts). Scene-operation editing of the *plan* is refused with 409 and zero provider calls. The following is the smallest contract that would let an architectural edit change the plan and regenerate only the affected geometry while keeping user edits.

## What already exists

* The scene stores the authored plan (`scene.architecturalPlan`, `architectural-plan-1`; derived heights stay omitted).
* `compileArchitecturalPlan` is deterministic: same plan → same elements, ids and provenance (`provenance[elementId].sources` names the plan entities that produced each element; `vertical` records derived values).
* `reviseBuilding` (semantic-building kernel) already implements the transaction on compiled output: it diffs previous and next compiles by element id, replaces changed elements, adds new ones, removes obsolete ones, and **refuses** (`DesignConflict`) when a generated element the user has since edited would be overwritten, or a new generated id collides with manual geometry. It is currently exercised only offline.

## Minimum additions

1. **Plan patch type.** A typed patch over named entities (`spaces`, `portals`, `roofs`, `levels`, `stairs`, `screens`, `pools`, `landscape`; set/replace/remove by id) applied to the stored plan, then re-validated with `architecturalPlanSchema`. No scene operations, no coordinates.
2. **Revision entry point.** `revisePlan(scene, patch)`: apply patch → `compileArchitecturalPlan(next)` → `reviseBuilding(previousCompile, nextCompile, currentScene)`. The previous compile is recomputed from the stored plan (deterministic), so no extra persisted state is required.
3. **Edit ledger.** Mark an element *manually edited* when a scene operation changes a generated element. Today this is inferred by comparing against the recomputed compile; persisting a per-element hash (or an `editedFromGenerated` flag) makes the conflict check cheap and explicit.
4. **Conflict policy.** Unaffected elements (element identical in both compiles) are untouched. Affected and unedited elements are replaced. Affected and *edited* elements are reported as a decision: keep the edit and detach the element from the plan, or discard the edit. Never silent.
5. **Stable ids.** Element ids derive from plan ids (`<space>-floor`, `<boundary>-wall`, …). Renaming a plan entity is a remove + add; changes that re-segment walls (a new opening) change boundary ids, so the ledger must key on provenance sources, not only ids.
6. **Atomicity and history.** The result is one appended project version (Undo/Redo already works per version). A rejected compile appends nothing.
7. **Planner role.** A future model step proposes a *patch* (never a whole new house) from the existing plan plus the rendered review; the compiler's all-at-once rejection list is the feedback loop.

## Not needed for this contract

A layout optimiser, automatic repair, or a second generation path. Partial-coverage roofs, valleys and voids are separate capabilities and independent of revision.
