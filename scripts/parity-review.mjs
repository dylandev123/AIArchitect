// Prepare the DEV-only interactive viewer from a captured fixture, without touching application state.
// Run: node scripts/parity-review.mjs [before|after]
// Then: python3 -m http.server 8766 --bind 127.0.0.1 --directory /tmp/cottage-parity
import fs from 'node:fs';
import { build } from 'esbuild';
const phase=process.argv[2]??'after';
if(!['before','after'].includes(phase))throw new Error('Use before or after');
fs.mkdirSync('/tmp/cottage-parity',{recursive:true});
fs.copyFileSync(`docs/architecture/parity/${phase}.json`,'/tmp/cottage-parity/models.json');
await build({entryPoints:['scripts/parity-viewer.mjs'],bundle:true,format:'esm',outfile:'/tmp/cottage-parity/viewer.js'});
fs.writeFileSync('/tmp/cottage-parity/index.html',`<!doctype html><html><head><title>Cottage parity · ${phase}</title><style>body{margin:0;font:16px system-ui;background:#e8e9e4}header{height:70px;display:flex;align-items:center;justify-content:space-around}main{display:flex}button{padding:10px}section{width:50vw}</style></head><body><header><b>V2 · ${phase}</b><button id="view">Switch front / entry view</button><b>V3 · ${phase}</b></header><main><section id="v2"></section><section id="v3"></section></main><script type="module" src="viewer.js"></script></body></html>`);
