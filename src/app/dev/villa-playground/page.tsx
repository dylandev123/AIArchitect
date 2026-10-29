import { OperationStudio } from './operation-studio';
import { readFile } from 'node:fs/promises';
import { validateCompositionPreview } from '@/lib/villa/composition';
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { replayRetainedVillaResponse } from "@/lib/villa/responseArtifact";
import { VillaPlayground } from "./viewer";

export const metadata: Metadata = {
  title: "Villa Playground · AI Architect",
  robots: { index: false, follow: false },
};

export default async function Page({ searchParams }: { searchParams: Promise<{ composition?: string; response?: string; scene?:string; offline?:string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { composition, response, offline, scene } = await searchParams;
  if (!composition && !response && !offline && scene !== 'legacy') return <OperationStudio/>;
  if(offline){
    if(!/^[a-z][a-z0-9-]{0,60}$/.test(offline))notFound();
    const proof=JSON.parse(await readFile(`.data/villa-offline-studies/${offline}.json`,'utf8'));
    const config=validateCompositionPreview(proof.config);
    return <VillaPlayground reference={proof.reference} recovered={{config,summary:proof.summary,unsupported:proof.unsupported}}/>;
  }
  const recovered = response ? await replayRetainedVillaResponse(response) : undefined;
  if (response && !recovered) notFound();
  return <VillaPlayground initialComposition={composition} recovered={recovered && 'version' in recovered.config ? { config: recovered.config, summary: recovered.summary, unsupported: recovered.unsupported } : undefined} />;
}
