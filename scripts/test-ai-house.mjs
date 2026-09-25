// Minimal connectivity test for POST /api/ai/house (needs a running server: `npm run dev`).
// Usage: npm run test:ai   (override target with AI_TEST_URL=http://localhost:3000)
import test from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.AI_TEST_URL ?? "http://localhost:3000";

test("/api/ai/house reaches OpenAI and returns a design", { timeout: 90_000 }, async () => {
  const res = await fetch(`${BASE}/api/ai/house`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "generate", prompt: "A small modern one-storey cabin", currentHouseJson: "{}" }),
  });
  const data = await res.json();
  assert.notEqual(res.status, 503, `AI not configured: ${data.error}`);
  assert.equal(res.status, 200, `Unexpected ${res.status}: ${data.error}`);
  assert.equal(typeof data.summary, "string");
  assert.equal(typeof data.json, "string");
});
