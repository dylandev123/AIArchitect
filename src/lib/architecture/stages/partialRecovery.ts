import type { z } from "zod";

/**
 * Salvages whichever top-level fields of a flat zod object schema are individually valid on a raw,
 * not-fully-valid value — instead of discarding the whole response because one field (e.g. an off-vocabulary
 * enum string) failed. Used by stages whose fallback must default only what's actually missing/invalid
 * rather than replacing an entire valid-but-imperfect model response with a generic default.
 */
export function recoverFields<Shape extends Record<string, z.ZodTypeAny>>(
  shape: Shape,
  raw: unknown
): { recovered: Partial<{ [K in keyof Shape]: z.infer<Shape[K]> }>; recoveredKeys: string[]; defaultedKeys: string[] } {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const recovered: Record<string, unknown> = {};
  const recoveredKeys: string[] = [];
  const defaultedKeys: string[] = [];
  for (const key of Object.keys(shape)) {
    // An absent optional field parses fine but was never actually salvaged from the model — it's a default.
    if (source[key] === undefined) { defaultedKeys.push(key); continue; }
    const parsed = shape[key].safeParse(source[key]);
    if (parsed.success) {
      recovered[key] = parsed.data;
      recoveredKeys.push(key);
    } else {
      defaultedKeys.push(key);
    }
  }
  return { recovered: recovered as Partial<{ [K in keyof Shape]: z.infer<Shape[K]> }>, recoveredKeys, defaultedKeys };
}
