"use client";

import { create } from "zustand";
import type { AssetSpec } from "@/lib/assets/native/spec";
import type { CuratedAsset } from "@/types/assets";
import type { PlanInput } from "@/lib/library/plans";
import type { AssetPlan, DesignRecipe, GenerationReport, KnowledgeNeed, KnowledgeStatus, Need, PlannedAsset } from "@/types/library";
import type { RecipeInput } from "@/lib/library/recipes";
import type { GenerationAvailability } from "@/lib/assetGeneration/providers";

/**
 * Client view of the server-persisted library (Needs, Knowledge Needs and Recipes). Not persisted locally: the server is the
 * source of truth, because generation runs there and records needs there.
 */

type Action =
  | { action: "setNeedStatus"; id: string; status: Exclude<Need["status"], "approved"> }
  | { action: "completeNeed"; id: string; assetId: string }
  | { action: "saveRecipe"; id?: string; recipe: RecipeInput; approve?: boolean }
  | { action: "setRecipeApproval"; id: string; approval: DesignRecipe["approval"] }
  | { action: "deleteRecipe"; id: string }
  | { action: "setKnowledgeStatus"; id: string; status: KnowledgeStatus }
  | { action: "savePlan"; plan: PlanInput }
  | { action: "deletePlan"; id: string }
  | { action: "completePlannedAsset"; planId: string; plannedAssetId: string; assetId: string }
  | { action: "discardNativeSpec"; planId: string; plannedAssetId: string }
  | { action: "generateExternal"; planId: string; assetIds?: string[] }
  | { action: "linkKnowledge"; id: string; kind: "asset" | "recipe"; targetId: string; linked: boolean };

interface LibraryStore {
  needs: Need[];
  recipes: DesignRecipe[];
  knowledge: KnowledgeNeed[];
  plans: AssetPlan[];
  /** One report per generation, newest first: what the learning loop found and stored. */
  generations: GenerationReport[];
  generation: GenerationAvailability | null;
  loaded: boolean;
  loading: boolean;
  error: string;
  refresh: (adminEmail: string) => Promise<void>;
  /** Runs an admin action and reloads; resolves to an error message, or null on success. */
  act: (adminEmail: string, action: Action) => Promise<string | null>;
  /** Asks the AI for a recipe draft for a Knowledge Need. Never saves; resolves to the validated draft or an error message. */
  proposeRecipe: (adminEmail: string, knowledgeId: string, avoid?: string[]) => Promise<RecipeProposal | { error: string }>;
  /** Asks the AI planner for an Asset Pack draft for a Need. Never saves. */
  planAssets: (adminEmail: string, target: { needId?: string; knowledgeId?: string }, opts?: { known?: string[]; avoid?: string[] }) => Promise<PlanDraft | { error: string }>;
  /** Saves (creates or updates) a plan and reloads. */
  savePlan: (adminEmail: string, plan: PlanInput) => Promise<{ plan: AssetPlan } | { error: string }>;
  /** Native generate / regenerate / refine for one planned asset. */
  generateNative: (adminEmail: string, planId: string, plannedAssetId: string, instruction?: string) => Promise<NativeOutcome | { error: string }>;
  /** A candidate spec for upgrading an approved native asset. Nothing is saved server-side; the caller stages the candidate for review. */
  upgradeNative: (adminEmail: string, asset: CuratedAsset, instruction?: string) => Promise<NativeOutcome | { error: string }>;
}

export interface PlanDraft {
  draft: { title: string; knowledgeId?: string; needId?: string; assets: PlannedAsset[] };
  adjustments: string[];
}

export type NativeOutcome =
  | { kind: "spec"; spec: AssetSpec; stats: { triangles: number; detail: string; notes: string[]; /** The validation error the one automatic repair retry fixed. */ retry?: { firstError: string } } }
  | { kind: "external"; reason: string };

/** Hands the Recipes tab a Knowledge Need to file a new recipe under, with the AI draft when there is one. */
export interface RecipeIntent extends Partial<RecipeProposal> {
  knowledgeId: string;
  title: string;
  /** Why there is no draft (generation failed and the blank form was opened instead). */
  notice?: string;
  nonce: number;
}

export interface RecipeProposal {
  recipe: RecipeInput;
  /** What validation changed to keep the draft consistent with the Knowledge Need. */
  adjustments: string[];
}

