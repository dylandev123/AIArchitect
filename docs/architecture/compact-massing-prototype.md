# Compact architectural massing prototype

Implemented 22 October 2026 against the current working tree and the [Terra/V3 boundary audit](terra-v3-authoring-boundary-audit.md). This is an isolated development experiment. V3 remains the construction and editable scene authority. No project format, saved data, database, credentials, production routing or construction engine is changed. No commits or deployment were performed.

## Contract

`terra-massing-1` is a disposable input to `expandCompactMassing` / `prepareCompactMassing` in [compactMassing.ts](../../src/lib/v3/compactMassing.ts). Terra chooses forms, dimensions, orientation, positions/relationships, storey heights and roof silhouette. Local code derives coordinates and technical bookkeeping. The contract is never stored as a project format or replayed over edits.

```json
{
  "format": "terra-massing-1",
  "title": "Asymmetric residence",
  "concept": "A tall living volume and a lower east wing.",
  "site": { "width": 70, "depth": 60 },
  "volumes": [
    {
      "name": "home",
      "at": [0, 0],
      "plan": { "kind": "rectangle", "width": 16, "depth": 10 },
      "heights": [3.8, 3.1],
      "roof": { "form": "gable", "pitchDegrees": 22, "overhang": 0.2 }
    },
    {
      "name": "wing",
      "attach": { "to": "home", "side": "east", "offset": 2 },
      "plan": { "kind": "rectangle", "width": 8, "depth": 6 },
      "heights": [3.4],
      "roof": { "form": "mono-pitch", "pitchDegrees": 12, "overhang": 0.2 }
    }
  ]
}
```

| Field | Executable meaning |
| --- | --- |
| `title`, `concept`, optional `assumptions` | Explanatory text; does not invent geometry or certify views/privacy/quality. |
| `site.width/depth` | Metres, centred flat site; each span 4–300m. |
| `volumes[].name` | Unique semantic reference, lowercase slug, 1–48 characters. Stable across array reordering. Optional `role` defaults to `residence`. |
| `at:[x,z]`, optional `rotation` | Absolute world position of the local origin; yaw in degrees. East +X, south +Z, +yaw turns +Z toward +X. |
| `attach:{to,side,offset?}` | Exclusive alternative to `at`/`rotation`. Touches the named host's LOCAL face, inherits its yaw. Offset defaults to zero and runs +X on north/south faces, +Z on east/west faces. Both volumes must be rectangular and share a nonzero wall span. Forward references work; cycles fail. |
| `plan:{kind:"rectangle",width,depth}` | Full architectural envelope dimensions, 1–150m each. |
| `plan:{kind:"l",width,depth,cut:{corner,width,depth}}` | Removes the named corner (`nw/ne/se/sw`) on all floors. |
| `plan:{kind:"u",width,depth,court:{side,width,depth,offset?}}` | Carves an open court from the named local face on all floors. Court width and offset from facade centre retain two side wings; depth retains a back wall. Offset uses the same +X/+Z convention. No paving is invented. |
| `recesses:[{side,width,depth,offset?}]` | Additional full-height facade indentations. An entrance recess is only a massing indentation; it constructs no door, vestibule, access route or room. |
| `upperSetbacks:[{corner,width,depth}]` | Removes named corners on every floor above ground, preserving the full ground footprint. Requires two or more storeys; not arbitrary per-floor polygons. |
| `plan:{kind:"outline",segments:[...]}` | Optional exact clockwise closed local line/arc boundary. Lines: `type,start,end`; arcs: `type,center,radius,startAngle,sweep`. Segment `id` is optional. Local origin and all authored points remain unchanged. No outline edits/recesses/setbacks can be combined with this form. |
| `heights` | 1–12 explicit bottom-up floor-to-floor heights, each 2.4–8m; determines total height, level count and datums. No guessed height division. |
| `roof` | Existing concept roof contract: `form`, optional `pitchDegrees` (1–60, default 12), optional `overhang` (0–3m, default .4). Pitch is ignored by flat roof families. These defaults are inherited compatibility policy, not new architectural inference. |

