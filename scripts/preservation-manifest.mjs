/** Builds the proposed Git preservation manifest. Read-only: never stages, commits or deletes anything. */
import {execFileSync} from 'node:child_process';
import {readFileSync, statSync, writeFileSync, existsSync} from 'node:fs';
import path from 'node:path';
const git = (...a) => execFileSync('git', a, {encoding: 'utf8', maxBuffer: 1 << 28}).split('\n').filter(Boolean);
const untracked = git('ls-files', '--others', '--exclude-standard'), modified = git('diff', '--name-only');
const isImage = f => /\.(png|jpe?g)$/i.test(f), size = f => statSync(f).size;
// Large generated artefacts: regenerable and not needed as evidence (embedded-image HTML, image-laden review requests).
const generated = f => /comparison\.html$/.test(f) || (/wire-request\.json$/.test(f) && size(f) > 2e6);
// Curated screenshots: any image a report or handoff names explicitly, plus the final unified evidence sets.
const reports = [...untracked, ...git('ls-files', 'docs')].filter(f => /\.md$/.test(f) && existsSync(f));
const referenced = new Set();
for (const r of reports) for (const m of readFileSync(r, 'utf8').matchAll(/[\w./{},-]+\.(?:png|jpe?g)/gi)) {
  const expand = s => { const b = s.match(/\{([^}]+)\}/); return b ? b[1].split(',').flatMap(x => expand(s.replace(b[0], x))) : [s]; };
  for (const name of expand(m[0])) for (const c of [path.join(path.dirname(r), name), name, path.join('docs/architecture/staged-villa', name)]) if (existsSync(c)) referenced.add(path.normalize(c));
}
const finalSets = /^docs\/architecture\/automatic-house\/(unified-offline-3|unified-offline-browser-3)\//;
// Approved lighter set (2026-11-06): 27 images. Final offline four-angle sets, real Terra renders, Studio states.
const angles = ['arrival', 'aerial', 'garden', 'poolside'];
const curated = new Set([
  ...['a-caribbean', 'b-courtyard', 'c-estate'].flatMap(b => angles.map(a => `docs/architecture/automatic-house/unified-offline-3/capture-1-${b}-${a}.png`)),
  ...['complete', 'correcting', 'failed-after-correction', 'workspace-house'].map(n => `docs/architecture/automatic-house/unified-offline-browser-3/${n}.png`),
  ...angles.map(a => `docs/architecture/staged-villa/stage4-exterior/terra-stage4-${a}.png`),
  ...angles.map(a => `docs/architecture/staged-villa/stage5-site/terra-stage5-${a}.png`),
  ...['running', 'failed', 'queued-worker-failure/held-queue'].map(n => `docs/architecture/automatic-house/${n}.png`),
]);
const include = [], excluded = [];
for (const f of untracked) {
  if (isImage(f)) (curated.has(f) ? include : excluded).push(f);
  else (generated(f) ? excluded : include).push(f);
}
include.push(...modified);
// Secret scan over exactly what would be committed (text files).
const patterns = [/sk-[A-Za-z0-9_-]{20,}/, /Bearer\s+[A-Za-z0-9._-]{20,}/, /studio_session=[0-9a-f]{16,}/, /OPENAI_API_KEY\s*=\s*\S+/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /"salt"\s*:\s*"[0-9a-f]{16,}"/, /"csrf"\s*:\s*"[0-9a-f]{32,}"/];
const hits = [];
for (const f of include.filter(f => !isImage(f))) { const t = readFileSync(f, 'utf8'); for (const p of patterns) if (p.test(t)) hits.push(`${f}: ${p}`); }
const forbidden = include.filter(f => /^\.data\/|(^|\/)\.env|setup-code|state\.json$|\.pem$/.test(f));
const mb = fs => (fs.reduce((s, f) => s + size(f), 0) / 1e6).toFixed(1);
const group = f => f.startsWith('src/') || f.startsWith('scripts/') || /^(vitest|next|tsconfig|package)/.test(f) ? 'source' : isImage(f) ? 'curated images' : 'evidence text';
const summary = {};
for (const f of include) { const g = group(f); summary[g] = summary[g] ?? []; summary[g].push(f); }
writeFileSync('docs/architecture/preservation-manifest.txt', include.sort().join('\n') + '\n');
writeFileSync('docs/architecture/preservation-excluded.txt', excluded.sort().join('\n') + '\n');
console.log(JSON.stringify({include: Object.fromEntries(Object.entries(summary).map(([k, v]) => [k, {files: v.length, mb: mb(v)}])), total: {files: include.length, mb: mb(include)},
  excluded: {files: excluded.length, mb: mb(excluded), generated: excluded.filter(f => !isImage(f))}, secretHits: hits, forbiddenPaths: forbidden}, null, 1));
