import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { generateText, Output } from "ai";
import { describe, it } from "vitest";
import { AI_PROVIDER_OPTIONS, getAiModel } from "@/lib/ai/model";
import { buildNativePrompt, NATIVE_SYSTEM_PROMPT } from "@/lib/library/nativeAi";
import type { PlannedAsset } from "@/types/library";
import { buildAsset } from "../build";
import { cleanLooseSpec, specOutputSchema } from "../spec";
import { encodePng, renderAsset } from "./render";

/**
 * Live QA against the REAL model. Skipped unless NATIVE_LIVE_QA=<generations per scenario> is set, because it spends tokens:
 *
 *   NATIVE_LIVE_QA=10 NATIVE_QA_DIR=/tmp/qa NATIVE_QA_LABEL=after NATIVE_QA_ONLY=deck,chaise npx vitest run live
 *
 * It runs exactly the production path (system prompt → model → loose schema → cleanLooseSpec → buildAsset) and records, per
 * generation, whether it built, its triangle count and, when it failed, why. Nothing here touches the library store.
 */

const N = Number(process.env.NATIVE_LIVE_QA ?? 0);
const DIR = process.env.NATIVE_QA_DIR ?? "/tmp/native-qa";
const LABEL = process.env.NATIVE_QA_LABEL ?? "run";
const ONLY = (process.env.NATIVE_QA_ONLY ?? "").split(",").filter(Boolean);

const asset = (id: string, name: string, category: PlannedAsset["category"], description: string, style: string[], material: string, dimensions: PlannedAsset["dimensions"], intent: string): PlannedAsset => ({
  id, name, category, description, style, material, dimensions, tags: [], priority: "recommended", estimatedReuse: 70, contexts: ["poolside"], generationPrompt: intent, approved: true, generated: false,
});

/** A planner-style, detail-hungry brief: the kind that tempts the model into dozens of slats. Set NATIVE_QA_RICH=1. */
const RICH: Record<string, string> = {
  deck: "Highly detailed: individual slats on the seat and on the back, slatted armrests, folding X-frame legs, rails, adjustable back bar, headrest cushion and seat cushion.",
  chaise: "Highly detailed: a full slatted seat deck with many narrow slats, a slatted adjustable back, slatted side rails, four legs with cross braces, wheels at the head end, a thick full-length cushion and a rolled headrest pillow.",
  pendant: "Show the woven rattan structure: horizontal and vertical ribs, a rim ring, a top cap, a cord and a canopy plate.",
  lantern: "Show all details: frame posts, top cap, base, glass panels, glowing candle, handle and finial.",
  planter: "Show the woven structure with horizontal bands and vertical ribs, a rope rim and small feet.",
};

const SCENARIOS = [
  asset("deck", "Tropical Deck Chair", "furniture", "A slatted teak deck chair with a reclined back and a cream cushion, for a tropical poolside terrace.", ["tropical", "rustic"], "teak", { width: 0.65, depth: 1.05, height: 0.95 }, "Tropical teak slatted deck chair with reclined back and seat cushion"),
  asset("chaise", "Pool Chaise Lounge", "furniture", "A long adjustable pool chaise lounge with a slatted frame, a reclined back section and a full-length cushion.", ["modern", "resort"], "wood", { width: 0.75, depth: 2.0, height: 0.85 }, "Resort pool chaise lounge, slatted frame, reclined back, long cushion"),
  asset("pendant", "Rattan Pendant Light", "light", "A woven rattan dome pendant light that hangs over a dining table and glows warmly.", ["boho", "tropical"], "rattan", { width: 0.5, depth: 0.5, height: 0.9 }, "Woven rattan dome pendant light hanging from a cord, warm glowing bulb inside"),
  asset("lantern", "Modern Lantern", "light", "A modern black-framed glass lantern with a warm glowing centre, for a terrace table or path.", ["modern", "minimal"], "metal", { width: 0.25, depth: 0.25, height: 0.5 }, "Modern lantern: dark metal frame, glass panels, warm light glowing inside, handle on top"),
  asset("planter", "Woven Planter", "decorative", "A basket-style woven rattan planter with a tapered body and a dark soil surface.", ["boho", "natural"], "rattan", { width: 0.45, depth: 0.45, height: 0.5 }, "Basket-style woven planter, tapered, rope rim, soil on top"),
].map((s) => (process.env.NATIVE_QA_RICH ? { ...s, description: `${s.description} ${RICH[s.id] ?? ""}`.trim() } : s)).filter((s) => ONLY.length === 0 || ONLY.includes(s.id));

