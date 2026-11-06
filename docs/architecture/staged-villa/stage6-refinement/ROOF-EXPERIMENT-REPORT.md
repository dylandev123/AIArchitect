# One offline Terra roof refinement experiment

**The existing semantic editor constructed the exact roof-only source edit, but the candidate is rejected by the stricter roof-seam mesh audit.** Its lower ridge is visible in the matched renders; it produces a modest flattening, not a convincing improvement in separation or overall architectural quality. The accepted Stage 5 villa remains unchanged.

[Interactive before/after comparison](roof-experiment-4/comparison.html) · [separate editable candidate](roof-experiment-4/candidate.save.json) · [candidate checkpoint and rejected status](roof-experiment-4/candidate.checkpoint.json).

## Scope and provenance

The input is the actual completed Terra-designed Breezeway Courtyard Villa: corrected-v5 house plus actual live Terra Stage 5 landscape, 377 elements, 23 rooms, four bedrooms and five bathroom rooms. The experiment replays recommendation 1 from the retained actual Stage 6 response through existing `runEdit` / `set-roof`, deterministic compiler and validators. No model/planner call was made. No facade operation was included.

Exactly one source leaf changes: `upper-bedroom-bar.roof.rise`, **2.45 → 2.0825 m**. Roof form remains hip; source overhang remains 1.3 m, actual per-edge eaves remain unchanged, and all materials/colors/appearance and other roof types remain unchanged. No plans, walls, doors, furniture or landscaping were edited.

The raw generic edit outcome reports acceptance because the existing validators pass. The separate experiment verdict rejects the candidate after the additional mesh audit. These are different checks, retained without rewriting the evidence. The saved candidate exists for diagnosis/review, not as a new accepted checkpoint.

## Construction, precision and junction findings

The compiler rounds scene-element centres and dimensions to millimetres. The requested source rise remains exactly 2.0825 m; its compiled roof height is **2.083 m**. The element centre moves from **8.025 to 7.841 m**, while its x/z position and width/depth remain fixed.

| Renderer-built measurement | Before | Candidate |
|---|---:|---:|
| Ridge elevation | 9.25 m | 8.8825 m |
| Eave elevation | 6.8 m | 6.7995 m |
| North/south hip-face pitch | 19.813793° | 17.031059° |
| End hip-face pitch | 24.010799° | 20.743043° |
| Roof slope triangles | 6 | 6 |

The ridge is 0.3675 m lower as intended. Independently rounded centre/height put the rendered eave **0.0005 m below its former level**, rather than preserving it exactly. Surfaces are finite and non-degenerate. Pitch reduction itself does not trigger the existing construction validators.

The audit uses the **normal renderer's actual pitched-roof surfaces and fascia solids**, with convex separating-axis checks, not intersecting roof bounding boxes as a substitute for surface collision. It distinguishes boundary contact, inherited overlap and newly introduced crossing. The strict positive-crossing threshold is 0.000001 m; it was not relaxed to accept the result.

- **Entry-pavilion gable:** no before/after contact or intersection. A conservative guaranteed clearance lower bound from the complete rendered-part bounds changes from **1.666763 to 1.666286 m**. This is a lower bound, not an exact nearest-surface distance. The entry gable is byte-identical.
- **Upper east-suite gable:** the roofs already abut at the shared edge, so there is **no positive separation gap** before or after. One existing fascia-corner overlap remains; its bounding overlap volume decreases slightly, from 0.0028 to 0.002795 m³. This inherited junction limitation was not relabelled as a newly fixed condition.
- **New candidate defect:** two hip-slope triangles now cross the east-suite fascia at the seam. Their minimum separating-axis overlap measures approximately **0.500 mm and 0.468 mm**. These are small, renderer-level slivers consistent with the 0.5 mm eave drift. They are not visible gaps at property-scale views, but they fail the experiment's requirement to introduce no new roof crossings.

**The candidate is therefore rejected for construction acceptance.** The standard validators' zero findings do not override the new mesh evidence. No snapping repair, eave adjustment, tolerance increase or geometry substitution was performed. A future precision/junction fix would be separate work; this experiment did not authorize one.

[Renderer geometry/pitches/junction audit](roof-experiment-4/roof-geometry.json), [east-gable crossing details](roof-experiment-4/junction-roof-upper-east-suite.json), [entry-gable clearance](roof-experiment-4/junction-roof-entry-pavilion.json).

## Preservation, save/reload and editability

The candidate still has **377/400 elements**, with 23 spare slots. The sole changed scene element is **`roof-upper-bedroom-bar`**, owned by **`roof:upper-bedroom-bar`**. Its centre Y and size Y change; every other serialized field remains equal.

**376 elements are byte-identical. Zero additions, zero removals, all element IDs and semantic ownership unchanged.** The full source compares equal after replacing only the one authorized roof-rise leaf. This preserves every room plan/type/dimension, circulation link, stair and void/guard, wall, opening/door, block footprint/level, other roof, material, facade and landscape item.

The exact 23-room programme/four bedrooms/five bathroom rooms remains. The full Stage 5 check with four bedrooms and five baths, all staged checks performed by the edit path, and the existing hard physical-relationship audit return zero findings. Flat site is retained. Earlier Stage 3 room-area/narrow-circulation warnings remain attached to the candidate checkpoint; no engineering, complete-navigation or code-compliance certification follows.

The candidate save reloads by recompiling its source and comparing the serialized scene. Semantic ownership also matches after reload, so existing roof edit targets remain addressable. No second architectural edit was performed merely to demonstrate editability.

