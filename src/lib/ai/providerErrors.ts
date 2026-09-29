import { NextResponse } from "next/server";
import { APICallError } from "ai";
import type { StageDiagnostics } from "@/lib/architecture/stages/diagnostics";
import type { CapabilityRequest } from "@/types/library";

export const isTimeout = (e: unknown) => e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");

/** Same dev-only diagnostics a successful generation response carries — see `runFinalAssembly`'s success branch. */
export interface ProviderErrorContext {
  architectureDiagnostics?: StageDiagnostics[];
  capabilityRequests?: CapabilityRequest[];
}

/**
 * Maps a model-call failure to a clear, actionable response instead of a generic one (or a platform 504).
 * `stage` (dev-only) names which part of generation actually failed — the mandatory final design call is
 * the one most likely to time out, distinct from the bounded architecture sub-stages, which never throw here.
 * `context` (dev-only, same as a successful response) carries the architecture pipeline's own diagnostics so
 * a final-assembly failure doesn't hide how the stages before it actually went — an HTTP-level error here
 * must never erase what the Architecture debug panel would otherwise show.
 */
export function providerErrorResponse(error: unknown, stage?: string, context?: ProviderErrorContext) {
  const isDev = process.env.NODE_ENV !== "production";
  const devStage = isDev && stage ? { stage } : {};
  const devContext = isDev && context ? context : {};
  if (isTimeout(error)) {
    return NextResponse.json(
      { error: "The AI took too long to respond. Try again, or start with a shorter brief and add detail afterwards.", ...devStage, ...devContext },
      { status: 504 }
    );
  }
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 429) {
      return NextResponse.json({ error: "The AI provider is rate-limiting requests right now. Please wait a moment and try again.", ...devStage, ...devContext }, { status: 429 });
    }
    return NextResponse.json(
      { error: `The AI provider returned an error${error.statusCode ? ` (HTTP ${error.statusCode})` : ""}. Please try again.`, ...devStage, ...devContext },
      { status: 502 }
    );
  }
  return NextResponse.json({ error: "AI request failed. Please try again.", ...devStage, ...devContext }, { status: 500 });
}
