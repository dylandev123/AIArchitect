import { generateText, Output } from "ai";
import { AI_PROVIDER_OPTIONS, getNativeAssetModel, getNativeAssetModelId } from "@/lib/ai/model";
import { withUsageLogging } from "@/lib/ai/usage/track";
import { nativeRequestType, specOutputSchema, type NativeGenerateInput } from "./nativeAi";

/**
 * The one model call behind native generation, refinement and upgrade. The repair retry goes through here too, but is logged
 * as its own request type (`native_asset_retry`), so its tokens and cost never hide inside the first attempt's line.
 */
export async function callNativeModel({ system, prompt, attempt }: NativeGenerateInput): Promise<unknown> {
  const { output } = await withUsageLogging({ projectId: null, requestType: nativeRequestType(attempt), scope: "component", model: getNativeAssetModelId(), maxOutputTokens: 6000, stage: "native-generation", retryNumber: attempt === "repair" ? 1 : 0 }, () =>
    generateText({
      model: getNativeAssetModel(),
      maxOutputTokens: 6000,
      system,
      messages: [{ role: "user", content: prompt }],
      output: Output.object({ schema: specOutputSchema }),
      providerOptions: AI_PROVIDER_OPTIONS,
    })
  );
  return output;
}
