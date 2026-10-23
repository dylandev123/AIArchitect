import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Local saved artifacts only. This route never imports an AI client or author.
export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development" || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(request.url).hostname)) {
    return new Response(null, { status: 404 });
  }
  try {
    const base = join(process.cwd(), ".v3-debug/second-live-b78f82e1b55e");
    const [originalBlueprint, houseConfigJson] = await Promise.all([
      readFile(join(base, "original/provider-response.json"), "utf8"),
      readFile(join(base, "final/recovered-scene.json"), "utf8"),
    ]);
    const hash = (text: string) => createHash("sha256").update(text).digest("hex");
    const sha256 = "b78f82e1b55e0ce9e78b01e40f2a4b0ed8d4841ac3e86f1b6b96923887fb94bb";
    if (hash(originalBlueprint) !== sha256 || hash(houseConfigJson) !== "38af84659ce9a14af0c71be5113d85c08acfe2f206d476f6988f838283dc2536") {
      throw new Error("Saved recovery integrity check failed.");
    }
    return Response.json({ name: "Second-live Mansion — Recovered Draft", houseConfigJson, sha256, originalBlueprint }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "The saved mansion recovery is unavailable or failed its integrity check. Original files were preserved." }, { status: 409 });
  }
}
