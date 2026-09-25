/**
 * Fast, dependency-free content hash (cyrb53) of the project JSON text. Used as
 * an optimistic-concurrency token: the client stamps a request with the
 * revision it read, and refuses to apply the AI's result if the live project
 * has moved on. Not cryptographic — it only has to detect edits.
 */
export function revisionOf(jsonText: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < jsonText.length; i++) {
    const ch = jsonText.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}
