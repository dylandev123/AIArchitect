# Ocean Crescent Villa recovery

Recovered the latest retained Terra generation, hash `8100bca24525c07e1319837d172478ea71557c45a367dc1d49b99a4bbd6a6483`. `original.response.json` is byte-for-byte identical to the retained response. No provider calls, repairs, migrations, commits or deployments.

Open the development preview:
http://localhost:3000/dev/villa-playground?response=8100bca24525c07e1319837d172478ea71557c45a367dc1d49b99a4bbd6a6483

Essential geometry passes: one curved enclosed footprint residence and its derived flat roof, one detached sea pavilion, rectangular pool, and two major terraces. This response has no rectangular wings or galleries. All authored architectural fields remain unchanged; only the existing derived garden calculation runs.

Unresolved original features remain in the editable configuration and are excluded from the renderer projection:
- `arrival-walk`: residence clearance conflict. Arrival access remains unresolved.
- `poolside-pavilion-walk`: pavilion clearance conflict.
- `ocean-border-east`: pavilion clearance conflict.
- `pavilion-garden`: pavilion clearance and path circulation conflicts.

No positional adjustment preserves the intended approach unambiguously, so no geometry is moved. Complete estate approval requires resolving these features and confirming access. Conservatively, any conflicting route receives an access warning because route kind/ID alone cannot establish that it is decorative.

Strict validation remains available for complete approval. Generation, editing and rendering use scoped preview validation: only identified route/bed geometric findings may be drafts. Schema errors, duplicate IDs, court conflicts, fixed boundaries, roofs, architectural overlaps and component relationships remain blocking. Edits clone and validate atomically; invalid architecture never replaces the current design. Draft warnings persist when the response message is dismissed, and the original AI summary is suppressed while drafts remain to avoid claiming unresolved features were built.

Verification: typecheck; 125 focused tests across 11 files (villa, Solana model, estate examples and edits); lint (one pre-existing unused-variable warning in villa-compositions-capture.mjs). Browser checked the real R3F scene: 1,343 meshes, no non-finite geometry, no runtime errors, AI endpoints blocked. See browser.json, assessment.json and preview.png. The check also exposed and fixed the camera's assumption that a main rectangular wing always exists.
