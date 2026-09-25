import { NextRequest, NextResponse } from "next/server";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { z } from "zod";
import { AI_NOT_CONFIGURED_MESSAGE, getAiModel, isAiConfigured } from "@/lib/ai/model";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "dylandevaux3@gmail.com";

export const maxDuration = 60;

// ── Valid value sets (mirror of composition.ts safe-cast arrays) ──────────────

const WALL_FINISH_VALUES = ["smooth-stucco","rough-stucco","board-batten","horizontal-lap","brick","stone-veneer","cedar-shingle","corrugated-metal","venetian-plaster","split-face-block"] as const;
const WINDOW_STYLE_VALUES = ["casement","double-hung","picture","arched","louvered"] as const;
const DOOR_STYLE_VALUES = ["flush","paneled","glass-panel","double","pivot"] as const;
const RAILING_STYLE_VALUES = ["iron","cable","glass-panel","timber","concrete-wall","picket"] as const;
const COLUMN_STYLE_VALUES = ["none","square-pilaster","craftsman-post","steel-section","board-strip"] as const;
const SURFACE_VALUES = ["concrete","travertine","slate-tile","terracotta","pebble","brick-paver","teak-deck","mosaic-tile"] as const;
const MATERIAL_TYPE_VALUES = ["concrete","stone","wood","glass","metal","stucco","tile","brick","timber","render","cedar","slate","copper","terracotta","marble","zinc","corten"] as const;
const ROOF_TYPE_VALUES = ["flat","gable","hip","mansard","shed","butterfly","sawtooth"] as const;

// ── Proposal schema ───────────────────────────────────────────────────────────

const colorHex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a 6-digit hex color");

const learnedPresetSchema = z.object({
  styleKey: z
    .string()
    .regex(/^[a-z][a-z0-9-]*$/, "Must be kebab-case (e.g. 'caribbean-coastal')")
    .describe("Unique kebab-case identifier for this style"),
  label: z.string().min(3).max(60).describe("Human-readable name (e.g. 'Caribbean Coastal')"),
  description: z.string().max(200).describe("One sentence describing the style's character"),
  tags: z.array(z.string().min(2).max(30)).max(8),
  exteriorOptions: z.object({
    wallFinish:   z.enum(WALL_FINISH_VALUES).describe("Primary cladding/finish on exterior walls"),
    windowStyle:  z.enum(WINDOW_STYLE_VALUES).describe("Window operability and frame style"),
    doorStyle:    z.enum(DOOR_STYLE_VALUES).describe("Entry door character"),
    railingStyle: z.enum(RAILING_STYLE_VALUES).describe("Balcony/stair railing type"),
    columnStyle:  z.enum(COLUMN_STYLE_VALUES).describe("Structural column/post profile"),
    patioSurface: z.enum(SURFACE_VALUES).describe("Ground-level patio or terrace material"),
    poolTile:     z.enum(SURFACE_VALUES).describe("Pool interior tile"),
  }),
  suggestedMaterials: z.object({
    exterior: z.object({ material: z.enum(MATERIAL_TYPE_VALUES), color: colorHex }),
    roof:     z.object({ material: z.enum(MATERIAL_TYPE_VALUES), color: colorHex }),
    trim:     z.object({ material: z.enum(MATERIAL_TYPE_VALUES), color: colorHex }),
    decking:  z.object({ material: z.enum(MATERIAL_TYPE_VALUES), color: colorHex }),
  }),
  compatibleRoofs: z
    .array(z.enum(ROOF_TYPE_VALUES))
    .min(1)
    .max(7)
    .describe("Roof forms that suit this style"),
});

const proposalResponseSchema = z.object({
  reasoning: z
    .string()
    .describe("Design rationale — what defines this style family and why these specific choices were made"),
  presets: z.array(learnedPresetSchema).min(1).max(3),
});

// ── System prompt ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert architectural style consultant for a procedural 3D building generator.

Your task is to propose new architectural style presets based on the admin's request. Each preset is a complete exterior configuration that uses ONLY the valid values listed below — these correspond to geometry and material options that already exist in the 3D rendering engine.

VALID VALUES (you must use ONLY these exact strings):

wallFinish: smooth-stucco | rough-stucco | board-batten | horizontal-lap | brick | stone-veneer | cedar-shingle | corrugated-metal | venetian-plaster | split-face-block

windowStyle: casement | double-hung | picture | arched | louvered

doorStyle: flush | paneled | glass-panel | double | pivot

railingStyle: iron | cable | glass-panel | timber | concrete-wall | picket

columnStyle: none | square-pilaster | craftsman-post | steel-section | board-strip

patioSurface / poolTile: concrete | travertine | slate-tile | terracotta | pebble | brick-paver | teak-deck | mosaic-tile

materialType (for exterior/roof/trim/decking): concrete | stone | wood | glass | metal | stucco | tile | brick | timber | render | cedar | slate | copper | terracotta | marble | zinc | corten

roofForms: flat | gable | hip | mansard | shed | butterfly | sawtooth

Colors must be valid 6-digit hex strings (#rrggbb). Choose colors that are visually authentic to the style — not generic defaults.

RULES:
- Never invent values not listed above
- Never reference geometry that isn't controlled by these parameters
- Propose 1-3 distinct presets per response
- Make each preset internally consistent (the choices should read as a coherent style)
- Colors should be carefully chosen to evoke the style (e.g. Caribbean = warm whites, turquoise trims, terracotta roofs)`;

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  if (!isAiConfigured()) {
    return NextResponse.json({ error: AI_NOT_CONFIGURED_MESSAGE }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { prompt, adminEmail } = (body ?? {}) as Record<string, unknown>;

  if (typeof adminEmail !== "string" || adminEmail.trim().toLowerCase() !== ADMIN_EMAIL.trim().toLowerCase()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json({ error: "Missing prompt" }, { status: 400 });
  }

  try {
    const { output } = await generateText({
      model: getAiModel(),
      maxOutputTokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt.trim() }],
      output: Output.object({ schema: proposalResponseSchema }),
    });

    return NextResponse.json({ proposal: output });
  } catch (err) {
    if (NoObjectGeneratedError.isInstance(err)) {
      return NextResponse.json(
        { error: "AI response didn't match the required schema. Try rephrasing." },
        { status: 502 }
      );
    }
    console.error("[admin/learn] AI call failed:", err);
    return NextResponse.json({ error: "AI request failed. Please try again." }, { status: 500 });
  }
}
