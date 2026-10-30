# Terra retained estate: diagnosis, original renders and targeted fixes

The actual draft is a recognizable, largely single-storey pool-court estate: a broad central salon, three repeated suite pavilions on either side, and an elliptical lounge across the water. It has a useful organizing idea and consistent materials, but its accommodation, arrival and circulation remain underdeveloped. It does not demonstrate an exceptional US$25 million residence.

One application defect is proven: **six of ten roof-pair rejections came from overlapping empty bounding volumes, not intersecting rendered roofs.** Four suite-to-suite pairs really intersect. A small roof narrow phase now distinguishes them. The unchanged 128-element draft still fails construction validation for those four pairs, water obstruction, four unsupported treads and the misplaced railing. No original geometry was changed or accepted.

This investigation made **zero provider calls**. Original evidence hashes, exact strict-response parsing and deterministic 128-element replay passed. No database access, migrations, model-default changes, admin enablement, commits or deployments were needed. All new evidence lives here; the entire original `../terra-controlled-estate-2026-10-29/` directory remains unchanged, including its historical report and finding counts.

## What Terra actually built

Every image below is the original rejected geometry using the existing React Three Fiber `OperationScene`, its pitched roof builders and normal `VillaScene` lighting/PostFx. The preview supplies only a neutral ground plane; it adds no palms, furnishings, paths or corrective construction. The furniture inside the pinned curved lounge belongs to that existing component. Cameras differ by view; the underlying scene does not.

![Original Rejected Terra Draft — aerial](original-aerial.png)

| Original view | Evidence |
|---|---|
| Landward arrival | [Original Rejected Terra Draft](original-arrival.png) |
| Actual salon entrance, facing +Z | [Original Rejected Terra Draft](original-entrance.png) |
| Poolside/outdoor living | [Original Rejected Terra Draft](original-poolside.png) |
| Garden/ocean side | [Original Rejected Terra Draft](original-garden.png) |
| Roof connections | [Original Rejected Terra Draft](original-roofs.png) |
| Stair and wall conflict | [Original Rejected Terra Draft](original-stairs.png) |
| Belvedere guard | [Original Rejected Terra Draft](original-railing.png) |

Browser verification matches all 128 rendered operation IDs, local positions and yaw values to the retained draft in each original view, checks for context loss and records cameras in [browser-result.json](browser-result.json). Browser API and external resource requests are blocked. The server page reads the local fixture only after its development-mode guard; it has no save or generation controls. Local route: `/dev/terra-estate-diagnosis`.

The primary 18×11m salon is proportionally dominant. Six 8×6.5m suites repeat two façade bays and low hip roofs; slight rotations produce overlap more than useful articulation. Together the seven main floor plates total 510m² gross shell footprint. The 13×12m water court and curved lounge create an axial outdoor destination. This is more coordinated than random scattered boxes, but less resolved than its verbal description: blank landward/side walls, repetitive private rooms, little differentiated façade depth, an arrival canopy facing a solid wall, and a stranded belvedere. The canopy over the belvedere at Y=6.15 has no posts reaching its underside; the actual belvedere support posts stop at Y=3.5. That additional model-authored support omission is visible in the renders and is not caught by the existing plate-only support gate.

The [retained Villa Solana aerial](../intelligence-comparison/solana-aerial.png) has a more legible vertical hierarchy, recessed upper accommodation, a substantial stone entrance portal, layered soffits/screens and differentiated terraces. Even setting its landscaping and presentation furnishings aside, its architectural edges and arrival are more developed. Terra's new draft expands shell accommodation over the previous 88-element experiment, but repeating six near-identical suites is not evidence of better architectural quality. These historical outputs use different prompts/workflows and are not a controlled model ranking.

## Trace from intent to geometry

The exact provider response is `resp_01626aae3021dedb006ae3822c78c487d2bd667f5b25c0d225`, completed GPT-5.6 Terra. The original preflight contains the actual provider-facing instructions, eight selected knowledge records and retrieval trace; the exact wire request is separately retained. Selected records cover value/estate composition, pool, envelope, waterfront, outdoor entertaining and legacy roof/arrival guidance. They supplied principles, not an automatic room or connection solver. No interior-specific record was selected; nevertheless the sent capability contract explicitly supported manual rooms, openings, supported stairs and counter volumes. The outdoor-entertaining record itself exposed composed counter volumes.

