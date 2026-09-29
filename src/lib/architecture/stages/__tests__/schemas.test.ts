import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { asSchema } from "ai";
import { foundationStageOutputSchema, massExpansionStageOutputSchema, roofCompositionStageOutputSchema } from "../schemas";

function expectObjectRootSchema(schema: z.ZodType) {
  const jsonSchema = asSchema(schema).jsonSchema as { type?: unknown; oneOf?: unknown; anyOf?: unknown; properties?: unknown };
  expect(jsonSchema.type).toBe("object");
  expect(jsonSchema.oneOf).toBeUndefined();
  expect(jsonSchema.anyOf).toBeUndefined();
  expect(jsonSchema.properties).toBeTruthy();
}

/**
 * `asSchema(...).jsonSchema` is exactly what `runStage`'s `Output.object({ schema })` sends the provider
 * (see `@ai-sdk/provider-utils`'s `zod4Schema`, which converts via `z.toJSONSchema`). OpenAI's structured
 * outputs (`response_format: "json_schema"`) require the ROOT of that schema to be `type: "object"`. A
 * top-level `z.discriminatedUnion` compiles to a root `oneOf` with no top-level `type` at all — which the
 * provider rejects with "schema must be a JSON Schema of 'type: \"object\"', got 'type: \"None\"'" — so this
 * guards every stage schema actually sent to the provider, not just mass expansion's.
 */
describe("stage schemas compile to a provider-valid root JSON Schema", () => {
  it("massExpansionStageOutputSchema has a root type of \"object\", not a union", () => {
    expectObjectRootSchema(massExpansionStageOutputSchema);
  });

  it("foundationStageOutputSchema has a root type of \"object\"", () => {
    expectObjectRootSchema(foundationStageOutputSchema);
  });

  it("roofCompositionStageOutputSchema has a root type of \"object\"", () => {
    expectObjectRootSchema(roofCompositionStageOutputSchema);
  });

  it("mass expansion's add-only fields are optional in the wire schema, conditionally required only via local superRefine", () => {
    const jsonSchema = asSchema(massExpansionStageOutputSchema).jsonSchema as { required?: string[] };
    // Only "decision" is unconditionally required at the wire level — "mass"/"relationships"/"reasoning"
    // being required only when decision === "add" is enforced by superRefine, not the JSON Schema shape,
    // since conditional requirements can't be expressed as a flat `required` array without reintroducing a
    // union (and the non-object root that comes with it).
    expect(jsonSchema.required).toEqual(["decision"]);
  });

  it("still rejects an \"add\" decision missing its required fields once parsed locally", () => {
    expect(massExpansionStageOutputSchema.safeParse({ decision: "add" }).success).toBe(false);
    expect(massExpansionStageOutputSchema.safeParse({ decision: "done" }).success).toBe(true);
    expect(
      massExpansionStageOutputSchema.safeParse({
        decision: "add",
        reasoning: "Adds a bedroom wing.",
        mass: { name: "Wing", role: "bedroom-wing", width: 8, depth: 6, floors: 1 },
        relationships: [{ kind: "adjacent-to", target: "mass-0", side: "east" }],
      }).success
    ).toBe(true);
  });
});
