# Staged villa proof (offline, flat site)

Run: `npx vite-node --config vitest.config.mts scripts/staged-villa-run.ts`, then `staged-villa-edits.ts` and `staged-villa-save.ts`.
Tests: `npx vitest run src/lib/villa/staged`.

The designer and edit planner used here are **developer-authored mocks**, not a model. No paid calls were made.

- Code: `src/lib/villa/staged/`
- Checkpoints: `stage{1..5}.checkpoint.json`, `stage{2..5}.scene.json`
- Edits: `edit-*.scene.json` / `edit-*.spec.json`
- Save file: `casa-corallina.save.json`
- Renders: `stage5-*.png`, `edit-*-arrival.png`