`recesses`, `upperSetbacks`, `assumptions` default to empty arrays; absolute rotation defaults to zero. All masses use existing concept flat-ground/base-elevation-zero defaults. Limits are 12 volumes, 12 recesses/volume, 4 upper corner setbacks/volume and 64 exact segments/outline. Exact arcs retain existing V3 radius, wall-offset, closure, self-intersection and tessellation limits. No raw V3 object escape hatch exists.

## Supported architecture and limits

Supported: asymmetrical connected rectangular wings, separate positioned/rotated volumes, L/U residences, open courtyards, different wing heights and storey heights, corner upper setbacks, recessed entrance envelopes, and precise irregular/curved boundaries through existing V3 line/arc outlines. Controls combine when their geometry is unambiguous and supported (a test combines a court, entrance recess and upper corner setback over three storeys).

Roof compatibility remains V3's existing authority:

- Rectangular independent masses: flat, floating-flat, mono-pitch, hip, gable, butterfly, terrace.
- Articulated/exact outlines: flat, floating-flat, mono-pitch, terrace.
- Rectangular junctions: flat, floating-flat, mono-pitch, hip, gable; matched roof datums or steps of at least .6m. Pairwise roof solver restrictions still apply.

Unsupported: a hole inside one footprint (the court shortcut is open-sided), arbitrary independent per-storey outlines, whole-floor inset shortcuts, skew/curved/articulated Boolean attachments, three mutually meeting roofs, domes/cones/splines, terrain/stacked/floating volumes, rooms, facade openings, stairs, circulation, structural engineering, architectural assemblies and a complete-house handoff. No site paving, gardens or furnishings are added. Independent rectangles can frame outdoor voids subject to the existing junction rules, but no general court/Boolean solver is introduced.

Unknown fields, missing choices, duplicate names, conflicting placements, cycles, unknown hosts, corner-only attachments, clipped/overlapping cuts, degenerate/excessive outlines, incompatible roofs and geometry outside the site/eaves all reject without a scene. Findings identify `code`, `targetId` and an actionable message. Examples include `MASSING_AMBIGUOUS_PLACEMENT`, `MASSING_REFERENCE_CYCLE`, `MASSING_CLIPPED_RECESS`, `FOOTPRINT_INVALID`, `ROOF_FOOTPRINT_UNSUPPORTED`, `JUNCTION_AMBIGUOUS_DATUM`. A required but unsupported/ambiguous brief can produce `{"unsupportedFeatures":["precise explanation"]}`; it is rejected as `MASSING_UNSUPPORTED_INTENT`.

The adapter proactively rejects facade recesses that the legacy articulated builder would partially trim against corner cuts. V3 preflight rejects malformed footprints before legacy rectangular fallback is reachable. It never substitutes a rectangle or a different roof to obtain a preview. This establishes geometric preservation of accepted inputs, not that natural-language claims in `concept` are independently true.

## Translation into V3

1. Strict schema validation, unique semantic names and exclusive placement rules.
2. Resolve attachment graph, inherit local frames and calculate exact face-contact coordinates. Root placement is always an explicit architectural decision.
3. Expand L/U/recess/setback controls into existing V3 notch/recess operations. Reject no-op upper edits, out-of-range cuts and potentially trimmed recesses.
4. Reuse the existing blueprint `architecturalPlanEnvelope` arithmetic. Exact outline bounds include analytical arc extrema and use V3's symmetric addressing envelope (`2*max(abs(local coordinate))`). They are not recentered tight bounding boxes; an outline from x=-3 to x=9 derives an 18m addressing width while preserving those points. The existing blueprint call now uses the same exported helper with unchanged arithmetic.
5. Derive `mass-<name>`, operation ids, missing segment ids and connection references. Existing concept lowering derives storey ids/elevations, material defaults, transforms, dimensions and implicit host roofs. Segment ids supplied explicitly are retained; collisions fail validation. Generated operation/segment ordinal ids belong to this one-time authoring input, not a durable recipe editor.
6. Call **the existing** `prepareArchitecturalConcept`, which constructs the existing `V3Scene`, checks outlines, site occupancy, junctions, roof compatibility, compiled geometry and roof presence, using **the existing** `compileV3Scene`. No new mesh or Boolean construction code was introduced.

