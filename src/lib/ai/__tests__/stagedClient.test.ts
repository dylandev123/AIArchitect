import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression coverage for the false-failure bug: a staged generation that completes successfully on the
 * server (HTTP 200, "done" frame) was being reported to the caller as failed, because the client's own
 * live-preview writes for each "stage" SSE frame moved the project's revision away from the pre-generation
 * baseline the final staleness check compared against — so any generation that streamed even one mass
 * looked "changed" and was rejected as stale, regardless of what the server returned.
 */

function stubBrowser() {
  const data = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
  vi.stubGlobal("localStorage", localStorage);
  vi.stubGlobal("window", { localStorage, addEventListener: () => {} });
}

const sseFrame = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

function fakeSseResponse(body: ReadableStream<Uint8Array>): Response {
  return {
    headers: { get: (name: string) => (name.toLowerCase() === "content-type" ? "text/event-stream" : null) },
    body,
    json: async () => ({}),
  } as unknown as Response;
}

/** A stream this test drives by hand, so it can interleave an "external edit" between specific frames instead of guessing at microtask timing. */
function controlledSseStream() {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({ start: (c) => { controller = c; } });
  const encoder = new TextEncoder();
  return { stream, push: (frame: string) => controller.enqueue(encoder.encode(frame)), close: () => controller.close() };
}

async function loadWithFreshStores() {
  vi.resetModules();
  const { useProjectStore } = await import("@/store/useProjectStore");
  const { requestStagedGeneration } = await import("../stagedClient");
  return { useProjectStore, requestStagedGeneration };
}

beforeEach(stubBrowser);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("requestStagedGeneration", () => {
  it("applies the result when the server finishes ok, even though the stream's own stage frames moved the project's live revision", async () => {
    const { useProjectStore, requestStagedGeneration } = await loadWithFreshStores();
    const project = useProjectStore.getState().createProject("Test House");

    const { stream, push, close } = controlledSseStream();
    push(sseFrame("stage", { type: "stage", stage: "intent", index: 1, of: 5, document: { fake: "in-progress-document" } }));
    push(sseFrame("done", { summary: "A modern pavilion", json: JSON.stringify({ done: true }) }));
    close();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeSseResponse(stream)));

    let applied: { summary: string; json: string } | undefined;
    const result = await requestStagedGeneration({
      projectId: project.id,
      prompt: "A modern pavilion house",
      apply: (summary, json) => { applied = { summary, json }; },
    });

    expect(result.ok).toBe(true);
    expect(applied).toEqual({ summary: "A modern pavilion", json: JSON.stringify({ done: true }) });
  });

  it("applies the result after streaming mass-added, architectural-geometry and roof-added frames too — every SSE 'stage' frame (not just the intent one) must count as the stream's own write, or the newer Architectural Geometry Pass would look like a concurrent edit", async () => {
    const { useProjectStore, requestStagedGeneration } = await loadWithFreshStores();
    const project = useProjectStore.getState().createProject("Test House");

    const { stream, push, close } = controlledSseStream();
    push(sseFrame("stage", { type: "stage", stage: "mass-expansion", index: 4, of: 6, document: { fake: "masses-in-progress" } }));
    push(sseFrame("stage", { type: "mass-added", stage: "mass-expansion", massesSoFar: 2, document: { fake: "mass-added" } }));
    push(sseFrame("stage", { type: "stage", stage: "architectural-geometry", index: 5, of: 6, document: { fake: "geometry-in-progress" } }));
    push(sseFrame("stage", { type: "roof-added", stage: "roof-composition", massId: "mass-0", roofsSoFar: 1, totalMasses: 1, document: { fake: "roof-added" } }));
    push(sseFrame("done", { summary: "A modern pavilion", json: JSON.stringify({ done: true }) }));
    close();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeSseResponse(stream)));

    let applied: { summary: string; json: string } | undefined;
    const result = await requestStagedGeneration({
      projectId: project.id,
      prompt: "A modern pavilion house",
      apply: (summary, json) => { applied = { summary, json }; },
    });

    expect(result.ok).toBe(true);
    expect(applied).toEqual({ summary: "A modern pavilion", json: JSON.stringify({ done: true }) });
  });

  it("still reports staleness when something else edits the project mid-stream, independent of the stream's own writes", async () => {
    const { useProjectStore, requestStagedGeneration } = await loadWithFreshStores();
    const project = useProjectStore.getState().createProject("Test House");

    const { stream, push, close } = controlledSseStream();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fakeSseResponse(stream)));

    const resultPromise = requestStagedGeneration({
      projectId: project.id,
      prompt: "A modern pavilion house",
      apply: () => { throw new Error("apply must not be called when the project went stale"); },
    });

    push(sseFrame("stage", { type: "stage", stage: "intent", index: 1, of: 5, document: { fake: "in-progress-document" } }));
    // Wait for the stage frame's own live-preview write to land before the "external" edit below, so the
    // two writes are deterministically ordered instead of racing on stream micro-scheduling.
    await vi.waitFor(() => {
      const live = JSON.parse(useProjectStore.getState().getProject(project.id)!.houseConfigJson);
      expect(live.architecturalDesignDocument).toEqual({ fake: "in-progress-document" });
    });

    // Something other than this stream — e.g. a scoped edit completing elsewhere — changes the project
    // after the stage frame landed but before "done" arrives. This is a genuine concurrent change, distinct
    // from the stream's own writes, and the staleness check must still catch it.
    useProjectStore.getState().updateHouseConfig(project.id, JSON.stringify({ editedElsewhere: true }));
    push(sseFrame("done", { summary: "A modern pavilion", json: JSON.stringify({ done: true }) }));
    close();

    const result = await resultPromise;
    expect(result).toMatchObject({ ok: false, stale: true });
  });
});
