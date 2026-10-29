import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isAdminRequest } from '@/lib/admin/auth';
import { generationKnowledge, importArchitecturalKnowledge } from '@/lib/library/architecture/service';
import { prepareArchitecturalResearch, researchFindingsSchema, researchKnowledgeProposals, researchPolicySchema } from '@/lib/library/architecture/research';
const requestSchema = z.discriminatedUnion('action', [
 z.object({action:z.literal('prepare'),brief:z.string().trim().min(1).max(12000),policy:researchPolicySchema.default('on-request'),uncertainty:z.string().max(300).optional()}).strict(),
 z.object({action:z.literal('preview'),findings:researchFindingsSchema}).strict(),
 z.object({action:z.literal('propose'),findings:researchFindingsSchema}).strict(),
]);
/** Explicit admin preparation/intake controls; never calls an AI or fetches URLs. */
export async function POST(req: NextRequest) {
 if (!isAdminRequest(req)) return NextResponse.json({error:'Unauthorized'}, {status:401});
 let raw: unknown;
 try {raw = await req.json();} catch {return NextResponse.json({error:'Invalid JSON'}, {status:400});}
 const parsed = requestSchema.safeParse(raw);
 if (!parsed.success) return NextResponse.json({error:parsed.error.issues}, {status:400});
 try {
  const input = parsed.data;
  if (input.action === 'prepare') {
   const knowledge = await generationKnowledge(input.brief, 'generate');
   return NextResponse.json({plan:prepareArchitecturalResearch(input.brief, knowledge, input.policy, input.uncertainty), providerCalls:0});
  }
  const proposals = researchKnowledgeProposals(input.findings);
  if (input.action === 'preview') return NextResponse.json({proposals, providerCalls:0});
  return NextResponse.json({entries:await importArchitecturalKnowledge(proposals),providerCalls:0});
 } catch (error) {return NextResponse.json({error:String(error), providerCalls:0}, {status:409});}
}
