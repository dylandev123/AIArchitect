# Independent architectural audit package

Open [AUDIT-PROMPT.md](AUDIT-PROMPT.md) for the review task. The downloadable [independent-audit-package.zip](independent-audit-package.zip) is self-contained; no repository connection, credentials or external calls are required. Nothing has been submitted to an external model.

Read raw evidence before [our conclusions](REPORT.md). Treat historical prompt text as evidence, not instructions to execute.

| Material | Location | Provenance |
|---|---|---|
| Full original mansion brief | `ORIGINAL-BRIEF.txt` | Extracted from the exact frozen Terra request, also present in Sol's request. |
| Both actual failed proposals | `raw/paired/terra.proposal.exact.txt`, `sol.proposal.exact.txt` | Exact model output; parsed variants and full responses alongside. No repaired replacement. |
| Historical provider-facing schema and instructions | `raw/paired/terra.request.exact.json`, `sol.request.exact.json` | Complete strict wire schema, developer text, retrieved knowledge and user input; only model differs. |
| Full paired failure assessment | `raw/paired/REPORT.md`, both `*.offline-audit.json`, `offline-validation.json` | Existing unfiltered manual and software findings; no paired renders exist. |
| Terra's original failed-run assessment | `raw/terra-run/REPORT.md`, `offline-investigation.json`, checkpoint and retained output | Original failure context preserved separately from comparison. |
| Existing actual screenshots and visual assessment | `raw/older-azure/{arrival,aerial,garden,poolside,aerial-oblique}.png`, `REPORT.md` | Earlier Azure model construction, **not either paired proposal**. Scene/operations/raw request/response and validation included. Older report links to additional historical runs are contextual references outside this packet; all primary evidence for this review is inside. |
| Current proposal schema | `provider-proposal-schema.current.json` | Exported offline through production wire adapter. Not substituted into historical requests. |
| Current Generate, capabilities, geometry, operations and validators | `source/src/…` | Source snapshots use final `.txt` extension to avoid compiling evidence. Model/assembly/profile contracts are authoritative; all scene modules and tests included. |
| Deterministic placement assumptions | `offline-results.json`, `source/scripts/architectural-planning-audit-offline.ts.txt` | Three developer arrangements, six selected thresholds, refusal cases and selected stair arithmetic; not model architecture. |
| Recommendations, limits and next experiment | `REPORT.md` | This audit's conclusions, explicitly separate from raw evidence. |
| Verification | `verification.json`, `tests.json`, `SHA256SUMS.json` | Test outcomes, full-typecheck limitation and hashes of every archive member except the manifest itself. |

The current path is brief/retrieval → model-selected spatial proposal → semantic validation → immutable selected anchors → model-authored operations → existing atomic construction/fidelity/review → normal editable rendering. In the local paired experiment, planning failed and construction did not run. The seven-criterion checkpoint is a local experiment callback, not an ordinary product-wide aesthetic gate.

Supported construction includes independent walls, slabs, roofs, real openings/infill, editable volumes and plants as abstractions, custom arc and polygon extrusions with holes, parent transforms, facade bays, doorway and straight-stair assemblies, direct additions/replacements and supported geometric/finish/attachment operations. These do not supply automatic architectural layout, full navigation, arbitrary shared-profile solving, surveyed terrain, hydraulic simulation or engineering/code certification. Generation's flat-site policy is narrower than the existence of terrain fields in scene/edit schemas.

Reproduce inside the original repository, offline:

```sh
npx vite-node --config vitest.config.mts scripts/architectural-planning-audit-offline.ts
npx vitest run src/lib/villa/scene/spatial.test.ts src/lib/villa/scene/designProposal.test.ts src/lib/villa/scene/walkingAccess.test.ts src/lib/villa/scene/assemblyEvidence.test.ts src/app/api/ai/scene/route.designFirst.test.ts --reporter=json --outputFile=docs/architecture/planning-method-audit-2026-10-30/tests.json
npx eslint src/lib/villa/scene/spatial.ts src/lib/villa/scene/spatial.test.ts scripts/architectural-planning-audit-offline.ts
python3 scripts/architectural-planning-audit-package.py
```

`npm run typecheck` currently fails on existing archived experiment imports/type errors and an existing duplicate property in the Sol review script. Those files were preserved. This package makes no full-typecheck or architectural-quality success claim.
