import {notFound} from 'next/navigation';
import {readFile} from 'node:fs/promises';
import {validateScene} from '@/lib/villa/scene/model';
import {SemanticViewer} from '../semantic-building/viewer';

/** Developer-only viewer for staged-villa checkpoints (offline files only; no API calls). */
export default async function Page({searchParams}: {searchParams: Promise<{file?: string; site?: string}>}) {
  if (process.env.NODE_ENV !== 'development') notFound();
  const params = await searchParams, file = params.file ?? '', siteMatch = /^(\d{2,3})x(\d{2,3})$/.exec(params.site ?? '');
  const site = siteMatch ? {width: Number(siteMatch[1]), depth: Number(siteMatch[2])} : undefined;
  if (!/^[a-z0-9._-]+\.scene\.json$/.test(file)) notFound();
  const livePoolEdit=file==='live-natural-language-pool.scene.json';
  const poolEditCandidate=file==='natural-language-pool-candidate.scene.json';
  const roofCandidate=file==='stage6-roof-candidate.scene.json';
  const scene = validateScene(JSON.parse(await readFile(`docs/architecture/staged-villa/${livePoolEdit?'natural-language-edit/live-edit-1/candidate.scene.json':poolEditCandidate?'natural-language-edit/pool-offline-2/candidate.scene.json':roofCandidate?'stage6-refinement/roof-experiment-4/candidate.scene.json':file.replace("live-1_","live-1/").replace("stage4-exterior_","stage4-exterior/").replace("stage4-corrections_","stage4-corrections/").replace("stage5-site_","stage5-site/").replace(/^automatic-(unified-offline-\d+|live-v3|creativity-\d+|scale-\d+)_/,"../automatic-house/$1/")}`, 'utf8')));
  const automatic=file.startsWith('automatic-unified-offline-');
  const scaleStudy=file.startsWith('automatic-scale-');
  const study=file.startsWith('automatic-creativity-'),finalV3=file==='automatic-live-v3_final-completed.scene.json';
  const liveV3=file.startsWith('automatic-live-v3_'),liveV3Preview=file==='automatic-live-v3_review-drive-preview.scene.json';
  const sitePreview=automatic||file.startsWith('stage5-site_')||roofCandidate||poolEditCandidate||livePoolEdit;
  const liveSite=file==='stage5-site_terra-stage5.scene.json';
  return <SemanticViewer site={site} scene={scene} thesis={scene.name} source={scaleStudy?'OFFLINE Phase 2 scale study · developer-authored stage answers through the real five-stage pipeline · construction capability, not Terra creativity':study?'OFFLINE architectural-variety study · developer-authored stage answers through the real pipeline · not Terra output':finalV3?'Actual Terra Stages 1–5 (live v3 + Stage 5 continuation) · completed saved house':liveV3Preview?'Actual Terra Stages 1–4 (live v3) · OFFLINE REVIEW PREVIEW of the software driveway with a developer-chosen pool · NOT Terra output, not saved':liveV3?'Actual Terra Stages 1–4 (live v3) · accepted Stage 4 checkpoint · no landscaping yet':automatic?'OFFLINE developer-authored provider doubles through the real automatic pipeline · not Terra output':livePoolEdit?'Actual Terra Stage 5 house · LIVE Terra natural-language pool edit · separate candidate':poolEditCandidate?'Actual Terra Stage 5 villa · OFFLINE MOCKED AI pool edit · accepted baseline preserved':roofCandidate?'OFFLINE Terra roof-only candidate · strict mesh audit REJECTED · baseline preserved':liveSite?'Actual Terra-designed house and LIVE Terra Stage 5 landscape':sitePreview?'Actual Terra Stage 2–4 house; OFFLINE SOFTWARE landscape rehearsal':`Staged villa checkpoint ${file}`} preferFrontDoor={sitePreview||liveV3||study||scaleStudy}/>;
}
