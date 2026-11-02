# Pitched roofs: the 52 findings were a bounding-box artefact, not a construction limit

No paid request, commit, deployment or database access. Retained Terra files were only read; nothing in them was repaired. Numbers: [results.json](results.json). Reproduce: `npx vite-node --config vitest.config.mts scripts/canonical-roof-construction-offline.ts` (refuses to overwrite).

## 1. What the 52 findings physically are

The previous checks reduced every roof to one axis-aligned box, grown 0.1 m on all four sides for a pitched roof, and compared boxes. I reproduced that rule (it gives exactly 52 on the retained plan) and then measured the same pairs against the real parts the shared builder emits: slope triangles, gable ends and fascia boxes.

| What the finding really is | Findings | Cause |
|---|---:|---|
| Bounding box only: no roof part touches the other | 22 | The grown box overlapped a neighbour's box. Nothing was built there. |
| Fascia board only: slopes and gable ends are clear | 26 | The 0.1 m board stands in the shared wall's 0.2 m thickness, or meets a neighbour's flat slab or board at the wall line. A decorative component, not a roof surface. |
| Rooms overlap | 2 | `media-lounge` lies wholly inside `east-suite-1` (8×6 m). A room collision reported again as a roof finding. |
| Roof surface penetrates | 1 | `east-suite-3`'s hip rises 0.32 to 0.35 m into `owner-suite`, which is stacked over half of it. |
| The same stacked-room cause, reported on the roof itself | 1 | "hip roof over a partly covered space". |

- **Software or model:** 48 of 52 were software artefacts, 2 were the room overlap and 2 were one real unsupported junction. Not one of the nine pitched roofs actually collided with a neighbouring roof surface.
- **One relationship, many reports:** the 52 findings were 32 distinct neighbour pairs across 9 roofs.
- **Gable roofs:** the builder puts boards on only the two eave edges, not four. The earlier contract text ("all four edges") was wrong for gables.
- **Not all fascia is fine:** where a roof overhangs a neighbour by at least 0.1 m, the board stands outside the wall, so it is still checked.

## 2. The change (small, general, nothing hard-coded)

- **Builder:** an optional roof field `fascia` (a subset of north/east/south/west) lists the boards to build. Absent means every board, exactly as before. Slopes and gable ends are never touched. The roof stays one editable element. Files: [fascia.ts](../../../src/lib/house/roof/fascia.ts), the two roof builders, [roofs.ts](../../../src/lib/villa/scene/roofs.ts), [model.ts](../../../src/lib/villa/scene/model.ts).
- **Rule, shared by compiler and diagnosis:** a board is withheld on an edge another room shares, because it would sit inside the wall. [coordination.ts](../../../src/lib/villa/canonical/coordination.ts) holds `exposedFascia` and `roofFootprints`. [plan.ts](../../../src/lib/villa/canonical/plan.ts) writes `fascia` only when a board is withheld, so unobstructed roofs compile byte-for-byte as before.
- **Checks:** the single bounding box is replaced by the slope envelope plus each board that is actually built, with strict vertical overlap. Roofs against roofs, against neighbouring volumes and against floors are still rejected, with the same messages. A board is named when it is the cause.
- **Not touched:** valleys, junctions, mesh unions or any new subsystem.

### What the canonical compiler now supports

| Combination | Status |
|---|---|
| Hip or gable beside a neighbour of any height or form, same level | Supported. Boards only on unshared edges. |
| Pitched roof on an upper storey beside other upper rooms | Supported. |
| Different forms and heights meeting along a wall | Supported. The slopes meet at the wall line as a valley with no drainage detail; geometry is non-penetrating, not waterproofed. |
| Pitched roof over a space with a room stacked over part of it | Rejected. It needs a lean-to or valley. Use flat, or put the upper rooms wholly over or clear. |
| Overhang reaching a taller or same-height neighbour, or its roof | Rejected. Allowed over open ground or a neighbour whose wall top and roof are below the underside. |
| Overlapping rooms | Rejected. No roof rule repairs them. |
| One roof over several rooms, L-shaped roofs, valleys, dormers | Not expressible. Each roof belongs to one rectangular room. |

The last row is the real expressiveness limit. A wing of three suites can only take three small roofs. I did not expand into it.

## 3. Evidence on different architecture

| Case | Result |
|---|---|
| Retained mansion revision (diagnosis and builder geometry; it cannot compile) | Roof findings 52 → 3 (the stacked-room junction twice, and the room overlap). Total findings 85 → 36. Re-measuring all nine roofs with boards withheld on shared edges gives **0** penetrations between roofs on the same level. |
| Multilevel house (generic fixture, orientation 0.4 rad): gable salon, hip gallery over it, gable suite beside it upstairs | Compiles. No roof findings. |
| Asymmetric courtyard (rotated −0.3 rad): hip gallery, gable wing, flat wing | Compiles. The gable wing abutting the taller hip was rejected by the previous rule. |

