# Stage 3: Terra designs room relationships, software solves the geometry

Status: **offline only.** No paid call, commit, deploy or database change has been made for this work.
The Breezeway Courtyard Villa Stage 2 checkpoint (`../live-1/raw-response.json`, `stage2.scene.json`, `stage2.checkpoint.json`) is untouched. A test pins their SHA-256 hashes and checks that rebuilding stage 2 from Terra's saved response reproduces `stage2.scene.json` byte for byte.

## 1. Why the first Stage 3 call failed (evidence: `../live-1/stage3.raw.json`)

| Question | Finding |
|---|---|
| Truncated / token limit? | **No.** The answer is complete, valid JSON of 1,509 characters; the ceiling was 12,000 output tokens. |
| What was wrong with it? | Terra closed the `plans` object after the first block, so `east-bedroom-wing`, `entry-pavilion` and `upper-bedroom-bar` landed at the top level, and `links` and `stairs` were missing. A brace-nesting slip inside a deeply recursive tree. |
| Was strict structured output enforced? | **No.** The call used `strictJsonSchema: false`. It also could not have been strict: the recursive plan schema uses `$ref`/`anyOf`, a `propertyNames`-pattern record, and `default` (checked offline with the repo's `strictSchemaIssues`). |
| Finish reason / usage? | **Lost.** The call was billed, but the old pipeline dropped usage on a failed parse (`calls: []`), and the finish reason was never captured. The amount cannot be recovered (the stage 1+2 call cost $0.0193 for reference). |
| Fixed | A provider failure now throws `DesignerError` carrying usage, finish reason and raw text; the pipeline stores them on the checkpoint and counts the cost. Stage 3 now sends a flat strict-compatible schema with `strictJsonSchema: true`. |

## 2. New Stage 3 contract (`src/lib/villa/staged/programme.ts`)

Terra returns `{rooms, connections, stairs, intentions}`: flat arrays, stable ids, every field required, no recursion, no coordinates. The wire schema is 1,163 bytes and passes `strictSchemaIssues` with no issues.

- `rooms`: `id, block, type, name, area, priority (core|normal|flex), facing (n|s|e|w|any)`
- `connections`: `a, b, kind (door|open)`
- `stairs`: `id, room` (ground stair room), `landing` (upper hall or gallery)
- `intentions`: short statements, recorded but not measured

Range and format rules are checked locally by `programmeIssues`, not in the provider schema. Every conflict names the rooms and blocks involved and nothing is auto-invented.

## 3. Can the existing geometry system build rooms? Partly, with one focused addition

- The existing kernel (`PlanNode` guillotine tree, `layoutRooms`, `roomEdges`, `validateInterior`, `compileHouse`) only **evaluates** a tree. It has no generator. It is reused unchanged and remains the independent judge: every layout the solver offers is re-validated by the real stage 3 `measure`, and layouts it rejects are never offered.
- Added `roomSolver.ts` (~500 lines), a **generator for the same guillotine trees, not a general constraint engine**:
  - Per block: memoised beam search over (subset of rooms, rectangle), trying every two-way split on both axes at area-proportional cuts, plus alignment cuts for the stair and for the landing above it.
  - Pruning: minimum sizes and aspect ratios, exterior-wall access for rooms that need daylight, and "both rooms of a connection must touch the cut they are separated by and overlap along it".
  - A bathroom whose only connection is one bedroom is placed with it as an ensuite unit (a 9-room block went from exhausting the work budget in ~10 s to solving in ~0.3 s).
  - Blocks are combined by backtracking so cross-block connections line up. Ground floor first, so the stair footprint is fixed; then the upper floor must contain a landing covering that footprint.
  - Software completes circulation only where the programme left a room unreachable, never into a bedroom off a living area, and reports what it added (`addedLinks`).
  - Output is up to 3 materially different layouts (some wall moves ≥1.5 m), each with metrics. `chooseLayout` is a pipeline hook for Terra to select; the default is the best score. Not wired to a model.

## 4. Offline results (all run, all passing)

`npx vitest run src/lib/villa/staged` → 48 tests pass (`src/lib/villa` as a whole: 110 files, 1,038 tests).

- **Real Terra massing, 19-room programme without coordinates** → 3 distinct complete layouts in ~60 ms, each passing `validateInterior`, the scene relationship audit, tiling, all requested connections with a real shared wall, the stair stack and bedroom privacy. Deterministic.
- **Two-storey, four-bedroom synthetic villa** (17 rooms, three blocks) and a bathroom-heavy variant → built.
- **Single-storey three-bedroom** and **facing swap** (living moves from south to east when asked) → built; geometry demonstrably responds to the programme.
- **Randomised programmes** on the real massing (sizes, priorities, facings, door/open wiring varied, 60 seeds) → 44 constructed, 16 reported conflicts. Every success is validator-clean; every failure names a conflict. No crashes.
- **Infeasible programmes** report specific conflicts: block too small (names block and m² shortfall), missing stair / foyer / bedroom count, blocks not adjacent, cross-level door, bedroom off living, landing not over stair, rooms with too many connections.
- **Editable:** a partition of a constructed plan is moved with the existing semantic `resize-room` edit, and the plan revalidates.

Artifacts: `option-N-ground.svg`, `option-N-upper.svg`, `option-N.scene.json`, `options.json`, `programme.json`. The scene is also at `../stage3-programme-offline.scene.json` (viewer: `/dev/staged-villa?file=stage3-programme-offline.scene.json`). The programme in `programme.json` is **developer-authored**, standing in for Terra until the live call.

## 5. Limitations and the smallest practical alternatives

1. **Guillotine only.** Pinwheel layouts (a central landing wrapped by four rooms) cannot be produced. When the stair footprint lands mid-block on a crowded upper floor, the solver reports it. Smallest fix: let Terra move the stair or landing to a block edge, or add an upper block.
2. **Beam search, not exhaustive.** A "no layout" answer can in principle miss a feasible one (it was sensitive to the cut grid during development; now 0.1 m and stable on the tests). The failing message is advisory, not a proof.
3. **Size.** Blocks up to about 9 independent rooms solve in well under a second; far denser blocks stop at a work budget and say so (`search-budget`).
4. **Areas are guidance.** Software scales each block's rooms to fill it (flex rooms absorb most). If the programme under-fills a block, rooms grow (the Breezeway demo's living room became 131 m² instead of 80). The live prompt asks Terra to fill ~100% of each block.
5. **Doors** sit at the midpoint of the shared wall (except at stairs). Windows and exterior doors remain Stage 4.

## 6. The one controlled live call (not run)

```
npx vite-node --config vitest.config.mts scripts/staged-villa-live-programme.ts          # dry: prints request, checks schema, spends nothing
npx vite-node --config vitest.config.mts scripts/staged-villa-live-programme.ts --live   # ONE paid Terra call
```

Safeguards: aborts if stage 2 differs from the saved checkpoint; refuses if `live/result.json` exists; 1 call, no correction, $2 hard cap, 12,000 output-token ceiling. Estimated cost about $0.03-0.15 ($2/M input, $12/M output; ~2k input tokens). Everything Terra returns (raw text, usage, finish reason, programme, conflicts) is saved to `live/result.json` before any success is assumed.
