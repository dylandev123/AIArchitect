import {z} from 'zod';
import {type StudioStore} from '@/lib/privateStudio/store';
import {privateOrigin,identity,signIn} from '@/lib/privateStudio/auth';
import {StudioError} from '@/lib/privateStudio/policy';
import {PrivateStudioService} from '@/lib/privateStudio/service';
const login=z.object({action:z.literal('login'),password:z.string().min(14).max(200),setupCode:z.string().max(128).optional()}).strict();
export function privateHandlers(store:StudioStore,service=new PrivateStudioService(store)){
 const json=(data:unknown,status=200,headers:Record<string,string>={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store',...headers}});
 const failure=(e:unknown)=>json({error:e instanceof StudioError||e instanceof z.ZodError?(e as Error).message:'Private Studio storage/execution unavailable; no automatic retry.'},e instanceof StudioError?e.status:e instanceof z.ZodError?422:503);
 return {
  GET:async(request:Request)=>{try{
   privateOrigin(request);const runId=new URL(request.url).searchParams.get('runId');
   if(runId)return json(await service.read(request,runId));
   const status=await store.transaction(s=>{try{identity(s,request,false);return null;}catch{return {authenticated:false,setupRequired:!s.account};}});
   return json(status??await service.read(request));
  }catch(e){return failure(e);}},
  POST:async(request:Request)=>{try{
   privateOrigin(request);const text=await request.text();if(Buffer.byteLength(text)>10000)throw new StudioError(413,'Request too large');
   const raw=JSON.parse(text);
   if(raw.action==='login'){
    const input=login.parse(raw),session=await signIn(store,input.password,input.setupCode);
    return json({authenticated:true,csrf:session.csrf},200,{'Set-Cookie':`studio_session=${session.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`});
   }
   if(raw.action==='logout'){
    await store.transaction(s=>{const session=identity(s,request);for(const [id,v] of Object.entries(s.sessions))if(v===session)delete s.sessions[id];});
    return json({authenticated:false},200,{'Set-Cookie':'studio_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});
   }
   return json(await service.execute(request,raw));
  }catch(e){return failure(e);}},
 };
}
