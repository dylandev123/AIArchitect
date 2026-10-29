import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url),{chromium}=require('/private/tmp/aiarchitect-studio-browser/node_modules/playwright-core');
const dir='docs/villa-playground/stacked-volumes';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const errors=[],blocked=[],checks=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(90000);
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.pathname.startsWith('/api/ai/')||!['localhost','127.0.0.1'].includes(u.hostname)){blocked.push(u.href);return r.abort();}return r.continue();});
 for(const id of ['sky-mansion','wing-estate','staggered-mansion','tower-pavilion','solana']){
  await page.goto('http://localhost:3000/dev/villa-playground'+(id==='solana'?'':'?composition='+id),{waitUntil:'networkidle',timeout:120000});
  await page.getByRole('button',{name:'House only',exact:true}).click();await page.waitForTimeout(3000);
  for(const view of ['aerial','front','rear']){
   let result;for(let attempt=0;attempt<60;attempt++){result=await page.locator('canvas').evaluate((c,{id,view})=>{
    let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];
    while(f){let h=f.memoizedState;while(h){const r=h.memoizedState?.current,s=r?.get?r.get():r;if(s?.scene?.isScene){
     const root=s.scene.getObjectByName(id==='solana'?'Property architecture':'Principal footprint · '+id);if(!root)return null;
     let meshes=0,finite=true,volumes=0,roofs=0,pergolas=0;const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
     root.updateWorldMatrix(true,true);root.traverse(o=>{if(o.name.startsWith('Stack volume'))volumes++;if(o.name.startsWith('Exposed rooftop'))roofs++;if(o.name==='Rooftop pergola')pergolas++;if(o.isMesh){meshes++;const a=o.geometry.attributes.position;if(a)finite&&=Array.from(a.array).every(Number.isFinite);o.geometry.computeBoundingBox();const b=o.geometry.boundingBox;if(b)for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){const v=o.position.clone().set(x,y,z).applyMatrix4(o.matrixWorld);[v.x,v.y,v.z].forEach((q,i)=>{min[i]=Math.min(min[i],q);max[i]=Math.max(max[i],q);});}}});
     const cx=(min[0]+max[0])/2,cz=(min[2]+max[2])/2,cy=(min[1]+max[1])/2,w=Math.max(max[0]-min[0],max[2]-min[2],(max[1]-min[1])*1.3);
     s.controls.target.set(cx,cy,cz);const pos=view==='aerial'?[cx+w*.85,cy+w*.85,cz+w*1.1]:view==='front'?[cx-w*.75,cy+w*.3,cz+w*1.4]:[cx+w*.85,cy+w*.35,cz-w*1.35];s.camera.position.set(...pos.map((q,i)=>[cx,cy,cz][i]+(q-[cx,cy,cz][i])*1.25));s.controls.update();s.invalidate();
     return {finite,meshes,volumes,roofs,pergolas,min,max,lastPassDrawCalls:s.gl.info.render.calls,lastPassTriangles:s.gl.info.render.triangles,geometries:s.gl.info.memory.geometries};
    }h=h.next;}f=f.return;}return null;
   },{id,view});if(result)break;await page.waitForTimeout(500);}
   assert(result?.finite&&result.meshes>50,JSON.stringify({id,result,errors}));if(id!=='solana')assert(result.volumes>=4);
   await page.waitForTimeout(1600);await page.locator('canvas').screenshot({path:`${dir}/${id}-${view}.png`});checks.push({id,view,...result});
  }
  const timing=await page.locator('canvas').evaluate(c=>new Promise(resolve=>{
   let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))],s;
   while(f&&!s){let h=f.memoizedState;while(h){const r=h.memoizedState?.current,t=r?.get?r.get():r;if(t?.scene?.isScene){s=t;break;}h=h.next;}f=f.return;}
   const times=[];let last=performance.now();const end=last+1800,initial=s.gl.info.render.frame;
   function frame(now){times.push(now-last);last=now;s.camera.position.x+=.005;s.controls.update();s.invalidate();if(now<end)requestAnimationFrame(frame);else{times.sort((a,b)=>a-b);resolve({frames:times.length,renderedFrames:s.gl.info.render.frame-initial,medianFrameMs:times[Math.floor(times.length/2)],p95FrameMs:times[Math.floor(times.length*.95)],lastPassDrawCalls:s.gl.info.render.calls,lastPassTriangles:s.gl.info.render.triangles,geometries:s.gl.info.memory.geometries});}}requestAnimationFrame(frame);
  }));checks.push({id,timing});console.log('Captured',id,timing);
 }
 assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
 writeFileSync(`${dir}/browser-checks.json`,JSON.stringify({errors,blocked,checks},null,2));
}finally{await browser.close();}
