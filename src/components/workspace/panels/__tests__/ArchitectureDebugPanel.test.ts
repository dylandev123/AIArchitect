import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { V3SiteHierarchyMigrationReportDetails } from "../ArchitectureDebugPanel";
import { upgradeLegacyV3SiteHierarchy } from "@/lib/v3/siteHierarchyMigration";

const projectRoot = resolve(fileURLToPath(new URL("../../../../../", import.meta.url)));
const forbiddenClientDependencies = /^(?:server-only|node:|assert|buffer|child_process|cluster|crypto|dgram|dns|fs|http|https|net|os|path|perf_hooks|process|readline|stream|string_decoder|tls|tty|util|v8|vm|worker_threads|zlib)(?:\/|$)/;

function runtimeImportSpecifiers(source: string) {
  return source.split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("import ") && !line.startsWith("import type "))
    .map((line) => line.match(/from\s+["']([^"']+)["']|import\s+["']([^"']+)["']/)?.slice(1).find(Boolean))
    .filter((specifier): specifier is string => !!specifier);
}

function resolveSourceImport(from: string, specifier: string) {
  const base = specifier.startsWith("@/")
    ? resolve(projectRoot, "src", specifier.slice(2))
    : resolve(dirname(from), specifier);
  return [".ts", ".tsx", "/index.ts", "/index.tsx"]
    .map((suffix) => `${base}${suffix}`)
    .find(existsSync);
}

const renderReport = (assignment: unknown) => renderToStaticMarkup(createElement(
  V3SiteHierarchyMigrationReportDetails,
  { report: { supportAssignments: [assignment] } },
));

describe("V3SiteHierarchyMigrationReportDetails", () => {
  it("keeps the panel's migration dependency importable from the client entry graph", () => {
    // Importing the Client Component above requires this module to be resolvable
    // through the same alias it uses at runtime. Keep this explicit so a renamed,
    // missing, or server-only migration dependency fails the panel regression test.
    expect(upgradeLegacyV3SiteHierarchy).toEqual(expect.any(Function));
  });

  it("keeps the migration runtime closure free of server-only dependencies", () => {
    const pending = [resolve(projectRoot, "src/lib/v3/siteHierarchyMigration.ts")];
    const visited = new Set<string>();

    while (pending.length) {
      const file = pending.pop()!;
      if (visited.has(file)) continue;
      visited.add(file);

      for (const specifier of runtimeImportSpecifiers(readFileSync(file, "utf8"))) {
        expect(specifier, `${file} imports a server-only dependency`).not.toMatch(forbiddenClientDependencies);
        if (specifier.startsWith(".") || specifier.startsWith("@/")) {
          const importedFile = resolveSourceImport(file, specifier);
          expect(importedFile, `${file} should resolve ${specifier}`).toBeDefined();
          if (importedFile) pending.push(importedFile);
        }
      }
    }

    expect(visited.size).toBeGreaterThan(1);
  });

  it("renders an assignment with evidence", () => {
    const markup = renderReport({
      objectId: "pool-deck",
      support: { kind: "terrace", levelId: "pool-terrace" },
      confidence: 100,
      evidence: ["overlapping pool deck"],
    });

    expect(markup).toContain("pool-deck");
    expect(markup).toContain("overlapping pool deck");
  });

  it("renders an assignment with empty evidence", () => {
    expect(() => renderReport({
      objectId: "arrival-drive",
      support: { kind: "terrain" },
      confidence: 70,
      evidence: [],
    })).not.toThrow();
  });

  it("renders a legacy partial assignment with undefined evidence", () => {
    expect(() => renderReport({
      objectId: "legacy-stair",
      support: { kind: "object", levelId: "arrival-court" },
      confidence: 85,
      evidence: undefined,
    })).not.toThrow();
  });
});
