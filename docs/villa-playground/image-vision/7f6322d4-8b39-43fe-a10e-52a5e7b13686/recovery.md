# First live image interpretation recovered offline

Run `7f6322d4-8b39-43fe-a10e-52a5e7b13686` now passes the full interpretation, composition validation and construction pipeline. No additional provider calls were made. The original response, interpretation, unvalidated candidate and prior failure report remain unchanged. The previous result.md describes the historical failure.

The mapper previously split targets on dots relative to architecture, rejecting `architecture.wings[0]`. It now canonicalizes only equivalent optional architecture prefixes and numeric bracket indices, then resolves own properties against the validated architecture. Malformed syntax, absent indices/fields and inherited properties fail. All supplied non-null targets are checked. Architectural fields are untouched.

Evidence basis and construction availability are independent: unsupported features may have visible or inferred evidence and must still have no target. The legacy unsupported evidence basis remains valid only with unsupported disposition. Hidden features still require inferred evidence and disclosure; built/approximate geometry cannot use unsupported evidence. Existing strict schemas and construction checks remain active.

Replay:

```sh
./node_modules/.bin/vite-node --config vitest.config.mts scripts/image-vision.ts replay 7f6322d4-8b39-43fe-a10e-52a5e7b13686
```

The original response text is copied verbatim into the regression fixture. Tests assert unchanged architecture and retained input, equivalent path normalization, visible unsupported trees, continued evidence contradictions, invalid/inherited/missing paths, unsupported substitute geometry, invalid dimensions, and a local width edit of the recovered house.

The editable configuration contains the original 23 × 10 m single-storey wing, 3.4 m walls, 1.4 m eave, Tuscan/hip/warm-stone/divided appearance, two terraces and 12 × 5 m offset pool. Open `/dev/villa-playground/image-first?run=7f6322d4-8b39-43fe-a10e-52a5e7b13686` on the development server and use Customize this villa. The existing page constructs directly from the retained response; no saved project was overwritten.

## Visual comparison

All four captures were inspected against the original image. These are qualitative comparisons; the reference camera is an estimate, not calibrated photogrammetry.

| Aspect | Result |
| --- | --- |
| Massing | Correct broad category: one elongated rectangular, single-storey residence. The rendered long axis reads across the frame, whereas the source recedes more strongly into depth. Estimated dimensions and camera do not establish an exact match. |
| Roof | Red terracotta hip roof with broad eaves preserves the dominant silhouette. Pitch, ridge proportions, tile detail and framing remain approximate. |
| Façade | Major mismatch: repeated divided windows and articulated stone finish replace sparse simple blue glazing, pale stucco and dark timber trim. The renderer also supplies an entrance whose location is unconfirmed. |
| Patio | Paved rectangles are present, but the left-side furnished sitting patio is not faithfully reconstructed: the output shows slabs near the short ends, with no matching table/chairs. |
| Pool/site | Offset rectangular pool is present. Pool surround, furniture, boundary walls and orderly planting are builder additions, not recovered evidence. Source tree positions, lawn, terrain, vehicle and grid are not reproduced. Visible unsupported trees remain honestly recorded in the interpretation. |

This completes the original construction/rendering experiment successfully, with limited visual fidelity. Geometry was not modified to improve the comparison.

Validation: all 188 villa tests in 21 files passed; typecheck passed; focused ESLint passed. Chromium rendered 431 finite meshes in each view with no page errors and no attempted AI/external requests. Initial sandbox/local-server launch attempts failed; the existing local server subsequently completed the capture.

Evidence: [replay proof](recovery-proof.json), [browser checks](browser-checks.json), [Aerial](reconstruction-aerial.png), [Arrival](reconstruction-arrival.png), [Poolside](reconstruction-poolside.png), [Reference comparison](reconstruction-reference.png).