[Exact proposal and provenance](roof-experiment-4/proposal.json), [existing editor outcome](roof-experiment-4/edit-outcome.json), [combined preservation and rejection verdict](roof-experiment-4/verification.json).

## Actual matched-camera visual comparison

Both sources were freshly rendered through normal **OperationScene/VillaScene**, at the original Stage 5 arrival, aerial, garden and poolside cameras. The measured position/target differences between each pair are below 0.00000001 m. Viewport, crop, daylight, materials, asset geometry and normal rendering paths are the same. Recorded material properties compare exactly.

The capture harness fixes water animation at 42 seconds and uses the same deterministic random seed for both runs; no production animation/material/lighting code changed. It serves the unrelated asset-catalog GET an empty local response and blocks other APIs/non-local resources. There were no blocked attempted requests beyond that stub, failed requests, HTTP errors, console/page errors or WebGL losses. Existing THREE deprecation warnings remain; they are not errors or repaired by this task.

Every capture verifies all 377 element IDs, local positions and yaw against its saved source, finite geometry and the requested camera. Full-canvas images are retained alongside the standard crops. These are actual captures of the unembellished baseline/candidate.

| View | Before | Candidate | Side-by-side | Visual assessment |
|---|---|---|---|---|
| Arrival | [Original](roof-experiment-4/before-arrival.png) | [Revised](roof-experiment-4/after-arrival.png) | [Compare](roof-experiment-4/comparison-arrival.png) | Lower central ridge is noticeable against the background gable. The roof looks calmer/flatter, but its broad plane remains dominant. |
| Aerial | [Original](roof-experiment-4/before-aerial.png) | [Revised](roof-experiment-4/after-aerial.png) | [Compare](roof-experiment-4/comparison-aerial.png) | Difference is slight: the large roof footprints and connected cluster read almost the same. |
| Garden | [Original](roof-experiment-4/before-garden.png) | [Revised](roof-experiment-4/after-garden.png) | [Compare](roof-experiment-4/comparison-garden.png) | Ridge is visibly lower in direct comparison. Upper roof weight is modestly reduced, but the east-gable seam stays joined. |
| Poolside | [Original](roof-experiment-4/before-poolside.png) | [Revised](roof-experiment-4/after-poolside.png) | [Compare](roof-experiment-4/comparison-poolside.png) | Slightly flatter silhouette; veranda, facade exposure and outdoor composition remain unchanged. No substantial new architectural depth appears. |

The change is **not invisible**, especially when toggling the identical images. At normal property scale it is modest and easily missed. My visual assessment is that the central roof looks slightly less heavy, but the proposal does **not convincingly achieve the intended separation of the neighbouring roof forms or make the whole house clearly more accomplished**. It is not a dramatic regression either. This is an observer assessment, not an independent or blinded aesthetic study.

In particular, lowering the ridge does not expose more vertical facade because the wall top/eave are effectively fixed; it does not create a horizontal gap or alter the roof footprints/topology. Those limits explain why the proposal's architectural benefit falls short of its narrative. Texture striping and washed-out presentation also remain unchanged.

[Interactive comparison](roof-experiment-4/comparison.html) provides direct before/after toggles for all four views. All eight toggle checks passed. Image-difference counts are retained solely as evidence of changed pixels, not as a beauty rating. [Comparison checks](roof-experiment-4/comparison-checks.json).

## Verification and retained diagnostic history

**118 tests passed across nine focused files** (staged suites plus roof-intersection and relationship tests). Typecheck and focused ESLint passed. The explicit edit/preservation/save checks, current construction validators and all eight browser captures passed. The **additional strict mesh acceptance check failed**, as recorded above; it must not be included among passed construction claims.

[Tests](roof-experiment-4/tests.json), [before browser evidence](roof-experiment-4/before-browser.json), [after browser evidence](roof-experiment-4/after-browser.json), [final preservation/camera/material checks](roof-experiment-4/preservation-final.json).

`roof-experiment-1…3` are retained validation diagnostics for the **same exact source edit**, not alternative designs or additional AI experiments. The first check assumed unrounded element dimensions; later diagnostics distinguished inherited fascia overlap from newly introduced slope crossings. `roof-experiment-4` is the final saved/rejected candidate and comparison. No failed evidence was deleted or overwritten.

Of 457 pre-existing dirty/untracked files pinned at task start, **456 remain unchanged**. The only intentional existing-file change is the development viewer's exact candidate-file mapping and explicit rejected-candidate provenance label. All prior source/checkpoint/response/capture evidence remains unchanged. New scripts and experiment artifacts are separate. The isolated development server used for captures was stopped.

No paid AI requests, credentials changes, commits, pushes, deployments or database changes occurred. Full-repository/hosted testing, independent aesthetic review, engineering/flashing/waterproofing and code compliance were not verified.

## Result and next priority

This experiment proves that the retained AI roof recommendation can be translated into a real semantic edit, isolated to one element, saved/reloaded and rendered with controlled comparisons. It does **not** prove a valid and visibly better accepted building: the strict mesh check rejects the rounding-related seam defect, and the visible compositional gain is limited.

Further work is justified on roof precision/junction validation before accepting roof edits. A stronger composition would require a separately scoped design hypothesis beyond merely lowering this one ridge. No such change was attempted, and the facade recommendation remains unapplied. The original Stage 5 villa stays the accepted baseline; this task stops at the comparison.
