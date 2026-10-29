import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url),{chromium}=require('/private/tmp/aiarchitect-studio-browser/node_modules/playwright-core');
const dir='docs/villa-playground/image-first';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const errors=[],requests=[],checks=[];
try{
 const page=await browser.newPage({viewport:{width:1600,height:1100}});page.setDefaultTimeout(90000);
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('**/*',r=>{const u=new URL(r.request().url());if(u.pathname.startsWith('/api/ai/')||!['localhost','127.0.0.1'].includes(u.hostname)){requests.push(u.href);return r.abort();}return r.continue();});
 for(const [id,query] of [['reconstruction','/image-first']]){
  await page.goto('http://localhost:3000/dev/villa-playground'+query,{waitUntil:'networkidle',timeout:120000});
  await page.locator('canvas').waitFor();await page.waitForTimeout(3500);
  for(const view of ['Aerial','Arrival','Poolside']){
   await page.getByRole('button',{name:view,exact:true}).click();await page.waitForTimeout(2000);
   const inspect=()=>page.locator('canvas').evaluate(c=>{
    let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];
    while(f){let h=f.memoizedState;while(h){const r=h.memoizedState?.current,s=r?.get?r.get():r;if(s?.scene?.isScene){let meshes=0,finite=true;const forms=[];s.scene.traverse(o=>{if(o.name.startsWith('Footprint building'))forms.push(o.name);if(o.isMesh){meshes++;const a=o.geometry.attributes.position;if(a)finite&&=Array.from(a.array).every(Number.isFinite);}});return{meshes,finite,forms,camera:s.camera.position.toArray()};}h=h.next;}f=f.return;}return null;
   });
   let scene;for(let attempt=0;attempt<120;attempt++){scene=await inspect();if(scene?.finite&&scene.meshes>100)break;await page.waitForTimeout(500);}
   assert(scene?.finite&&scene.meshes>100,JSON.stringify({scene,errors}));
   if(query.includes('composition='))assert.equal(scene.forms.length,2);
   await page.screenshot({path:`${dir}/${id}-${view.toLowerCase()}.png`});checks.push({id,view,...scene});
   if(query.includes('composition=')){
    // A closer orbit of the real rendered house; no geometry or image changes.
    await page.locator('canvas').evaluate((c,{id,view})=>{
     let f=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];
     while(f){let h=f.memoizedState;while(h){const r=h.memoizedState?.current,s=r?.get?r.get():r;
      if(s?.scene?.isScene){
       const root=s.scene.getObjectByName('Principal footprint · '+id),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
       root.updateWorldMatrix(true,true);root.traverse(o=>{if(!o.isMesh)return;o.geometry.computeBoundingBox();const b=o.geometry.boundingBox;
        for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){
         const v=o.position.clone().set(x,y,z).applyMatrix4(o.matrixWorld);[v.x,v.y,v.z].forEach((q,i)=>{min[i]=Math.min(min[i],q);max[i]=Math.max(max[i],q);});
        }
       });
       const cx=(min[0]+max[0])/2,cz=(min[2]+max[2])/2,w=max[0]-min[0],cy=4;
       s.controls.target.set(cx,cy,cz);
       if(view==='Aerial')s.camera.position.set(cx+w*.55,cy+w*1.15,cz+w*.8);
       else if(view==='Arrival')s.camera.position.set(cx-w*.38,cy+w*.3,cz-w*1.22);
       else s.camera.position.set(cx+w*.24,cy+w*.22,cz+w*1.25);
       s.controls.update();s.invalidate();return;
      }h=h.next;}f=f.return;}
    },{id,view});
    await page.waitForTimeout(1800);assert.equal(await page.getByRole('button',{name:view,exact:true}).getAttribute('aria-pressed'),'true');await page.screenshot({path:`${dir}/${id}-${view.toLowerCase()}-detail.png`});
   }
  }
  console.log('Captured',id);
 }
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 writeFileSync(`${dir}/browser-checks.json`,JSON.stringify({errors,requests,checks},null,2));
}finally{await browser.close();}
