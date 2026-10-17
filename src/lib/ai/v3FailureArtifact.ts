import { createHash, randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const V3_FAILURE_ARTIFACT_MAX_BYTES = 1024 * 1024;
const sensitiveKey = /^(?:headers?|.*(?:authorization|cookie|password|secret|token|api[-_]?key)|prompt|brief|messages?|history|email|phone|address)$/i;

/** Preserve original JSON text/formatting except sensitive values, including truncated JSON. */
export function redactV3FailureText(raw: string): string {
  const keys = /"((?:\\.|[^"\\])*)"\s*:/g;
  let match: RegExpExecArray | null;
  let cursor = 0;
  let result = "";
  while ((match = keys.exec(raw))) {
    let key: string;
    try { key = JSON.parse(`"${match[1]}"`); } catch { continue; }
    if (!sensitiveKey.test(key)) continue;
    let end = keys.lastIndex;
    while (/\s/.test(raw[end] ?? "") && end < raw.length) end++;
    const start = end;
    let depth = 0;
    let quoted = false;
    for (; end < raw.length; end++) {
      const char = raw[end];
      if (quoted) {
        if (char === "\\") end++;
        else if (char === '"') { quoted = false; if (!depth) { end++; break; } }
      } else if (char === '"') quoted = true;
      else if (char === "{" || char === "[") depth++;
      else if (char === "}" || char === "]") { if (!depth) break; if (--depth === 0) { end++; break; } }
      else if (!depth && char === ",") break;
    }
    result += raw.slice(cursor, start) + '"[REDACTED]"';
    cursor = end;
    keys.lastIndex = end;
  }
  let safe = result + raw.slice(cursor);
  // Also remove credentials echoed in ordinary strings or malformed non-JSON output.
  for (const [key, value] of Object.entries(process.env)) {
    if (/(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)/i.test(key) && value && value.length >= 8) {
      safe = safe.split(value).join("[REDACTED]");
    }
  }
  return safe.replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[REDACTED]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED_EMAIL]");
}

/** What the pipeline concluded about this attempt. Everything here is derived server-side data, never request content. */
export interface V3FailureDiagnostics {
  terrainMode?: "flat" | "advanced";
  decision: "repair-requested" | "rejected";
  errors: string[];
  warnings: string[];
  /** Normalization/repair notes, including every omission (`*_OMITTED`) with its reason. */
  notes: { code: string; targetId: string; message: string }[];
  omitted: { targetId: string; code: string; message: string }[];
  normalizedScene?: unknown;
}

/** Server-only, best effort. Two fixed slots bound total retention to 2 MiB. Never returned to clients. */
export async function retainV3FailureArtifact(raw: string | undefined, attempt: 0 | 1, phase: "ingestion" | "structured-output", diagnostics?: V3FailureDiagnostics) {
  if (process.env.NODE_ENV !== "development" || raw === undefined) return;
  let temporary: string | undefined;
  try {
    const safe = redactV3FailureText(raw);
    const artifact = {
      version: 2, capturedAt: new Date().toISOString(), attempt, phase,
      source: "provider-output", originalBytes: Buffer.byteLength(raw),
      redacted: safe !== raw, sha256: createHash("sha256").update(raw).digest("hex"),
      omittedForSize: false, rawResponse: safe,
      ...(diagnostics ? { diagnostics: JSON.parse(redactV3FailureText(JSON.stringify(diagnostics))) } : {}),
    };
    let serialized = JSON.stringify(artifact, null, 2);
    if (Buffer.byteLength(serialized) > V3_FAILURE_ARTIFACT_MAX_BYTES && artifact.diagnostics?.normalizedScene !== undefined) {
      // The normalized scene is reproducible from rawResponse; drop it before ever dropping the replay input.
      serialized = JSON.stringify({ ...artifact, diagnostics: { ...artifact.diagnostics, normalizedScene: null, normalizedSceneOmittedForSize: true } }, null, 2);
    }
    if (Buffer.byteLength(serialized) > V3_FAILURE_ARTIFACT_MAX_BYTES) {
      // Never pretend a truncated preview is an exact replay fixture.
      serialized = JSON.stringify({ ...artifact, omittedForSize: true, rawResponse: null }, null, 2);
    }
    const directory = path.join(process.cwd(), ".v3-debug");
    await mkdir(directory, { mode: 0o700, recursive: true });
    const stat = await lstat(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) return;
    await chmod(directory, 0o700);
    temporary = path.join(directory, `${randomUUID()}.tmp`);
    await writeFile(temporary, serialized, { mode: 0o600, flag: "wx" });
    await rename(temporary, path.join(directory, `failed-attempt-${attempt}.json`));
  } catch {
    // Diagnostics must never change generation/repair behavior or log raw errors.
  } finally {
    if (temporary) await unlink(temporary).catch(() => {});
  }
}

/** One fixed development-only slot, independent of failure replay slots. Never a client payload. */
export async function retainV3RevisionArtifact(input: {
  initialScene: unknown; revisedScene?: unknown; targetedFindings: unknown;
  initialAuthoredScene?: unknown; revisedAuthoredScene?: unknown;
  accepted: boolean; reasons: string[]; changedPaths?: string[];
}) {
  if (process.env.NODE_ENV !== 'development') return;
  let temporary: string | undefined;
  try {
    const redacted = JSON.parse(redactV3FailureText(JSON.stringify(input)));
    let serialized = JSON.stringify({ version: 1, capturedAt: new Date().toISOString(), ...redacted });
    if (Buffer.byteLength(serialized) > V3_FAILURE_ARTIFACT_MAX_BYTES) serialized = JSON.stringify({ version: 1, accepted: input.accepted, snapshotsOmittedForSize: true, reasons: redacted.reasons?.slice(0,32), targetedFindings: redacted.targetedFindings });
    if (Buffer.byteLength(serialized) > V3_FAILURE_ARTIFACT_MAX_BYTES) serialized = JSON.stringify({ version: 1, accepted: input.accepted, omittedForSize: true });
    const directory = path.join(process.cwd(), '.v3-debug');
    await mkdir(directory, { mode: 0o700, recursive: true });
    const stat = await lstat(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) return;
    await chmod(directory, 0o700);
    temporary = path.join(directory, `${randomUUID()}.tmp`);
    await writeFile(temporary, serialized, { mode: 0o600, flag: 'wx' });
    await rename(temporary, path.join(directory, 'revision-latest.json'));
  } catch { /* Best-effort diagnostics must never change fallback behavior. */ }
  finally { if (temporary) await unlink(temporary).catch(() => {}); }
}