The selected intent was “Tidal Court Estate”: landward arrival, central public salon, private satellite suites, water court and ocean lounge, with accessible viewing deck. The response emits 36 operations: seven residential-wing assemblies, one pool assembly, and 28 direct adds. Expansion yields 128 elements, all retained, without removals or ID churn. Assemblies reproduce their documented datums and transforms; no operation is dropped. The strict adapter matches the original normalized output exactly. The loss is principally in authored coordination and omission, followed by one overconservative validation decision; it is not a renderer secretly simplifying a finished mansion.

All indexes below are zero-based authored / expanded indexes. Full updated gate findings and provenance are in [current-findings.json](current-findings.json); historical findings remain untouched at source.

| Finding and exact evidence | First stage / classification | Smallest demonstrated response |
|---|---|---|
| Salon roof versus each suite: overlapping rectangular envelopes, disjoint rendered surfaces | Validation; **validation defect** | Pitched roof narrow phase after broad-phase overlap |
| Suite roof pairs one/two, two/three, four/five, five/six intersect rendered slopes/fascia | Authored assembly placement; **model-authored defect + coordination failure** | Reserve rotated eaves before placement; diagnostic overhang reduction clears these four pairs |
| `ocean-link` crosses `pool-water` | Primitive placement op 15; **model-authored defect + coordination failure** | Move link entirely past water, or intentionally design a supported raised bridge |
| Terrace ends 0.45m before near pool deck and walking levels differ 0.1m | Ops 7/8; **coordination failure** | Match slab tops and edges explicitly; retain nonfatal adjacency review |
| Stair treads rise 0.4m, unsupported plates, terminal wall collision and wrong landing datums | Ops 28–35; **model-authored defect + coordination failure** | Equal-rise calculation, connected supports, clear run and destination; requires authored route redesign |
| Railing base 0.495m below deck | Op 26; **model-authored defect** | Existing `place-on` operation derives centre elevation correctly |
| Garden walks run through suite footprints; landward salon wall lacks entry passage | Ops 0–6, 10–12; **model-authored defect + coordination failure** | Replace relevant real walls with openings and connect exterior routes to actual doors |
| Suite interior partitions, bathrooms and kitchen fit-out omitted | Programme/construction commitments and emitted operations; **model-authored incompleteness** | Build partitions/doors and editable counter volumes; describe unbuilt work honestly |
| Automatic stairs/interiors, specialist equipment, infinity hydraulics, arbitrary bespoke forms absent | Capability selection; **schema/capability limitation** for those specialized constructions | Use available primitives where possible; disclose unsupported systems |
| Pool stated as 16 operations, actual expansion 14 | Provider instruction; **application contract defect** | Correct accounting text to 14; no cap increase |

No retained-generation assembly defect or rendering defect was demonstrated. A pinned pavilion remains a composite rather than independently editable internal parts. Metadata enclosure references to belvedere volumes and empty access arrays create warnings; changing those references alone cannot make the stair usable. Architectural review warnings remain separate from hard geometric rejection.

## Roof causes and fix

The salon roof has eaves Y=4.0 and ridge Y=5.3; each suite roof has eaves Y=3.4 and ridge Y=4.3. These follow `root.at.y + .1 + height` and `eaves + roofRise`. Roof centres are eaves plus half rise. Roof dimensions are wall spans; the existing builder adds overhang. Terra's supplied elevations are interpreted faithfully; there is no doubled rise or hidden expansion offset.

`main-salon-roof` is authored 0 / expanded 19. Suite roofs are 1/30, 2/41, 3/52, 4/63, 5/74 and 6/85. Their salon-facing envelope penetrations are about 0.096–0.350m. The old check filled all space between eaves and ridge with a rectangle; at the actual meeting locations the sloping surfaces remain separate. An independent diagnostic triangle test, including fascia box surfaces, finds zero rendered surface intersections for all six salon/suite pairs. See [roof-mesh-probe.json](roof-mesh-probe.json).

Adjacent suites are 8m apart in Z, with 6.5m depths, 0.8m overhangs and ±0.05–0.12 rad yaw. Overhang and rotation consume their apparent wall gaps: pair envelope penetrations are approximately 0.436m and 0.782m on each side. The independent mesh probe confirms all four physical intersections. These are not intentional joined roofs with authored flashing, valleys or unions.

`roofIntersection.ts` now reuses `buildSceneRoof` slopes and fascia. Convex separating-axis tests handle triangle surfaces and solid fascia boxes, including coplanar surfaces, arbitrary yaw, nested parent transforms and contained fascia solids. The existing oriented envelope check remains the broad phase, extended for the builder's fascia; pitched/pitched candidates get the narrow phase. Flat/mixed pairs retain conservative envelope checks. Results are cached within each relationship audit. There is no new geometry engine or generated junction. Roof form/overhang now participate in the existing edit geometry fingerprint so changing them cannot inherit stale issue exemptions.

