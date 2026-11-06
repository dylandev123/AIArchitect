# Live v3 Stage 5 failure: investigation and offline replay (2026-11-06)

No paid calls, approvals, commits or deployments. The live run, its six ledger records and the consumed approval in the private store are unchanged. A verbatim export is in [evidence.json](evidence.json). The accepted Stage 4 house is preserved in [stage4-accepted.checkpoint.json](stage4-accepted.checkpoint.json); its 210 elements rebuild exactly from its spec.

## Root cause: our deterministic landscaping software

In the accepted Stage 2–4 house, the entrance door (foyer, south face of `arrival-entry-volume`) opens onto a 5 × 4 m entrance court. The open `private-garden-terrace` (x −8…−3, z 5…11) covers the outer 2 m of that court, across its full width. Stage 5's arrival rule required a straight 4.8 m drive from the court to the boundary, shifted at most ±3 m. Every candidate crossed that terrace or the bedroom wing.

The failure therefore did **not depend on the pool**. However, `poolFit` reported it against every pool size at every anchor as "does not fit". Terra was told that no pool could be placed. It reasonably chose `none` and said so in its statement. Validation then rejected `none` because the brief requires a pool. The correction prompt repeated that a pool is required while the same table still marked every pool "does not fit". No compliant answer existed, so the correction call could not succeed.

| Origin | Verdict |
| --- | --- |
| Terra's design choices | Stage 2 placed the terrace directly in front of the only free face of the entry volume. This is unusual but valid accepted architecture. Terra's Stage 5 answers were consistent with the measured data it was given. |
| Stage 5 contract | Faithful to the measured data, but it gives no way to report or resolve a pool-independent blocker. |
| Deterministic landscaping | **Defect.** It treated an accepted paved terrace in front of the door as an obstacle to arrival, rather than as the forecourt. |

## Fix (`siteGeneral.ts`, accepted architecture untouched)

An accepted open terrace that overlaps the entrance court across at least the full drive width (4.8 m) now counts as the arrival forecourt. The drive starts at the terrace's outer edge, must land fully on it, and still may not touch any building, veranda, other terrace or pool. Narrower terraces, enclosed blocks and verandas still block arrival, and a test covers this.

## Offline replay ([liveV3Replay.test.ts](../../../../src/lib/villa/staged/liveV3Replay.test.ts))

- The real Terra Stage 1–4 responses reproduce the accepted Stage 4 architecture exactly.
- Measured pool fit at the retained reservation is now `fits` for plunge, intimate, generous and lap.
- Both real Stage 5 answers are still rejected **verbatim**, because they say `pool: none`.
- The real Stage 5 answer, with only `pool.scale` substituted (a developer substitution, not Terra output), completes for all four sizes: zero findings, zero feature-audit findings, Stages 1–4 unchanged, and the save reopens identically. The drive runs from z 11 to the south boundary at z 24.

## Safeguards (added after review)

All are in `siteFeasibility.ts` and `pipeline.ts`; tests are in `siteFeasibility.test.ts`.

- **Measured feasibility.** The site derivation is first run with no pool. Any access failure there (entrance court, driveway, garden walk or garden side) is a *site blocker*. Pool placement is then measured only when there are no blockers. A pool that itself cuts the only drive is reported as "this pool would obstruct site access". The pool table sent to Terra uses exactly this measurement.
- **Stage 5 preflight.** Before the Stage 5 call, and before any Stage 5 correction, `stage5Preflight` refuses with `site-infeasible` (not repairable, so no correction call) if:
  - there is a site blocker; or
  - a pool is required, or reserved and not excluded, and no reservation placement fits.
- **Earliest access check.** Stage 4 is the stage that decides the entrance, so it now rejects designs that leave the entrance unreachable (`arrival-access`, repairable at Stage 4).
- **No-pool briefs.** A brief that excludes a pool may answer `none` even when the massing kept a pool reservation.

## Visual review of the accepted Stage 4 house (renders `stage4-*.png`)

The front door, under the timber canopy, opens south into the inner garden corner, directly onto the private garden terrace. There is no front-facing forecourt. The review-only preview (`review-drive-preview-*.png`) uses a developer-chosen pool, is not Terra output, and is not saved. In it, a 4.8 m paved strip runs from the south boundary straight onto that terrace, with the pool beside it.

- **Construction:** valid; nothing overlaps.
- **Architecture:** a genuine programme weakness. Arrival happens through the sheltered private garden, past the pool, onto the bedroom wing's private terrace. That conflicts with the brief's "sheltered garden" and "private" intent, and the paved strip cuts the lawn in two.
- **Origin:** Terra's Stage 2 massing (entry volume enclosed on three sides, terrace in front of its only free face), accepted by Stage 4 without an access check, which now exists.
- **Verdict:** acceptable as a temporary compromise for finishing and evaluating this house. It should not become the default arrival pattern, and it is not something landscaping can fix without changing accepted architecture.
- **Camera:** the viewer's "Arrival" preset looks at the north elevation, not the entrance. This is a viewer camera issue.

## Stage 5-only continuation (implemented, not approved, not run)

Private Studio previously could not continue a stopped run. The new mechanism:

- `prepareStage5Continuation` is an administrator-only operation. It creates one new owned project linked to the source run, recording `continuesFrom` = run ID, stage 5, and the SHA-256 of the accepted Stage 1–4 checkpoints. The source must be stopped (failed) with accepted Stages 1–4, a failed Stage 5 and only settled calls.
- The new run starts from verbatim copies of those checkpoints after re-checking the hash, and only with the source's exact description. The source run, its calls and its approval are only read; tests compare them byte for byte.
- The policy `STAGE5_CONTINUATION_POLICY` (version 5) allows one design call, no correction and no retry, with a 4,000-token output cap, a 170 s timeout, a 16,000-byte request ceiling and a **US$0.10** hard limit. The measured request is 14,374 bytes. Its worst-case reservation is (14,374 + 1,024) × US$2.50 + 4,000 × US$15 per million = US$0.0985.
- It needs its own single-use approval bound to the continuation project, the brief and the continuation policy. Ordinary live approvals do not work for it, and it can only execute Stage 5.
- No call is made while any call is unsettled or uncertain. A successful run passes full validation and the feature audit, and the save reopens identically (`continuation.test.ts`).
- `.data/private-studio/prepare-stage5-continuation-v3.mts` creates the project and approval. Run it only after explicit authorization.
