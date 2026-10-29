# Redesign construction contract — offline repair

No OpenAI requests were made for this repair. No commits, deployment, database migrations, new agents or construction engines. Existing uncommitted workspace changes were retained.

## Diagnosis of the paid response

The exact original remains at `../redesign-live/provider-response.raw.json`; its SHA-256 is recorded in `developer-study.audit.json`. The original scene remains `../redesign-live/before.json`. No original evidence files were rewritten.

The provider returned one `output_text` message containing only `architecturalPlan`. Missing fields: **name, summary, unsupported, operations**. The raw message is valid, complete JSON; there are no returned operations to salvage, including in alternate message blocks. Its `constructed` knowledge decisions cite nonexistent proposed IDs and do not constitute construction.

The provider-echoed schema requires all four omitted fields; architecturalPlan was optional for edits. Thus the schema did not formally permit concept-only output. However `text.format.strict` was **false**, inherited from the shared legacy provider option for free-form operation payloads. The direct-scene operation union has explicit shapes, so Redesign can use a strict schema independently of those legacy endpoints. The SDK rejected the missing fields correctly. Parsing did not erase valid operations or turn a complete result into a concept.

HTTP 200, provider `status: completed`, `incomplete_details: null`, finish reason `stop`, `truncation: disabled`. Output limit 30,000 tokens; only 3,302 output tokens were consumed (2,439 reasoning, 863 text), versus 11,047 input tokens and 14,349 total. This is not evidence of an output-limit termination. Exactly why the model elected to stop is unknown; prompt causation cannot be established from one response.

The retained prompt already requested construction passes, actual operations and all result fields. No instruction expressly authorized concept-only completion. There was a residual generic “use only targeted operations” edit instruction beneath the Redesign override; that ambiguity is removed. Intent instructions and knowledge descriptions occupied substantial context but did not replace the construction requirement. No retrieval, model, reasoning or token-budget settings were expanded.

Runtime previously allowed an empty edit if accompanied by unsupported text, and used the permissive geometry-result schema after provider parsing, including SDK-error fallback. Consequently provider and runtime mode requirements were not identical. Those paths now share the Redesign runtime contract.

## Minimal functional changes

- Redesign requires architecturalPlan, name, summary, unsupported and 1–800 operations. Concept-only, missing fields, unsupported operations and empty transactions are rejected.
- Redesign rejects finish/terrain-only transactions and transactions that leave the element array unchanged. There is no aesthetic element-count threshold or automatic construction.
- Redesign alone uses `strict: true` on the actual OpenAI response format. Every nested object closes additional properties and requires its keys. Former optional fields are explicit nullable fields on the wire; a schema-guided adapter removes only those optional nulls before existing parsing. It supplies no missing fields, operations or coordinates. Genuine nullable terrain retains its meaning.
- Existing generate/refine provider behavior is preserved. SDK-error fallback cannot weaken the new Redesign requirements. The browser also revalidates operations before saving a version.
- Instructions explicitly sequence evaluation, improved composition and construction in the same response, prioritize concise prose to leave room for geometry, require all fields and forbid stopping after the concept.
- Existing 400-element, 800-operation, panel, geometry, attachment and support budgets, atomic executor, separate version creation, concurrency guards and original preservation remain active. Retries remain zero.

`redesign.response-format.json` is a retained serialization of the corrected response format. The SDK transport tests independently compare it structurally with the actual `wire.text.format.schema` and audit strictness throughout every operation and plan union.

## Reuse of the paid concept

The concept contains enough information for an **interpreted developer construction study**, not a uniquely determined or lossless reconstruction. Explicit concept facts retained: 14 m salon span, 5.2 m salon height, 3.2 m lower owner/guest pavilions, north arrival/gallery, south loggia and retained pool, independent roofs and limestone/timber/bronze palette, removal of the prior overlapping upper composition.

The executor already supports the floors, enclosure, openings, doors, roof sections, columns, shade screens and routes needed for that study. Unsupported curves or a new engine are unnecessary. Coordinates, most widths/depths, opening sizes and route details were absent and are explicit developer choices in `scripts/redesign-construction-proof.ts`. The script creates a separate **developer-authored** response and editable scene; it never modifies the model's raw response or pretends Terra supplied operations. Knowledge dispositions in this authored scene are labelled considered rather than preserving the model's false constructed claims.

The proof executes **76 operations** into **50 elements**, preserves every original pool element exactly and passes existing relationship and JSON reload validation. Its programme remains incomplete: kitchen, bathrooms, services, detailed circulation and engineering are unverified or omitted by the concept. The pool is retained without silently fixing it. Architectural warnings remain in the audit. `developer-study.browser.png` is this developer study, not a successful paid Terra redesign.

## Verification

96 focused tests across 14 files pass: scene route, serialized provider schema, construction, relationships, planning and redesign persistence. Real OpenAI SDK transport is mocked with a placeholder key and in-memory responses; no network provider calls.

Cases include complete operations; concept-only; every missing required field; empty, finish-only and no-change transactions; unknown operations; unsupported shapes; coordinated large redesign with more than 150 elements; optional null normalization; late support failure; exact raw response retention; no retry; unchanged original; and separate version/undo/redo/reload behavior. The existing 174-part study also passes the canonical route.

`npm run typecheck` and focused ESLint pass. Browser evidence is recorded in `browser.json`: homepage recent-project entry → canonical workspace Redesign button → `/api/ai/scene` with mode edit and intent redesign. The mock construction response saves a separate candidate, retains the original, survives undo/redo/reload and renders each editable ID with finite mesh coordinates. A concept-only HTTP 200 mock is rejected client-side without changing any persisted project/version. All AI endpoints are intercepted; external page requests are blocked. The stale local dev server needed restarting before this check.

## Capacity and remaining uncertainty

Substantial executable redesign is demonstrated offline under the existing executor limits. The paid failure had abundant unused output allowance; increasing it is not justified. Operation and element caps do not promise that every worst-case 800-operation response can fit 30,000 output tokens, especially with reasoning and prose. No tokenizer-measured capacity or live latency claim is made.

Actual OpenAI acceptance of the strict schema for this account/model, Terra's instruction adherence, architectural quality, output length and latency remain **unverified live**. Mocks exercise SDK serialization and runtime behavior, not provider-side schema validation or model intelligence. The next paid test, only when separately requested, must verify these. This repair makes concept-only success impossible; it does not guarantee that a future call constructs satisfactory architecture.
