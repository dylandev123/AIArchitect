import {readFile} from 'node:fs/promises';
import {NextResponse} from 'next/server';
export async function GET(_request: Request, context: {params: Promise<{responseId:string}>}) {
    if(process.env.NODE_ENV!=='development')return new Response(null,{status:404});
    const {responseId}=await context.params;
    if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(responseId))return new Response(null,{status:400});
    try {
        const report=JSON.parse(await readFile(`.data/scene-responses/${responseId}.diagnostics.json`,'utf8'));
        // Private messages and raw provider bodies remain server-only.
        return NextResponse.json({...report.diagnostics,experiment:{model:report.providerMetadata?.model,reasoningEffort:report.providerMetadata?.reasoningEffort,usage:report.providerMetadata?.usage,requestFingerprint:report.requestFingerprint,validation:report.validation,architecturalQuality:report.architecturalQuality?.status}},{headers:{'Cache-Control':'no-store'}});
    } catch {return new Response(null,{status:404});}
}
