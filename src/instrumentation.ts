/** This file is invoked once per Next server instance, independently of browser requests. */
export async function register(){
 if(process.env.NEXT_RUNTIME==='nodejs'&&process.env.NODE_ENV==='development'&&!process.env.VERCEL){
  const {startStudioWorker}=await import('./lib/privateStudio/worker');
  startStudioWorker();
 }
}
