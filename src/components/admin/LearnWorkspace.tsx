"use client";

import { useState } from "react";
import {
  Sparkles, CheckCircle, XCircle, RotateCcw, ChevronDown, ChevronRight,
  AlertTriangle, BookOpen,
} from "lucide-react";
import { useAdminStore } from "@/store/useAdminStore";
import { useLearnStore } from "@/store/useLearnStore";
import { useProjectStore } from "@/store/useProjectStore";
import { setMaterialZone } from "@/lib/house/jsonEdit";
import type { LearnedStylePreset, LearnProposal } from "@/types/learn";
import type { MaterialZone } from "@/types/house";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `lp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function validatePresetsClientSide(presets: LearnedStylePreset[]): string[] {
  const errors: string[] = [];
  const HEX_RE = /^#[0-9a-fA-F]{6}$/;
  const KEBAB_RE = /^[a-z][a-z0-9-]*$/;

  presets.forEach((p, i) => {
    const prefix = `Preset ${i + 1} (${p.styleKey}):`;
    if (!KEBAB_RE.test(p.styleKey)) errors.push(`${prefix} styleKey must be kebab-case`);
    if (!p.label || p.label.length < 3) errors.push(`${prefix} label is too short`);
    if (p.compatibleRoofs.length === 0) errors.push(`${prefix} must have at least one compatible roof`);

    const mats = p.suggestedMaterials;
    (["exterior","roof","trim","decking"] as const).forEach((zone) => {
      if (!HEX_RE.test(mats[zone].color)) {
        errors.push(`${prefix} ${zone} color "${mats[zone].color}" is not a valid hex`);
      }
    });
  });

  return errors;
}

// ── Material Swatches ──────────────────────────────────────────────────────

function MaterialSwatches({ preset }: { preset: LearnedStylePreset }) {
  const zones: { zone: MaterialZone; label: string }[] = [
    { zone: "exterior", label: "Ext" },
    { zone: "roof",     label: "Roof" },
    { zone: "trim",     label: "Trim" },
    { zone: "decking",  label: "Deck" },
  ];
  return (
    <div className="flex gap-2">
      {zones.map(({ zone, label }) => (
        <div key={zone} className="flex flex-col items-center gap-0.5">
          <div
            className="h-7 w-7 rounded-md border border-white/10"
            style={{ backgroundColor: preset.suggestedMaterials[zone].color }}
            title={`${label}: ${preset.suggestedMaterials[zone].material} ${preset.suggestedMaterials[zone].color}`}
          />
          <span className="text-[9px] text-neutral-600">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Option Pills ───────────────────────────────────────────────────────────

function OptionPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-white/5 bg-white/[0.03] px-2 py-1">
      <span className="text-[10px] text-neutral-600">{label}</span>
      <span className="text-[10px] font-medium text-neutral-300">{value}</span>
    </div>
  );
}

// ── Preset Card ────────────────────────────────────────────────────────────

interface PresetCardProps {
  preset: LearnedStylePreset;
  projectId?: string;
  proposalStatus: "pending" | "approved" | "rejected";
}

function PresetCard({ preset, projectId, proposalStatus }: PresetCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [applied, setApplied] = useState(false);
  const updateHouseConfig = useProjectStore((s) => s.updateHouseConfig);
  const getProject = useProjectStore((s) => s.getProject);

  const handleApply = () => {
    if (!projectId) return;
    const project = getProject(projectId);
    if (!project) return;

    // Build updated JSON with all exterior options + suggested materials
    let json = project.houseConfigJson;

    // Apply materials zone by zone
    const mats = preset.suggestedMaterials;
    (["exterior", "roof", "trim", "decking"] as MaterialZone[]).forEach((zone) => {
      json = setMaterialZone(json, zone, {
        material: mats[zone].material,
        color: mats[zone].color,
      });
    });

    // Inject exteriorOptions into the JSON
    try {
      const parsed = JSON.parse(json) as Record<string, unknown>;
      parsed.exteriorOptions = { ...preset.exteriorOptions };
      json = JSON.stringify(parsed, null, 2);
    } catch {
      // leave json as-is if parse fails
    }

    updateHouseConfig(projectId, json);
    setApplied(true);
    setTimeout(() => setApplied(false), 2000);
  };

  const opts = preset.exteriorOptions;

  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-neutral-100">{preset.label}</span>
            <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-neutral-500">
              {preset.styleKey}
            </code>
          </div>
          <p className="mt-0.5 text-xs text-neutral-500">{preset.description}</p>
        </div>
        <MaterialSwatches preset={preset} />
      </div>

      {/* Tags */}
      {preset.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {preset.tags.map((t) => (
            <span key={t} className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-neutral-600">{t}</span>
          ))}
        </div>
      )}

      {/* Expand options */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className="mt-2 flex items-center gap-1 text-[11px] text-neutral-600 hover:text-neutral-400 transition"
      >
        {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        {expanded ? "Hide" : "Show"} options
      </button>

      {expanded && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <OptionPill label="Wall" value={opts.wallFinish} />
          <OptionPill label="Window" value={opts.windowStyle} />
          <OptionPill label="Door" value={opts.doorStyle} />
          <OptionPill label="Railing" value={opts.railingStyle} />
          <OptionPill label="Column" value={opts.columnStyle} />
          <OptionPill label="Patio" value={opts.patioSurface} />
          <OptionPill label="Pool" value={opts.poolTile} />
          <div className="flex items-center gap-1.5 rounded-md border border-white/5 bg-white/[0.03] px-2 py-1">
            <span className="text-[10px] text-neutral-600">Roofs</span>
            <span className="text-[10px] font-medium text-neutral-300">{preset.compatibleRoofs.join(", ")}</span>
          </div>
        </div>
      )}

      {/* Apply button */}
      {proposalStatus === "approved" && projectId && (
        <button
          onClick={handleApply}
          className={`mt-2.5 w-full rounded-lg py-1.5 text-xs font-medium transition ${
            applied
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/20"
              : "bg-amber-500/15 text-amber-300 border border-amber-500/20 hover:bg-amber-500/25"
          }`}
        >
          {applied ? "Applied to project!" : "Apply to Current Project"}
        </button>
      )}
    </div>
  );
}

// ── Proposal Card ──────────────────────────────────────────────────────────

function ProposalCard({ proposal, projectId }: { proposal: LearnProposal; projectId?: string }) {
  const approve = useLearnStore((s) => s.approve);
  const reject = useLearnStore((s) => s.reject);
  const [reasoningOpen, setReasoningOpen] = useState(false);

  const statusColors: Record<string, string> = {
    pending:  "text-amber-400 bg-amber-500/10 border-amber-500/20",
    approved: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    rejected: "text-neutral-500 bg-white/[0.03] border-white/5",
  };

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-neutral-300 line-clamp-2">{proposal.prompt}</p>
          <p className="mt-0.5 text-[10px] text-neutral-600">
            {new Date(proposal.createdAt).toLocaleString()}
            {proposal.reviewedAt && ` · reviewed ${new Date(proposal.reviewedAt).toLocaleString()}`}
          </p>
        </div>
        <span className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-medium capitalize ${statusColors[proposal.status]}`}>
          {proposal.status}
        </span>
      </div>

      {/* Validation errors */}
      {proposal.validationErrors.length > 0 && (
        <div className="mt-2 rounded-lg bg-red-500/10 p-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-red-400">
            <AlertTriangle size={12} /> Validation errors (cannot approve)
          </div>
          <ul className="mt-1 list-disc pl-4">
            {proposal.validationErrors.map((e, i) => (
              <li key={i} className="text-[10px] text-red-400/80">{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* AI Reasoning */}
      <button
        onClick={() => setReasoningOpen((o) => !o)}
        className="mt-2 flex items-center gap-1 text-[11px] text-neutral-600 hover:text-neutral-400 transition"
      >
        {reasoningOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        AI reasoning
      </button>
      {reasoningOpen && (
        <p className="mt-1 rounded-lg bg-white/[0.03] p-2.5 text-[11px] text-neutral-400 leading-relaxed">
          {proposal.reasoning}
        </p>
      )}

      {/* Preset cards */}
      <div className="mt-3 flex flex-col gap-2">
        {proposal.presets.map((preset) => (
          <PresetCard
            key={preset.id}
            preset={preset}
            projectId={projectId}
            proposalStatus={proposal.status}
          />
        ))}
      </div>

      {/* Action buttons — only for pending without validation errors */}
      {proposal.status === "pending" && proposal.validationErrors.length === 0 && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => approve(proposal.id)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-500/15 py-2 text-xs font-medium text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25 transition"
          >
            <CheckCircle size={13} /> Publish
          </button>
          <button
            onClick={() => reject(proposal.id)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-500/10 py-2 text-xs font-medium text-red-400 border border-red-500/15 hover:bg-red-500/20 transition"
          >
            <XCircle size={13} /> Reject
          </button>
        </div>
      )}
    </div>
  );
}

// ── Knowledge Base Status ──────────────────────────────────────────────────

function KBStatus() {
  const { publishedKnowledge, history, rollback } = useLearnStore();

  return (
    <div className="flex shrink-0 items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
      <div className="flex items-center gap-3">
        <BookOpen size={13} className="text-neutral-500" />
        <div>
          <span className="text-[11px] font-medium text-neutral-300">
            Knowledge v{publishedKnowledge.version}
          </span>
          <span className="ml-2 text-[11px] text-neutral-600">
            {publishedKnowledge.presets.length} preset{publishedKnowledge.presets.length !== 1 ? "s" : ""} published
          </span>
          {publishedKnowledge.publishedAt && (
            <span className="ml-2 text-[11px] text-neutral-700">
              · {new Date(publishedKnowledge.publishedAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
      {history.length > 0 && (
        <button
          onClick={rollback}
          className="flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] text-neutral-500 border border-white/5 hover:border-white/10 hover:text-neutral-300 transition"
          title={`Roll back to v${history[0].version}: ${history[0].reason}`}
        >
          <RotateCcw size={11} />
          Rollback to v{history[0].version}
        </button>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

interface LearnWorkspaceProps {
  projectId?: string;
}

export function LearnWorkspace({ projectId }: LearnWorkspaceProps) {
  const adminEmail = useAdminStore((s) => s.adminEmail);
  const { proposals, addProposal, updateProposal } = useLearnStore();

  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");

  const handleGenerate = async () => {
    const trimmed = prompt.trim();
    if (!trimmed || generating) return;

    setGenerating(true);
    setGenError("");

    try {
      const res = await fetch("/api/admin/learn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed, adminEmail, projectId }),
      });
      const data = (await res.json()) as {
        proposal?: {
          reasoning: string;
          presets: Array<{
            styleKey: string;
            label: string;
            description: string;
            tags: string[];
            exteriorOptions: LearnedStylePreset["exteriorOptions"];
            suggestedMaterials: LearnedStylePreset["suggestedMaterials"];
            compatibleRoofs: LearnedStylePreset["compatibleRoofs"];
          }>;
        };
        error?: string;
      };

      if (data.error || !data.proposal) {
        throw new Error(data.error ?? "No proposal returned");
      }

      const { reasoning, presets: rawPresets } = data.proposal;

      const presets: LearnedStylePreset[] = rawPresets.map((p) => ({
        id: makeId(),
        ...p,
      }));

      const validationErrors = validatePresetsClientSide(presets);

      const proposal: LearnProposal = {
        id: makeId(),
        prompt: trimmed,
        reasoning,
        status: "pending",
        createdAt: new Date().toISOString(),
        presets,
        validationErrors,
      };

      addProposal(proposal);
      setPrompt("");
    } catch (err) {
      setGenError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  // Only show the most recent 20 proposals, pending first
  const sortedProposals = [...proposals].sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (b.status === "pending" && a.status !== "pending") return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  void updateProposal; // keep import used

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden">
      {/* Knowledge base status bar */}
      <KBStatus />

      {/* Prompt input */}
      <div className="flex shrink-0 flex-col gap-2">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate();
          }}
          placeholder={`Describe what you want — e.g. "Add Caribbean coastal wall combinations" or "Create a Mediterranean exterior pack with terracotta roofs"`}
          rows={3}
          className="w-full resize-none rounded-lg border border-white/8 bg-neutral-800/60 p-3 text-sm text-neutral-200 placeholder-neutral-600 outline-none focus:border-amber-500/40 transition"
        />
        {genError && <p className="text-xs text-red-400">{genError}</p>}
        <button
          onClick={handleGenerate}
          disabled={generating || !prompt.trim()}
          className="flex items-center justify-center gap-2 rounded-lg bg-amber-500/20 py-2.5 text-sm font-medium text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <Sparkles size={14} />
          {generating ? "Generating proposal…" : "Generate Proposal"}
          <span className="text-[10px] text-amber-500/70">⌘↵</span>
        </button>
      </div>

      {/* Examples */}
      {proposals.length === 0 && !generating && (
        <div className="shrink-0 rounded-lg border border-white/5 bg-white/[0.02] p-3">
          <p className="mb-2 text-[11px] font-medium text-neutral-500">Example prompts</p>
          <div className="flex flex-col gap-1.5">
            {[
              "Improve modern garage door styles",
              "Add Caribbean wall combinations with bright tropical colors",
              "Create a Mediterranean exterior pack",
              "Design a Japandi minimalist style with dark timber",
              "Propose Scandinavian coastal variants",
            ].map((ex) => (
              <button
                key={ex}
                onClick={() => setPrompt(ex)}
                className="rounded-md px-2.5 py-1.5 text-left text-[11px] text-neutral-500 hover:bg-white/5 hover:text-neutral-300 transition"
              >
                &ldquo;{ex}&rdquo;
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Proposal list */}
      {sortedProposals.length > 0 && (
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-3 pb-2">
            {sortedProposals.map((proposal) => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                projectId={projectId}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
