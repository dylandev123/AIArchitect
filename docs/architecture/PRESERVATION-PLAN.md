# Preservation plan for the uncommitted staged-generation work (proposal, not executed)

Measured 2026-11-06. Nothing has been committed, staged, cleaned or moved. Workflow: directly on `main`, no branches or pull requests.

## What exists only in the working tree

| Category | Files | Size | Proposal |
| --- | ---: | ---: | --- |
| Source: `src/lib/villa/staged/**`, `src/lib/privateStudio/**`, `src/instrumentation.ts`, Private Studio/staged API routes, dev viewers, Studio components, `src/lib/ai/paidExecution*`, new tests, `scripts/*` | 152 untracked + 40 modified tracked | 0.9 MB | **Commit all.** This is the generator, the Studio, its security and its tests. |
| Evidence text: reports, handoffs, real Terra raw responses, checkpoints, saves, ledgers, test/build logs | 405 | 40.4 MB | **Commit.** Real provider responses cannot be regenerated without paying again. |
| Large generated text: three 32 MB `comparison.html` files (embedded images) and two 8 MB visual-review `wire-request.json` | 5 | 114.7 MB | **Do not commit.** Regenerable from committed sources or images; add to `.gitignore`. Keep a local or cloud copy. |
| Screenshots | 273 | 491 MB | **Commit a curated set** (~20–30 final images: each report's final arrival/aerial/garden/poolside, Studio progress/failure). Ignore intermediate captures; back up the rest outside git. |
| Secrets and live state: `.data/private-studio/**` (password hash, sessions, approvals, call ledger), `.env*` | — | — | Already git-ignored. **Never commit.** Back up `.data/private-studio/state.json` privately; it is the authoritative spending ledger. |

A scan of all untracked non-image evidence found no API keys, bearer tokens or session cookies. The only matches were the text `"authorization": "User approved …"`.

## Production risk of committing as-is

The working tree deliberately blocks every public `/api/ai/*` route, in `src/proxy.ts`, and blocks every unreserved provider call, in `src/lib/ai/model.ts`. Deploying it would switch off the live site's existing AI features, including `/api/ai/scene`. That is now one explicit, documented switch:

- default (unset): public AI routes return 403, and only reserved Private Studio calls can reach the provider;
- `LEGACY_AI_ROUTES=enabled` in the deployment environment restores the old routes exactly (69/69 of their tests pass). Private Studio still requires a reservation.

Choose one before deploying. The old routes have no authentication or spending reservation, so enabling them restores today's unauthenticated paid endpoints.

## Suggested commit sequence (after approval)

1. Add `.gitignore` rules for `docs/architecture/**/comparison.html` and uncurated captures.
2. Commit source and tests (one commit), then evidence text and curated images (second commit).
3. Verify `git status` shows only the ignored artefacts and that a fresh clone passes `npm run typecheck` and `npx vitest run`.
4. Push to `main` only after deciding the `LEGACY_AI_ROUTES` value for the deployment.

## Generated manifest (2026-11-06, second pass)

`node scripts/preservation-manifest.mjs` (read-only) writes `preservation-manifest.txt` (included) and `preservation-excluded.txt`. A secret scan of every included text file found no API keys, bearer tokens, session cookies, private keys, password salts or CSRF tokens; no `.data/`, `.env*`, `setup-code` or `state.json` path is included. Operational approval scripts in `.data/private-studio/` stay ignored.

Proposed `.gitignore` additions (keep excluded artefacts out of `git status`; curated images are added with `git add -f`):

```
docs/architecture/**/comparison.html
docs/architecture/staged-villa/stage6-refinement/review-request-*/wire-request.json
docs/architecture/**/*.png
docs/architecture/**/*.jpg
```
