// Local UI only. An unexpected AI request fails the check and is blocked.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {writeFileSync,mkdirSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE ?? '/private/tmp/aiarchitect-studio-browser/node_modules/playwright-core');
const directory='docs/villa-playground/compositions';
mkdirSync(directory,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE ?? `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
const errors=[],requests=[],checks=[];
try {
  const page=await browser.newPage({viewport:{width:1500,height:1050}});
  page.setDefaultTimeout(90000);
  page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/api/ai/**',route=>{requests.push(route.request().url());return route.abort();});
  await page.goto(process.env.VILLA_URL ?? 'http://127.0.0.1:3107/dev/villa-playground',{waitUntil:'domcontentloaded',timeout:120000});
  async function scene() {
    return page.locator('canvas').evaluate(c=>{
      let fiber=c[Object.keys(c).find(k=>k.startsWith('__reactFiber$'))];
      while(fiber) { let hook=fiber.memoizedState;
        while(hook) { const state=hook.memoizedState?.current;
          if(state?.scene?.isScene) {const groups=[],parts=[];let meshes=0;
            state.scene.traverse(o=>{if(o.isGroup&&o.name)groups.push(o.name);if(o.isMesh){meshes++;if(o.userData.id)parts.push(o.userData.id);}});
            return {groups,parts,meshes};
          } hook=hook.next;
        } fiber=fiber.return;
      } return null;
    });
  }
  async function waitScene(group) {
    for(let i=0;i<120;i++){const s=await scene();if(s?.meshes>100&&s.groups.includes(group))return s;await page.waitForTimeout(500);}
    throw Error(`Missing mounted group: ${group}`);
  }
  await page.locator('canvas').waitFor();
  await waitScene('Villa Solana · fixed architectural composition');
  const sentinel='wing-composition-project-storage-sentinel';
  await page.evaluate(value=>localStorage.setItem('ai-architect-projects',value),sentinel);
  await page.screenshot({path:`${directory}/preserved-solana.jpg`,type:'jpeg',quality:90});
  for(const [id,label] of [['compact-l','Compact L'],['courtyard-u','Courtyard U'],['pavilion-estate','Pavilion estate']]) {
    await page.getByRole('button',{name:label,exact:true}).click({force:true});
    const s=await waitScene(`Local composition · ${id}`);
    assert.equal(await page.getByRole('form',{name:'Design with Terra'}).count(),1);
    assert(await page.getByRole('button',{name:'Refine villa',exact:true}).isDisabled());
    checks.push({composition:id,meshes:s.meshes,terraGenerationAvailable:true});
  }
  for(const [id,label,layout] of [['modern','Modern Contemporary','stepped'],['caribbean','Caribbean Tropical','pavilions'],['spanish','Spanish Hacienda','courtyard'],['tuscan','Tuscan Estate','garden-l']]) {
    await page.getByRole('button',{name:label,exact:true}).click({force:true});
    await waitScene(`${id} / ${layout}`);
    await page.getByRole('button',{name:'Customize this villa',exact:true}).click({force:true});
    await page.getByLabel('Levels',{exact:true}).selectOption('1');
    await page.getByLabel('Exterior',{exact:true}).selectOption('limestone');
    await page.getByLabel('Swimming pool',{exact:true}).uncheck();
    await page.waitForTimeout(1500);
    assert(!(await scene()).parts.includes('villa-pool-basin'));
    await page.getByLabel('Swimming pool',{exact:true}).check();
    await page.waitForTimeout(1500);
    assert((await scene()).parts.includes('villa-pool-basin'));
    await page.getByRole('button',{name:'Close customization',exact:true}).click({force:true});
    await page.screenshot({path:`${directory}/preserved-${id}.jpg`,type:'jpeg',quality:88});
    checks.push({style:id,customization:true,poolToggle:true});
  }
  await page.getByRole('button',{name:'Solana original',exact:true}).click({force:true});
  await waitScene('Villa Solana · fixed architectural composition');
  assert.equal(await page.evaluate(()=>localStorage.getItem('ai-architect-projects')),sentinel);
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  writeFileSync(`${directory}/regression-checks.json`,JSON.stringify({checks,errors,aiRequests:requests,projectStorageUnchanged:true},null,2)+'\n');
  console.log(JSON.stringify({checks,errors,aiRequests:requests}));
} finally {await browser.close();}