The resulting semantic scene is the sole geometry authority. Neither this prototype nor its viewer imports the project store or invokes saving. Evaluation metadata and debug response evidence use the pre-existing concept workflow. The expanded authoring recipe is not installed in saved projects. Deterministic tests round-trip V3 JSON and prove stable compiled results; this is a persistence compatibility test, not a save integration feature.

## Evaluation paths

All UI access requires `NODE_ENV=development` and `AI_V3_CONCEPT_EVALUATION=1`. Compact controls additionally require `AI_V3_COMPACT_MASSING_EVALUATION=1`. Both HTTP paths reject compact access when either flag is off or the environment is production/test. The pure conversion functions remain callable by deterministic tests, like the existing concept adapter.

- Existing `/api/ai/concept` requests with `{prompt}` retain the existing language and behavior.
- Opt-in `{prompt,language:"compact"}` swaps only the authoring prompt and deterministic adapter. It uses the same model factory, provider options, token cap, response capture and usage logger. **One Terra request, zero translation calls, zero retries/repair calls.** Its usage stage is `v3-compact-massing-evaluation`; no model/key configuration changes.
- `/api/ai/concept/compact` accepts `{fixture:<name>}` for independent compact/existing-concept comparisons or `{input:<contract>}` for offline custom validation. This route makes **zero provider calls**, requires no key, and performs no storage/evidence writes.
- `/dev/architectural-concept` retains the existing viewer. Compact opt-in adds an authoring-language choice plus offline fixtures, JSON input and two previews using the same V3 renderer. Fixture results say “Hand-authored fixtures · zero provider calls”; generated results identify the authoring language separately.

## Validation results

**All evidence here is deterministic/offline. Real Terra generations: zero. Live OpenAI calls: zero.** Transport tests mock the HTTP provider response and use a non-secret placeholder; they establish one-call wiring, not model compliance. Natural-generation reliability, architectural quality, latency, token/cost savings and production handoff readiness were not measured.

Six independent fixture pairs compare both canonical semantic geometry and **every compiled primitive**, not just screenshots or bounding boxes:

| Fixture | Masses | Storeys | Compiled primitives (including terrain) | Roof primitives |
| --- | ---: | ---: | ---: | ---: |
| asymmetric-wings | 2 | 3 | 30 | 9 |
| l-residence | 1 | 2 | 21 | 2 |
| u-courtyard | 1 | 2 | 27 | 1 |
| upper-setback | 1 | 2 | 17 | 1 |
| recessed-entrance | 1 | 2 | 27 | 1 |
| exact-outline | 1 | 2 | 13 | 1 |

All six have zero rooms and exactly equal compiled primitives to their independent existing-concept baselines. See [machine-readable checks](compact-massing-evaluation/checks.json) and [fixture source](../../src/lib/v3/evaluation/compactMassingExamples.ts).

Additional tests verify actual L/U solid/void areas and roof triangle coverage (no roof over the sampled court void), full ground/reduced upper geometry, exact entrance-recess span/depth/offset, unequal cumulative storey datums, real stepped wing junctions, rotated/forward references, unchanged input, reorder-stable mass identity, JSON reload, analytical arc extrema, compatible roofs, incompatible roofs, cycles/duplicates/unknown fields, malformed outlines and all flag gates. Endpoint tests prove zero offline network calls and unchanged project store state. A native Safari check of the isolated development page verified the two U-courtyard WebGL silhouettes, including the open void and matching roof boundary. This was a fixture view, not a Terra generation. The temporary preview server was stopped after verification; the existing server was not stopped or reconfigured.

**188 tests passed across 11 files**, including 40 compact adapter tests. The final focused regression command below covers the audit's eight original files plus compact tests and both route suites. TypeScript (`--noEmit --incremental false`), scoped ESLint and `git diff --check` also pass. No full repository test/build certification is claimed for this already substantially modified working tree.

## The 16-versus-17 freedom audit discrepancy

