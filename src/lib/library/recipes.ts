import { z } from "zod";
import { PROJECT_SCALES } from "@/lib/house/scale";
import { RECIPE_APPROVALS, RECIPE_CATEGORIES, type DesignRecipe, type RecipeParameter } from "@/types/library";
import type { SiteEnvironment } from "@/types/house";

const ENVIRONMENTS = ["countryside", "beach", "cliff", "hillside", "farm", "forest", "suburban", "urban"] as const satisfies readonly SiteEnvironment[];

const tag = z.string().trim().toLowerCase().min(1).max(40);

const parameterSchema = z
  .object({
    key: z.string().trim().min(1).max(60),
    label: z.string().max(80).optional(),
    unit: z.string().max(20).optional(),
    value: z.union([z.number(), z.string().max(80), z.boolean()]),
    min: z.number().optional(),
    max: z.number().optional(),
    options: z.array(z.string().max(60)).max(20).optional(),
  })
  .refine((p) => p.min === undefined || p.max === undefined || p.min <= p.max, { message: "min must not exceed max" })
  .refine((p) => typeof p.value !== "number" || ((p.min === undefined || p.value >= p.min) && (p.max === undefined || p.value <= p.max)), {
    message: "value must lie within min/max",
  });

/** What an admin (or a Learn proposal) supplies; ids, counters, timestamps and approval are assigned by the store. */
export const recipeInputSchema = z.object({
  name: z.string().trim().min(3).max(80),
  category: z.enum(RECIPE_CATEGORIES),
  styleTags: z.array(tag).max(10).default([]),
  compatibleScales: z.array(z.enum(PROJECT_SCALES)).max(5).default([]),
  environmentTags: z.array(z.enum(ENVIRONMENTS)).max(8).default([]),
  parameters: z.array(parameterSchema).max(40).default([]),
  relationships: z
    .array(z.object({ kind: z.enum(["requires", "prefers", "conflicts"]), target: z.string().trim().min(1).max(60), note: z.string().max(200).optional() }))
    .max(20)
    .default([]),
  guidance: z.array(z.string().trim().min(1).max(240)).max(20).default([]),
  origin: z.object({ kind: z.enum(["admin", "learn", "generation"]), projectId: z.string().max(64).optional() }).optional(),
});

export type RecipeInput = z.infer<typeof recipeInputSchema>;

/** A new recipe always starts "proposed": nothing is reusable globally until an admin approves it. */
export function createRecipe(input: RecipeInput, now: Date = new Date(), id: string = crypto.randomUUID()): DesignRecipe {
  const at = now.toISOString();
  return {
    ...input,
    id,
    usageCount: 0,
    successCount: 0,
    failureCount: 0,
    approval: "proposed",
    version: 1,
    created_at: at,
    updated_at: at,
  };
}

/** Editing a recipe's substance bumps its version; approval state and counters are unaffected by an edit. */
export function updateRecipe(recipe: DesignRecipe, input: RecipeInput, now: Date = new Date()): DesignRecipe {
  return { ...recipe, ...input, version: recipe.version + 1, updated_at: now.toISOString() };
}

export function setRecipeApproval(recipe: DesignRecipe, approval: DesignRecipe["approval"], now: Date = new Date()): DesignRecipe {
  return { ...recipe, approval, updated_at: now.toISOString() };
}

export const isRecipeApproval = (v: unknown): v is DesignRecipe["approval"] => typeof v === "string" && (RECIPE_APPROVALS as readonly string[]).includes(v);

/**
 * Records that generation used a recipe ("pending", counted once at the start) and how the design turned out
 * ("success" / "failure", counted once at the end), so a recipe's history reflects designs that were accepted.
 */
export function recordRecipeUse(recipe: DesignRecipe, outcome: "success" | "failure" | "pending"): DesignRecipe {
  return {
    ...recipe,
    usageCount: recipe.usageCount + (outcome === "pending" ? 1 : 0),
    successCount: recipe.successCount + (outcome === "success" ? 1 : 0),
    failureCount: recipe.failureCount + (outcome === "failure" ? 1 : 0),
  };
}

