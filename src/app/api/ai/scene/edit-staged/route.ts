import {z} from 'zod';
import {editAcceptedStagedSave} from '@/lib/villa/staged/naturalLanguageEdit';
const schema=z.object({save:z.string().max(2_000_000),instruction:z.string().min(1).max(4000),expectedHash:z.string().regex(/^[a-f0-9]{64}$/),proposal:z.unknown()}).strict();
/** Developer-only accepted-save editing proof. No paid branch, persistence or rejected-plan dependency.
 * proposal is an explicitly mocked/injected AI output; this endpoint must not claim a live planner ran. */
export async function POST(request:Request){
 if(process.env.NODE_ENV!=='development'&&process.env.NODE_ENV!=='test')return Response.json({error:'Not found'},{status:404});
 try{const input=schema.parse(await request.json());const result=await editAcceptedStagedSave(input);return Response.json({...result,provenance:'Injected AI proposal; no live provider execution'}, {status:result.accepted?200:422,headers:{'Cache-Control':'no-store'}});}
 catch(error){return Response.json({accepted:false,error:String(error),providerCalls:0},{status:422,headers:{'Cache-Control':'no-store'}});}
}
