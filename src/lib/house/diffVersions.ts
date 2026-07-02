export interface FieldChange {
  field: string;
  before: unknown;
  after: unknown;
}

export interface ArrayItemChange {
  index: number;
  type: "added" | "removed" | "changed";
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  fieldChanges?: FieldChange[];
}

export interface SectionDiff {
  key: string;
  label: string;
  items: ArrayItemChange[];
}

export interface VersionDiff {
  houseChanges: FieldChange[];
  sections: SectionDiff[];
}

const SECTIONS: { key: string; label: string }[] = [
  { key: "windows", label: "Windows" },
  { key: "doors", label: "Doors" },
  { key: "garages", label: "Garages" },
  { key: "balconies", label: "Balconies" },
  { key: "patios", label: "Patios" },
  { key: "pools", label: "Pools" },
  { key: "driveways", label: "Driveways" },
];

function diffFields(before: Record<string, unknown>, after: Record<string, unknown>): FieldChange[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes: FieldChange[] = [];
  for (const field of keys) {
    if (JSON.stringify(before[field]) !== JSON.stringify(after[field])) {
      changes.push({ field, before: before[field], after: after[field] });
    }
  }
  return changes;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

/** Structural diff between two site JSON snapshots: which house fields and which feature items changed. */
export function diffVersions(beforeJson: string, afterJson: string): VersionDiff | null {
  let before: Record<string, unknown>;
  let after: Record<string, unknown>;
  try {
    before = asRecord(JSON.parse(beforeJson));
    after = asRecord(JSON.parse(afterJson));
  } catch {
    return null;
  }

  const houseChanges = diffFields(asRecord(before.house), asRecord(after.house));

  const sections: SectionDiff[] = SECTIONS.map(({ key, label }) => {
    const beforeArr = asArray(before[key]);
    const afterArr = asArray(after[key]);
    const maxLen = Math.max(beforeArr.length, afterArr.length);
    const items: ArrayItemChange[] = [];

    for (let i = 0; i < maxLen; i++) {
      const b = beforeArr[i];
      const a = afterArr[i];
      if (b && !a) {
        items.push({ index: i, type: "removed", before: b });
      } else if (!b && a) {
        items.push({ index: i, type: "added", after: a });
      } else if (b && a) {
        const fieldChanges = diffFields(b, a);
        if (fieldChanges.length > 0) {
          items.push({ index: i, type: "changed", before: b, after: a, fieldChanges });
        }
      }
    }
    return { key, label, items };
  });

  return { houseChanges, sections };
}

export function summarizeItem(item: Record<string, unknown> | undefined): string {
  if (!item) return "";
  const parts: string[] = [];
  if (typeof item.wall === "string") parts.push(`${item.wall} wall`);
  if (typeof item.offset === "number") parts.push(`offset ${item.offset}m`);
  if (typeof item.level === "number") parts.push(`level ${item.level}`);
  return parts.length > 0 ? parts.join(", ") : "item";
}
