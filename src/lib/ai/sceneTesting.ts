import {z} from 'zod';

/** Public development catalogue. Official model pages checked 2026-10-29.
 * Account access is unverified; no model discovery or paid probe runs on load. */
export const SCENE_TEST_MODELS = [
 {id:'gpt-5.6-terra',label:'GPT-5.6 Terra',efforts:['none','low','medium','high','xhigh','max'],input:2,output:12},
 {id:'gpt-5.6-sol',label:'GPT-5.6 Sol',efforts:['none','low','medium','high','xhigh','max'],input:4,output:20},
 {id:'gpt-6.1-sol',label:'GPT-6.1 Sol',efforts:['low','medium','high','xhigh','max'],input:2,output:10},
 {id:'gpt-6-astra',label:'GPT-6 Astra',efforts:['low','medium','high','xhigh','max'],input:10,output:50},
] as const;
export const sceneTestSettingsSchema=z.object({
 model:z.enum(['current','gpt-5.6-terra','gpt-5.6-sol','gpt-6.1-sol','gpt-6-astra']),
 reasoningEffort:z.enum(['medium','high']).optional(),
 fixture:z.literal('mansion-coordination').optional(),
}).strict();
export type SceneTestSettings=z.infer<typeof sceneTestSettingsSchema>;
export function resolveSceneTestSettings(settings:SceneTestSettings|undefined,currentModel:string,environment=process.env.NODE_ENV){
 if(settings&&environment!=='development')throw Error('Model testing overrides are development-only.');
 const model=!settings||settings.model==='current'?currentModel:settings.model;
 const capability=SCENE_TEST_MODELS.find(m=>m.id===model);
 if(settings?.reasoningEffort&&!capability?.efforts.some(e=>e===settings.reasoningEffort))throw Error('Reasoning effort is not verified for this model.');
 return {model,reasoningEffort:settings?.reasoningEffort};
}
