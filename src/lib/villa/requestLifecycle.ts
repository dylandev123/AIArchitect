/** Villa-only deadlines. Leave time for retention/assembly and delivery after the provider. */
export const VILLA_PROVIDER_TIMEOUT_MS = 160_000;
export const VILLA_CLIENT_TIMEOUT_MS = 195_000;
export const VILLA_REQUEST_STORAGE_KEY = 'villa-pending-request';
export function villaTransportMessage(error: unknown) {
  const name = error instanceof Error ? error.name : '';
  const reason = name === 'TimeoutError' ? 'The browser stopped waiting for Terra.'
    : name === 'AbortError' ? 'The browser request was cancelled.' : 'The connection to Terra failed.';
  return `${reason} Your current villa is preserved. Check the retained request before generating again; it may already have incurred usage. No automatic retry was made.`;
}
