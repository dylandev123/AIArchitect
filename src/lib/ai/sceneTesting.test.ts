import {expect,it} from 'vitest';
import {SCENE_TEST_MODELS,sceneTestSettingsSchema,resolveSceneTestSettings} from './sceneTesting';
it('leaves the configured default untouched and blocks production overrides',()=>{
 expect(resolveSceneTestSettings(undefined,'custom-current','production')).toEqual({model:'custom-current',reasoningEffort:undefined});
 expect(()=>resolveSceneTestSettings({model:'gpt-6.1-sol'},'gpt-5.6-terra','production')).toThrow(/development-only/);
 expect(sceneTestSettingsSchema.safeParse({model:'unverified'}).success).toBe(false);
 expect(sceneTestSettingsSchema.safeParse({model:'gpt-6-astra',reasoningEffort:'none'}).success).toBe(false);
 expect(()=>resolveSceneTestSettings({model:'current',reasoningEffort:'high'},'unknown','development')).toThrow(/not verified/);
});
it.each(SCENE_TEST_MODELS)('supports verified medium/high for $id without assuming none works universally',m=>{
 for(const reasoningEffort of ['medium','high'] as const)expect(resolveSceneTestSettings({model:m.id,reasoningEffort},'unchanged','development')).toEqual({model:m.id,reasoningEffort});
 expect(m.efforts.includes('none' as never)).toBe(m.id.startsWith('gpt-5.6'));
});
