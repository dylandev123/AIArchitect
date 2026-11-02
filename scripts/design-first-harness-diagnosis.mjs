/** Offline reproduction only: never connect, retrieve knowledge or call a provider. */
import assert from 'node:assert/strict';
import { Client } from 'pg';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const dir = 'docs/architecture/design-first/live-2026-10-30';
globalThis.fetch = async () => { throw Error('Offline diagnosis prohibits network'); };
Client.prototype.connect = function () { throw Error('Offline diagnosis prohibits database connections'); };
const client = new Client({ query_timeout: 0 });
// An unconnected client only queues this query; it sends no SQL.
const returned = client.query('SELECT 1', () => {});
assert.equal(returned, undefined);
let reproduced;
try { returned.catch(() => {}); } catch (error) { reproduced = String(error); }
assert.equal(reproduced, "TypeError: Cannot read properties of undefined (reading 'catch')");
const source = readFileSync('scripts/design-first-experiment.ts', 'utf8');
const recorded = JSON.parse(readFileSync(`${dir}/source-hashes.json`, 'utf8'))['scripts/design-first-experiment.ts'];
assert.equal(createHash('sha256').update(source).digest('hex'), recorded);
const evidence = {
    offline: true, providerCalls: 0, databaseConnections: 0,
    reproduction: reproduced,
    cause: 'The experiment guard assumed every pg query returned a Promise. pg-pool dispatches Client.query with a callback, for which pg returns undefined. Calling .catch on that return throws before knowledge retrieval completes.',
    originalExperimentSourceHashMatches: true,
    architecturalConclusion: 'Not evaluated: neither design nor construction was requested.',
    correctionForFuturePreparation: 'Preserve pg callback overloads and observe errors through callbacks; attach Promise.catch only to Promise-returning overloads. Test Pool-to-Client callback delegation offline before any separately authorized run.',
    rerunAttempted: false,
};
writeFileSync(`${dir}/offline-harness-diagnosis.json`, JSON.stringify(evidence, null, 2), { flag: 'wx', mode: 0o600 });
writeFileSync(`${dir}/experiment-script.as-run.ts`, source, { flag: 'wx', mode: 0o600 });
console.log(JSON.stringify(evidence));
