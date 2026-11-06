# Production rejected plan `caribbean-beach-estate-01` — analysis (offline, no model calls)

The export `caribbean-beach-estate-01.rejected.json` is preserved byte-for-byte (sha256 468a0e5b…395a, asserted by `productionRejected.test.ts`).
Reproduce: `npx vite-node --config vitest.config.mts scripts/production-rejected-analysis.ts`.

## What the 50 errors were
Production reported 50 errors (1 resolution, 2 site, 4 openings, 41 roofs, 2 screens). Because derive stopped at the first problem, the diagnosis
dropped the whole composition, so 17 facade-bay findings and three span/volume conflicts were never visible. The corrected diagnosis reports 69 errors
(+2 observations) in **19 root causes**. No later compiler phase ran or was claimed to pass.

| Root cause | Findings | Owner |
|---|---:|---|
| Span `great-hall-roof` lists `ocean-veranda`, which also has a different roofs entry (hip/bronze/1 m vs flat/timber/0.8 m) | 1 | Terra |
| The same span's rooms do not tile a rectangle (veranda 18 m wide vs hall 16 m; 318 vs 342 m²) — hidden behind the first error | 1 | Terra |
| The same span mixes envelope heights (hall 6.6 m, veranda 3.8 m) — hidden | 1 | Terra |
| `living-volume` claims one roof but kitchen, dining-room, scullery, powder-room carry their own — hidden | 1 | Terra |
| Overhangs of abutting same-height roofs overlap (24 pairs; 24 rooms were given an overhang) | 24 | Terra |
| Overhangs project into a taller neighbour's volume (hall 6.6 m, kitchen 3.8 m, galleries) | 16 | Terra |
| Facade rhythms placed on walls another room shares (6 rhythms) — 17 findings, hidden | 17 | Terra |
| Openings between rooms that share no wall / too short a wall (4) | 4 | Terra |
| Arrival lawn overlaps five rooms; pool lawn 9 m outside the 90×75 m site | 2 | Terra |
| Library screen on an interior boundary and standing in guest-gallery | 2 | Terra |
| "great-hall has neither a roof nor a space above it" | 1 (removed) | **Software artefact** |

Probe (in memory, not Terra's design): with the span reduced to the hall and every overhang 0, all 40 remaining roof findings disappear, so none came from an actual
roof-surface or occupied-volume intersection, from duplicate roofs or from bounding-box inflation. They are one authored decision (overhang on abutting roofs).
The diagnosis and the compiler measure these with the same footprint geometry (`roofFootprints`, `exposedFascia`); a test pins the pairs equal.

## Software defects corrected
1. `expandComposition` stopped at the first problem per span → every independent span problem is now reported together.
2. Ownership message now says whether the second roof is a redundant duplicate or a conflicting design, which attributes differ, and both ways to resolve it.
3. Diagnosis discarded the entire composition when any span was invalid → it now keeps valid spans, facades and the problems (one lenient expansion shared with the strict compiler form), so rooms of an unresolved span are not reported unroofed.
4. `diagnosePlan` crashed (`portal.mode` of undefined) for any screen on a wall that also carries a composed facade bay — latent in valid plans too.
5. Span envelope-height and volume one-roof claims were only checked after construction; they are now diagnosed from the declaration with the same rule (`volumeRoofClaimProblems`).
6. A roof span could not name a single room, so a volume could not own one room's roof (`min(2)`); probable reason Terra added the veranda. Now `min(1)`; prompt states it.
7. Findings are grouped by root cause (`rootCauses`) in the rejection and the Rejected Plan panel.

## Not changed (deliberately)
- Per-edge overhang clipping for abutting roofs: it would be a new construction capability; the evidence shows a model decision the prompt already forbids.
- Facade rhythm auto-selecting an exposed wall run; the volume one-roof contract (the retained 2 Nov mansion violates it identically).
- No correction offers were added for roofs; existing site offers remain `unverified` because compilation still stops in derive.

## Untested
Construction, exterior, composition, site and validate phases have never run on this plan; no browser render exists for it (nothing constructs).
