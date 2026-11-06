import {describe,it,expect,vi,afterEach} from 'vitest';
import {studioRehearsal} from './studioRehearsal';
import {POST} from '@/app/api/ai/staged-rehearsal/route';
import {loadHouse} from './save';
const brief='A four-bedroom Caribbean villa on a flat site with veranda and pool';
afterEach(()=>vi.unstubAllEnvs());
describe('Studio offline adapter',()=>{
 it('constructs all retained stages, forwards the brief, saves, reloads and previews a reversible edit',async()=>{
  let saved='';for(const stage of [2,3,4,5]){const r=await studioRehearsal({action:'stage',brief,stage});expect('stageBrief'in r&&r.stageBrief).toBe(brief);expect('findings'in r&&r.findings).toEqual([]);expect(r.providerCalls).toBe(0);if('save'in r&&r.save)saved=r.save;}
  const before=loadHouse(saved);const edit=await studioRehearsal({action:'edit',save:saved,instruction:'Move the pool 2 metres closer to the veranda.'});expect('accepted'in edit&&edit.accepted).toBe(true);expect(loadHouse(saved).scene).toEqual(before.scene);
  const bad=await studioRehearsal({action:'edit',save:saved,instruction:'Move the pool 10 metres closer to the veranda.'});expect('accepted'in bad&&bad.accepted).toBe(false);expect('save'in bad&&bad.save).toBe(saved);
 });
 it('rejects unsupported briefs and instructions',async()=>{
  await expect(studioRehearsal({action:'stage',brief:'A snowy hillside palace',stage:2})).rejects.toThrow('supports only');
  await expect(studioRehearsal({action:'edit',save:'{}',instruction:'Move pool and change the roof'})).rejects.toThrow('Mock supports only');
 });
 it('hides replay in production and denies cross-origin requests',async()=>{
  vi.stubEnv('NODE_ENV','production');expect((await POST(new Request('http://localhost/api/ai/staged-rehearsal',{method:'POST'}))).status).toBe(404);
  vi.stubEnv('NODE_ENV','test');expect((await POST(new Request('http://localhost/api/ai/staged-rehearsal',{method:'POST',headers:{origin:'https://elsewhere.test'}}))).status).toBe(403);
 });
});
