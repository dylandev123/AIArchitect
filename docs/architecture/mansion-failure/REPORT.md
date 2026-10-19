# Canopy Meridian live mansion failure audit

Recovered 19 October 2026. **The canopy was not the whole failure. Full architectural recovery remains blocked by authored ambiguities and missing access design. No new generation is justified yet.** Both complete responses are preserved; no geometry was invented or edited in either fixture.

## 1. Recovered design and evidence

Terra designed **Canopy Meridian House**, a 150 × 120 m flat Saint Lucia estate: a 46 × 26 × 8 m two-storey stone residence with an 8 m recessed north entrance, a recessed south balcony, floating copper-colored roofs, separate west guest and east wellness pavilions, arrival court, pool terrace, reflection/swimming pool, event lawn and four garden zones. There are 19 objects, one authored U-shaped stair, nine main-house opening definitions and two explicit facade assemblies. No curved outlines, intersecting/stacked building masses, lifts, interior room plans, furniture, trees or planting instances were authored. Labels describe spa/fitness and lush gardens, but do not supply equipment or planted geometry.

Sources: `.v3-debug/failed-attempt-0.json` and `failed-attempt-1.json`, captured at 08:21:17 and 08:21:56 America/St_Lucia. The first is the original response; the second is the objective repair. Both raw strings match their retained SHA-256 hashes, were not redacted or size-truncated, and parse completely. `recovery.json` records hashes and historical errors. Fixtures are `src/lib/v3/__tests__/fixtures/canopy-meridian-attempt-{0,1}.json`; they preserve complete provider JSON, without server credentials, headers, conversation history or environment values. Architectural requirements include the budget and country because they are part of the design. The existing revision-latest artifact predates this failure (17 October) and was not substituted for either response. Current Next development logs contain no matching retained canopy failure/request record; artifact diagnostics are the evidence for the live rejection.

`baseline.json` records replay before these changes. `replay.json` records separate canonicalization and its notes, normalization, production ingestion (including deterministic repair and validation), forced offline compilation even on rejection, compiled audit, architectural review, circulation resolution, every object’s primitive IDs/labels and objective-repair assessment. These diagnostics contain local scene data, not provider calls. The baseline is intentionally retained as historical evidence and must not be regenerated with current code.

## 2. Confirmed construction failures

| Semantic object / feature | Intended architecture and exact failure | Classification / disposition |
| --- | --- | --- |
| `mainResidence / entry-mainEntryDoor/canopy` | The 8 m recess spans 0.413043…–0.586957… of the 46 m facade. Original door 0.43–0.57 fits. V3's derived ±0.04 padding makes the canopy 10.12 m wide. Repair door 0.45–0.55 still produces 8.28 m. | **Compiler defect, fixed.** Bound derived padding to the door’s unique supporting wall. Door, depth, facade and all authored assemblies remain unchanged. Applies to any articulated recessed entry, not this ID alone. |
| `mainStair` | Authored usable 2.5 × 4.2 m U stair, level 0→1, world (-15,1). A lowercase-only interior ID rule silently omitted its camelCase ID; the building then had no upper-floor access. | **Normalization/schema mismatch, fixed.** Preserve case consistently in circulation provider schema, normalization and interior validation. Compiles treads, landing, guards and slab opening at the authored host-local (-15,0), and resolves usable. No renamed IDs or invented stair. |
| `mainResidence / southLivingDoor`, `southDiningDoor` | Original spans 0.12–0.42 and 0.58–0.88 cross the south recess edges at 0.39/0.61. Different parts of each door address different wall planes 2.2 m apart. | **Unsupported/under-specified opening construction.** V3 omits them with fatal diagnostics. This is not proof the architecture is impossible, but a planar sliding door cannot simply be bent through the return without an authored subdivision/choice. Repair narrows them to 0.12–0.38 / 0.62–0.88 and constructs both. Original remains blocked; no automatic clipping/splitting invented. |
| `mainResidence / northUpperGlass` | Original 0.28–0.72 crosses the north recess’s offset wall planes. | **Unsupported multi-plane facade span.** Repair retains only 0.28–0.40: constructs, but loses most of the broad glazing. This is a substantial architectural reduction, not evidence original intent was recovered. |
| `mainResidence / southUpperDoor` | Original 0.38–0.62 crosses both south recess corners. | **Unsupported multi-plane door.** Repair 0.40–0.60 lies wholly in the recess and constructs. Original balcony access is absent. |
| `mainResidence / mainSouthBalcony/mainSouthBalconySlab` and `/mainSouthBalconyRail` | Original balcony 0.34–0.66 crosses the recessed wall and outer wall planes. V3 requires one supporting segment, so both slab and rail fail. | **Compiler capability/addressing limit, not a general architectural impossibility.** A bridging balcony could be legitimate, but attachment and shape across returns are not expressed by this schema. Repair narrows to 0.40–0.60 and constructs. We did not choose a bridging shape or move it. |
| `mainResidence / northPortico/northPorticoSlab` | Original slab 0.37–0.63 exceeds the recessed wall segment. Posts at 0.42/0.58 individually resolve. | **Unsupported spanning assembly.** Repair slab 0.42–0.58 constructs. Original spanning portico remains under-specified for the current attachment model. Posts are preserved. |
| `mainRoof` | Original roof envelope 48.4 × 28.4 exceeds the articulated host’s 46 × 26 envelope. The footprint roof compiler requires matching origin/yaw/dimensions and uses `overhang` for eaves. | **Compiler contract incompatibility.** Original roof surface is absent (some ancillary roof-owned pieces still exist, so nonzero primitive count is insufficient). Repair aligns envelope and sets overhang to zero; roof constructs, but original eaves were reduced. Explicit envelope vs offset-outline intent cannot be uniquely recovered without a design choice. |
| `estatePlan / req-budget` | `range:{value:"USD 15000000"}` is structurally invalid; canonical textual commitments use `value`. | **Lossless representation drift, fixed.** Relocate only an exclusive textual `range.value` with no conflicting value or numeric bounds. Numeric ranges remain validated; malformed cases receive precise schema paths. |
| `estatePlan / arch-water-garden` | Pool/terrace/lawn declared `joined`. Former validator required building masses even for an outdoor composition. After correcting that assumption, the actual pool ends at z=36.5 and lawn starts at z=37: a 0.5 m physical gap remains. | **Validator assumption fixed; actual commitment mismatch remains fatal.** The connectivity tolerance is 0.05 m, not the 0.75 m access tolerance. A thematic axis can legitimately have a gap, but is not touching joined construction. Decide whether to correct the commitment or author the connecting geometry; neither was invented. |

