/** Rasterises the diagnostic SVG drawings with local Chrome. No network. Usage: node scripts/e2e-diagnostic-svg-to-png.mjs <dir> */
import {createRequire} from 'node:module';
import {readFileSync,readdirSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_CORE_PATH??'/Users/dylandevaux/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const dir=process.argv[2];
const browser=await chromium.launch({headless:false,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--headless=new']});
try{
 for(const f of readdirSync(dir).filter(n=>n.endsWith('.svg'))){
  const svg=readFileSync(`${dir}/${f}`,'utf8'),m=svg.match(/width="(\d+)" height="(\d+)"/);
  const page=await browser.newPage({viewport:{width:+m[1],height:+m[2]},deviceScaleFactor:1.5});
  await page.setContent(`<body style="margin:0">${svg}</body>`);await page.screenshot({path:`${dir}/${f.replace(/\.svg$/,'.png')}`});await page.close();
 }
}finally{await browser.close();}
