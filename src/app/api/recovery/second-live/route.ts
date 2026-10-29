import { replayRetainedVillaResponse } from "@/lib/villa/responseArtifact";
import { compositionFindings } from "@/lib/villa/composition";

// The four-level Villa response recorded by generation c5578b5e-cb1e-40cc-a877-f7b01c17a990.
const responseId = "322247c40a2c1eb0b3e667280d7f9551759779cb4b753e6c925c386e99664036";

// Local saved artifacts only. This route never imports an AI client or author.
export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development" || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(request.url).hostname)) {
    return new Response(null, { status: 404 });
  }
  try {
    const recovered = await replayRetainedVillaResponse(responseId);
    if (!recovered) return Response.json({ error: "The saved Villa response file is missing. Original files were preserved." }, { status: 404 });
    return Response.json({ url: `/dev/villa-playground?response=${responseId}` }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message.includes('hash mismatch')) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    const findings = compositionFindings(error);
    return Response.json({ error: `Saved mansion validation failed: ${findings.map(f => `${f.path}: ${f.message}`).join('; ')}`, findings }, { status: 422 });
  }
}
