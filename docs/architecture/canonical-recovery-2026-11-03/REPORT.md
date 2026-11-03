# Software-assisted recovery test, final Terra plan (2026-11-03)

Offline only: 0 paid calls, no database, commits or deployments. Source `proposal.normalized.json` is unmodified (hash checked before and after).
Evidence: [probe.json](probe.json), [decisions-compile-only.json](decisions-compile-only.json); scripts `canonical-recovery-probe.ts`, `canonical-recovery-decisions.ts`.

**Outcome: strict recovery stops. No Software-Assisted Diagnostic Reconstruction was built or rendered.** Of the 9 diagnostic errors (6 root causes), one correction is mechanical; the rest need decisions.

| Error | Class | Why |
|---|---|---|
| waterfront-lawn 0.5 m outside site | **Mechanical** | site.depth 80→81 (exact shortfall; no change to the house). Clears the error, introduces none. |
| living-salon × west-gallery 0.5×6 m (+ gallery roof into salon) | **Choice** | 6 single edits clear it. powder-room.gap 0.5/6 and living-salon.gap 6 are unsafe: they sever the entry-powder / entry-living doors. Safe ones: salon alignment→start (shifts the whole social wing 4.5 m, breaks the axis), salon width 18→17, gallery alignment→start (gallery then runs 8 m toward the road, building grows to z 22). |
| dining-deck-link, no shared wall | **Choice** | dining alignment end→start or depth 10→12 both work; each shifts a room chain or resizes a room. |
| arrival-bed overlaps 4 rooms | **Choice** | No width fits beside the court; remove, or move it into the approach (north of the court). |
| east-garden-reserve overlaps east wing | **Choice (bounded)** | width 16→10 is the largest that fits, but it is a 37% cut. |
| arrival-bronze-screen blocks the door and stands in the court | **Choice** | The court abuts the entry wall, so any north-wall screen stands in the court. Remove or move to another wall. |
| pantry-east-cloister, no shared wall | **Fundamental** | There is a 6 m gap (the service yard). The whole east wing has no indoor link to the house. Any fix invents circulation. |

I did not apply the choices to the working copy. Applying the mechanical edit alone leaves compile failing on the salon/gallery collision (`probe.json` → `mechanicalOnly`).

## Is anything hiding behind these? (compile-only, no render)
One explicit choice per blocker: site 81, dining→start, east wing routed through the service yard, arrival-bed removed, reserve width 10, screen removed, plus one salon/gallery option:
- salon alignment→start: **diagnostics 0 errors, compiles**
- salon width 17: fails (reserve now collides with the wing)
- gallery alignment→start: fails (lawn now 4 m outside the site)

So the known blockers are the whole list for one variant, but fixes interact, and only the coordinator's re-run shows which combination holds. The compiling variant sends bedroom access through the service yard, which is not something to accept silently. It was not rendered because the stop condition applied.

## Product implication
Recommend a bounded, transparent **coordination stage between planning and compilation**, but a **decision stage, not an auto-repair engine**. About 1 in 6 root causes was auto-fixable. A user-facing menu of verified, ranked options (as the coordinator already produces) would cover the rest, and each pick resolves with no model call. Needs before building it: the coordinator currently offers options only for the collision, not for door adjacency, site items, screens or wing linkage, and it misses options such as gallery alignment. A cheap second step could ask the user, or a small model call, to choose among the verified options. A separate prevention step is to make Terra declare wing linkage explicitly, since the disconnected east wing is the one real redesign issue.

---
# Render of the diagnostic variant — SOFTWARE-ASSISTED DIAGNOSTIC RECONSTRUCTION, NOT AN ACCEPTED TERRA GENERATION

Exact variant = "G4" of `decisions-compile-only.json`. Files: [diagnostic-plan.json](diagnostic-plan.json) (modified copy), [decisions.json](decisions.json) (before/after + rationale), [scene.json](scene.json) (real compiler output, 168 elements), `DIAGNOSTIC-{arrival,aerial,garden,poolside}.png` (red label burned into every image), [browser-result.json](browser-result.json). Scripts: `canonical-recovery-build.ts`, `canonical-recovery-capture.mjs`; dev page `src/app/dev/canonical-recovery/`.

## Decisions applied (none approved as design)
| # | Change | Source |
|---|---|---|
| D1 | site depth 80→81 m (not permitted if the plot is fixed; alternative is a smaller lawn) | recovery |
| D2 | living-salon alignment centre→start (social wing shifts 4.5 m, axis broken) | recovery |
| D3 | dining-gallery alignment end→start (kitchen/service chain 2 m south) | recovery |
| D4 | east wing's only link re-hosted on the service yard (bedrooms entered via service yard) | recovery |
| D5 | arrival-bed removed | recovery |
| D6 | east-garden-reserve width 16→10 | recovery |
| D7 | arrival-bronze-screen removed | recovery |
Everything else (rooms, sizes, heights, roofs, materials, pool, constraints) is Terra's.

## Verification
Compiled by the real `compileArchitecturalPlan` (0 diagnostic errors). The browser page compiles the same plan independently; all four views match `scene.json` exactly: element IDs, positions and yaw (asserted), 0 page errors, no WebGL context loss, API calls blocked. No paid calls; original plan hash unchanged.

## Assessment
- **Massing:** three flat boxes in a row: a low central pavilion and two huge bedroom slabs (23×33 m each, 705 m² of near-identical rooms). The "tall central hall" is barely taller than the wings. Symmetry reads as a hotel or clinic block, not a villa.
- **Roofs:** all 23 roofs are flat dark slabs with no overhang. Between them are thin gaps that look like errors, not shadow gaps.
- **Façade depth and openings:** large blank white and limestone walls, almost no visible glazing, one dark door. The waterfront elevation Terra described (piers, veranda shadow, glazing) barely shows; only the timber veranda roof gives a hint.
- **Entrance:** a small flat canopy over a door in a plain wall. With the screen removed there is no arrival experience at all.
- **Site/pool:** the 18×5 m pool is small for a US$25M estate. The oversized lawn renders as a teal rectangle that reads as water. The east wing sits apart, with no visible link.
- **Luxury character:** none yet. It is a competent footprint, not a design.

## Verdict
The underlying concept is **too generic to justify further recovery** as it stands. The retained plan is a symmetric linear arrangement with a uniform bedroom module repeated six times. The ideas in the thesis (layered waterfront elevation, recessed entry, deep veranda shadow) are not in the geometry. Fixing placement would give a tidy but dull result. The east wing's missing link shows the plan was never really resolved. It would be better to spend effort on getting generation to commit to massing, roof and façade decisions than on rescuing this plan.
