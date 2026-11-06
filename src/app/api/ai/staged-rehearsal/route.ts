import {studioRehearsal} from '@/lib/villa/staged/studioRehearsal';
export async function POST(request:Request){
 if((process.env.NODE_ENV!=='development'&&process.env.NODE_ENV!=='test')||process.env.VERCEL==='1')return Response.json({error:'Not found'},{status:404});
 const origin=request.headers.get('origin');
 if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'Cross-origin request denied'},{status:403});
 try{const text=await request.text();if(text.length>2_100_000)throw Error('Request too large');return Response.json(await studioRehearsal(JSON.parse(text)),{headers:{'Cache-Control':'no-store'}});}
 catch(e){return Response.json({error:(e as Error).message,providerCalls:0,costUsd:0},{status:422});}
}