The original recorded **10 errors** (one malformed plan + four openings + four assembly parts including the derived canopy + the main roof). The recorded repair showed only the derived canopy because subsequent estate audits were skipped. After fixes the original still reports **9 fatal findings** (four openings, three authored assembly parts, roof alignment and joined-group connectivity); the repair reports **one fatal estate commitment** and **zero compiled geometry errors**. Neither passes full production ingestion.

## 3. Access, site and visual audit

These findings exist in both responses unless stated otherwise. Exact diagnostics are in `replay.json`.

- `guestWalk` is a north/south rectangle x=-29.5…-26.5. The residence ends at x=-23 and guest pavilion begins at x=-33: gaps are 3.5 m at each side. `wellnessWalk` spans x=26.5…29.5, leaving 3.5 m to the residence and 2.5 m to the wellness pavilion (x=32). These four access disconnections are real authored geometry errors. There are no authored bend coordinates or east/west connecting runs to recover.
- `entryWalk` ends at z=-11; the recessed north entry wall is z=-9.6. Thus the walk stops about 1.4 m short of the actual recessed doorway. The existing coarse building-envelope route check misses this; this is a confirmed additional access blocker from the plan and front view. The door also starts at the compiled 0.26 m floor datum while the walk top is 0.06 m: a 0.20 m threshold difference has no authored access step/ramp. No step was invented.
- `wellnessPavilion / wellnessSouthGlass` is glazing, not a door; `meditationCourt` has no direct south access. Its near edge is z=19 while the pavilion ends at z=18: another 1 m gap. A door plus a connecting surface is an authored design decision.
- `poolTerrace` top is 0.14 m against the residence floor at 0.26 m: a 0.12 m threshold remains. The repair's south doors provide opening access but do not prove step-free access. The original has no constructed south doors. Upper balcony access is restored in the repair after preserving `mainStair`.
- Ten authored allocation conflicts remain: `zone-arrival` contains out-of-allocation `arrivalDrive`, `entryWalk`, `arrivalGarden`; `zone-residence` has `poolTerrace`; `zone-water` has `poolTerrace`, `sunsetLawn`, `southGarden`; `zone-guests` has `westGarden`, `guestWalk`; `zone-wellness` has `eastGarden`. These are advisory to acceptance but significant in design review. They require resolving contradictory plan commitments rather than arbitrarily shrinking objects.
- `southGarden` extends to z=67 beyond the site's z=60 boundary; this is visible in the aerial view. `arrivalDrive` reaches z=-59, inside the boundary. Garden rectangles also overlap one another and outdoor surfaces. Terrain/landscape rendering shows patch edges and some visible interference; no terrain implementation was changed.
- Pool dimensions are finite and construct its shell, water and coping. No pool stair, ladder or separate pool entry was authored; current checks do not certify swimmer access. The terrace meets/overlaps the pool edge. No swimming-safety certification is implied.
- **Roof support remains physically incomplete despite finite compiled geometry.** All three authored roof bases are 0.25 m above their host tops; the floating-roof compiler adds its own 0.45 m bearing height from that base. `mainRoof` bearing bottoms are y=8.25 above the residence top y=8.00; guest and wellness bearing bottoms are y=4.85/5.05 above host tops y=4.60/4.80. The enlarged rectangular pavilion roofs also place perimeter bearings outside the host envelope (e.g. `guestRoof` x=-51.45 vs host edge -51; `wellnessRoof` x=31.55 vs host edge 32). These are authored datum/compiler-host-support incompatibilities not detected by the current geometry audit. They need host-aware bearing construction or an explicit roof/support design decision; no roof was lowered and no support extension was invented. Primitive positions and sizes are retained in `replay.json`.
- Three building masses are disjoint; no stacked masses, mass junctions, curved outlines, roof intersections or lifts occur in this recovered design. No conclusions about those features are inferred from this mansion. Existing curved and nonrectangular regression tests pass separately.
- No invalid/nonfinite dimensions or incomplete triangles remain in either compiled primitive set. Original missing architecture is nevertheless a fatal construction failure. The repair has three roof surfaces, all opening definitions produce geometry (rhythms create multiple windows), the balcony/rail, portico and stair. All 19 authored object records remain identical to their pre-change normalized records.
- Material surface values were prose (e.g. “weathered copper standing seam”), whereas the normalized material enum accepts categories. Those prose fields are dropped by existing normalization, retaining IDs/colors. Exact copper standing seams, mixed bronze framing and volcanic stone finishes are therefore not recovered as authored detailed materials. Images show generic mapped surfaces. This is a visual/finish capability limitation, not a geometry acceptance failure; retained raw fixtures preserve the descriptions.
- Sparse landscaping and empty interiors are authored-content limitations: landscape-zone rectangles are not trees, spa equipment, rooms or furniture. The extensive blank north wall in the repair results partly from its glazing reduction. No “luxury quality” claim is made from a successful render.

