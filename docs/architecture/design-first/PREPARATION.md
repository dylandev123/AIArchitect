# Prepared controlled design-first experiment — not authorized or sent

One normal Generate experiment using [experiment.request.json](experiment.request.json), with the exact original 776 m² brief and no retained scene, template or developer fixture injected into the request. This now means **two potentially paid provider requests**, not one: select spatial architecture, then construct that selected proposal. A failure in stage one stops before stage two.

After separate user authorization, verify the configured model remains `gpt-5.6-terra` with provider-default reasoning; retain any discrepancy and stop rather than substituting a model. Keep 30,000 output tokens per stage and zero retries. Use `/api/ai/scene` with normal retrieval and existing usage accounting authorized for that experiment; this preparation does not authorize database writes or change the existing read-only/local usage evidence procedure. Verify hosting timeout support for the 360-second route allowance before submitting. Do not run the old single-call mansion script: its payload fingerprints and call-count assumptions are stale for this workflow.

Retain exact planning schema/system/messages, retrieved text, raw response/wire, usage and selected proposal. Retain the construction schema/system/messages (including that exact proposal), raw response/wire, operations/expansion, candidate, audits and fidelity. The route now retains both stages under one response ID. Its `experiment.stageUsage` separates planning and construction; the legacy `usage` field is explicitly labelled construction-stage. Compute any cost using both stage usages and applicable rates, not the second response alone. Do not print credentials.

Do not retry, repair geometry, shrink selected masses or change settings to obtain acceptance. On divergence, keep the unapproved recoverable draft and identify the changed/missing commitments. On successful construction, render the actual unchanged scene through normal presentation in Arrival, Aerial, Garden and Poolside. Compare proposal and geometry for suite individuation, circulation, entrance sequence, facade depth, meaningful section/roof hierarchy and outdoor composition. Distinguish ordinary faithful architecture from an exceptional design. Do not certify completed suites from capacity, room names or floor area.

The offline context snapshot in `experiment.preparation.json` uses the previous retained retrieval solely to make preparation inspectable without database or network access. It is not a fingerprint of a future live request: fresh retrieval and the not-yet-existing selected proposal affect the payload. Preserve those exact future payloads before judging the result. No fixed mansion dimensions, coordinates or IDs are added to provider instructions.

## Mandatory architectural checkpoint (before paid request two)

The experiment must invoke the existing route inside `withDesignCheckpoint` from
`src/lib/villa/scene/designCheckpoint.ts`. This request-local boundary runs after
proposal validation and before construction begins. Ordinary product generation
is unchanged. Running the unwrapped route is **not this experiment**.

The checkpoint callback must save the exact proposal and SHA-256 from
`designProposalHash`, alongside the full first provider output/wire, usage,
retrieval, system, messages and schema. Pause for an architectural assessment;
do not return a passing review merely because the schema validates. No additional
model call may perform the assessment. Retain the review before releasing the
callback. Missing evidence, unresolved criteria or any failed criterion stops the
route before the construction request. Preserve the first output even if invalid.
A failed checkpoint ends this attempt: no revised proposal, retries or fallbacks.

Record `proposalHash`, `criteria` and `conclusion` using
`DesignCheckpointReview`. Each of these seven criteria needs an explicit
pass/fail/unresolved verdict and concrete anchor/space/route IDs, dimensions and
reasoning sufficient to explain the judgment:

- `distinctive-massing`: convincing coherent composition and identity; repeated generic boxes with cosmetic accents fail.
- `volume-hierarchy`: developed primary and subordinate volumes, proportions, roof/section and facade depth.
- `six-individual-suites`: six individually located, non-overlapping suite allocations with meaningful boundaries, privacy and access; aggregate floor reservations or names alone fail. Deferred fit-out remains disclosed.
- `circulation-and-arrival`: connected public/private/level routes and a memorable approach, threshold and entrance sequence; route prose alone is insufficient.
- `waterfront-and-outdoor-relationships`: developed waterfront and arrival elevations, real entrances, shaded terraces and connected pool/outdoor spaces.
- `construction-precision`: coordinated world geometry, walking/envelope/roof datums, openings, clearances and sufficiently resolved interfaces; unresolved critical relationships block construction.
- `estate-ambition`: architectural sophistication appropriate to the requested estate, judged from the proposal itself without a fixed mansion template or price-to-area formula.

Do not count seven checked boxes as proof of beauty. The conclusion must explain
why the whole composition is convincing, or precisely why design-first failed.
No passing review is prepared in advance. An underdeveloped proposal means one
paid call total and no construction renders; label absent construction evidence
as not produced because the design checkpoint failed.

After a pass, release only this exact immutable proposal to the existing Generate
engine. Retain both full provider outputs, exact construction payload, operation
and expanded-operation streams, candidate/draft, fidelity and all audits. Measure
actual geometry against every architectural commitment, including six suite
bounds/access, circulation, arrival, facade depth, roofs, terraces and pool. Keep
unverified actual-surface/headroom issues explicit. Missing or simplified design
is failure, even when operation validation passes. Capture unchanged Arrival,
Aerial, Garden and Poolside views through normal presentation, including element
identity/transform verification and browser errors. Judge the actual mansion
against the proposal and prior result, not contract acceptance or finding counts.

Authorization remains pending. Maximum two paid requests total, zero retries,
no fallback models, database writes, unrelated changes, commits or deployments.
