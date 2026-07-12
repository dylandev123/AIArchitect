import { NextRequest, NextResponse } from "next/server";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { aiPatchResponseSchema } from "@/lib/ai/siteSchema";
import { buildScopedSystemPrompt } from "@/lib/ai/systemPrompt";
import { classifyPromptTarget, validateOpsForScope, type EditScope } from "@/lib/ai/targeting";
import { applyPatch } from "@/lib/house/applyPatch";

export const maxDuration = 60;

const MODEL = process.env.AI_HOUSE_MODEL || "anthropic/claude-sonnet-4.6";
const MAX_HISTORY_TURNS = 12;

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

interface RequestBody {
  prompt?: string;
  currentHouseJson?: string;
  history?: ChatTurn[];
  scope?: EditScope;
}

export async function POST(req: NextRequest) {
  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
    return NextResponse.json(
      {
        error:
          "AI isn't configured yet. Set AI_GATEWAY_API_KEY in your environment (Vercel AI Gateway) to enable this.",
      },
      { status: 503 }
    );
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: "Missing prompt." }, { status: 400 });
  }

  const currentHouseJson = typeof body.currentHouseJson === "string" ? body.currentHouseJson : "{}";
  const history = Array.isArray(body.history) ? body.history.slice(-MAX_HISTORY_TURNS) : [];
  const scope = body.scope ?? classifyPromptTarget(prompt);

  try {
    const { output } = await generateText({
      model: MODEL,
      maxOutputTokens: 8000,
      system: buildScopedSystemPrompt(scope),
      messages: [
        ...history.map((turn) => ({ role: turn.role, content: turn.content }) as const),
        {
          role: "user" as const,
          content: `Current house JSON:\n\`\`\`json\n${currentHouseJson}\n\`\`\`\n\nInstruction: ${prompt}`,
        },
      ],
      output: Output.object({ schema: aiPatchResponseSchema }),
    });

    const violations = validateOpsForScope(output.operations, scope);
    if (violations.length > 0) {
      console.warn(`[AI] Scope violations (${scope.label}):`, violations);
    }
    const allowedOps = scope.allowedOps.length > 0
      ? output.operations.filter(o => scope.allowedOps.includes(o.op))
      : output.operations;
    const opsToApply = allowedOps.length > 0 ? allowedOps : output.operations;

    const { json, errors } = applyPatch(currentHouseJson, opsToApply);
    if (errors.length > 0) {
      console.error("AI patch application failed:", errors);
      return NextResponse.json(
        { error: `Couldn't apply that edit cleanly: ${errors[0]}` },
        { status: 502 }
      );
    }

    return NextResponse.json({ summary: output.summary, json });
  } catch (error) {
    if (NoObjectGeneratedError.isInstance(error)) {
      return NextResponse.json(
        { error: "The AI's response didn't match the edit schema. Try rephrasing your request." },
        { status: 502 }
      );
    }
    console.error("AI house generation failed:", error);
    return NextResponse.json({ error: "AI request failed. Please try again." }, { status: 500 });
  }
}
