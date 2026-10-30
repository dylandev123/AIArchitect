# AI-to-geometry semantic contract repair

The construction contract is repaired offline. The original paid refinement is **not recovered or accepted**. A separately labelled supported semantic transaction passes the existing full refinement pipeline and project history. No provider requests, database writes, commits or deployments were made.

## Exact failure and cause

The retained response's operation **16** (zero based; seventeenth operation), `add rear-loggia-canopy-edge`, specifies `semanticType: "material"` and `kind: "volume"`. The complete editing vocabulary includes `material` as a resource for material changes, with no direct-scene renderer mapping. It does not identify a geometric canopy component. Neither its label nor its proportions establishes an unambiguous replacement semantic type.

The review selected rear-facade work and declared that new ID. The refinement instruction requested an aligned canopy edge; it did not instruct the model to use `material`. The provider schema nevertheless offered `material` alongside geometry types through `elementSchema`'s independent semantic and kind enums. The ordinary Refine response adapter returns that schema directly; parsing accepted the pairing. Scope validation allowed the declared addition. Atomic staging then called `validateScene`, which correctly rejected the pair against `DIRECT_SCENE_KINDS`. The visual-review route caught the failure and retained the original.

Thus Terra authored an unsupported pairing, enabled by an application schema defect. The runtime rejection was correct. There was no lost geometry, missing synonym normalization or evidence that a valid architectural type was rejected. Converting `material` into `mass`, `roof` or another type automatically would invent meaning.

## Production correction

- `src/lib/villa/scene/model.ts`: element schemas now have one branch per renderer kind. Each branch's optional semantic enum is derived from the existing authoritative `DIRECT_SCENE_KINDS` map and `OBJECT_TYPES`. Scene persistence, add/replace operations, Generate, Refine, Redesign, visual refinement and ordinary editing all consume that same constrained element schema. Unknown values and incompatible combinations fail with semantic value, renderer kind and supported values in validation details. No fallback conversion exists.
- `src/lib/villa/scene/capabilityReference.ts`: the executable contract reference handles the new union and derives its compact semantic/kind compatibility reference from the same map. The material resource is no longer advertised as an element semantic type. This changes construction-contract information only; architectural design guidance is unchanged.
- Three existing schema-introspection tests use `elementFieldsSchema` to inspect shared fields. That object is the shared field template, not the scene/operation acceptance schema.
- `semanticContract.test.ts` and `scripts/semantic-contract-offline.ts` retain the real failure and exercise supported equivalents offline.

The broader semantic editing registry still includes material resources. V3 native-type adapters remain separate representations; they preserve their existing native mappings and do not authorize direct-scene material geometry. No vocabulary or geometry capability was added. Existing primitive/profile, roof, opening, pavilion, attachment and relationship restrictions still apply after semantic compatibility; a compatible type is not a guarantee of arbitrary valid dimensions, hosts or intersections.

## Retained replay and valid geometry

The exact paid operation array remains unchanged and fails the corrected schema at operation 16. `elementFieldsSchema` reproduces why the former independent enums accepted its value; regression tests also verify the absent material renderer mapping.

`fixture.operations.json` is explicitly a **developer fixture**, with only that operation's semantic type changed to `mass`. It constructs 50 editable elements through `stageSceneOperations`, including the canopy edge, and is retained separately as `construction.scene.json`. It is not an accepted refinement. The full `stageGenerationRefinement` path correctly refuses it with:

> New collision between dining-post-west-front and main-floor.

The first additional blocker follows operation **12**, `move dining-post-west-front`. Other downstream checks may also find problems; they are not certified clean. No post position, material, glazing, slab or validation gate was manually repaired. The rejected geometry must not be imported as an approved project version.

`supported-fixture.json` and `supported-fixture.scene.json` demonstrate a different, existing developer structural study with explicit supported semantics: roof for `entry-roof`, mass for `entry-west-pier` and `entry-east-pier`, and wall for the two arrival screens. Its removals, replacement and additions pass `stageGenerationRefinement`, including scope, preservation, extent, relationships and evidence-difference checks. Tests save it through the normal project store, reload/validate it, Undo, Redo and resize an added pier while retaining its ID. This is real editable construction evidence, not evidence of Terra's architectural quality.

No recovered-candidate screenshots are supplied: the original raw candidate cannot pass acceptance. Original cameras and historical screenshots remain untouched. No visual improvement is claimed for the paid proposal or the developer fixtures.

## Verification and limits

**276 tests pass across 41 files; typecheck and focused ESLint pass.** A final five-test rerun also verifies that the extracted raw provider text exactly matches the retained operation object. The scene/semantic/provider/project-history suite covers the shared vocabulary, every declared renderer pair including the pavilion, the unchanged raw response, invalid and ambiguous values, ordinary generation/editing, replacement/removal/addition limits, protected metadata, unrelated geometry, atomic rejection and project history. Existing geometry/profile and SDK schema tests also run. See `tests.txt`, `typecheck.txt` and `eslint.txt` for final results.

All original limits remain unchanged: 23 existing targets for this 47-element house, 32 additions, 8 removals further limited to 20%, 80 operations, original bounds plus 6 m, no terrain edits or assemblies. Stable IDs, preservation, relationship validation and atomic execution remain enforced.

No live response has tested whether Terra chooses an appropriate semantic label under the corrected schema. No provider-side compliance, new architectural quality, successful paid candidate, matching-camera comparison or full interactive browser session is claimed. Existing SDK transport tests verify local serialization and adapters without a paid request.

Reproduce:

```sh
npx vite-node --config vitest.config.mts scripts/semantic-contract-offline.ts
npx vitest run src/lib/villa/scene src/lib/semantic src/store/__tests__/directScenePersistence.test.ts src/app/api/ai/scene/route.providerSchema.test.ts src/app/api/ai/scene/route.test.ts
npm run typecheck
```
