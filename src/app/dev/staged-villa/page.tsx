import {notFound} from 'next/navigation';
import {readFile} from 'node:fs/promises';
import {validateScene} from '@/lib/villa/scene/model';
import {SemanticViewer} from '../semantic-building/viewer';

/** Developer-only viewer for staged-villa checkpoints (offline files only; no API calls). */
export default async function Page({searchParams}: {searchParams: Promise<{file?: string}>}) {
  if (process.env.NODE_ENV !== 'development') notFound();
  const file = (await searchParams).file ?? '';
  if (!/^[a-z0-9._-]+\.scene\.json$/.test(file)) notFound();
  const livePoolEdit=file==='live-natural-language-pool.scene.json';
  const poolEditCandidate=file==='natural-language-pool-candidate.scene.json';
  const roofCandidate=file==='stage6-roof-candidate.scene.json';
  const scene = validateScene(JSON.parse(await readFile(`docs/architecture/staged-villa/${livePoolEdit?'natural-language-edit/live-edit-1/candidate.scene.json':poolEditCandidate?'natural-language-edit/pool-offline-2/candidate.scene.json':roofCandidate?'stage6-refinement/roof-experiment-4/candidate.scene.json':file.replace("live-1_","live-1/").replace("stage4-exterior_","stage4-exterior/").replace("stage4-corrections_","stage4-corrections/").replace("stage5-site_","stage5-site/").replace(/^automatic-(unified-offline-\d+)_/,"../automatic-house/$1/")}`, 'utf8')));
  const automatic=file.startsWith('automatic-unified-offline-');
  const sitePreview=automatic||file.startsWith('stage5-site_')||roofCandidate||poolEditCandidate||livePoolEdit;
  const liveSite=file==='stage5-site_terra-stage5.scene.json';
  return <SemanticViewer scene={scene} thesis={scene.name} source={automatic?'OFFLINE developer-authored provider doubles through the real automatic pipeline · not Terra output':livePoolEdit?'Actual Terra Stage 5 house · LIVE Terra natural-language pool edit · separate candidate':poolEditCandidate?'Actual Terra Stage 5 villa · OFFLINE MOCKED AI pool edit · accepted baseline preserved':roofCandidate?'OFFLINE Terra roof-only candidate · strict mesh audit REJECTED · baseline preserved':liveSite?'Actual Terra-designed house and LIVE Terra Stage 5 landscape':sitePreview?'Actual Terra Stage 2–4 house; OFFLINE SOFTWARE landscape rehearsal':`Staged villa checkpoint ${file}`} preferFrontDoor={sitePreview}/>;
}
