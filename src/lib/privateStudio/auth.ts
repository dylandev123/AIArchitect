import {createHash,randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {readFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import {StudioStore,type State} from './store';
import {StudioError} from './policy';
export const STUDIO_ORIGIN='http://localhost:3015';
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
const equal=(a:string,b:string)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
export function privateOrigin(request:Request){
 if(!['development','test'].includes(process.env.NODE_ENV??'')||process.env.VERCEL)throw new StudioError(404,'Private Studio is local-development only');
 if(new URL(request.url).origin!==STUDIO_ORIGIN)throw new StudioError(403,'Private Studio requires http://localhost:3015');
 if(request.method!=='GET'&&request.headers.get('origin')!==STUDIO_ORIGIN)throw new StudioError(403,'Same-origin request required');
 if(request.headers.get('sec-fetch-site')==='cross-site')throw new StudioError(403,'Cross-site request refused');
}
export function identity(state:State,request:Request,mutation=true){
 const token=request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith('studio_session='))?.slice('studio_session='.length)??'';
 const session=state.sessions[digest(token)];
 if(!session||session.expires<Date.now()||session.owner!==state.account?.owner)throw new StudioError(401,'Sign in to private Studio');
 if(mutation&&!equal(session.csrf,request.headers.get('x-studio-csrf')??''))throw new StudioError(403,'CSRF check failed');
 return session;
}
export async function signIn(store:StudioStore,password:string,setupCode?:string){
 if(password.length<14||password.length>200)throw new StudioError(422,'Use a password of 14–200 characters');
 const result=await store.transaction(async s=>{
  if(s.lockedUntil>Date.now())return {error:true};
  let valid=false;
  if(!s.account){
   const localCode=await readFile(path.join(store.directory,'setup-code'),'utf8');
   if(setupCode&&equal(digest(setupCode),digest(localCode))){const salt=randomBytes(16).toString('hex');s.account={owner:'private-developer',salt,hash:scryptSync(password,salt,64).toString('hex')};valid=true;}
  }else valid=equal(scryptSync(password,s.account.salt,64).toString('hex'),s.account.hash);
  if(!valid){s.loginFailures++;if(s.loginFailures>=5){s.lockedUntil=Date.now()+15*60*1000;s.loginFailures=0;}return {error:true};}
  s.loginFailures=0;s.lockedUntil=0;
  const token=randomBytes(32).toString('hex'),csrf=randomBytes(32).toString('hex');
  s.sessions[digest(token)]={owner:s.account!.owner,csrf,expires:Date.now()+8*3600000};
  // A fresh login revokes all old sessions for this single-user website.
  s.sessions={[digest(token)]:s.sessions[digest(token)]};
  return {token,csrf};
 });
 if('error'in result)throw new StudioError(401,'Sign-in refused or temporarily locked');
 await unlink(path.join(store.directory,'setup-code')).catch(()=>{});
 return result;
}
export const sessionDigest=digest;
