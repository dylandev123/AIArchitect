import { afterEach, expect, it, vi } from 'vitest';
import { laderaScene } from './scene/example';
const state=vi.hoisted(()=>({records:[] as unknown[],disk:vi.fn(()=>{throw Error('Serverless filesystem unavailable');})}));
vi.mock('@/lib/library/store',()=>({readLibrary:async()=>({designLessons:state.records}),libraryStorageInfo:()=>({kind:'postgres'}),mutateLibrary:vi.fn()}));
vi.mock('node:fs/promises',()=>({mkdir:state.disk,readFile:state.disk,readdir:state.disk,writeFile:state.disk}));
afterEach(()=>{vi.unstubAllEnvs();state.disk.mockClear();});
it('loads persisted lesson summaries on fresh production instances without touching disk',async()=>{
 vi.stubEnv('VERCEL','1');
 state.records=[{id:'retained',createdAt:'2026-10-29T00:00:00Z',lesson:{version:1,brief:'Tropical waterfront house',verdict:'rejected',feedback:'The arrival needs a clearer sheltered threshold.',origin:'terra',before:laderaScene,after:{...laderaScene,name:'Revised'}}}];
 const first=await import('./design-learning-store');
 const summaries=await first.listDesignLessonSummaries();
 expect(summaries[0].feedback).toContain('sheltered threshold');
 vi.resetModules();
 const fresh=await import('./design-learning-store');
 expect(await fresh.listDesignLessonSummaries()).toEqual(summaries);
 expect(state.disk).not.toHaveBeenCalled();
});
