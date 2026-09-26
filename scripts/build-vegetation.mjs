// Bakes the stylised vegetation set into lightweight GLBs (public/models/vegetation) plus a manifest.
// Usage: node scripts/build-vegetation.mjs
//
// Drop-in replacement: put your own low-poly GLBs in the same folder and list them in manifest.json — the viewport
// loads whatever the manifest names (see src/components/workspace/viewport/scenery/vegetation.ts) and falls back to the
// same procedural geometry if a file is missing. A GLB may contain a mesh named "bark" and/or "leaf".
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildVegetation, VEGETATION_KINDS } from "../src/lib/landscaping/vegetationGeometry.ts";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "models", "vegetation");
mkdirSync(OUT, { recursive: true });

const pad4 = (n) => (n + 3) & ~3;

/** Minimal GLB writer: one node with a "bark" and "leaf" mesh primitive, vertex-coloured PBR materials. */
function glb(parts) {
  const chunks = [];
  const bufferViews = [];
  const accessors = [];
  let offset = 0;
  const push = (typed, target) => {
    const bytes = new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength);
    const padded = new Uint8Array(pad4(bytes.length));
    padded.set(bytes);
    chunks.push(padded);
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, target });
    offset += padded.length;
    return bufferViews.length - 1;
  };
  const accessor = (typed, type, componentType, count, target, minMax) => {
    const view = push(typed, target);
    accessors.push({ bufferView: view, componentType, count, type, ...(minMax ?? {}) });
    return accessors.length - 1;
  };
  const meshes = [];
  const nodes = [];
  const materials = [];
  const add = (name, geo, material) => {
    const pos = geo.attributes.position;
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < pos.count; i++) for (let k = 0; k < 3; k++) { const v = pos.array[i * 3 + k]; min[k] = Math.min(min[k], v); max[k] = Math.max(max[k], v); }
    const attrs = {
      POSITION: accessor(new Float32Array(pos.array), "VEC3", 5126, pos.count, 34962, { min, max }),
      NORMAL: accessor(new Float32Array(geo.attributes.normal.array), "VEC3", 5126, pos.count, 34962),
      COLOR_0: accessor(new Float32Array(geo.attributes.color.array), "VEC3", 5126, pos.count, 34962),
    };
    materials.push(material);
    meshes.push({ name, primitives: [{ attributes: attrs, material: materials.length - 1, mode: 4 }] });
    nodes.push({ name, mesh: meshes.length - 1 });
  };
  if (parts.bark) add("bark", parts.bark, { name: "bark", pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.95 } });
  add("leaf", parts.leaf, { name: "leaf", doubleSided: true, pbrMetallicRoughness: { baseColorFactor: [1, 1, 1, 1], metallicFactor: 0, roughnessFactor: 0.85 } });

  const json = {
    asset: { version: "2.0", generator: "ai-architect build-vegetation" },
    scene: 0,
    scenes: [{ nodes: nodes.map((_, i) => i) }],
    nodes, meshes, materials, accessors, bufferViews,
    buffers: [{ byteLength: offset }],
  };
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonPadded = new Uint8Array(pad4(jsonBytes.length)).fill(0x20);
  jsonPadded.set(jsonBytes);
  const bin = new Uint8Array(offset);
  let at = 0;
  for (const c of chunks) { bin.set(c, at); at += c.length; }
  const total = 12 + 8 + jsonPadded.length + 8 + bin.length;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, total, true);
  view.setUint32(12, jsonPadded.length, true); view.setUint32(16, 0x4e4f534a, true); out.set(jsonPadded, 20);
  const b = 20 + jsonPadded.length;
  view.setUint32(b, bin.length, true); view.setUint32(b + 4, 0x004e4942, true); out.set(bin, b + 8);
  return out;
}

const VARIANTS = { oak: 3, "oak-tall": 2, pine: 2, cypress: 1, palm: 2, shrub: 2, "shrub-flowering": 2 };
const manifest = [];
for (const kind of VEGETATION_KINDS) {
  for (let v = 0; v < VARIANTS[kind]; v++) {
    const parts = buildVegetation(kind, v);
    const file = `${kind}-${v}.glb`;
    const bytes = glb(parts);
    writeFileSync(join(OUT, file), bytes);
    manifest.push({ id: `${kind}-${v}`, kind, variant: v, file, height: +parts.height.toFixed(3), radius: +parts.radius.toFixed(3) });
    console.log(file.padEnd(24), (bytes.length / 1024).toFixed(1).padStart(7), "KB");
  }
}
writeFileSync(join(OUT, "manifest.json"), JSON.stringify({ version: 1, models: manifest }, null, 2));
