import { saveDesignLesson } from '@/lib/villa/design-learning-store';
export async function POST(request:Request){
 if(process.env.NODE_ENV!=='development')return Response.json({error:'Development only'},{status:404});
 try{
  if(request.headers.get('origin')!==new URL(request.url).origin)throw Error('Same-origin review required.');
  if(Number(request.headers.get('content-length'))>40000000)throw Error('Lesson exceeds storage budget.');
  const body=await request.text();if(body.length>40000000)throw Error('Lesson exceeds storage budget.');
  return Response.json({...await saveDesignLesson(JSON.parse(body)),providerCalls:0});
 }catch(error){return Response.json({error:error instanceof Error?error.message:'Lesson storage failed',providerCalls:0},{status:400});}
}