Historical 20 directional roof reports become **8 directional reports for four real pairs**. The unchanged full scene still has 14 hard relationship findings versus 26 historically. This is a correction to false rejection, not evidence of improved generated beauty. It does not certify drainage, roof/wall clearances or structure.

## Pool, stairs, railings and interiors

`pool-water` is op 7 / expanded 88, centre [0,0.2,18.45], width 13, depth 12: Z=12.45–24.45. The pool assembly root [0,0.15,11] is the near dry-deck centre, not the basin centre; local basin Z=depth/2+1.45. The instructions already stated that origin. Orientation is zero here, so no rotation ambiguity explains the obstruction.

`ocean-link` is op 15 / expanded 107, centre [0,0.1,24], size [8,0.2,3]. It occupies X=±4, Z=22.5–25.5, Y=0–0.2. It lies through the water plane over a 1.95m length. Its name “bridge deck” supplies no elevation or support. This is genuine water obstruction. Moving its centre to Z=25.95 removes only that finding, placing it at the water boundary/far dry side; this local test does not certify a complete route into the curved pavilion. The terrace, op 8 / expanded 100, ends at Z=9.8, while the near deck begins at Z=10.25; tops are 0.2 and 0.3 respectively.

Stairs 01–07 are authored 28–34 / expanded 120–126. Their walking tops are 0.2, 0.6, 1.0, 1.4, 1.8, 2.2 and 2.6m. Each plate is only 0.2m thick, leaving vertical gaps; treads 02–05 lack ground-connected support. The seventh tread reaches the solid salon rear wall at Z≈−5.35. `stair-landing` (35/127) top is 3.4m, an 0.8m final jump; belvedere top is 3.625m, another 0.225m difference. This is an exterior stair, so no upper residential floor opening was intended; the direct obstruction here is the rear wall and the approach/landing arrangement. Current primitives can express a supported staircase, but cannot automatically solve it.

An **isolated developer feasibility example**, [stair-example.DEVELOPER.json](stair-example.DEVELOPER.json), uses 19 equal risers of 3.425/19≈0.1803m, ground-connected stepped volumes and a supported landing aligned to the original deck datum, outside the salon wall. It is not inserted into the mansion and does not claim guardrails, a complete arrival approach, engineering or code compliance. Tests establish that ordinary primitives can represent the necessary rise, support and clear endpoints. Merely changing the original seven tread heights would not fix its route.

`belvedere-rail-front` (26/118) centre Y=3.68, height 1.1, base=3.13. `belvedere-deck` (23/115) top=3.625. `place-on` with support `belvedere-deck`, offset [0,−2.18], derives local centre Y=.675 and world centre Y=4.175; base=3.625. Its full 7m span then satisfies the existing supported-deck check. No rendering offset caused the error.

There are no authored interior partitions or later opening replacements. All suites receive the same two-bay shell, not bedroom/bath/dressing subdivision. The provider explicitly discloses that omission. Kitchen/service is a programme allocation on the shared salon slab, not cabinetry or enclosed service space. Manual walls, door openings and counter volumes were available and explained; specialist plumbing/appliance assets are not. Only 36 authored operations and 128/400 elements were used; 9,047 output tokens including reasoning were reported against a 30,000 maximum, with completed status. No truncation or budget rejection explains the missing work. Convenience bias or budget caution are hypotheses, not observable internal causes. Existing instructions already requested complete rooms: added guidance makes the construction obligations concrete, without claiming that prose alone will reliably solve them.

## Implemented changes and separate developer evidence

- Narrow the existing pitched-roof collision check to actual builder geometry and invalidate stale edit exemptions after roof shape changes.
- Clarify wing roof datums, rotated eave reservation, missing automatic passages and explicit room/opening construction.
- Correct pool accounting to 14; expose rotated basin-centre transform, water reservation, near/far deck extents and matching walking surfaces.
- Add Generate-only guidance for equal risers including the final rise, contacting supports, wall-free destination, railing centre/place-on, real suite partitions and kitchen fit-out. Scoped edits do not receive the extra Generate checklist. No fixed house plan or mandatory form is introduced.
- Add a development-only read-only preview and offline provenance/replay/mesh probes, fixture tests and screenshots.

Three **independent** developer diagnostic scenes preserve all unrelated original elements: [railing](railing.DEVELOPER.json), [pool link](pool-link.DEVELOPER.json), [suite eaves](suite-eaves.DEVELOPER.json). Their exact operations are adjacent files. They are not combined into a repaired estate. Each remains incomplete and rejected for its other faults. Reducing suite overhangs from 0.8 to 0.2m is an illustrative clearance choice, not a recommended tropical architectural redesign; increasing separation or explicitly coordinating junctions are other authoring decisions. No interiors were invented.