For both compiled cases, [roofAbutment.test.ts](../../../src/lib/villa/canonical/roofAbutment.test.ts) checks:
- Withheld boards match the compiler's own wall boundaries, derived independently.
- Each rendered board stands outside an exposed edge of its room, checked in world space under rotation. I confirmed the test fails if the builder-to-plan side mapping is swapped.
- Every slope and gable end is intact.
- No surface or board of one roof penetrates another roof or a floor.
- Save, reload, edit one roof, Undo and Redo behave, and recompiling the saved plan reproduces identical elements.

Rendering is verified at builder-primitive level, which both the studio and the scene viewer consume. I did not open a browser capture, so there are no new screenshots.

Tests: canonical 218 pass; whole `src` 3607 pass, 3 skipped; typecheck and ESLint clean for the changed files. One existing budget test moved: the direct-scene capability reference is derived from the element schema, so the new field adds about 100 characters. I raised its limit from 6000 to 6200 rather than hide the field.

## 4. What remains, grouped by underlying decision (retained revision)

36 findings are 14 decision groups.

| Design decision | Groups / findings | Can software derive it now? | What only the model can decide |
|---|---:|---|---|
| **Ensuite placement** (bath beside suite changes that wall) | 4 / 20 | Only the openings once a side is declared as `shared` or `exposed`. | Where each bath goes and which wall the suite's window then uses. All four repeat one pattern. |
| **Exterior window access** | 6 / 8 | Four of the ten blocked windows resolve with host side `exposed`. | Six sit in rooms with no exterior wall wide enough, so the arrangement has to change. |
| **Upper-floor circulation** | 1 / 3 | Once declared, the door's wall and position. This brought access failures from 3 to 0 in the previous work. | That the landing connects to each of the three suites. |
| **Room collision** | 1 / 2 | Reports it, with both extents. | Whether `media-lounge` or `east-suite-1` moves. |
| **Site boundary** | 1 / 1 | Reports the excess. | Site size or bed position. |
| **Roof over a stacked room** | 1 / 2 | Reports it with the supported alternatives. | Flat roof for `east-suite-3`, or move `owner-suite`. |

Software cannot derive that a connection exists, the arrangement, the roof form or the site. It only derives positions from relationships the model declares.

## 5. Is another model revision justified?

1. **Can the compiler build a credible, varied pitched-roof mansion?** Yes for abutting hips and gables of any height, on any storey, with strict rejection of the genuinely unsupported junctions above. It cannot build one roof across a wing.
2. **Software limitation or invalid model arrangements?** 48 of 52 were software. 4 were model-authored: one stacked-room junction, reported twice, and one room overlap, reported twice.
3. **How many independent decisions remain?** 14 groups. About 7 distinct kinds, since the bath wall repeats four times.
4. **Can the representation express a constructible version of this concept?** Yes for every group. The earlier compact multilevel fixture (ensuite, study, deeper wing) compiled with 0 findings when authored as relationships. I did not construct the mansion's own fix, and I cannot assert that the model will.
5. **Is the model getting accurate information?** It was not. The old contract said a fascia sits on all four edges and cannot be trimmed, which is false for gables and steered it toward flat roofs. It now states the real rules, and the revision request regroups the findings accordingly. The prepared, unsent request's hash changes again, so any earlier approval is void.
6. **Meaningful improvement or a corrected repetitive mansion?** The roof class is eliminated, so a revision should now get further than before. But the plan still has six identical suites and baths. Coordination software cannot fix that, and passing the compiler measures none of it.

## 6. Recommendation for the next live experiment

Run **one** revision of the same rejected plan (about US$0.2), authorised fresh. State two pre-registered outcomes: (a) it compiles, or fails only on a new class; (b) the suites are no longer six identical rooms, judged by dimensions, roof form and window pattern across suites. If (a) holds and (b) fails, the evidence points at a separate concept-development step, not more coordination work. If (a) fails on one of the 14 groups above, that is a model failure, not a software gap.

Do not run it before the roof-over-several-rooms limit is decided. If you want wing-scale roofs, that is a separate, larger feature; I stopped short of it.

## Limitations

- Valleys between abutting hips are geometry only. No drainage, flashing or waterproofing is certified.
- A partly shared edge loses its whole board, because the board is one piece. Exposed length on that edge is left bare.
- The previous-rule reproduction in the script is mine. It matches the retained count of 52, but the old code no longer exists to run directly.
