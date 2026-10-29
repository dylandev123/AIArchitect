# Saved-image vision readiness

Implementation is ready for one separately authorized live call. No live interpretation has been run. Mock geometry comes from the existing manually labelled offline proof and does not demonstrate vision accuracy.

The implementation reuses `OPENAI_API_KEY`, `getAiModel()`, `AI_PROVIDER_OPTIONS`, the saved `public/inspiration/villa.jpg`, `constructImageSpec`, Villa validation, and existing builders. It allows supported wings, footprint forms and connections without image-specific geometry in the interpreter. Each significant feature has a visible/inferred/unsupported evidence record, confidence, construction mapping and approximation disclosure. Dimensions and the reference camera remain single-image estimates. Validation checks exterior geometry; it does not certify structural engineering or hidden room layouts.

## Offline checks

```sh
npx vitest run src/lib/villa/image-first.test.ts src/lib/villa/image-vision.test.ts
node scripts/image-vision-mock.mjs
npx vite-node --config vitest.config.mts scripts/image-vision.ts replay 00000000-0000-4000-8000-000000000001
```

Open `/dev/villa-playground/image-first?run=00000000-0000-4000-8000-000000000001` in development. Customize edits the validated configuration through the existing editor. Loading/reloading the page makes no vision call.

With the development server running:

```sh
IMAGE_VISION_RUN=00000000-0000-4000-8000-000000000001 node scripts/image-vision-capture.mjs
```

`CAPTURE_ORIGIN` overrides localhost. Capture saves aerial, arrival, poolside and estimated reference-camera screenshots and camera/mesh checks under `docs/villa-playground/image-vision/<run>/`. Outbound browser requests and AI endpoints are blocked. The reference pose is approximate and needs human visual comparison against the concept.

## After separate live authorization only

```sh
npx vite-node --config vitest.config.mts scripts/image-vision.ts --authorize-one-live-call
```

This explicit command makes one SDK generation invocation, without tools or retries. There is no live button, automatic call or image-generation stage. It saves source bytes/hash, model, prompt/settings, raw SDK response including provider body, output text and usage under `.data/image-vision/<run>/` before parsing and validating the output. Accepted configuration and interpretation are saved as `proof.json`; malformed/unsupported output remains available in `response.json` and does not become a fallback house. Storage failure before the call prevents spending; storage failure after the call is a failure, not a retry.

Replay with `scripts/image-vision.ts replay <run>` and open the resulting page. The page verifies that the current source image still matches the retained hash. Capture with `IMAGE_VISION_RUN=<run>`. Review major silhouette, floor levels, wings, roof, entrance, facade, materials and terrace relationships against the source, and review all uncertainty before calling the visual result successful. Live model access, output validity, match quality and token usage remain unverified.

No V3 changes, migrations, commits or deployment are part of this integration.

Image input format follows the [official OpenAI vision documentation](https://developers.openai.com/api/docs/guides/images-vision?api-mode=responses), through the installed AI SDK adapter.