## 4. Systemic cause and corrections

There is a broader **addressing and capability-contract mismatch**, not evidence that all nonrectangular architecture is broken. Articulated openings and assemblies use compass facade fractions, but a single facade can contain several offset planes. Outline-based curved architecture instead uses explicit segment IDs. Terra's original spans mixed those planes; the code cannot infer a unique spanning construction. Existing provider instructions already forbid spanning planes, so the original also violated a stated contract. However V3's own canopy padding violated that contract even for a valid door. Curved assembly support exists; assemblies are not universally restricted to rectangular geometry.

Changes made:

1. `footprintConstruction.ts`: constrain only generated entry-canopy padding to the unique door support segment. Ambiguous doors and authored spanning assemblies remain errors.
2. `generation.ts`, `interior.ts`, `schema.ts`: accept stable camelCase interior/circulation identifiers consistently; preserve `mainStair` and all geometry.
3. `intentCanonicalization.ts`: losslessly relocate exclusive textual requirement `range.value` to `value`.
4. `validation.ts`: precise estate schema paths and independent estate/interior/relationship diagnostics despite footprint construction failures; malformed structural prerequisites still stop unsafe processing.
5. `scene.ts`: blocking footprint construction diagnostics now make compiled audit fail, even in lenient mode. Missing roofs/openings cannot be called geometry success just because the remaining triangles are finite.
6. `estatePlan.ts`: collapse consecutive identical route IDs instead of requiring self-edges; require an actual building within building/residence program groups without requiring associated roofs/terraces to become masses.
7. `estateSpatial.ts`: group minimum dimensions use the group's world envelope (single objects retain local dimensions); joined outdoor groups can use authored non-building objects but must still physically connect. No connectivity validation was removed.
8. `safeRevision.ts`: allow only diagnosed assembly attachment-field changes while preserving IDs, types, intent, part counts and all other fields. Deletion and unrelated geometry changes remain rejected. The captured repair is still rejected by the intent guard because it also shrinks a now-valid entry door and changes undiagnosed portico posts. We do not silently accept its reduced design.
9. `composition.ts` / estate instructions: clarify hosted footprint roof envelope vs overhang, derived canopy sizing, grouped dimensions and physically joined compositions. No fixed architectural templates were introduced.

