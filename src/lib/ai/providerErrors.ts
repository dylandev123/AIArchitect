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
 * The SDK retains the provider's parsed error body on APICallError, but the
 * generic client response intentionally does not disclose it. Keep the small,
 * actionable portion for server diagnostics without ever logging the request,
 * URL, headers, or an unbounded provider body.
 */
export type ProviderRequestRejection = {
  name: string;
  status?: number;
  type?: string;
  code?: string;
  parameter?: string;
  message: string;
};

const PROVIDER_DIAGNOSTIC_MAX_CHARS = 600;

function redactProviderDiagnostic(value: string): string {
  return value
    .replace(/\bsk-(?:proj-)?[A-Za-z0-9_-]{8,}\b/g, "[REDACTED_API_KEY]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(/([\"']?(?:(?:x-)?api[_-]?key|authorization|cookie|password|secret|token)[\"']?\s*[:=]\s*[\"']?)[^\"'\s,}\]]+/gi, "$1[REDACTED]")
    .slice(0, PROVIDER_DIAGNOSTIC_MAX_CHARS);
}

function providerErrorObject(error: APICallError): Record<string, unknown> | undefined {
  const fromData = error.data;
  if (fromData && typeof fromData === "object" && !Array.isArray(fromData)) {
    const nested = (fromData as Record<string, unknown>).error;
    if (nested && typeof nested === "object" && !Array.isArray(nested)) return nested as Record<string, unknown>;
  }
  if (!error.responseBody) return undefined;
  try {
    const parsed: unknown = JSON.parse(error.responseBody);
    const nested = parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>).error
      : undefined;
    return nested && typeof nested === "object" && !Array.isArray(nested) ? nested as Record<string, unknown> : undefined;
  } catch {
    return undefined;
  }
}

function diagnosticString(value: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  return redactProviderDiagnostic(String(value));
}

/** Extracts only the stable provider-error fields; it never exposes request data. */
export function describeProviderRequestRejection(error: unknown): ProviderRequestRejection | undefined {
  if (!APICallError.isInstance(error)) return undefined;
  const detail = providerErrorObject(error);
  return {
    name: error.name || "AI_APICallError",
    ...(error.statusCode !== undefined ? { status: error.statusCode } : {}),
    ...(diagnosticString(detail?.type) ? { type: diagnosticString(detail?.type) } : {}),
    ...(diagnosticString(detail?.code) ? { code: diagnosticString(detail?.code) } : {}),
    ...(diagnosticString(detail?.param) ? { parameter: diagnosticString(detail?.param) } : {}),
    message: diagnosticString(detail?.message) ?? redactProviderDiagnostic(error.message || "Provider request failed"),
  };
}

/** V3-only server logging for provider rejections before a model response exists. */
export function logV3ProviderRequestRejection(error: unknown): ProviderRequestRejection | undefined {
  const rejection = describeProviderRequestRejection(error);
  if (rejection) console.warn("[v3-provider] request rejected", rejection);
  return rejection;
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
