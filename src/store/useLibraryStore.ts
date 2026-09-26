"use client";

import { create } from "zustand";
import type { DesignRecipe, Need } from "@/types/library";
import type { RecipeInput } from "@/lib/library/recipes";
import type { GenerationAvailability } from "@/lib/assetGeneration/providers";

/**
 * Client view of the server-persisted library (Needs and Recipes). Not persisted locally: the server is the
 * source of truth, because generation runs there and records needs there.
 */

type Action =
  | { action: "setNeedStatus"; id: string; status: Exclude<Need["status"], "approved"> }
  | { action: "completeNeed"; id: string; assetId: string }
  | { action: "saveRecipe"; id?: string; recipe: RecipeInput }
  | { action: "setRecipeApproval"; id: string; approval: DesignRecipe["approval"] }
  | { action: "deleteRecipe"; id: string };

interface LibraryStore {
  needs: Need[];
  recipes: DesignRecipe[];
  generation: GenerationAvailability | null;
  loaded: boolean;
  loading: boolean;
  error: string;
  refresh: (adminEmail: string) => Promise<void>;
  /** Runs an admin action and reloads; resolves to an error message, or null on success. */
  act: (adminEmail: string, action: Action) => Promise<string | null>;
}

const headers = (email: string) => ({ "Content-Type": "application/json", "x-admin-email": email });

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  needs: [],
  recipes: [],
  generation: null,
  loaded: false,
  loading: false,
  error: "",

  refresh: async (adminEmail) => {
    set({ loading: true });
    try {
      const res = await fetch("/api/admin/library", { headers: headers(adminEmail), cache: "no-store" });
      const data = (await res.json()) as { needs?: Need[]; recipes?: DesignRecipe[]; generation?: GenerationAvailability; error?: string };
      if (!res.ok || !data.needs || !data.recipes) throw new Error(data.error ?? `Library request failed (HTTP ${res.status}).`);
      set({ needs: data.needs, recipes: data.recipes, generation: data.generation ?? null, loaded: true, error: "" });
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
}));
