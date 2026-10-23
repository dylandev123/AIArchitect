// Test-process preload only. No application code imports this module.
// Return fixture text at the provider transport boundary, retaining the real
// production model adapter, SDK parsing and route. Never contact a provider.
import { readFileSync, appendFileSync } from 'node:fs';
import net from 'node:net';
import { syncBuiltinESMExports } from 'node:module';

const inputs = JSON.parse(process.env.OFFLINE_BLUEPRINT_INPUTS || '[]');
if (!inputs.length || !process.env.OFFLINE_BLUEPRINT_LOG) throw Error('Offline inputs and log are required');
const outputs = inputs.map(file => readFileSync(file, 'utf8'));
// Keep malformed/truncated fixtures intact to exercise SDK parse failures too.
// Defined empty values prevent Next's env-file loader from using real credentials.
for (const key of ['DATABASE_URL', 'POSTGRES_URL', 'VERCEL', 'OPENAI_ORG_ID', 'OPENAI_PROJECT_ID']) process.env[key] = '';
process.env.OPENAI_API_KEY = 'offline-placeholder-never-sent';
process.env.AI_V3_ARCHITECTURAL_BLUEPRINT = '1';
process.env.AI_V3_BLUEPRINT_FIRST = '0';
process.env.NEXT_TELEMETRY_DISABLED = '1';
const record = value => appendFileSync(process.env.OFFLINE_BLUEPRINT_LOG, JSON.stringify(value) + '\n');
const loopback = host => ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host);
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const options = Array.isArray(args[0]) ? args[0][0] : args[0];
  const host = typeof options === 'object' ? options.host : typeof args[1] === 'string' ? args[1] : 'localhost';
  if (host && !loopback(host)) { record({ blockedSocket: host }); throw Error('Offline replay forbids external sockets'); }
  return connect.apply(this, args);
};
syncBuiltinESMExports();
const originalFetch = globalThis.fetch;
let calls = 0;
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (url.origin === 'https://api.openai.com' && url.pathname === '/v1/responses') {
    const request = JSON.parse(init?.body || '{}');
    const index = calls++;
    record({ mockedProviderResponse: index, fixture: inputs[index], model: request.model, maxOutputTokens: request.max_output_tokens, format: request.text?.format?.type });
    if (!outputs[index]) throw Error('Unexpected extra authoring/repair call');
    if (request.max_output_tokens !== 10000) throw Error('Unexpected production token budget');
    return Response.json({
      id: `offline-${index}`, model: request.model, created_at: 1, status: 'completed',
      output: [{ type: 'message', id: `offline-message-${index}`, role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: outputs[index], annotations: [] }] }],
      usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
    });
  }
  if (!loopback(url.hostname)) { record({ blockedFetch: url.origin + url.pathname }); throw Error('Offline replay forbids external fetch'); }
  return originalFetch(input, init);
};
