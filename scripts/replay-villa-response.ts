/** Read-only, offline replay. Imports no provider client and never updates a saved villa.
 * Usage: vite-node --config vitest.config.mts scripts/replay-villa-response.ts RESPONSE.json [CURRENT_CONFIG.json]
 * Supply the current configuration only when replaying an edit response.
 */
import { readFileSync } from 'node:fs';
import { resolveVillaResult, villaRequestSchema } from '../src/lib/villa/terra';
import { buildComposition, compositionFindings, compositionSchema } from '../src/lib/villa/composition';

const [responsePath, currentPath] = process.argv.slice(2);
if (!responsePath) throw new Error('Supply a retained .response.json file. Optionally supply the current configuration for an edit.');
try {
  const current = currentPath ? JSON.parse(readFileSync(currentPath, 'utf8')) : undefined;
  const input = villaRequestSchema.parse({ mode: currentPath ? 'edit' : 'generate', prompt: 'Offline replay', ...(currentPath ? { current } : {}) });
  const result = resolveVillaResult(input, JSON.parse(readFileSync(responsePath, 'utf8')));
  const built = 'version' in result.config ? buildComposition(compositionSchema.parse(result.config)) : undefined;
  console.log(JSON.stringify({ accepted: true, providerCalls: 0, ...result, ...(built ? { construction: { buildingWings: built.wings.filter(w => w.role !== 'gallery').length, derivedWings: built.wings.length } } : {}) }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ accepted: false, providerCalls: 0, findings: compositionFindings(error), ...(error instanceof SyntaxError ? { error: error.message } : {}) }, null, 2));
  process.exitCode = 1;
}
