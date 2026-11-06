# Stage 4: exterior architectural design (Terra decides character, software constructs)

Stage 3 (`../stage3-programme/live/`) is untouched; its scene is pinned by SHA-256 in `src/lib/villa/staged/exterior.test.ts` and rebuilt from Terra's saved responses.

- `live/request.json`, `live/result.json`: the one live Terra call (raw answer, usage, cost). `terra-stage4.checkpoint.json`: design, derivation, spec, metrics, warnings. `terra-stage4.scene.json`: the built scene.
- `terra-stage4-{arrival,aerial,garden,poolside}.png`: real ArchitecturalScene renders. `mock-offline-*`: renders of a developer-authored MOCK answer (not a model output) used to test the pipeline.
- Re-run offline (spends nothing): `npx vite-node --config vitest.config.mts scripts/staged-villa-live-exterior.ts`. The `--live` flag refuses a second paid call.
