import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { redactV3FailureText, retainV3FailureArtifact, retainV3RevisionArtifact, V3_FAILURE_ARTIFACT_MAX_BYTES } from "../v3FailureArtifact";
import { ingestV3GenerationOutput } from "@/lib/v3/ingestion";
let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "v3-artifact-test-"));
  vi.spyOn(process, "cwd").mockReturnValue(directory);
  vi.stubEnv("NODE_ENV", "development");
});
afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllEnvs(); await rm(directory, { recursive: true, force: true }); });
const read = async (attempt = 0) => JSON.parse(await readFile(path.join(directory, ".v3-debug", `failed-attempt-${attempt}.json`), "utf8"));
it("retains original input for offline ingestion with private permissions", async () => {
  const raw = '{ "objects": [], "site": {"width":180,"depth":180}, "metadata": {} }';
  await retainV3FailureArtifact(raw, 0, "ingestion");
  const artifact = await read();
  expect(artifact.rawResponse).toBe(raw);
  expect(ingestV3GenerationOutput(JSON.parse(artifact.rawResponse))).toEqual(ingestV3GenerationOutput(JSON.parse(raw)));
  expect((await stat(path.join(directory, ".v3-debug"))).mode & 0o777).toBe(0o700);
  expect((await stat(path.join(directory, ".v3-debug/failed-attempt-0.json"))).mode & 0o777).toBe(0o600);
});
it("redacts nested secrets, request content and truncated values", () => {
  vi.stubEnv("TEST_PROVIDER_SECRET", "arbitrary-provider-credential");
  const safe = redactV3FailureText(JSON.stringify({ headers: { private: "hidden" }, password: "multiple words secret", api_key: "private-key", metadata: { brief: "private prompt", email: "me@example.org" }, label: "arbitrary-provider-credential", objects: [] }));
  expect(JSON.parse(safe).objects).toEqual([]);
  for (const secret of ["hidden", "multiple words", "private-key", "private prompt", "me@example.org", "arbitrary-provider-credential"]) expect(safe).not.toContain(secret);
  expect(redactV3FailureText('{"token":"hidden')).not.toContain("hidden");
});
it("bounds file size and retention and explicitly marks omitted output", async () => {
  await retainV3FailureArtifact("x".repeat(V3_FAILURE_ARTIFACT_MAX_BYTES), 0, "structured-output");
  expect(await read()).toMatchObject({ rawResponse: null, omittedForSize: true });
  await retainV3FailureArtifact("first", 1, "structured-output");
  await retainV3FailureArtifact("latest", 1, "structured-output");
  expect((await read(1)).rawResponse).toBe("latest");
  expect(await readdir(path.join(directory, ".v3-debug"))).toHaveLength(2);
});
it.each(["production", "test"])("does not write in %s", async (environment) => {
  vi.stubEnv("NODE_ENV", environment);
  await retainV3FailureArtifact("private", 0, "structured-output");
  expect(await readdir(directory)).toEqual([]);
});
it("does not throw if local storage fails", async () => {
  vi.mocked(process.cwd).mockReturnValue("/invalid\0");
  await expect(retainV3FailureArtifact("{}", 0, "ingestion")).resolves.toBeUndefined();
});

it("retains redacted bounded revision snapshots and decisions in one independent slot", async () => {
  const file = path.join(directory, '.v3-debug/revision-latest.json');
  const input = { initialScene: { metadata: { brief: 'private brief' }, objects: [] }, revisedScene: { objects: [] }, targetedFindings: [{ code: 'OUTDOOR_PLACEMENT_CONFLICT', targetIds: ['pool'] }], accepted: false, reasons: ['Unrelated mass change.'] };
  await retainV3RevisionArtifact(input);
  const raw = await readFile(file, 'utf8');
  expect(raw).not.toContain('private brief');
  expect(JSON.parse(raw)).toMatchObject({ accepted: false, reasons: input.reasons, revisedScene: input.revisedScene });
  expect((await stat(file)).mode & 0o777).toBe(0o600);
  await retainV3RevisionArtifact({ ...input, initialScene: 'x'.repeat(V3_FAILURE_ARTIFACT_MAX_BYTES), accepted: true });
  expect((await stat(file)).size).toBeLessThanOrEqual(V3_FAILURE_ARTIFACT_MAX_BYTES);
  expect(JSON.parse(await readFile(file, 'utf8'))).toMatchObject({ accepted: true, snapshotsOmittedForSize: true });
  expect(await readdir(path.dirname(file))).toEqual(['revision-latest.json']);
});
it.each(['production','test'])("never retains revision snapshots in %s", async environment => {
  vi.stubEnv('NODE_ENV', environment);
  await retainV3RevisionArtifact({ initialScene: {}, targetedFindings: [], accepted: false, reasons: [] });
  expect(await readdir(directory)).toEqual([]);
});
