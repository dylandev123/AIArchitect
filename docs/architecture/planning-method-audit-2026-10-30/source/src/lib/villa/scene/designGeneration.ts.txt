import { generateText, Output, NoObjectGeneratedError, type ModelMessage } from 'ai';
import { evaluateDesignCheckpoint } from './designCheckpoint';
import { getAiModel } from '@/lib/ai/model';
import { withUsageLogging } from '@/lib/ai/usage/track';
import { strictSceneResponseSchema, type SceneRequest } from './terra';
import { designProposalSchema, validateDesignProposal, DESIGN_FIRST_INSTRUCTIONS } from './designProposal';

/** A separate model response selects architecture. No operations run here. */
export async function selectDesignProposal(args: {
    input:SceneRequest; system:string; messages:ModelMessage[];
    selection:{model:string;reasoningEffort?:string}; signal:AbortSignal;
    onCall:()=>void; onEvidence:(evidence:unknown)=>void;
}) {
    const system=args.system+DESIGN_FIRST_INSTRUCTIONS;
    const schema=await strictSceneResponseSchema(designProposalSchema);
    let wire:unknown;
    const base={system,messages:args.messages,schema:await Output.object({schema}).responseFormat};
    let evidence:unknown=base;
    args.onEvidence(evidence);
    try {
        const result=await withUsageLogging({projectId:null,requestType:'generation',scope:'world',model:args.selection.model,stage:'villa-scene-design',maxOutputTokens:30000},async()=>{
            args.onCall();
            return generateText({model:getAiModel(record=>{wire=record;},args.selection.model),system,messages:args.messages,
                output:Output.object({schema}),providerOptions:{openai:{strictJsonSchema:true,...(args.selection.reasoningEffort?{reasoningEffort:args.selection.reasoningEffort}:{})}},
                maxOutputTokens:30000,maxRetries:0,abortSignal:AbortSignal.any([args.signal,AbortSignal.timeout(args.input.testing?600000:170000)])});
        });
        evidence={...base,wire,output:result.output,text:result.text,usage:result.totalUsage,finishReason:result.finishReason};
        args.onEvidence(evidence);
        if(result.finishReason!=='stop')throw Error('Spatial proposal incomplete; construction was not requested.');
        const proposal = validateDesignProposal(result.output);
        await evaluateDesignCheckpoint(proposal, decision => {
            evidence = { ...evidence as object, architecturalCheckpoint: decision };
            args.onEvidence(evidence);
        });
        return proposal;
    } catch(error) {
        // Includes SDK structured-output failures; do not rescue them as a scene.
        args.onEvidence({...evidence as object,wire,error:String(error),...(NoObjectGeneratedError.isInstance(error)?{text:error.text,usage:error.usage,finishReason:error.finishReason,response:error.response}:{})});
        throw error;
    }
}