interface Row { scenario: string; run: number; stage: "ok" | "schema" | "build" | "unsupported" | "model"; error?: string; triangles?: number; detail?: string; notes?: string[]; parts?: number; ms: number }

describe.skipIf(!N)("live native generation QA", () => {
  it("generates and builds", async () => {
    try { process.loadEnvFile(".env.local"); } catch { /* env may already be set */ }
    const out = path.join(DIR, LABEL);
    mkdirSync(out, { recursive: true });
    const jobs = SCENARIOS.flatMap((s) => Array.from({ length: s.id === "deck" || s.id === "chaise" ? N : Math.min(N, Number(process.env.NATIVE_QA_OTHERS ?? 3)) }, (_, i) => ({ s, i })));
    const rows: Row[] = [];
    const specs: Record<string, unknown> = {};
    const queue = [...jobs];
    const worker = async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        const { s, i } = job;
        const t0 = Date.now();
        const row: Row = { scenario: s.id, run: i, stage: "model", ms: 0 };
        try {
          const { output } = await generateText({
            model: getAiModel(), maxOutputTokens: 6000, system: NATIVE_SYSTEM_PROMPT,
            messages: [{ role: "user", content: buildNativePrompt(s, "Tropical estate pack") }],
            output: Output.object({ schema: specOutputSchema }), providerOptions: AI_PROVIDER_OPTIONS,
          });
          const parsed = specOutputSchema.safeParse(output);
          if (!parsed.success) Object.assign(row, { stage: "schema", error: parsed.error.issues[0]?.message });
          else if (parsed.data.unsupported) Object.assign(row, { stage: "unsupported", error: parsed.data.unsupported.reason });
          else {
            const built = buildAsset(cleanLooseSpec(parsed.data));
            specs[`${s.id}-${i}`] = parsed.data;
            if (!built.ok) Object.assign(row, { stage: "build", error: built.error, parts: parsed.data.parts.length });
            else {
              Object.assign(row, { stage: "ok", triangles: built.asset.triangles, detail: built.asset.detail, notes: built.asset.notes, parts: parsed.data.parts.length });
              writeFileSync(path.join(out, `${s.id}-${i}.png`), encodePng(renderAsset(built.asset), 360, 360));
            }
          }
        } catch (err) {
          const e = err as { text?: string; cause?: unknown; finishReason?: string };
          row.error = `${err instanceof Error ? err.message.slice(0, 200) : String(err)}${e.finishReason ? ` [finish: ${e.finishReason}]` : ""}${e.cause ? ` cause: ${String((e.cause as Error).message ?? e.cause).slice(0, 300)}` : ""}${e.text ? ` text-tail: …${e.text.slice(-160)}` : ""}`;
        }
        row.ms = Date.now() - t0;
        rows.push(row);
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    rows.sort((a, b) => a.scenario.localeCompare(b.scenario) || a.run - b.run);
    writeFileSync(path.join(out, "results.json"), JSON.stringify(rows, null, 1));
    writeFileSync(path.join(out, "specs.json"), JSON.stringify(specs));
    for (const id of new Set(rows.map((r) => r.scenario))) {
      const mine = rows.filter((r) => r.scenario === id);
      const ok = mine.filter((r) => r.stage === "ok");
      const tri = ok.map((r) => r.triangles!);
      console.log(`${id}: ${ok.length}/${mine.length} built` + (tri.length ? `, triangles ${Math.min(...tri)}–${Math.max(...tri)}` : ""));
      for (const r of mine.filter((x) => x.stage !== "ok")) console.log(`   ✗ [${r.stage}] ${r.error}`);
    }
  }, 900_000);
});
