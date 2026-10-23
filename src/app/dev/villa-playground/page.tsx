import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { replayRetainedVillaResponse } from "@/lib/villa/responseArtifact";
import { VillaPlayground } from "./viewer";

export const metadata: Metadata = {
  title: "Villa Playground · AI Architect",
  robots: { index: false, follow: false },
};

export default async function Page({ searchParams }: { searchParams: Promise<{ composition?: string; response?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { composition, response } = await searchParams;
  const recovered = response ? await replayRetainedVillaResponse(response) : undefined;
  if (response && !recovered) notFound();
  return <VillaPlayground initialComposition={composition} recovered={recovered && 'version' in recovered.config ? { config: recovered.config, summary: recovered.summary, unsupported: recovered.unsupported } : undefined} />;
}
