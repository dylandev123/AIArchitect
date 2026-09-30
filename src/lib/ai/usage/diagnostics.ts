import { createHash } from "node:crypto";

/** Pure helpers for the diagnostic fields of a usage record: fingerprints and size bounds, never full prompts or reasoning. */
export const DIAGNOSTIC_MAX_CHARS = 2_000;
export const CANDIDATE_MAX_CHARS = 32_000;

/** Short, stable content fingerprint (sha256 prefix) — identifies a prompt/output without storing it. */
export const fingerprint = (text: string): string => createHash("sha256").update(text).digest("hex").slice(0, 16);

export const bounded = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…[+${text.length - max} chars]` : text);
export const boundedDiagnostic = (text: string) => bounded(text, DIAGNOSTIC_MAX_CHARS);
/** A rejected structured candidate as bounded JSON, or undefined when there is none. */
export function boundedCandidate(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  try { return bounded(JSON.stringify(value), CANDIDATE_MAX_CHARS); } catch { return undefined; }
}
