import { z } from 'zod';
import { saveCandidate, listCandidates } from '@/lib/villa/creation/store';
import { candidateSchema } from '@/lib/villa/creation/candidate';
export const runtime='nodejs';
export async function GET() {
  if(process.env.NODE_ENV!=='development') return Response.json({error:'Development only'},{status:404});
  return Response.json({candidates:await listCandidates()});
}
export async function POST(request: Request) {
  if(process.env.NODE_ENV!=='development') return Response.json({error:'Development only'},{status:404});
  if(request.headers.get('origin') && request.headers.get('origin')!==new URL(request.url).origin) return Response.json({error:'Origin mismatch'},{status:403});
  try {
    const raw=await request.text(); if(raw.length>13000000) throw new Error('Candidate exceeds storage limit.');
    const input=z.object({candidate:candidateSchema,approve:z.boolean().optional()}).strict().parse(JSON.parse(raw));
    return Response.json({candidate:await saveCandidate(input.candidate,input.approve)});
  } catch(error) {return Response.json({error:error instanceof Error?error.message:'Invalid candidate'},{status:400});}
}
