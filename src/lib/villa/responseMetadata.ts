/** Display copy only. Never walk the architecture or normalize IDs, builders or enums. */
export const VILLA_TEXT_LIMITS = { name: 80, character: 160, summary: 600, unsupported: 200 } as const;
export const CHARACTER_MAX_LENGTH = VILLA_TEXT_LIMITS.character;
export const UNSUPPORTED_COPY_FALLBACK = 'Terra returned an unreadable unsupported-feature explanation. Review the retained response for details.';

export function truncateDisplayText(value: string, limit: number): string {
  if (value.length <= limit) return value;
  const prefix = value.slice(0, limit);
  // Keep a word ending exactly at the limit; otherwise remove its partial tail.
  if (/\s/u.test(value[limit])) return prefix.trimEnd();
  const boundary = prefix.search(/\s+\S*$/u);
  if (boundary > 0) return prefix.slice(0, boundary);
  // A single long token has no word boundary. Do not split a surrogate pair.
  return prefix.replace(/[\uD800-\uDBFF]$/u, '').trimEnd();
}
export const truncateCharacter = (value: string) => truncateDisplayText(value, CHARACTER_MAX_LENGTH);

function copy(value: unknown, limit: number, fallback: string): string {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  const text = truncateDisplayText(value, limit);
  return text.trim() ? text : fallback;
}
function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeVillaResponse(output: unknown, mode: 'generate' | 'edit' = 'generate'): unknown {
  if (!record(output)) return output;
  const normalized = {
    ...output,
    summary: copy(output.summary, VILLA_TEXT_LIMITS.summary, 'Villa configuration received.'),
    // Preserve every warning, including overflow beyond the provider's eight-item guidance.
    // Malformed warnings stay visible instead of implying that everything is supported.
    unsupported: output.unsupported == null ? [] : (Array.isArray(output.unsupported) ? output.unsupported : [output.unsupported])
      .map(value => copy(value, VILLA_TEXT_LIMITS.unsupported, UNSUPPORTED_COPY_FALLBACK)),
  };
  // Name and character exist only on full generated compositions. A patch cannot rename
  // architecture; extra patch fields must still fail the strict contract.
  if (mode === 'generate' && record(output.changes)) return {
    ...normalized,
    changes: {
      ...output.changes,
      name: copy(output.changes.name, VILLA_TEXT_LIMITS.name, 'Untitled villa'),
      character: copy(output.changes.character, VILLA_TEXT_LIMITS.character, 'A villa designed for its setting.'),
    },
  };
  return normalized;
}