function formatParam(p: RecipeParameter): string {
  const unit = p.unit ? ` ${p.unit}` : "";
  const range =
    p.min !== undefined || p.max !== undefined ? ` (range ${p.min ?? "…"}–${p.max ?? "…"}${unit})` : p.options?.length ? ` (one of ${p.options.join("/")})` : "";
  return `${p.label ?? p.key}: ${String(p.value)}${range ? "" : unit}${range}`;
}

/** Prompt text for the recipes generation will lean on. Empty when there are none, so a bare library changes nothing. */
export function describeRecipesForPrompt(recipes: readonly DesignRecipe[]): string {
  if (recipes.length === 0) return "";
  const blocks = recipes.map((r) => {
    const lines = [`- ${r.name} (${r.category}${r.styleTags.length ? `, ${r.styleTags.join("/")}` : ""})`];
    for (const g of r.guidance) lines.push(`    • ${g}`);
    for (const p of r.parameters) lines.push(`    • ${formatParam(p)}`);
    for (const rel of r.relationships) lines.push(`    • ${rel.kind} ${rel.target}${rel.note ? ` — ${rel.note}` : ""}`);
    return lines.join("\n");
  });
  return `═══ PROVEN DESIGN PATTERNS ═══

These approved patterns worked on earlier projects that match this brief. Prefer them over inventing a composition, adapt their parameters only within the stated ranges, and ignore any that clash with the brief. They guide the design; you still output only the operations and catalog values described elsewhere.
${blocks.join("\n")}`;
}

// ── Text form for the admin editor ───────────────────────────────────────────

/** `pitch: 32 [28..36] deg`, `roof: hip {hip|gable|mansard}`, `spa: true` — one parameter per line. */
export function parseParameterLines(text: string): { params: RecipeParameter[]; errors: string[] } {
  const params: RecipeParameter[] = [];
  const errors: string[] = [];
  for (const [i, raw] of text.split("\n").entries()) {
    const line = raw.trim();
    if (!line) continue;
    const m = /^([A-Za-z][\w.-]*)\s*:\s*(.*)$/.exec(line);
    if (!m) {
      errors.push(`Line ${i + 1}: expected "key: value".`);
      continue;
    }
    let rest = m[2];
    const range = /\[\s*(-?\d+(?:\.\d+)?)\s*\.\.\s*(-?\d+(?:\.\d+)?)\s*\]/.exec(rest);
    if (range) rest = rest.replace(range[0], " ");
    const options = /\{([^}]*)\}/.exec(rest);
    if (options) rest = rest.replace(options[0], " ");
    const [valueText, unit] = rest.trim().split(/\s+/);
    if (!valueText) {
      errors.push(`Line ${i + 1}: missing value.`);
      continue;
    }
    const value: RecipeParameter["value"] = valueText === "true" ? true : valueText === "false" ? false : Number.isFinite(Number(valueText)) ? Number(valueText) : valueText;
    params.push({
      key: m[1],
      value,
      ...(range ? { min: Number(range[1]), max: Number(range[2]) } : {}),
      ...(options ? { options: options[1].split("|").map((o) => o.trim()).filter(Boolean) } : {}),
      ...(unit ? { unit } : {}),
    });
  }
  return { params, errors };
}

export function formatParameterLines(params: readonly RecipeParameter[]): string {
  return params
    .map((p) => `${p.key}: ${String(p.value)}${p.min !== undefined && p.max !== undefined ? ` [${p.min}..${p.max}]` : ""}${p.options?.length ? ` {${p.options.join("|")}}` : ""}${p.unit ? ` ${p.unit}` : ""}`)
    .join("\n");
}

/** `requires: pool-bar — within 6 m of the pool edge`; kind defaults to "prefers". */
export function parseRelationshipLines(text: string): DesignRecipe["relationships"] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const m = /^(requires|prefers|conflicts)\s*:\s*([^—]+?)(?:\s+—\s+(.*))?$/i.exec(line);
      return m
        ? { kind: m[1].toLowerCase() as "requires" | "prefers" | "conflicts", target: m[2].trim(), ...(m[3] ? { note: m[3].trim() } : {}) }
        : { kind: "prefers" as const, target: line };
    });
}

export function formatRelationshipLines(rels: DesignRecipe["relationships"]): string {
  return rels.map((r) => `${r.kind}: ${r.target}${r.note ? ` — ${r.note}` : ""}`).join("\n");
}
