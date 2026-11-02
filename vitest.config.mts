import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };
/** Suites that exercise the retired new-house authors (V2, V3, villa, 2D plan, concept, direct-scene
 * operations Generate). Kept as historical regression evidence in their own project with the
 * retirement gate opened by src/test/retiredAuthorsSetup.ts. Everything else is the active project. */
export const retiredAuthorSuites = [
  // V2 / V3 house author (mode "generate"), the V3 local-edit authors and their streaming/token paths.
  "src/app/api/ai/house/__tests__/route.architecturalBlueprint.test.ts",
  "src/app/api/ai/house/__tests__/route.architecturalEdit.test.ts",
  "src/app/api/ai/house/__tests__/route.goalCoverage.test.ts",
  "src/app/api/ai/house/__tests__/route.streaming.test.ts",
  "src/app/api/ai/house/__tests__/route.test.ts",
  "src/app/api/ai/house/__tests__/route.tokenExhaustion.test.ts",
  "src/app/api/ai/house/__tests__/route.v2authority.test.ts",
  "src/app/api/ai/house/__tests__/route.v3.test.ts",
  // 2D plan design, concept and villa-configuration authors.
  "src/app/api/ai/plan/**/*.test.ts",
  "src/app/api/ai/concept/route.test.ts",
  "src/app/api/ai/villa/route.test.ts",
  "src/app/api/ai/villa/route.lifecycle.test.ts",
  "src/app/api/ai/villa/route.metadata.test.ts",
  "src/app/api/ai/villa/scene/route.test.ts",
  // Direct-scene operations author for Generate (Edit/Redesign/Complete assertions in the same files are
  // unaffected by the gate, which only governs mode "generate").
  "src/app/api/ai/scene/route.designFirst.test.ts",
  "src/app/api/ai/scene/route.intelligence.test.ts",
  "src/app/api/ai/scene/route.knowledge.test.ts",
  "src/app/api/ai/scene/route.providerSchema.test.ts",
  "src/app/api/ai/scene/route.test.ts",
];

export default defineConfig({
  // Root alias is also used by `vite-node --config vitest.config.mts` evidence scripts.
  resolve: { alias },
  test: {
    projects: [
      { resolve: { alias }, test: { name: "active", testTimeout: 30000, include: ["src/**/*.test.ts"], exclude: ["**/node_modules/**", ...retiredAuthorSuites] } },
      { resolve: { alias }, test: { name: "retired-authors", testTimeout: 30000, include: retiredAuthorSuites, setupFiles: ["src/test/retiredAuthorsSetup.ts"] } },
    ],
  },
});
