// Offline, read-only: replays the retained Terra mansion proposal through the current compiler and
// classifies every remaining finding. Also runs one clearly labelled ALTERED COPY (omitted heights)
// as a diagnostic of what height derivation alone resolves. The altered copy is not a Terra output.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { compileArchitecturalPlan, type ArchitecturalPlan } from '../src/lib/villa/canonical/plan';
const SOURCE = 'docs/architecture/canonical-corrected-mansion-2026-11-02/proposal.normalized.json';
const OUT = 'docs/architecture/canonical-spatial-authority-2026-11-02';
const run = (plan: ArchitecturalPlan) => { try { compileArchitecturalPlan(plan); return []; } catch (e) { return (e as { decisions?: string[] }).decisions ?? [String(e)]; } };
const classify = (d: string) =>
  d.includes('occupied volumes overlap') ? { class: 'model-authored contradiction', cause: 'explicit ground-room height exceeds the floor datum of the room stacked above it (redundant restatement of the level rise)', resolvedByDerivation: true }
  : d.includes('Omit this roof') ? { class: 'model-authored contradiction', cause: 'roof declared on a space wholly covered by the floor above', resolvedByDerivation: false }
  : d.includes('unsupported-capability: roof conflicts') ? { class: 'representation gap', cause: 'space is only partly under an upper floor; one roof slab cannot follow the exposed remainder', resolvedByDerivation: false }
  : { class: 'other', cause: d, resolvedByDerivation: false };
const plan = JSON.parse(readFileSync(SOURCE, 'utf8')).plan as ArchitecturalPlan;
const findings = run(plan);
// Only the ground rooms named in a height-overlap finding: the smallest change that tests derivation.
const stackedGround = [...new Set(findings.filter(f => f.includes('occupied volumes overlap')).map(f => f.split('/')[0]))];
const altered = structuredClone(plan); for (const s of altered.spaces) if (stackedGround.includes(s.id)) delete s.height;
const afterDerivation = run(altered);
const label = (f: string) => ({ finding: f.split(':')[0], ...classify(f), text: f });
const report = {
  note: 'Offline replay of the unchanged retained Terra proposal. No provider call.',
  source: SOURCE,
  retained: { findings: findings.length, classified: findings.map(label) },
  alteredCopyDiagnostic: { label: 'ALTERED COPY, NOT A TERRA OUTPUT: heights omitted on ground spaces so the compiler derives them', omittedHeights: stackedGround.length, remainingFindings: afterDerivation.length, remaining: afterDerivation.map(label) },
};
mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/mansion-replay.json`, JSON.stringify(report, null, 2));
const tally = (items: { class: string; cause: string }[]) => Object.entries(items.reduce<Record<string, number>>((a, c) => { const k = `${c.class}: ${c.cause.slice(0, 60)}`; a[k] = (a[k] ?? 0) + 1; return a; }, {}));
console.log(JSON.stringify({ retained: findings.length, retainedBy: tally(report.retained.classified), alteredRemaining: afterDerivation.length, alteredBy: tally(report.alteredCopyDiagnostic.remaining) }, null, 1));
