import { VILLA_CLIENT_TIMEOUT_MS, villaTransportMessage } from './requestLifecycle';

/** Single attempt only. Recovery uses GET, never replays a paid POST. */
export async function fetchVillaRequest(input: unknown, requestId: string) {
  let response: Response;
  try {
    response = await fetch('/api/ai/villa', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Villa-Request-ID': requestId }, body: JSON.stringify(input), signal: AbortSignal.timeout(VILLA_CLIENT_TIMEOUT_MS) });
  } catch (error) { throw new Error(villaTransportMessage(error)); }
  return readVillaReply(response);
}
export async function recoverVillaRequest(requestId: string) {
  let response: Response;
  try { response = await fetch(`/api/ai/villa?requestId=${encodeURIComponent(requestId)}`, { cache: 'no-store', signal: AbortSignal.timeout(15_000) }); }
  catch (error) { throw new Error(villaTransportMessage(error)); }
  return readVillaReply(response);
}
async function readVillaReply(response: Response) {
  let body;
  try { body = await response.json(); }
  catch (error) {
    if (error instanceof Error && ['AbortError', 'TimeoutError', 'TypeError'].includes(error.name)) throw new Error(villaTransportMessage(error));
    throw new Error(`Terra returned an unreadable server response (${response.status}). Your current villa is preserved. Check the retained request; no automatic retry was made.`); }
  if (!response.ok || response.status === 202) throw new Error([typeof body.error === 'string' ? body.error : `Terra server failure (${response.status}). Your current villa is preserved. No automatic retry was made.`, ...(body.findings ?? []).map((f: { path: string; message: string }) => `${Array.isArray(f.path) ? f.path.join('.') : f.path}: ${f.message}`)].join('\n'));
  return body;
}
