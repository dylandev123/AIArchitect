# Reference-aware review attempt and offline patio study

The single authorized API attempt failed DNS resolution (`getaddrinfo ENOTFOUND api.openai.com`). No HTTP response, Terra proposal, usage or billing confirmation was received. No retry or paid edit was attempted. This is an incomplete live review and a separate manual offline study, not a successful Terra improvement.

Open [the self-contained before/after comparison](comparison.html). It includes all three camera-matched comparisons and the concept. Both configurations remain available: [original](original.config.json), [unapproved candidate](revised.config.json).

## Preserved inputs and transport record

Baseline is the existing audited material/glazing correction for retained image-vision run `7f6322d4-8b39-43fe-a10e-52a5e7b13686`, not the older manual image-first fixture or the raw, uncorrected reconstruction. Its brief was reconstructed from retained interpretation; no historical user brief was recovered. The source image, original interpretation response, raw architecture and proof remain untouched and pass [SHA-256 verification](verification.json). A separate [copy of the original raw vision response](original-vision-response.json) is retained here. There is no new review raw response to preserve because DNS failed before one was received.

[Review input](review-input.json) includes the validated baseline, known unresolved features, three 640 × 360 real render captures and original concept bytes. [Request settings](request-settings.json) retain the existing Terra model/configuration and review instructions. [Transport record](transport.json) records one fetch invocation; it does not prove that a request reached OpenAI. [Failure](failure.json) records the DNS error. No usage or cost estimate is fabricated. No key or environment file was changed.

The direct runner bypassed the automatic review UI entirely, disabled retries, guarded against a second fetch and wrote an exclusive attempt marker to prohibit rerunning. Raw response capture was configured before parsing, but no response arrived. No model or endpoint change was attempted.

## Manual offline candidate

Because no Terra proposal exists, there are no AI-proposed changes to evaluate. A separate manual study addresses one visible reference relationship: the concept has paving along a long side of the house, whereas the baseline terrace sits by the short end and overlaps the building footprint by 1 m.

The existing `west-sitting-patio` retains its identity, paving selection and 6 m depth. Its x changes −14 → −4.5 m, z 1.5 → 8 m and width 7 → 12 m. It now meets the long wall at z=5, extends to z=11, has no footprint overlap, and has a 2.5 m gap from the pool in x. Area increases 42 → 72 m². These dimensions and the chosen side are inferred from a single image, not measured or recovered geometry. The retained terrace ID is a stable identity, not an updated directional description.

An explicit fourth change, `siteMode: derived → fixed`, freezes the existing garden bounds. Otherwise automatic garden derivation would move the boundary and planting envelope after the patio relocation. All garden coordinates, the house, roof, eaves, glazing, other terrace, pool, materials and collection identities remain equal. This is a manual candidate validated through existing composition validation/building, not a claimed narrow-scope Terra edit. [Exact changed fields and rationale](offline-findings.json).

## Architectural assessment

- **Aerial:** paving now visibly adjoins a long facade, and the short-end overlap is removed. This is a limited spatial correction toward the visible reference relationship.
- **Poolside:** the patio becomes a more usable contiguous outdoor platform, but is a large bare slab. Furniture, exact grey paving and the concept's intimate landscape setting are still absent. Its larger area is an unverified design choice.
- **Arrival:** the moved patio is mostly on the hidden side. Entrance legibility, residential glazing rhythm and silhouette have no demonstrated improvement.

The architecture has **not been established as better overall**. The evidence supports a limited patio relationship improvement, with uncertain dimensions and orientation. Repeated window bays, shutters, missing timber trim, roof proportions and generic site planting remain conspicuous mismatches. No calibrated similarity score is asserted. The aerial image omits some distant site geometry by design; the paired cameras and daylight are equal, not registered to the reference photograph.

Verdict: **retain for human review; unapproved**. The current/original design was not overwritten, and no acceptance, rejection lesson or successful-design learning was submitted.

## Checks and reproduction

Three original and three candidate PNG captures were produced by the existing `ReviewPreview` renderer, which checks PNG dimensions, nonblank pixels, camera framing and context health. Camera positions/targets match within 1e-8 in all three pairs. Browser page errors: none. All browser API routes were blocked; the renderer attempted only the unrelated `/api/assets` listing, which was blocked consistently. No browser request reached a paid endpoint. The early development-panel capture attempt was abandoned before any review or edit request.

`npm run typecheck` passed. Offline validation passed, asserted the exact four changed fields and preserved house/pool/garden/materials, and verified all recorded source hashes. See [verification](verification.json), [before checks](before-render-checks.json), and [after checks](after-render-checks.json).

Reproduce offline: `./node_modules/.bin/vite-node --config vitest.config.mts scripts/reference-review-offline.ts`, then `node scripts/reference-review-render.mjs --after` with the dev server running. The isolated development page is `/dev/villa-playground/reference-review-capture` (append `?after=1` for the candidate). The live script must not be rerun; its attempt marker enforces the zero-retry limit.

No additional provider requests, key changes, commits or deployment. Stopped after retaining these findings.
