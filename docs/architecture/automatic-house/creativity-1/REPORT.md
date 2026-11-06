# Phase 1: architectural vision, variable heights, composition checks (2026-11-06)

Offline engineering only. No paid calls, approvals, commits, pushes or deploys. Private Studio `state.json` is byte-identical before and after (sha256 `19e700c0…`).

## Baseline preserved
- `../live-v3-final/completed.save.json` is the real Terra house (live v3 Stages 1–4 + Stage 5 continuation), copied read-only from Private Studio. `records.json` holds its accepted slices, raw responses and the 7 call records (budget charge US$0.125, billed estimate about US$0.108).
- `../live-v3-final/final-completed-{arrival,aerial,garden,poolside}.png` are renders of the actual completed save, not the Stage 5 preview.
- `completedBaseline.test.ts` pins the 263 scene elements (sha256 `9d1b12d7…`). It also checks that the saved design parses unchanged, that it audits clean, and that save → reopen is lossless.

## What changed
1. **Stage 1 vision** (`spec.ts` `visionSchema`): style, ambition (modest → estate, with brief evidence), composition, primary volume, focal points, height, roof and entrance strategy, 0–4 signature features, and brief constraints. Terra must supply it. Saved designs without it stay valid and are never checked.
2. **Block heights and ranks** (Stage 2): `low` 2.7 m, `standard` 3.1 m, `tall` 4.3 m, `double` 6.5 m. `double` is one occupied level, never an extra floor. A block carrying an upper floor stays standard. Software derives the following:
   - wall heights;
   - party walls stop at the lower eave, and the taller volume's exposed upper wall becomes a `band-*` wall in its own finish;
   - eaves: a taller volume keeps its eave over a lower roof that fits beneath it;
   - cornices;
   - roof elevations;
   - window and door heights (tall glazing in tall rooms, a 3.3 m entrance door);
   - canopy and portal height;
   - verandas, which never rise above a low host's eave.

   `standard` is stored as absent, so uniform houses compile exactly as before.
3. **Composition checks** (`composition.ts`), in three tiers:
   - **Hard:** `brief-vision-contradiction`, e.g. an upper storey in a single-storey brief, luxury ambition for a "modest" brief, or a contradicted L/U shape.
   - **Correctable:** `vision-*`, i.e. promises the geometry does not build: primary volume not dominant, height strategy, signature features, entrance volume, composition and court enclosure, roof strategy and layered roofs (Stage 4), glass pavilion. They earn the existing single correction; if still unresolved, the stage is accepted with a recorded warning.
   - **Observations:** `composition-note`, recorded only.
4. **Editing:** a new `set-block-height` semantic edit. All identities are unchanged; bands belong to `block:<id>`.
5. **Element budget:** the site is reserved before decorative trim; required architecture that cannot fit raises `element-budget`; dropped trim is reported (`element-budget-trim`) and recorded on the checkpoint.

## Variety study (developer-authored answers, real pipeline)
| House | Volumes / heights | Footprint | Elements | Notes |
|---|---|---|---|---|
| modest | 2 × standard, 1 storey | about 150 m² | 88 | no vision warnings, no forced features |
| villa | double living, tall entrance, 2-storey wing, low guest wing | about 530 m² + upper | 396 | roofs step 10.8 → 3.0 m; U-court on 3 sides; 26 of 200 trim pieces dropped and reported |
| estate | double glass pavilion, cantilevered upper suite, low pitched wings | about 980 m² + upper | 274 | flat + hip roofs |

`*-flat.*` is the same design with heights removed (what the old generator could build). Its vision discrepancies are recorded as warnings.

## Element budget findings
- The 400 limit is enforced by the scene schema (`elements.max(400)`): renderer, editor, saves and APIs all share it.
- **Before this change**, trim was capped against architecture only and the landscape was added afterwards. The villa would have reached 422 elements and failed Stage 5 with a non-repairable compile error. Now the site is reserved first.
- **Proposal (separate redesign):** group decorative trim per block side into one semantic `trim-run` element carrying a compact parameter list (lintels, sills, shutters, cornice, plinth). The renderer expands it, as it already does for lawn patches and hedge panels. Selection and editing stay at block and trim-run level, and saves stay compact. Measure draw calls and editor frame time on the 396-element villa before raising any limit.

## Known limits found (next phase)
- An open terrace reached only through a garden door fails the site's dry-route rule; only covered verandas count as reached by doors.
- Stage 5 site derivation takes about 11 s on a 96 × 72 m site.
- The veranda roof stays at 3 m beside double-height hosts, which is correct but reads low. Roofs remain flat, hip or gable only.