Railing [original](original-railing.png) → [developer placement example](developer-railing-railing.png) uses the same camera and renderer. The developer example is labelled separately in the screenshot. Pool [original](original-poolside.png) → [developer dry-link example](developer-pool-link-poolside.png); roofs [original](original-roofs.png) → [developer smaller-eaves example](developer-suite-eaves-roofs.png). These comparisons use matching cameras. Original screenshot labels always say **Original Rejected Terra Draft**.

## Verification and practical limits

`npx vitest run src/lib/villa/scene` passed all **111 tests across 27 files**, including all four retained-estate diagnosis tests. Machine-readable results are in [tests.json](tests.json). Coverage includes exact original replay, continued whole-scene rejection, true versus false roof contacts, coincident/rotated/gable roofs, supported manual stair feasibility, minimal isolated corrections, normal generation, strict adapters, edits, support, pool construction, persistence/history and unchanged budgets. Typecheck and focused ESLint also pass. [verification.json](verification.json) records exact-response/hash checks, updated counts, provenance and independent developer examples. No paid or model-based visual assessment was used.

Reproduce with the existing dependencies:

```sh
npx vite-node --config vitest.config.mts scripts/terra-estate-diagnosis.ts
npx vite-node --config vitest.config.mts scripts/terra-estate-roof-probe.ts
npx vitest run src/lib/villa/scene
npm run typecheck
npm run dev -- --hostname 127.0.0.1 --port 3015
node scripts/terra-estate-diagnosis-capture.mjs
node scripts/terra-estate-diagnosis-capture.mjs railing
```

Capture uses a locally available `playwright-core` and Chrome; the script documents its path. Browser network interception blocks APIs and non-loopback URLs. Original-evidence hash checks use the historical manifest; no original file is overwritten. The original report's historical recommendation for a new layout compiler was not implemented.

## Twelve direct answers

1. **Appearance:** a broad salon and six repetitive low hip-roof suites around an axial pool and elliptical lounge, with blank arrival walls and an unresolved raised viewing deck. Eight labelled original views are above.
2. **Concept or construction?** A reasonable pool-court organizing idea, underdeveloped as a residential plan and badly coordinated in construction. More than a worthless draft; substantially less than an exceptional mansion.
3. **Roofs:** four genuine adjacent-suite collisions caused by yaw/overhang placement; six additional pairs falsely rejected by coarse bounding volumes. Assembly elevations and renderer expansion agree.
4. **Pool:** the model put a water-level slab across the far end of the basin, despite a correctly documented near-deck origin. No pool validator false positive was found.
5. **Stairs/railing:** large disconnected rises, wrong endpoints/support and a solid wall on the route; railing centre mistaken for base. Existing primitives/place-on can express the needed relationships.
6. **Interiors:** no operations built them; shell convenience and programme allocations do not create rooms. There was ample remaining operation/element capacity and no output truncation.
7. **Responsibility:** Terra authored the missing rooms and incompatible coordinates; application defects were the pitched bounding-volume rejection and incorrect pool accounting text. No assembly or rendering bug was established.
8. **Incorrect validation?** Yes, six unique roof pairs (12 directional reports). Other demonstrated hard failures are real. Flat/mixed roof envelopes remain conservative; architectural-quality findings remain warnings.
9. **Exact fixes:** shared-builder pitched narrow phase, roof-shape edit fingerprint, corrected pool cost and explicit assembly/Generate coordination guidance, plus isolated preview and offline evidence/tests.
10. **Construction or detection?** The code fixes false rejection without moving geometry. Existing placement operations demonstrably correct the railing; separate developer examples prove local pool/eave/stair feasibility. Guidance can influence future construction, but first-pass model benefit is unmeasured without another generation, which was prohibited.
11. **Still unsupported:** arbitrary custom/curved solids outside the pinned pavilion, pitched forms beyond gable/hip, automatic room/stair layout, specialist service equipment, infinity hydraulics, generation-time sloping terrain and structural/code verification. Ordinary partitions and supported stairs are possible manually.
12. **Highest-impact remaining improvement:** resolve the chosen room-and-route plan against shared geometric datums before spending output on repeated shells: real bedrooms/baths, opening-to-walk connections, roof edges and destination levels. The missing architectural value is purposeful spatial sequence and differentiated accommodation, not a larger primitive count. This can be pursued through compact coordinated examples and the existing authoring/assembly contracts without a second construction engine or fixed mansion template.