const headers = (email: string) => ({ "Content-Type": "application/json", "x-admin-email": email });

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  needs: [],
  recipes: [],
  knowledge: [],
  plans: [],
  generations: [],
  generation: null,
  loaded: false,
  loading: false,
  error: "",

  refresh: async (adminEmail) => {
    set({ loading: true });
    try {
      const res = await fetch("/api/admin/library", { headers: headers(adminEmail), cache: "no-store" });
      const data = (await res.json()) as { needs?: Need[]; recipes?: DesignRecipe[]; knowledge?: KnowledgeNeed[]; plans?: AssetPlan[]; generations?: GenerationReport[]; generation?: GenerationAvailability; error?: string };
      if (!res.ok || !data.needs || !data.recipes) throw new Error(data.error ?? `Library request failed (HTTP ${res.status}).`);
      set({ needs: data.needs, recipes: data.recipes, knowledge: data.knowledge ?? [], plans: data.plans ?? [], generations: data.generations ?? [], generation: data.generation ?? null, loaded: true, error: "" });
    } catch (err) {
      set({ error: (err as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  act: async (adminEmail, action) => {
    try {
      const res = await fetch("/api/admin/library", { method: "POST", headers: headers(adminEmail), body: JSON.stringify(action) });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) return data.error ?? `Request failed (HTTP ${res.status}).`;
      await get().refresh(adminEmail);
      return null;
    } catch (err) {
      return (err as Error).message;
    }
  },

  proposeRecipe: async (adminEmail, knowledgeId, avoid) => {
    try {
      const res = await fetch("/api/admin/learn/recipe", { method: "POST", headers: headers(adminEmail), body: JSON.stringify({ knowledgeId, avoid }) });
      const data = (await res.json().catch(() => ({}))) as Partial<RecipeProposal> & { error?: string };
      if (!res.ok || !data.recipe) return { error: data.error ?? `Recipe proposal failed (HTTP ${res.status}).` };
      return { recipe: data.recipe, adjustments: data.adjustments ?? [] };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  planAssets: async (adminEmail, target, opts) => {
    try {
      const res = await fetch("/api/admin/learn/assets", { method: "POST", headers: headers(adminEmail), body: JSON.stringify({ ...target, ...opts }) });
      const data = (await res.json().catch(() => ({}))) as Partial<PlanDraft> & { error?: string };
      if (!res.ok || !data.draft) return { error: data.error ?? `Asset planning failed (HTTP ${res.status}).` };
      return { draft: data.draft, adjustments: data.adjustments ?? [] };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  savePlan: async (adminEmail, plan) => {
    try {
      const res = await fetch("/api/admin/library", { method: "POST", headers: headers(adminEmail), body: JSON.stringify({ action: "savePlan", plan }) });
      const data = (await res.json().catch(() => ({}))) as { error?: string; value?: AssetPlan };
      if (!res.ok || !data.value) return { error: data.error ?? `Request failed (HTTP ${res.status}).` };
      await get().refresh(adminEmail);
      return { plan: data.value };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  generateNative: async (adminEmail, planId, plannedAssetId, instruction) => {
    try {
      const res = await fetch("/api/admin/learn/native", { method: "POST", headers: headers(adminEmail), body: JSON.stringify({ planId, plannedAssetId, instruction }) });
      const data = (await res.json().catch(() => ({}))) as Partial<NativeOutcome> & { error?: string };
      if (!res.ok || !data.kind) return { error: data.error ?? `Native generation failed (HTTP ${res.status}).` };
      await get().refresh(adminEmail);
      return data as NativeOutcome;
    } catch (err) {
      return { error: (err as Error).message };
    }
  },

  upgradeNative: async (adminEmail, asset, instruction) => {
    if (!asset.sourceSpec || !asset.family) return { error: "This asset has no native spec to upgrade." };
    try {
      const body = { name: asset.name, category: asset.family, style: asset.styleTags ?? [], dimensions: asset.dimensions, generationPrompt: asset.generationPrompt, current: asset.sourceSpec, instruction };
      const res = await fetch("/api/admin/learn/native/upgrade", { method: "POST", headers: headers(adminEmail), body: JSON.stringify(body) });
      const data = (await res.json().catch(() => ({}))) as Partial<NativeOutcome> & { error?: string };
      if (!res.ok || !data.kind) return { error: data.error ?? `Upgrade failed (HTTP ${res.status}).` };
      return data as NativeOutcome;
    } catch (err) {
      return { error: (err as Error).message };
    }
  },
}));
