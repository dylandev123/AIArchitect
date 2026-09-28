import { afterEach, describe, expect, it, vi } from "vitest";
import { useLibraryStore } from "../useLibraryStore";

const library = (recipes: unknown[] = []) => ({ needs: [], recipes, knowledge: [], plans: [], generations: [], generation: null });

afterEach(() => {
  vi.unstubAllGlobals();
  useLibraryStore.setState({ needs: [], recipes: [], knowledge: [], plans: [], generations: [], generation: null, loaded: false, loading: false, error: "" });
});

describe("library Admin synchronization", () => {
  it("reloads authoritative library state after saving a recipe", async () => {
    const recipe = { id: "recipe-1", name: "Outdoor Dining", approval: "proposed" };
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, value: recipe }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(library([recipe])), { status: 200 }));
    vi.stubGlobal("fetch", fetch);

    const error = await useLibraryStore.getState().act("admin@example.com", { action: "saveRecipe", recipe: { name: "Outdoor Dining" } as never });

    expect(error).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(useLibraryStore.getState().recipes).toEqual([recipe]);
  });

  it("does not let an older refresh overwrite a newer authoritative response", async () => {
    let firstResolve!: (value: Response) => void;
    const first = new Promise<Response>((resolve) => { firstResolve = resolve; });
    const current = { id: "recipe-current", name: "Current" };
    vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(first).mockResolvedValueOnce(new Response(JSON.stringify(library([current])), { status: 200 })));

    const older = useLibraryStore.getState().refresh("admin@example.com");
    const newer = useLibraryStore.getState().refresh("admin@example.com");
    await newer;
    firstResolve(new Response(JSON.stringify(library([{ id: "recipe-stale", name: "Stale" }])), { status: 200 }));
    await older;

    expect(useLibraryStore.getState().recipes).toEqual([current]);
  });
});
