# Direct-scene provider schema rejection

The retained `.data/scene-responses/87b732b3-3e83-4e78-8e33-cc562e3c9b05.json` records a rejected request with an OpenAI invalid-schema error and no output/rawResponse. This is a request-schema rejection before inference, not a geometry or mansion audit failure. No retained files were edited.

The original invalid node was `$.properties.operations.items.oneOf[8].properties.offset.items` (`op: place-on`). Zod's positional tuple emitted draft-7 `items: [{type: number, minimum: -10000, maximum: 10000}, {...}]`. No other positional tuples occur in the complete direct-scene provider schema.

The corrected node is `$.properties.operations.items.anyOf[8].properties.offset`:

```json
{"type":"array","items":{"type":"number","minimum":-10000,"maximum":10000},"minItems":2,"maxItems":2}
```

The discriminated operation union also emitted `oneOf`. A plain union emits supported `anyOf`; each branch retains its unique literal `op`. Coordinate order, tuple types in application code, defaults, finite bounds, geometry validation, atomic transactions, scene persistence and architectural capabilities are preserved. No adapter or persisted-data migration is needed.

`route.providerSchema.test.ts` runs the actual canonical route, AI SDK, and OpenAI Responses adapter with a replacement fetch transport and a dummy credential. Generation and editing both receive successful synthetic provider responses. Tests inspect the serialized `text.format.schema`, compare it with the canonical Output.object schema, recursively audit every schema node against an explicit keyword allowlist, check all ten operation branches and generation/edit planning requirements, reproduce detection of the old invalid tuple, test coordinate limits, and confirm a mocked provider schema rejection is retained without output or retries. No network request is made by these mocked calls.

The route keeps its existing `strictJsonSchema: false` setting. Optional fields and default annotations are intentional in this non-strict contract; local Zod and geometry validation remain authoritative. This change does not claim strict-mode compliance. Supported anyOf, homogeneous arrays and bounds follow the OpenAI structured output schema documentation: https://developers.openai.com/api/docs/guides/structured-outputs . A future strict-mode change would require a separate nullable/required-field audit.

The homepage creates direct-scene projects, WorkspaceShell selects OperationStudio, and OperationStudio sends both generation and editing to `/api/ai/scene`. SceneReview uses the same edit route; `/api/ai/villa/scene` reexports the canonical handler. All receive the corrected contract.

Validation: 67 focused tests pass across 13 files, including homepage regression, provider serialization, relationship/placement, plan, persistence and route tests. TypeScript and lint of the changed source/test pass. Repository-wide lint reports 16 existing errors and five warnings in unrelated scripts. The default Turbopack production build stalled during compilation (idle after more than two minutes) and was stopped; `npx next build --webpack` completed successfully, including TypeScript and static-page generation.

Zero live OpenAI calls, retries, V3 edits, migrations, commits or deployment were performed. Readiness is based on complete local schema and SDK-boundary validation; live provider acceptance has intentionally not been tested.
