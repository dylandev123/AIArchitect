import {expect,it,vi,afterEach} from 'vitest';
const read=vi.hoisted(()=>vi.fn());
vi.mock('node:fs/promises',()=>({readFile:read}));
import {GET} from './route';
afterEach(()=>vi.unstubAllEnvs());
const request=new Request('http://localhost/api/dev/scene-diagnostics/10000000-0000-4000-8000-000000000001');
const context={params:Promise.resolve({responseId:'10000000-0000-4000-8000-000000000001'})};
it('reloads model/reasoning/usage/validation with diagnostics while retaining private payloads server-side',async()=>{
 vi.stubEnv('NODE_ENV','development');read.mockResolvedValue(JSON.stringify({diagnostics:{outcome:'rejected'},providerMetadata:{model:'gpt-6.1-sol',reasoningEffort:'high',usage:{totalTokens:5},response:{private:'provider body'}},requestFingerprint:'frozen-input',validation:{status:'rejected'},architecturalQuality:{status:'requires-visual-review'},messages:['private'],requestSystem:'private',rawResponse:'private'}));
 const body=await (await GET(request,context)).json();expect(body).toEqual({outcome:'rejected',experiment:{model:'gpt-6.1-sol',reasoningEffort:'high',usage:{totalTokens:5},requestFingerprint:'frozen-input',validation:{status:'rejected'},architecturalQuality:'requires-visual-review'}});expect(JSON.stringify(body)).not.toContain('private');
});
it('keeps saved development diagnostics unavailable in production',async()=>{vi.stubEnv('NODE_ENV','production');expect((await GET(request,context)).status).toBe(404);});
