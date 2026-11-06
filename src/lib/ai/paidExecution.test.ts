import {afterEach,expect,it,vi} from 'vitest';
import {withReservedCall,authorizeProviderDispatch} from './paidExecution';
import {getAiModel,getNativeAssetModel} from './model';
import {generateText} from 'ai';
const policy={model:'gpt-5.6-terra',maxOutputTokens:12000,maxWireBytes:1000};
const body=JSON.stringify({model:policy.model,max_output_tokens:12000});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
it('blocks legacy generation and native-asset models at the final transport even if proxy is bypassed',async()=>{
 vi.stubEnv('OPENAI_API_KEY','offline-placeholder');const network=vi.fn();vi.stubGlobal('fetch',network);
 for(const model of [getAiModel(),getNativeAssetModel()])await expect(generateText({model,prompt:'Legacy unapproved',maxOutputTokens:12000,maxRetries:0})).rejects.toThrow('no unused server reservation');
 expect(network).not.toHaveBeenCalled();
});
it('bounds model, output ceiling, input bytes and one dispatch per reservation',async()=>{
 await expect(withReservedCall(policy,async()=>authorizeProviderDispatch(JSON.stringify({model:'other',max_output_tokens:12000})))).rejects.toThrow('differs');
 await expect(withReservedCall(policy,async()=>authorizeProviderDispatch(JSON.stringify({model:policy.model,max_output_tokens:13000})))).rejects.toThrow('differs');
 await expect(withReservedCall(policy,async()=>authorizeProviderDispatch('x'.repeat(1001)))).rejects.toThrow('input ceiling');
 await withReservedCall(policy,async()=>{authorizeProviderDispatch(body);expect(()=>authorizeProviderDispatch(body)).toThrow('no unused');});
 expect(()=>authorizeProviderDispatch(body)).toThrow('no unused');
});
it('LEGACY_AI_ROUTES restores legacy transport only; Private Studio still requires a reservation',async()=>{
 vi.stubEnv('OPENAI_API_KEY','offline-placeholder');vi.stubEnv('LEGACY_AI_ROUTES','enabled');
 expect(()=>authorizeProviderDispatch(body)).not.toThrow();
 expect(()=>authorizeProviderDispatch(body,{requireReservation:true})).toThrow('no unused');
 const network=vi.fn();vi.stubGlobal('fetch',network);
 await expect(generateText({model:getAiModel(undefined,undefined,{requireReservation:true}),prompt:'Studio',maxOutputTokens:12000,maxRetries:0})).rejects.toThrow('no unused');
 expect(network).not.toHaveBeenCalled();
 // A reservation context still enforces its own bounds when the switch is on.
 await expect(withReservedCall(policy,async()=>authorizeProviderDispatch(JSON.stringify({model:'other',max_output_tokens:12000})))).rejects.toThrow('differs');
});
