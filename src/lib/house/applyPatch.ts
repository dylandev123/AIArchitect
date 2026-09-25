import { FEATURE_JSON_KEY, FEATURE_TYPES } from "./features/featureTypes";

function genApplyId(): string {
  try { return globalThis.crypto.randomUUID(); } catch { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`; }
}

export interface PatchOp {
  op: string;
  value?: Record<string, unknown>;
  fields?: Record<string, unknown>;
  /** Stable id of the target item. Preferred over `index`; resolved against the pre-batch snapshot. */
  id?: string;
  index?: number;
}

export interface ApplyPatchResult {
  json: string;
  errors: string[];
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "Window" -> "windows", "Garage" -> "garages", etc. — derived from the single source of truth. */
const TYPE_NAME_TO_ARRAY_KEY: Record<string, string> = Object.fromEntries(
  FEATURE_TYPES.map((type) => [capitalize(type), FEATURE_JSON_KEY[type]])
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Ops handled as whole-object merges in the first pass, not array add/update/remove. */
const WHOLE_OBJECT_OPS = new Set(["setHouse", "setMaterials", "setExteriorOptions", "setSite"]);

/**
 * Applies a batch of typed patch operations to the project's JSON, touching
 * only the paths the operations name. Update/remove ops address an item by
 * stable `id` (preferred) or by `index`; both are resolved against a snapshot
 * of each array taken before the batch runs, so multiple ops on the same array
 * behave correctly regardless of the order the model emitted them in — there
 * is no progressive index drift.
 */
export function applyPatch(jsonText: string, operations: PatchOp[]): ApplyPatchResult {
  let root: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(jsonText);
    root = isRecord(parsed) ? { ...parsed } : {};
  } catch {
    return { json: jsonText, errors: ["Current project JSON is invalid; cannot apply edits."] };
  }

  const errors: string[] = [];

  for (const op of operations) {
    if (op.op === "setHouse") {
      const house = isRecord(root.house) ? root.house : {};
      root.house = { ...house, ...(op.fields ?? {}) };
    } else if (op.op === "setSite") {
      const site = isRecord(root.site) ? root.site : {};
      root.site = { ...site, ...(op.fields ?? {}) };
    } else if (op.op === "setMaterials") {
      const materials = isRecord(root.materials) ? root.materials : {};
      const fields = isRecord(op.fields) ? op.fields : {};
      const merged: Record<string, unknown> = { ...materials };
      for (const zone of Object.keys(fields)) {
        const zoneFields = fields[zone];
        if (!isRecord(zoneFields)) continue;
        const existingZone = isRecord(merged[zone]) ? merged[zone] : {};
        merged[zone] = { ...existingZone, ...zoneFields };
      }
      root.materials = merged;
    } else if (op.op === "setExteriorOptions") {
      const existing = isRecord(root.exteriorOptions) ? root.exteriorOptions : {};
      const merged: Record<string, unknown> = { ...existing };
      for (const [key, value] of Object.entries(isRecord(op.fields) ? op.fields : {})) {
        if (value === null) delete merged[key];
        else if (value !== undefined) merged[key] = value;
      }
      root.exteriorOptions = merged;
    }
  }

  /** Resolves an op's target to an index in the pre-batch array, or null (error already recorded). */
  const resolveTarget = (op: PatchOp, arrayKey: string): number | null => {
    if (typeof op.id === "string") {
      const arr = Array.isArray(root[arrayKey]) ? (root[arrayKey] as Record<string, unknown>[]) : [];
      const at = arr.findIndex((item) => isRecord(item) && item.id === op.id);
      if (at === -1) {
        errors.push(`${op.op}: no item with id "${op.id}" in "${arrayKey}".`);
        return null;
      }
      return at;
    }
    if (typeof op.index === "number") return op.index;
    errors.push(`${op.op}: missing "id".`);
    return null;
  };

  interface Bucket {
    updates: Map<number, Record<string, unknown>>;
    removes: Set<number>;
    adds: Record<string, unknown>[];
  }
  const byArray = new Map<string, Bucket>();

  for (const op of operations) {
    const match = /^(add|update|remove)([A-Za-z]+)$/.exec(op.op);
    if (!match) {
      if (!WHOLE_OBJECT_OPS.has(op.op)) errors.push(`Unknown operation "${op.op}".`);
      continue;
    }
    const [, action, typeName] = match;
    const arrayKey = TYPE_NAME_TO_ARRAY_KEY[typeName];
    if (!arrayKey) {
      errors.push(`Unknown operation "${op.op}".`);
      continue;
    }

    if (!byArray.has(arrayKey)) byArray.set(arrayKey, { updates: new Map(), removes: new Set(), adds: [] });
    const bucket = byArray.get(arrayKey)!;

    if (action === "add") {
      bucket.adds.push(op.value ?? {});
    } else if (action === "update") {
      const at = resolveTarget(op, arrayKey);
      if (at === null) continue;
      const existing = bucket.updates.get(at) ?? {};
      bucket.updates.set(at, { ...existing, ...(op.fields ?? {}) });
    } else {
      const at = resolveTarget(op, arrayKey);
      if (at === null) continue;
      bucket.removes.add(at);
    }
  }

  for (const [arrayKey, bucket] of byArray) {
    const original = Array.isArray(root[arrayKey]) ? (root[arrayKey] as Record<string, unknown>[]) : [];

    for (const idx of bucket.removes) {
      if (idx < 0 || idx >= original.length) errors.push(`Index ${idx} out of range for "${arrayKey}".`);
    }
    for (const idx of bucket.updates.keys()) {
      if (idx < 0 || idx >= original.length) errors.push(`Index ${idx} out of range for "${arrayKey}".`);
    }

    const next: Record<string, unknown>[] = [];
    original.forEach((item, idx) => {
      if (bucket.removes.has(idx)) return;
      const fields = bucket.updates.get(idx);
      if (fields) {
        // Strip `id` so AI cannot change stable element identifiers.
        const safeFields = { ...fields };
        delete safeFields.id;
        next.push({ ...item, ...safeFields });
      } else {
        next.push(item);
      }
    });
    // Inject stable id for AI-added elements that don't have one.
    for (const item of bucket.adds) {
      next.push("id" in item ? item : { id: genApplyId(), ...item });
    }

    root[arrayKey] = next;
  }

  return { json: JSON.stringify(root, null, 2), errors };
}
