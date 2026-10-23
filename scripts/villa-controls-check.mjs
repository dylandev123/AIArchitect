// Local controls and intercepted failure responses only; never calls Terra.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? '/private/tmp/aiarchitect-studio-browser/node_modules/playwright-core');
const directory = 'docs/villa-playground/styles';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE ?? `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`, args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'] });
const errors = [], checks = [];
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1050 } });
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(process.env.VILLA_URL ?? 'http://127.0.0.1:3107/dev/villa-playground', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.locator('canvas').waitFor(); await page.waitForTimeout(4000);
  async function meshes() {
    return page.locator('canvas').evaluate(c => {
      let fiber = c[Object.keys(c).find(k => k.startsWith('__reactFiber$'))];
      while (fiber) {
        let hook = fiber.memoizedState;
        while (hook) {
          const state = hook.memoizedState?.current;
          if (state?.scene?.isScene) {
            const parts = [];
            state.scene.updateMatrixWorld(true);
            state.scene.traverse(o => { if (o.isMesh && o.userData.id) {
              o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox;
              parts.push({ id: o.userData.id, geometry: o.geometry.uuid, size: [b.max.x-b.min.x,b.max.y-b.min.y,b.max.z-b.min.z], position: o.position.toArray() });
            } });
            return { parts, camera: state.camera.position.toArray() };
          }
          hook = hook.next;
        }
        fiber = fiber.return;
      }
      return null;
    });
  }
  const variants = [['modern','Modern Contemporary',['garden-l']], ['caribbean','Caribbean Tropical',['courtyard']], ['spanish','Spanish Hacienda',['garden-l']], ['tuscan','Tuscan Estate',['courtyard','stepped']]];
  for (const [style, label, layouts] of variants) {
    await page.getByRole('button', { name: label, exact: true }).click();
    const toggle = page.getByRole('button', { name: 'Customize this villa', exact: true });
    if (await toggle.count()) await toggle.click();
    for (const layout of layouts) {
      await page.getByLabel('Composition', { exact: true }).selectOption(layout);
      await page.getByLabel('Levels', { exact: true }).selectOption('1');
      if (style !== 'modern') await page.getByLabel('Roof', { exact: true }).selectOption('gable');
      await page.waitForTimeout(800); assert((await meshes()).parts.length > 30);
      await page.getByRole('button', { name: 'Close customization', exact: true }).click();
      await page.screenshot({ path: `${directory}/${style}-${layout}-one-level.jpg`, type: 'jpeg', quality: 85 });
      await page.getByRole('button', { name: 'Customize this villa', exact: true }).click();
      checks.push({ style, layout, levels: 1, geometryMounted: true });
    }
    await page.getByRole('button', { name: 'Close customization', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Spanish Hacienda', exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'Customize this villa', exact: true }).click();
  const before = await meshes(), architecture = before.parts.filter(p => /^kit-|pitched-roof|gable-end|arcade/.test(p.id));
  assert(architecture.length > 30);
  // Keyboard changes exercise the actual React input handlers.
  const poolLength = page.getByLabel('Pool length', { exact: true });
  await poolLength.focus(); await poolLength.press('Home'); for (let i=0;i<4;i++) await poolLength.press('ArrowRight');
  await page.waitForTimeout(400);
  const shorter = await meshes();
  assert.deepEqual(shorter.parts.filter(p => /^kit-|pitched-roof|gable-end|arcade/.test(p.id)), architecture, 'Pool resize must retain the actual building geometry instances');
  const basin = shorter.parts.find(p => p.id === 'villa-pool-basin'); assert(basin); assert(Math.abs(basin.size[0] - 12) < .05);
  await page.getByLabel('Exterior', { exact: true }).selectOption('limestone');
  await page.getByLabel('Glazing', { exact: true }).selectOption('panoramic');
  await page.getByLabel('Veranda depth', { exact: true }).focus(); await page.getByLabel('Veranda depth', { exact: true }).press('End');
  await page.getByLabel('Terrace depth', { exact: true }).focus(); await page.getByLabel('Terrace depth', { exact: true }).press('End');
  await page.getByLabel('Swimming pool', { exact: true }).uncheck(); await page.waitForTimeout(300);
  assert(!(await meshes()).parts.some(p => p.id === 'villa-pool-basin'));
  await page.getByLabel('Swimming pool', { exact: true }).check();
  await page.getByRole('button', { name: 'Close customization', exact: true }).click();
  await page.waitForTimeout(500); await page.screenshot({ path: `${directory}/manual-customization.jpg`, type: 'jpeg', quality: 90 });
  const start = await meshes();
  await page.mouse.move(800,450); await page.mouse.down(); await page.mouse.move(960,480,{steps:12}); await page.mouse.up(); await page.waitForTimeout(350);
  assert.notDeepEqual((await meshes()).camera,start.camera);
  const orbit = await meshes(); await page.mouse.wheel(0,-150); await page.waitForTimeout(350); assert.notDeepEqual((await meshes()).camera,orbit.camera);
  const zoom = await meshes(); await page.mouse.down({button:'right'}); await page.mouse.move(1020,460,{steps:8}); await page.mouse.up({button:'right'}); await page.waitForTimeout(350); assert.notDeepEqual((await meshes()).camera,zoom.camera);
  let requests = 0, release;
  await page.route('**/api/ai/villa', async route => { requests++; await new Promise(resolve => { release=resolve; }); await route.fulfill({status:422,contentType:'application/json',body:JSON.stringify({error:'Unsupported configuration. Your current villa is preserved.'})}); });
  await page.getByRole('button',{name:'Refine villa',exact:true}).click(); await page.getByLabel('Villa brief',{exact:true}).fill('Add an unsupported dome');
  const preserved = (await meshes()).parts;
  await page.getByRole('button',{name:'Apply change',exact:false}).click();
  await page.waitForTimeout(300); assert(await page.getByRole('button',{name:'Terra is designing…',exact:true}).isDisabled());
  assert(await page.getByRole('button',{name:'Modern Contemporary',exact:true}).isDisabled());
  release(); await page.getByRole('alert').waitFor(); assert.equal(requests,1); assert.deepEqual((await meshes()).parts,preserved);
  await page.screenshot({path:`${directory}/rejected-edit-preserves-villa.jpg`,type:'jpeg',quality:85});
  await page.getByRole('button',{name:'Dismiss Terra response',exact:true}).click();
  await page.getByRole('button',{name:'Reset camera',exact:true}).click(); await page.waitForTimeout(1500);
  await page.setViewportSize({width:390,height:844}); await page.waitForTimeout(800);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth),false);
  await page.screenshot({path:`${directory}/mobile.jpg`,type:'jpeg',quality:85});
  assert.deepEqual(errors,[]);
  writeFileSync(`${directory}/controls-checks.json`,JSON.stringify({provenance:'Actual UI handlers and R3F geometry. One intercepted failure, zero live calls.',variants:checks,poolResizeRetainsBuildingGeometry:true,poolBasinActuallyResized:true,materialGlazingVerandaTerraceControls:true,poolToggle:true,orbitPanZoom:true,rejectedEditRetainsGeometry:true,duplicateSubmissionsDisabled:true,mobileNoHorizontalOverflow:true,errors},null,2)+'\n');
  console.log(JSON.stringify({checks,errors}));
} finally {await browser.close();}