The objective-repair route already combines all fatal validation issues and geometry errors. It now receives the independent estate failure with the footprint failures rather than needing another paid attempt to discover it. Design review is still a separate stage; the offline audit deliberately executes it even when ingestion rejects. The actual captured repair cannot be certified as intent-preserving: narrowing broad glazing and reducing eaves are visible compromises. Current guards prevent deletion/unrelated changes, but do not prove aesthetic equivalence of every diagnosed span change; that remains a limitation.

## 5. Render and acceptance outcome

**Original response: incomplete compilation, not accepted. Repaired response: geometry compiles and renders, but full scene acceptance still fails the disconnected joined-group commitment, and functional/visual shortcomings remain.** Neither is a recovered, fully functional $15M mansion. Completing it requires explicit decisions about multi-plane facades/bridging projections/eaves, actual access routes, thresholds, roof-bearing support, meditation-court access and conflicting estate allocations. These cannot be reconstructed uniquely from retained data.

The offline development page `/dev/mansion-failure?attempt=0|1` uses the production `PrimitiveMesh`, edge finishing, lighting, environment, shadows and PostFx. It is guarded against production serving and performs no project writes. This is production renderer coverage, not a deployed production build. The capture runner blocks AI provider endpoints.

Screenshots: `webgl/attempt-{0,1}-{overview,arrival,pool,plan,recess,section}.jpg`. All 12 captured with no browser page errors (`webgl/capture.json`). Inspected original overview and repaired arrival, aerial/plan, pool, recessed facade and section. Original aerial shows the missing main roof and south openings; repaired views show restored roof/doors, entry canopy, balcony, the stair in section, disconnected side paths and garden patches. The section intentionally clips above 2.8 m; it is not evidence of a missing upper floor.

## 6. Verification and next generation decision

- Full suite: **165 files passed, 2 skipped; 1,930 tests passed, 3 skipped** (before expanding the mansion regression from one to eight tests).
- Final focused run (mansion + creative freedom): **33/33 passed**. Mansion regression: **8/8 passed**, including multi-failure reporting, exact raw-input immutability, canopy bounds, stair usability, zero repair geometry errors without false acceptance, retained roofs, unchanged unrelated primitives, grouped estate checks, and repair intent protection.
- Focused curved, articulated, estate and completeness suites: **78/78 passed** before the later estate refinements; estate/spatial/creative-freedom follow-up: **46/46 passed**. The full suite includes these refinements and the independent-diagnostics changes.
- TypeScript: `npx tsc --noEmit` passed. ESLint: `npm run lint` passed. `git diff --check` passed. Final checks are recorded separately in `checks.json`.
- No Terra/OpenAI calls, paid generations, V2 edits, terrain edits, commits, pushes or deployment. Existing uncommitted work was preserved.

**Do not spend another live generation yet.** Resolve the retained design blockers offline or obtain explicit architectural choices, then replay both fixtures and review the WebGL output. The current fixes prevent the self-generated canopy failure and lost stair, improve grouped estate interpretation, and expose multiple failures; they do not claim to construct unsupported or missing design automatically.

## Object-by-object construction inventory

All objects have finite compiled primitives. Counts include ancillary pieces and therefore are not a roof/opening completeness proof. Detailed primitive IDs, labels and bounds are in `replay.json`.

