import { Color } from "three";
import type { BuiltAsset } from "./build";

/**
 * Minimal glTF 2.0 binary writer for a BuiltAsset: one mesh per material, PBR metallic-roughness materials (named by
 * their spec key, so a recolour or swap is a change to one material), no textures. Pure typed-array code, so it runs in
 * the browser and in Node and its output goes straight into the existing GLB validator and storage.
 */

const pad4 = (n: number) => (n + 3) & ~3;

export function exportGlb(asset: BuiltAsset): ArrayBuffer {
  const bufferViews: object[] = [];
  const accessors: object[] = [];
  const chunks: Uint8Array[] = [];
  let offset = 0;

  const addView = (data: Float32Array, target: number) => {
    const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    const padded = new Uint8Array(pad4(bytes.length));
    padded.set(bytes);
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length, target });
    chunks.push(padded);
    offset += padded.length;
    return bufferViews.length - 1;
  };

  let usesEmissiveStrength = false;
  const materials = asset.meshes.map(({ surface }) => {
    const c = new Color(surface.color);
    const glow = surface.emissive ? new Color(surface.emissive) : null;
    // glTF's emissiveFactor is capped at 1 per channel; a stronger glow is the colour plus KHR_materials_emissive_strength.
    const strong = glow !== null && surface.emissiveIntensity > 1;
    if (strong) usesEmissiveStrength = true;
    return {
      name: surface.key,
      pbrMetallicRoughness: { baseColorFactor: [c.r, c.g, c.b, surface.transparent ? surface.opacity : 1], roughnessFactor: surface.roughness, metallicFactor: surface.metalness },
      ...(surface.transparent ? { alphaMode: "BLEND" } : {}),
      ...(glow ? { emissiveFactor: (strong ? [glow.r, glow.g, glow.b] : [glow.r, glow.g, glow.b].map((v) => v * surface.emissiveIntensity)) } : {}),
      ...(strong ? { extensions: { KHR_materials_emissive_strength: { emissiveStrength: surface.emissiveIntensity } } } : {}),
    };
  });

  const meshes = asset.meshes.map(({ geometry }) => {
    const pos = geometry.getAttribute("position");
    const attributes: Record<string, number> = {};
    for (const [name, attr, type] of [["POSITION", pos, "VEC3"], ["NORMAL", geometry.getAttribute("normal"), "VEC3"], ["TEXCOORD_0", geometry.getAttribute("uv"), "VEC2"]] as const) {
      const array = Float32Array.from(attr.array as ArrayLike<number>);
      const view = addView(array, 34962);
      accessors.push({
        bufferView: view,
        componentType: 5126,
        count: attr.count,
        type,
        ...(name === "POSITION" ? { min: [geometry.boundingBox!.min.x, geometry.boundingBox!.min.y, geometry.boundingBox!.min.z], max: [geometry.boundingBox!.max.x, geometry.boundingBox!.max.y, geometry.boundingBox!.max.z] } : {}),
      });
      attributes[name] = accessors.length - 1;
    }
    return { attributes };
  });

  const json = {
    asset: { version: "2.0", generator: "AI Architect native asset generator" },
    ...(usesEmissiveStrength ? { extensionsUsed: ["KHR_materials_emissive_strength"] } : {}),
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: asset.spec.name ?? asset.spec.family, children: meshes.map((_, i) => i + 1) }, ...meshes.map((_, i) => ({ name: asset.meshes[i].surface.key, mesh: i }))],
    meshes: meshes.map((m, i) => ({ name: asset.meshes[i].surface.key, primitives: [{ ...m, material: i, mode: 4 }] })),
    materials,
    accessors,
    bufferViews,
    buffers: [{ byteLength: offset }],
  };

  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonPadded = new Uint8Array(pad4(jsonBytes.length)).fill(0x20);
  jsonPadded.set(jsonBytes);
  const total = 12 + 8 + jsonPadded.length + 8 + offset;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonPadded.length, true);
  view.setUint32(16, 0x4e4f534a, true);
  out.set(jsonPadded, 20);
  let at = 20 + jsonPadded.length;
  view.setUint32(at, offset, true);
  view.setUint32(at + 4, 0x004e4942, true);
  at += 8;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out.buffer;
}
