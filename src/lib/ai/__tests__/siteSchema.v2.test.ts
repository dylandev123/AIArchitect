import { describe, expect, it } from "vitest";
import { z } from "zod";
import { buildGenerationResponseSchema } from "../siteSchema";
import { WORLD_SCOPE } from "../targeting";

/**
 * Confirms the V2 Final Assembly trim (finalAssembly.ts) actually changes what's sent to the model: a V2
 * project's schema must never ask for `house` or the dead legacy shell-decoration ops (compileArchitecture
 * never reads any of them — see finalAssembly.ts's doc comment), while a legacy project's schema must stay
 * byte-for-byte what it always was.
 */
describe("buildGenerationResponseSchema V2 trim", () => {
  function opNames(schema: z.ZodTypeAny): string[] {
    const json = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as { properties?: { operations?: { items?: { properties?: { op?: { enum?: string[] } } } } } };
    return json.properties?.operations?.items?.properties?.op?.enum ?? [];
  }
  function hasHouse(schema: z.ZodTypeAny): boolean {
    const json = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as { properties?: Record<string, unknown> };
    return "house" in (json.properties ?? {});
  }

  it("legacy schema (forV2=false) requires house and offers window/door/dormer/crossGable ops", () => {
    const schema = buildGenerationResponseSchema(WORLD_SCOPE, [], false);
    expect(hasHouse(schema)).toBe(true);
    const ops = opNames(schema);
    expect(ops).toEqual(expect.arrayContaining(["addWindow", "addDoor", "addDormer", "addCrossGable"]));
  });

  it("V2 schema (forV2=true) omits house and every dead legacy shell-decoration op", () => {
    const schema = buildGenerationResponseSchema(WORLD_SCOPE, [], true);
    expect(hasHouse(schema)).toBe(false);
    const ops = opNames(schema);
    expect(ops).not.toEqual(expect.arrayContaining(["addWindow"]));
    expect(ops).not.toEqual(expect.arrayContaining(["addDoor"]));
    expect(ops).not.toEqual(expect.arrayContaining(["addDormer"]));
    expect(ops).not.toEqual(expect.arrayContaining(["addCrossGable"]));
    // Everything else the legacy schema offers is untouched — this is a narrowing, not a redesign.
    expect(ops).toEqual(expect.arrayContaining(["addRoom", "addPool", "addPatio", "addBuilding"]));
  });
});
