import { FEATURE_LABEL, type FeatureType } from "@/lib/house/features/featureTypes";

export type ScopeKind = "house" | "materials" | "feature" | "full";

export interface EditScope {
  kind: ScopeKind;
  featureType?: FeatureType;
  label: string;
  /** Non-empty = only these op names are permitted. Empty = no restriction. */
  allowedOps: string[];
}

export const FULL_SCOPE: EditScope = { kind: "full", label: "Everything", allowedOps: [] };

function featureOpNames(t: FeatureType): string[] {
  const cap = t.charAt(0).toUpperCase() + t.slice(1);
  return [`add${cap}`, `update${cap}`, `remove${cap}`];
}

export function makeScopeForFeature(featureType: FeatureType): EditScope {
  return {
    kind: "feature",
    featureType,
    label: FEATURE_LABEL[featureType],
    allowedOps: featureOpNames(featureType),
  };
}

type Rule = { pattern: RegExp; kind: ScopeKind; featureType?: FeatureType; label: string };

const RULES: Rule[] = [
  { pattern: /\b(garage|carport|car\s+port)\b/i,                              kind: "feature", featureType: "garage",    label: "Garage" },
  { pattern: /\b(window|glazing|fenestration)\b/i,                             kind: "feature", featureType: "window",    label: "Windows" },
  { pattern: /\b(door|entrance|entryway)\b/i,                                  kind: "feature", featureType: "door",      label: "Doors" },
  { pattern: /\b(pool|swimming\s+pool|infinity\s+pool)\b/i,                    kind: "feature", featureType: "pool",      label: "Pool" },
  { pattern: /\b(patio|terrace)\b/i,                                           kind: "feature", featureType: "patio",     label: "Patio" },
  { pattern: /\b(balcony|balcon|deck)\b/i,                                     kind: "feature", featureType: "balcony",   label: "Balcony" },
  { pattern: /\bdriveway\b/i,                                                   kind: "feature", featureType: "driveway",  label: "Driveway" },
  { pattern: /\b(bedroom|bathroom|kitchen|living\s+room|dining|office|hallway|laundry|room)\b/i, kind: "feature", featureType: "room", label: "Rooms" },
  { pattern: /\b(garden|lawn|landscape|trees?|plants?|shrubs?)\b/i,            kind: "feature", featureType: "landscape", label: "Landscaping" },
  { pattern: /\b(villa|resort|hotel|restaurant|reception)\b/i,                 kind: "feature", featureType: "building",  label: "Buildings" },
  { pattern: /\b(road|street|path)\b/i,                                        kind: "feature", featureType: "road",      label: "Roads" },
  { pattern: /\b(parking|car\s+park)\b/i,                                      kind: "feature", featureType: "parking",   label: "Parking" },
  { pattern: /\b(material|paint|stucco|concrete|stone|wood|metal|tile|facade|colour|color)\b/i, kind: "materials", label: "Materials" },
  { pattern: /\b(roof|roofing|ridge|gable|hip|flat\s+roof)\b/i,                kind: "house",   label: "Roof" },
  { pattern: /\b(floor|floors?|storey|stories|width|depth|footprint|bigger|wider|taller|smaller)\b/i, kind: "house", label: "House Structure" },
];

function buildScope(r: Rule): EditScope {
  if (r.kind === "materials") return { kind: "materials", label: r.label, allowedOps: ["setMaterials"] };
  if (r.kind === "house") return { kind: "house", label: r.label, allowedOps: ["setHouse", "setMaterials"] };
  if (r.featureType) return { kind: "feature", featureType: r.featureType, label: r.label, allowedOps: featureOpNames(r.featureType) };
  return FULL_SCOPE;
}

export function classifyPromptTarget(prompt: string): EditScope {
  const hits = RULES.filter(r => r.pattern.test(prompt))
    .filter((r, i, arr) => arr.findIndex(x => x.kind === r.kind && x.featureType === r.featureType) === i);

  if (hits.length === 0) return FULL_SCOPE;
  if (hits.length === 1) return buildScope(hits[0]);

  const kinds = new Set(hits.map(h => h.kind));
  const features = new Set(hits.filter(h => h.featureType).map(h => h.featureType));

  if (kinds.size === 1 && features.size <= 1) return buildScope(hits[0]);
  if (kinds.size === 2 && kinds.has("house") && kinds.has("materials")) {
    return { kind: "full", label: "House + Materials", allowedOps: ["setHouse", "setMaterials"] };
  }
  return FULL_SCOPE;
}

export function validateOpsForScope(ops: { op: string }[], scope: EditScope): string[] {
  if (!scope.allowedOps.length) return [];
  return ops
    .filter(o => !scope.allowedOps.includes(o.op))
    .map(o => `"${o.op}" is out of scope for "${scope.label}"`);
}

export function buildScopeInstruction(scope: EditScope): string {
  if (!scope.allowedOps.length) return "";
  return `═══ SCOPE CONSTRAINT ═══
Target: ${scope.label}
Allowed ops: ${scope.allowedOps.join(", ")}
Do NOT emit any other operation types.`;
}
