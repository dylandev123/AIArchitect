/** OpenAI strict structured-output compatibility of a serialized JSON schema. Returns human-readable issues. */
const UNSUPPORTED = ['allOf', 'oneOf', 'not', 'if', 'then', 'else', 'patternProperties', 'propertyNames', 'dependentRequired', 'dependentSchemas', 'unevaluatedProperties', 'default'];
export function strictSchemaIssues(schema: unknown): string[] {
  const out: string[] = [];
  const root = schema as Record<string, unknown>;
  if (root?.type !== 'object') out.push('root must be an object');
  const walk = (node: unknown, path: string, depth: number) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach((n, i) => walk(n, `${path}[${i}]`, depth)); return; }
    const n = node as Record<string, unknown>;
    for (const k of UNSUPPORTED) if (k in n) out.push(`${path}: unsupported keyword ${k}`);
    if (n.type === 'object' || 'properties' in n) {
      const props = Object.keys((n.properties as object) ?? {}), req = (n.required as string[]) ?? [];
      if (n.additionalProperties !== false) out.push(`${path}: additionalProperties must be false`);
      for (const p of props) if (!req.includes(p)) out.push(`${path}.${p}: every property must be required`);
    }
    if (depth > 10) out.push(`${path}: nesting deeper than 10`);
    for (const [k, v] of Object.entries(n)) if (typeof v === 'object') walk(v, `${path}.${k}`, depth + (k === 'properties' || k === 'items' ? 1 : 0));
  };
  walk(schema, '$', 0);
  return out;
}