| Object | Type | Original / repair primitive count | Review |
| --- | --- | --- | --- |
| `arrivalDrive` | driveway | 1 / 1 | Arrival allocation conflict; meets court. |
| `arrivalCourt` | terrace | 1 / 1 | Constructed; connected arrival surfaces. |
| `entryWalk` | path | 1 / 1 | Allocation conflict; stops 1.4 m before recessed entry. |
| `mainResidence` | building-mass | 144 / 191 | Original unresolved doors/glazing/assemblies; repaired shell constructed; stair restored. |
| `mainRoof` | roof-form | 4 / 49 | Original roof surface absent; repaired plate present; bearing gap remains. |
| `poolTerrace` | terrace | 1 / 1 | Constructed; zone conflicts and threshold difference. |
| `reflectionPool` | pool | 10 / 10 | Shell/water/coping constructed; swimmer access not authored. |
| `sunsetLawn` | landscape-zone | 1 / 1 | Constructed; zone conflict; not physically joined to pool. |
| `guestPavilion` | building-mass | 80 / 80 | Shell/openings constructed; guest walk disconnected. |
| `guestRoof` | roof-form | 28 / 28 | Constructed; bearings lack full host contact. |
| `wellnessPavilion` | building-mass | 97 / 97 | Shell/openings constructed; no direct meditation-court door. |
| `wellnessRoof` | roof-form | 32 / 32 | Constructed; bearings lack full host contact. |
| `meditationCourt` | terrace | 1 / 1 | Constructed; gap and missing direct door. |
| `guestWalk` | path | 1 / 1 | Constructed ribbon; gaps at both destinations. |
| `wellnessWalk` | path | 1 / 1 | Constructed ribbon; gaps at both destinations. |
| `arrivalGarden` | landscape-zone | 1 / 1 | Zone rectangle only; allocation conflict. |
| `westGarden` | landscape-zone | 1 / 1 | Zone rectangle only; allocation conflict/overlaps. |
| `eastGarden` | landscape-zone | 1 / 1 | Zone rectangle only; allocation conflict/overlaps. |
| `southGarden` | landscape-zone | 1 / 1 | Zone rectangle only; allocation conflict and site overrun. |

## Addendum — recovery finalization (19 October 2026, later pass)

Sections 1–6 above are retained as the original findings; where they conflict with this addendum, the addendum is current. Before-screenshots: `webgl/`. After-screenshots: `webgl-recovered/attempt-{0,1}-{overview,arrival,pool,recess,roof,balcony,pavilions}.jpg` (14 captures, no page errors; production `PrimitiveMesh`/lighting/PostFx via `/dev/mansion-failure`).

### Additional constructions recovered (original response)

- Articulated main roof retained: the authored 48.4 × 28.4 envelope is recognized as the host plus twice the authored 1.2 m overhang; mismatched envelopes still fail.
- Broad `northUpperGlass` (0.28–0.72) constructs as three panes across the three north wall planes, authored span unchanged.
- Balcony slab and rail (0.34–0.66) and portico slab (0.37–0.63) construct as rectangular assemblies bridging the inward recess, attached to the two outer shoulders; portico posts stay inside the slab. Only inward recesses with two outer shoulders qualify; anything else stays `FOOTPRINT_ASSEMBLY_UNRESOLVED`.
- Floating-roof bearings (main, guest, wellness) are grounded on, and kept within, their hosts.
- Recessed entry thresholds and horizontal access gaps are reported separately from elevation differences.

### Current diagnostic classification

| Class | Original response | Repaired response |
| --- | --- | --- |
| A. Recovered | Roof, north glazing, balcony, portico, canopy, stair, bearings | All geometry; geometry audit `ok` |
| B. Supported but wrongly built | None remaining | None |
| C. Unsupported geometry | `southLivingDoor`, `southDiningDoor`, `southUpperDoor`: each a single planar sliding door crossing the south recess's offset planes (3 geometry errors) | None |
| D. Missing design information | Which part of each door goes in which plane (subdivide, clip, or move) | Reductions in the repair (glazing 0.28–0.40, eaves, balcony) are compromises, not recovered intent |
| E. Estate/access contradictions | `arch-water-garden` joined with 0.5 m pool→lawn gap (fatal); four walk gaps (3.5/3.5/3.5/2.5 m); `entryWalk` 1.4 m short of recessed door; 0.12–0.20 m thresholds; `meditationCourt` has no door and a 1 m gap; 10 allocation conflicts; `southGarden` beyond site | Same, minus the south-door entries |

Neither response passes full ingestion. The original is blocked by C and E; the repair by E only (`arch-water-garden`). The three sliding doors were deliberately not split or clipped: nothing authored says they are several doors.

### Tests

Changed two stale tests: the balcony position assertion now uses `toBeCloseTo` (1.8e-15 float residue), and the diagnosed-repair guard test now creates a real unresolved attachment, since the authored balcony no longer fails. No validation was loosened. Full suite (2 workers): 166 files passed, 2 skipped; 1,944 tests passed, 3 skipped. Mansion regression 8/8, compatibility 7/7, footprint baseline 9 scenes byte-identical. `tsc --noEmit`, `npm run lint`, `git diff --check` clean.

### Another live generation

Still not justified. The remaining blockers are authored design contradictions. Re-prompting would need explicit direction on: door-vs-return planes, walk endpoints and the entry walk, pool/lawn joint, and zone allocations.
