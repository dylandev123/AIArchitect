"""Offline, self-contained review archive. Copies only explicit evidence/source.
No environment, configuration secrets, .data, database, or network access.
Source snapshots are text so archived code is not compiled by the application.
"""
from pathlib import Path
import hashlib
import json
import shutil
import zipfile

root = Path(__file__).resolve().parents[1]
out = root / 'docs/architecture/planning-method-audit-2026-10-30'
paired = root / 'docs/architecture/design-first/sol-planning-comparison-2026-10-30'
terra = root / 'docs/architecture/design-first/live-after-rehearsal-2026-10-30'
azure = root / 'docs/architecture/complete-mansion-2026-10-30'


def copy(source, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)
    assert source.read_bytes() == target.read_bytes()


# Keep full paired raw payloads, assessments and reproducibility records.
for directory, name in [(paired, 'paired'), (terra, 'terra-run')]:
    for source in sorted(directory.iterdir()):
        if source.is_file():
            suffix = '.txt' if source.suffix in ('.ts', '.tsx', '.mjs') else ''
            copy(source, out / 'raw' / name / (source.name + suffix))

# Older construction, clearly distinguished from the unconstructed pair.
azure_files = ['REPORT.md', 'scene.json', 'operations.json', 'programme.json',
               'expanded-operations.json', 'architecture-audit.json',
               'relationship-findings.json', 'geometry-ledger.json', 'postflight.json',
               'provider-request.exact.json', 'provider-response.exact.json',
               'usage-and-cost.json', 'browser-result.json', 'final-verification.json',
               'arrival.png', 'aerial.png', 'garden.png', 'poolside.png', 'aerial-oblique.png']
for name in azure_files:
    copy(azure / name, out / 'raw/older-azure' / name)

source_files = [*sorted((root / 'src/lib/villa/scene').glob('*.ts')),
                root / 'src/lib/semantic/vocabulary.ts',
                root / 'src/app/api/ai/scene/route.ts',
                root / 'src/app/api/ai/scene/route.designFirst.test.ts',
                root / 'scripts/architectural-planning-audit-offline.ts',
                root / 'scripts/architectural-planning-audit-package.py']
for source in source_files:
    copy(source, out / 'source' / (str(source.relative_to(root)) + '.txt'))

t = json.loads((paired / 'terra.request.exact.json').read_text())
s = json.loads((paired / 'sol.request.exact.json').read_text())
assert set(t) == set(s)
assert [key for key in t if t[key] != s[key]] == ['model']
user = next(item for item in t['input'] if item['role'] == 'user')
brief = json.loads(user['content'][0]['text'])['prompt']
(out / 'ORIGINAL-BRIEF.txt').write_text(brief + '\n')

tests = json.loads((out / 'tests.json').read_text())
verification = {
    'date': '2026-10-30', 'paidCalls': 0, 'externalCalls': 0,
    'databaseConnections': 0, 'databaseChanges': 0, 'commits': 0, 'deployments': 0,
    'changedApplicationFiles': ['src/lib/villa/scene/spatial.ts', 'src/lib/villa/scene/spatial.test.ts'],
    'pairedRequestDifference': ['model'],
    'tests': {'passed': tests['numPassedTests'], 'total': tests['numTotalTests'],
              'success': tests['success'], 'files': len(tests['testResults'])},
    'offlineFixtureScript': 'passed; fetch denied; no provider or database invoked',
    'focusedEslint': 'passed',
    'typecheck': {'passed': False, 'scope': 'npm run typecheck',
                  'errors': ['docs/architecture/design-first/live-2026-10-30/experiment-script.as-run.ts: archived relative imports and consequent type errors',
                             'scripts/sol-planning-comparison-review.ts: duplicate object property at line 33'],
                  'changedFilesReported': False,
                  'action': 'Existing evidence and unrelated script left untouched; no claim of a passing full typecheck.'},
    'sourceSnapshotFormat': 'Original bytes under source/<original-path>.txt; remove final .txt when referring to source names.',
    'visualProvenance': 'Older Azure construction only. No Terra Reef Court or Sol Breeze Court render exists.',
}
assert verification['tests']['success']
(out / 'verification.json').write_text(json.dumps(verification, indent=2) + '\n')

# A repository-independent reading packet includes exact payloads and images.
files = [p for p in sorted(out.rglob('*')) if p.is_file() and p.name not in
         ('independent-audit-package.zip', 'SHA256SUMS.json')]
manifest = {str(p.relative_to(out)): hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
(out / 'SHA256SUMS.json').write_text(json.dumps(manifest, indent=2) + '\n')
archive = out / 'independent-audit-package.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as packet:
    for p in [*files, out / 'SHA256SUMS.json']:
        packet.write(p, p.relative_to(out))
with zipfile.ZipFile(archive) as packet:
    assert packet.testzip() is None
    for path, digest in manifest.items():
        assert hashlib.sha256(packet.read(path)).hexdigest() == digest
print(json.dumps({'files': len(files) + 1, 'archiveBytes': archive.stat().st_size,
                  'manifestVerified': True, 'tests': verification['tests']}, indent=2))
