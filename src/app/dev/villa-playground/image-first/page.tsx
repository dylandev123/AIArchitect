import { OperationStudio } from '@/components/scene/OperationStudio';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { replayFirstImageFidelity } from '@/lib/villa/image-fidelity';
import { constructVision } from '@/lib/villa/image-vision';
import { notFound } from 'next/navigation';
import { constructImageSpec, offlineImageSpec } from '@/lib/villa/image-first';
import { VillaPlayground } from '../viewer';
export default async function Page({searchParams}: {searchParams:Promise<{run?:string;fidelity?:string;compatibility?:string}>}) {
  if (process.env.NODE_ENV !== 'development') notFound();
  const {run,fidelity,compatibility}=await searchParams;
  if (!run && !fidelity && compatibility !== '1') return <><p>Image-first direct construction · describe the visible architecture below. <a href='?compatibility=1'>Retained offline reconstruction</a></p><OperationStudio initialReference={{source:'/inspiration/villa.jpg',image:`data:image/jpeg;base64,${(await readFile('public/inspiration/villa.jpg')).toString('base64')}`}} /></>;
  if(fidelity && (!run || fidelity!=='audited')) notFound();
  if(run && !/^[a-f0-9-]{36}$/.test(run)) notFound();
  const root=`.data/image-vision/${run}`;
  const mock = run ? Boolean(JSON.parse(await readFile(`${root}/request.json`,'utf8')).mock) : false;
  const proof = run ? (fidelity ? replayFirstImageFidelity : constructVision)(JSON.parse(JSON.parse(await readFile(`${root}/response.json`,'utf8')).text)) : constructImageSpec(offlineImageSpec);
  if(run) {
    const meta=JSON.parse(await readFile(`${root}/request.json`,'utf8'));
    const image=await readFile('public/inspiration/villa.jpg');
    if(createHash('sha256').update(image).digest('hex')!==meta.sourceSha256) throw new Error('Saved reference changed; restore retained concept before comparison.');
  }
  return <><aside style={{padding:24,background:'#f4efe5',color:'#242d28'}}>
    <h1>Image-first · {fidelity ? 'audited offline correction' : mock ? 'mock vision replay · zero live calls' : run ? 'retained vision replay' : 'offline proof'}</h1>
    <p>{mock ? 'Mock response based on the manual offline proof. Validates replay and rendering only; live interpretation and visual fidelity remain untested.' : run ? 'Saved image → retained vision interpretation → validated editable 3D. This page replays locally without API calls.' : 'Saved image → manual analysis fixture → validated editable 3D. No API calls.'}</p>
    {/* Preserve the original bytes rather than an optimized derivative. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={proof.spec.source} alt="Authoritative saved architectural concept" width={480} />
    <script id="image-vision-camera" type="application/json" dangerouslySetInnerHTML={{__html:JSON.stringify('camera' in proof.spec ? proof.spec.camera : null).replace(/</g,'\\u003c')}} />
    <details><summary>Image specification and uncertainty</summary>{fidelity && <p>Audited local material/glazing correction applied after exact replay. Window positions, roof and patio coordinates remain as interpreted. <a href={`?run=${run}`}>View exact retained replay</a></p>}<pre style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(proof.spec,null,2)}</pre></details>
    <p><a href="/dev/villa-playground">Text-first playground</a> · Use Customize below to edit the reconstruction.</p>
  </aside><VillaPlayground reference={{source:proof.spec.source,image:`data:image/jpeg;base64,${(await readFile('public/inspiration/villa.jpg')).toString('base64')}`}} recovered={{config:proof.config,summary:proof.summary,unsupported:proof.unsupported}} /></>;
}