Reproduced before implementation: `terraFreedomAudit.test.ts` expected `{specialized:16,generic:14}` and observed `{specialized:17,generic:13}`. Investigation traced the single promotion to **the fixture object `fountain`**, whose `fountain` capability was added in the pre-existing working-tree changes to `capabilities.ts`. That builder emits five actual meshes: basin floor, shell, coping, water surface and jet. The shaped-driveway capability also added in that working tree does not explain this fixture (it contains a `gate`, not a shaped driveway).

The audit now checks the exact specialized and generic object identities and zero proxy identities, plus the fountain's five constructed mesh roles. All other fixture dispatch identities, generic water-wall fallback/source preservation and failed-preview recovery remain protected. This is a semantic reconciliation with construction evidence; the assertion was not changed to a new aggregate count merely to obtain a pass. No production capability or builder was modified to resolve the audit. Current dispatch is 17 specialized / 13 generic, all 30 retained.

## Exact testing steps

From the repository root, run deterministic tests (no key, no OpenAI requests):

```sh
node_modules/.bin/vitest run \
  src/lib/v3/__tests__/compactMassing.test.ts \
  src/lib/v3/__tests__/architecturalConcept.test.ts \
  src/lib/v3/__tests__/conceptFootprintTrace.test.ts \
  src/lib/v3/__tests__/architecturalPlanAuthoring.test.ts \
  src/lib/v3/__tests__/architecturalPlanFirst.test.ts \
  src/lib/v3/__tests__/roomPlanning.test.ts \
  src/lib/v3/__tests__/savedPlanExteriorHandoff.test.ts \
  src/lib/v3/__tests__/architecturalBlueprint.test.ts \
  src/lib/v3/__tests__/terraFreedomAudit.test.ts \
  src/app/api/ai/concept/route.test.ts \
  src/app/api/ai/concept/compact/route.test.ts --maxWorkers=2
node_modules/.bin/tsc --noEmit --incremental false
node_modules/.bin/vite-node --config vitest.config.mts scripts/compact-massing-evidence.ts
```

Start a development instance with explicit flags (restart your own existing dev instance with these flags if it already owns this checkout; Next.js 16 prevents simultaneous dev instances in one checkout):

```sh
AI_V3_CONCEPT_EVALUATION=1 AI_V3_COMPACT_MASSING_EVALUATION=1 \
  npm run dev -- --hostname 127.0.0.1 --port 3118
```

1. Open `http://127.0.0.1:3118/dev/architectural-concept` and scroll to “Compact massing · deterministic offline evaluation”.
2. Click each of the six fixture buttons. Compare “Compact → V3” with “Independent existing concept → V3”; orbit either using the existing controls. The JSON editor contains the selected compact contract.
3. Edit JSON and click **Evaluate JSON offline**. For a refusal example, load `u-courtyard`, change roof `form` to `hip` and evaluate. Expect `ROOF_FOOTPRINT_UNSUPPORTED` and no substitute/stale preview.
4. For an ambiguity example, add `at:[0,0]` to the attached `wing` of `asymmetric-wings`. Expect `MASSING_AMBIGUOUS_PLACEMENT`.
5. Do not press **Generate 3D Concept** during offline testing. That separate form uses the existing OpenAI configuration and would issue one real Terra request. Selecting Compact massing there changes its output contract; this live behavior was only validated with mock transport here.
6. Remove the compact flag and restart: offline compact requests and `{language:"compact"}` return 403, compact UI controls disappear, and the existing concept evaluator stays available. With production `NODE_ENV`, both evaluation modes are disabled even if flags are set.

Offline HTTP examples, while the flagged dev server runs:

```sh
curl -s -H 'Content-Type: application/json' \
  -d '{"fixture":"u-courtyard"}' http://127.0.0.1:3118/api/ai/concept/compact

node -e 'const fs=require("node:fs"); process.stdout.write(JSON.stringify({input:JSON.parse(fs.readFileSync("docs/architecture/compact-massing-evaluation/asymmetric-wings.json","utf8"))})))' \
  | curl -s -H 'Content-Type: application/json' --data-binary @- \
    http://127.0.0.1:3118/api/ai/concept/compact
```

Both return `providerCalls:0`; fixture results explicitly identify deterministic hand-authored provenance. No real Terra response is included in these fixture artifacts.
