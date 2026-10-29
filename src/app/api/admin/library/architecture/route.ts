import { NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/admin/auth';
import { importArchitecturalKnowledge, importKnowledgeSchema, inspectArchitecturalKnowledge } from '@/lib/library/architecture/service';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
 if(!isAdminRequest(req)) return NextResponse.json({error:'Unauthorized'},{status:401});
 try { return NextResponse.json({entries:await inspectArchitecturalKnowledge(req.nextUrl.searchParams.get('q') ?? '')}); }
 catch { return NextResponse.json({error:'Knowledge store unavailable'},{status:503}); }
}
export async function POST(req: NextRequest) {
 if(!isAdminRequest(req)) return NextResponse.json({error:'Unauthorized'},{status:401});
 let raw: unknown;
 try {raw = await req.json();} catch {return NextResponse.json({error:'Invalid JSON'},{status:400});}
 const checked = importKnowledgeSchema.safeParse(raw);
 if(!checked.success) return NextResponse.json({error:checked.error.issues},{status:400});
 try {return NextResponse.json({entries:await importArchitecturalKnowledge(checked.data)});}
 catch(error) {return NextResponse.json({error:String(error)},{status:409});}
}
