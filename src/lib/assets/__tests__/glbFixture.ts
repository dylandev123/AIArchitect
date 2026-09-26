/** Builds small but real GLB files for tests: one box mesh (8 vertices, 12 triangles) with configurable extras. */

export interface FixtureOptions {
  /** Box corners in the mesh's own space. Default: 4 × 3 × 4 m, base on y=0, centred. */
  min?: [number, number, number];
  max?: [number, number, number];
  node?: { translation?: number[]; scale?: number[]; rotation?: number[] };
  /** Claimed index count (accessor only; the validator never reads indices). Default 36 = 12 triangles. */
  indexCount?: number;
  materials?: number;
  /** Fake PNG headers embedded as images, `[width, height]` each. */
  images?: [number, number][];
  omitPosition?: boolean;
  omitPositionBounds?: boolean;
  externalBuffer?: boolean;
  noMeshes?: boolean;
  extensionsRequired?: string[];
  version?: string;
}

const pad4 = (n: number) => (4 - (n % 4)) % 4;

function pngHeader(width: number, height: number): Uint8Array {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const dv = new DataView(b.buffer);
  dv.setUint32(16, width);
  dv.setUint32(20, height);
  return b;
}

export function buildGlb(opts: FixtureOptions = {}): ArrayBuffer {
  const min = opts.min ?? [-2, 0, -2];
  const max = opts.max ?? [2, 3, 2];
  const corners: number[] = [];
  for (let i = 0; i < 8; i++) corners.push(i & 1 ? max[0] : min[0], i & 2 ? max[1] : min[1], i & 4 ? max[2] : min[2]);
  const positions = new Float32Array(corners);
  const indices = new Uint16Array([0, 1, 3, 0, 3, 2, 4, 6, 7, 4, 7, 5, 0, 2, 6, 0, 6, 4, 1, 5, 7, 1, 7, 3, 0, 4, 5, 0, 5, 1, 2, 3, 7, 2, 7, 6]);

  const chunks: Uint8Array[] = [];
  const views: { buffer: 0; byteOffset: number; byteLength: number }[] = [];
  const add = (bytes: Uint8Array) => {
    const at = chunks.reduce((n, c) => n + c.byteLength + pad4(c.byteLength), 0);
    chunks.push(bytes);
    views.push({ buffer: 0, byteOffset: at, byteLength: bytes.byteLength });
    return views.length - 1;
  };
  const posView = add(new Uint8Array(positions.buffer));
  const idxView = add(new Uint8Array(indices.buffer));
  const imageViews = (opts.images ?? []).map(([w, h]) => add(pngHeader(w, h)));

  const total = chunks.reduce((n, c) => n + c.byteLength + pad4(c.byteLength), 0);
  const bin = new Uint8Array(total);
  chunks.forEach((c, i) => bin.set(c, views[i].byteOffset));

  const materialCount = opts.materials ?? 1;
  const json: Record<string, unknown> = {
    asset: { version: opts.version ?? "2.0" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ ...(opts.noMeshes ? {} : { mesh: 0 }), ...opts.node }],
    meshes: [{ primitives: Array.from({ length: Math.max(materialCount, 1) }, (_, i) => ({ attributes: opts.omitPosition ? {} : { POSITION: 0 }, indices: 1, material: materialCount > 0 ? i : undefined })) }],
    accessors: [
      { bufferView: posView, componentType: 5126, count: 8, type: "VEC3", ...(opts.omitPositionBounds ? {} : { min, max }) },
      { bufferView: idxView, componentType: 5123, count: opts.indexCount ?? 36, type: "SCALAR" },
    ],
    bufferViews: views,
    buffers: [opts.externalBuffer ? { uri: "model.bin", byteLength: total } : { byteLength: total }],
    materials: Array.from({ length: materialCount }, () => ({ pbrMetallicRoughness: { baseColorFactor: [0.6, 0.5, 0.4, 1] } })),
    ...(imageViews.length > 0 ? { images: imageViews.map((v) => ({ bufferView: v, mimeType: "image/png" })), textures: imageViews.map((_, i) => ({ source: i })) } : {}),
    ...(opts.extensionsRequired ? { extensionsRequired: opts.extensionsRequired } : {}),
  };
  if (opts.noMeshes) delete json.meshes;

  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonPadded = new Uint8Array(jsonBytes.length + pad4(jsonBytes.length)).fill(0x20);
  jsonPadded.set(jsonBytes);
  const length = 12 + 8 + jsonPadded.length + 8 + bin.length;
  const out = new ArrayBuffer(length);
  const dv = new DataView(out);
  dv.setUint32(0, 0x46546c67, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, length, true);
  dv.setUint32(12, jsonPadded.length, true);
  dv.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(out).set(jsonPadded, 20);
  const binAt = 20 + jsonPadded.length;
  dv.setUint32(binAt, bin.length, true);
  dv.setUint32(binAt + 4, 0x004e4942, true);
  new Uint8Array(out).set(bin, binAt + 8);
  return out;
}
