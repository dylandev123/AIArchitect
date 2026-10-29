import {defineConfig} from 'vite';
import {resolve} from 'node:path';
export default defineConfig({resolve:{alias:{'@':resolve(process.cwd(),'src')}},esbuild:{jsx:'automatic'},server:{host:'127.0.0.1',port:3004,strictPort:true}});
