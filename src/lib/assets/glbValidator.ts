import type { AssetValidationReport } from "@/types/assets";
import type { AssetCategory, NeedDimensions } from "@/types/library";

/**
 * The one GLB validation pipeline: uploads and (later) provider-generated models both go through `validateGlb`.
 * It reads only the container (JSON chunk plus, where needed, a few bytes of the binary chunk) — nothing is decoded
 * or rendered — so it is fast, runs in the browser or Node, and cannot be crashed by a heavy texture.
 *
 * Two outcomes, deliberately separate:
 *  - errors  (hard failures): the file cannot be used as a model at all. `passed` is false.
 *  - warnings: usable, but heavy or oddly set up. High detail alone never fails an asset.
 */

export const GLB_VALIDATOR_VERSION = 1;

export const GLB_LIMITS = {
  /** Above this a warning; above `fileSizeMaxBytes` the file is refused (it will not download/parse sensibly in a browser). */
  fileSizeWarnBytes: 15 * 1024 * 1024,
  fileSizeMaxBytes: 100 * 1024 * 1024,
  /** Triangles across every mesh instance. A warning at web-heavy, a refusal only where a browser tab would fall over. */
  trianglesWarn: 100_000,
  trianglesMax: 2_000_000,
  /** Renderable primitive instances — each is roughly a draw call. */
  meshesWarn: 100,
  materialsWarn: 10,
  texturesWarn: 16,
  /** Longest texture edge in pixels. Warned only: large textures are a size/memory cost, not a defect. */
  textureEdgeWarn: 2048,
  textureMemoryWarnBytes: 256 * 1024 * 1024,
  /** The longest side must lie in this range (metres) or the model is treated as corrupt/wrong-unit. */
  sizeMinM: 0.05,
  sizeMaxM: 200,
  /** Base may sit this far (m, or a fraction of the height) off y=0 before "not ground aligned" is reported. */
  groundToleranceM: 0.05,
  groundToleranceRatio: 0.02,
  /** Pivot may sit this fraction of the footprint off-centre before it is reported. */
  pivotToleranceRatio: 0.15,
  /** Measured vs expected size: outside this ratio range suggests a unit mismatch (cm/mm exports). */
  expectedSizeRatio: [0.5, 2] as const,
  /** Upright structures are at least this tall relative to their longest footprint side. */
  uprightMinHeightRatio: 0.25,
} as const;

/** Categories that stand upright and are noticeably tall; only these are checked for orientation. */
const UPRIGHT_FAMILIES: readonly AssetCategory[] = ["gazebo", "pergola", "outdoor-bar", "outdoor-kitchen", "cabana"];

/** Required extensions the viewer has no decoder for; a model that needs one cannot be shown. */
const UNSUPPORTED_EXTENSIONS = ["KHR_draco_mesh_compression", "EXT_meshopt_compression", "KHR_texture_basisu"];

export interface ValidateGlbOptions {
  /** What the model is meant to be: enables the orientation check. */
  family?: AssetCategory;
  /** Intended real-world size (a Need's dimensions): a very different measured size is flagged as a probable unit error. */
  expectedDimensions?: NeedDimensions;
  /** Injected for tests. */
  now?: () => Date;
}

const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

const COMPONENT_BYTES: Record<number, number> = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const NORMALIZE_DIVISOR: Record<number, number> = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 };

interface Accessor {
  bufferView?: number;
  byteOffset?: number;
  componentType: number;
  normalized?: boolean;
  count: number;
  type: string;
  min?: number[];
  max?: number[];
  sparse?: unknown;
}
interface BufferView { buffer: number; byteOffset?: number; byteLength: number; byteStride?: number }
interface GltfPrimitive { attributes?: Record<string, number>; indices?: number; material?: number; mode?: number }
interface GltfNode { mesh?: number; children?: number[]; matrix?: number[]; translation?: number[]; rotation?: number[]; scale?: number[] }
interface GltfMaterial { [slot: string]: unknown }
interface GltfImage { uri?: string; bufferView?: number; mimeType?: string }
interface Gltf {
  asset?: { version?: string };
  scene?: number;
  scenes?: { nodes?: number[] }[];
  nodes?: GltfNode[];
  meshes?: { primitives?: GltfPrimitive[] }[];
  accessors?: Accessor[];
  bufferViews?: BufferView[];
  buffers?: { uri?: string; byteLength: number }[];
  materials?: GltfMaterial[];
  textures?: { source?: number }[];
  images?: GltfImage[];
  extensionsRequired?: string[];
}

type Mat4 = number[];
const IDENTITY: Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** Column-major 4x4 product a·b. */
function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Array<number>(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return out;
}

function localMatrix(node: GltfNode): Mat4 {
  if (node.matrix?.length === 16) return node.matrix;
  const [tx, ty, tz] = node.translation ?? [0, 0, 0];
  const [qx, qy, qz, qw] = node.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale ?? [1, 1, 1];
  const xx = qx * qx, yy = qy * qy, zz = qz * qz, xy = qx * qy, xz = qx * qz, yz = qy * qz, wx = qw * qx, wy = qw * qy, wz = qw * qz;
  return [
    (1 - 2 * (yy + zz)) * sx, 2 * (xy + wz) * sx, 2 * (xz - wy) * sx, 0,
    2 * (xy - wz) * sy, (1 - 2 * (xx + zz)) * sy, 2 * (yz + wx) * sy, 0,
    2 * (xz + wy) * sz, 2 * (yz - wx) * sz, (1 - 2 * (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

function transformPoint(m: Mat4, x: number, y: number, z: number): [number, number, number] {
  return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
}

interface Parsed { json: Gltf; bin: Uint8Array | null }

/** Splits a GLB into its JSON and binary chunks; throws a user-readable message when the container is broken. */
function parseContainer(buffer: ArrayBuffer): Parsed {
  if (buffer.byteLength < 20) throw new Error("File is too small to be a GLB.");
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== GLB_MAGIC) throw new Error("Not a GLB file (missing the glTF header). Only binary .glb files are supported.");
  const version = view.getUint32(4, true);
  if (version !== 2) throw new Error(`Unsupported glTF container version ${version} (expected 2).`);
  const declared = view.getUint32(8, true);
  if (declared > buffer.byteLength) throw new Error(`GLB is truncated: header says ${declared} bytes but the file has ${buffer.byteLength}.`);

  let json: Gltf | null = null;
  let bin: Uint8Array | null = null;
  let offset = 12;
  while (offset + 8 <= declared) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (start + length > declared) throw new Error("GLB is corrupted: a data chunk runs past the end of the file.");
    if (type === CHUNK_JSON && !json) {
      try {
        json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, start, length))) as Gltf;
      } catch {
        throw new Error("GLB is corrupted: its JSON scene description does not parse.");
      }
    } else if (type === CHUNK_BIN && !bin) {
      bin = new Uint8Array(buffer, start, length);
    }
    offset = start + length + ((4 - (length % 4)) % 4);
  }
  if (!json) throw new Error("GLB is corrupted: it has no JSON scene description.");
  return { json, bin };
}

/** Bounds of a POSITION accessor in the model's units: from its declared min/max, else read from the binary chunk. */
function positionBounds(json: Gltf, bin: Uint8Array | null, accessor: Accessor): { min: number[]; max: number[] } | null {
  const scale = accessor.normalized ? NORMALIZE_DIVISOR[accessor.componentType] ?? 1 : 1;
  if (accessor.min?.length === 3 && accessor.max?.length === 3) {
    return { min: accessor.min.map((v) => v / scale), max: accessor.max.map((v) => v / scale) };
  }
  // The spec requires min/max on POSITION, but some exporters omit it: fall back to reading the vertices.
  const view = accessor.bufferView !== undefined ? json.bufferViews?.[accessor.bufferView] : undefined;
  const bytes = COMPONENT_BYTES[accessor.componentType];
  if (!bin || !view || !bytes || accessor.sparse || view.buffer !== 0) return null;
  const stride = view.byteStride ?? bytes * 3;
  const base = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  const read = (at: number): number => {
    switch (accessor.componentType) {
      case 5126: return dv.getFloat32(at, true);
      case 5120: return dv.getInt8(at);
      case 5121: return dv.getUint8(at);
      case 5122: return dv.getInt16(at, true);
      default: return dv.getUint16(at, true);
    }
  };
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < accessor.count; i++) {
    const at = base + i * stride;
    if (at + bytes * 3 > bin.byteLength) return null;
    for (let k = 0; k < 3; k++) {
      const v = read(at + k * bytes) / scale;
      if (v < min[k]) min[k] = v;
      if (v > max[k]) max[k] = v;
    }
  }
  return accessor.count > 0 ? { min, max } : null;
}

function trianglesOf(mode: number, count: number): number | null {
  if (mode === 4) return Math.floor(count / 3);
  if (mode === 5 || mode === 6) return Math.max(count - 2, 0);
  return null; // points and lines render nothing a viewer would count as a surface
}

function decodeBase64Prefix(uri: string): Uint8Array | null {
  const comma = uri.indexOf(",");
  if (!uri.startsWith("data:") || comma < 0 || typeof atob !== "function") return null;
  try {
    const raw = atob(uri.slice(comma + 1));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

/** Pixel size read from a PNG or JPEG header; null for any other format (WebP, KTX2…). */
export function imageSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: dv.getUint32(16), height: dv.getUint32(20) };
  }
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let at = 2;
    while (at + 9 < bytes.length) {
      if (bytes[at] !== 0xff) { at++; continue; }
      const marker = bytes[at + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0xff) { at += marker === 0xff ? 1 : 2; continue; }
      const length = dv.getUint16(at + 2);
      // Start-of-frame markers carry the dimensions (all but DHT, JPG, DAC).
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: dv.getUint16(at + 5), width: dv.getUint16(at + 7) };
      }
      at += 2 + length;
    }
  }
  return null;
}

const round = (n: number, places = 3) => Math.round(n * 10 ** places) / 10 ** places;
const fmt = (n: number) => (Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(2));
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/**
 * Validates one GLB. Never throws: a file that cannot be read yields a failed report, so callers can always store
 * the result next to the asset.
 */
export function validateGlb(buffer: ArrayBuffer, options: ValidateGlbOptions = {}): AssetValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const report: AssetValidationReport = {
    checkedAt: (options.now?.() ?? new Date()).toISOString(),
    passed: false,
    errors,
    warnings,
    validatorVersion: GLB_VALIDATOR_VERSION,
    fileSizeBytes: buffer.byteLength,
  };
  const fail = () => {
    report.passed = errors.length === 0;
    return report;
  };

  if (buffer.byteLength > GLB_LIMITS.fileSizeMaxBytes) {
    errors.push(`File is ${mb(buffer.byteLength)}, over the ${mb(GLB_LIMITS.fileSizeMaxBytes)} limit. Reduce textures or geometry.`);
    return fail();
  }
  if (buffer.byteLength > GLB_LIMITS.fileSizeWarnBytes) {
    warnings.push(`Large file (${mb(buffer.byteLength)}): it will be slow to download. Consider compressing textures.`);
  }

  try {
    inspect(buffer, options, report);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : "The file could not be read as a GLB.");
  }
  return fail();
}

function inspect(buffer: ArrayBuffer, options: ValidateGlbOptions, report: AssetValidationReport): void {
  const { warnings } = report;
  const { json, bin } = parseContainer(buffer);

  if (!json.asset?.version?.startsWith("2")) throw new Error(`Unsupported glTF version "${json.asset?.version ?? "unknown"}" (expected 2.x).`);
  const unsupported = (json.extensionsRequired ?? []).filter((e) => UNSUPPORTED_EXTENSIONS.includes(e));
  if (unsupported.length > 0) throw new Error(`Requires ${unsupported.join(", ")}, which the viewer cannot decode. Re-export without compression.`);

  // A buffer stored outside the file means the geometry is not in the GLB.
  const buffers = json.buffers ?? [];
  const externalBuffer = buffers.find((b) => b.uri !== undefined && !b.uri.startsWith("data:"));
  if (externalBuffer) throw new Error(`Geometry is stored in an external file (${externalBuffer.uri}). Export a single self-contained .glb.`);
  if (buffers.length > 0 && buffers.some((b) => b.uri === undefined) && !bin) throw new Error("GLB is missing its binary data chunk: the geometry is not in the file.");

  const nodes = json.nodes ?? [];
  const meshes = json.meshes ?? [];
  const accessors = json.accessors ?? [];
  if (meshes.length === 0) throw new Error("No renderable mesh: the file contains no geometry.");

  const sceneRoots = json.scenes?.[json.scene ?? 0]?.nodes ?? (() => {
    const children = new Set(nodes.flatMap((n) => n.children ?? []));
    return nodes.map((_, i) => i).filter((i) => !children.has(i));
  })();

  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let triangles = 0;
  let primitives = 0;
  const usedMaterials = new Set<number>();
  let usesDefaultMaterial = false;
  let ignoredNonSurface = 0;

  const visit = (index: number, parent: Mat4, depth: number) => {
    const node = nodes[index];
    if (!node || depth > 64) return;
    const world = multiply(parent, localMatrix(node));
    if (node.mesh !== undefined) {
      const mesh = meshes[node.mesh];
      for (const prim of mesh?.primitives ?? []) {
        const positionIndex = prim.attributes?.POSITION;
        if (positionIndex === undefined) throw new Error(`Mesh ${node.mesh} has a primitive with no POSITION data: required geometry is missing.`);
        const position = accessors[positionIndex];
        if (!position || position.type !== "VEC3" || !(position.count > 0)) throw new Error(`Mesh ${node.mesh} has an empty or invalid position accessor.`);
        const mode = prim.mode ?? 4;
        const count = prim.indices !== undefined ? accessors[prim.indices]?.count : position.count;
        const tris = trianglesOf(mode, count ?? 0);
        if (tris === null) { ignoredNonSurface++; continue; }
        if (tris === 0) continue;
        const bounds = positionBounds(json, bin, position);
        if (!bounds) throw new Error(`Mesh ${node.mesh}: vertex positions have no bounds and could not be read.`);
        primitives++;
        triangles += tris;
        if (prim.material !== undefined) usedMaterials.add(prim.material);
        else usesDefaultMaterial = true;
        for (let corner = 0; corner < 8; corner++) {
          const [x, y, z] = transformPoint(world, corner & 1 ? bounds.max[0] : bounds.min[0], corner & 2 ? bounds.max[1] : bounds.min[1], corner & 4 ? bounds.max[2] : bounds.min[2]);
          if (x < min[0]) min[0] = x; if (x > max[0]) max[0] = x;
          if (y < min[1]) min[1] = y; if (y > max[1]) max[1] = y;
          if (z < min[2]) min[2] = z; if (z > max[2]) max[2] = z;
        }
      }
    }
    for (const child of node.children ?? []) visit(child, world, depth + 1);
  };
  for (const root of sceneRoots) visit(root, IDENTITY, 0);

  if (primitives === 0) throw new Error("No renderable mesh: the scene contains no triangle geometry.");
  if (ignoredNonSurface > 0) warnings.push(`${ignoredNonSurface} point/line primitive(s) are ignored: only triangle meshes are rendered.`);

  report.meshCount = primitives;
  report.triangleCount = triangles;
  report.materialCount = usedMaterials.size + (usesDefaultMaterial ? 1 : 0);
  const images = json.images ?? [];
  report.textureCount = (json.textures ?? []).length;
  report.imageCount = images.length;

  // ── Size, pivot, footprint ──
  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  if (![...min, ...max].every(Number.isFinite) || size.some((s) => !(s > 0))) {
    throw new Error("Invalid dimensions: the model has zero or non-finite extent on at least one axis.");
  }
  const [width, height, depth] = size;
  const longest = Math.max(...size);
  if (longest > GLB_LIMITS.sizeMaxM) throw new Error(`Invalid dimensions: ${fmt(longest)} m on its longest side (limit ${GLB_LIMITS.sizeMaxM} m). Was it exported in the wrong unit?`);
  if (longest < GLB_LIMITS.sizeMinM) throw new Error(`Invalid dimensions: ${fmt(longest)} m on its longest side (minimum ${GLB_LIMITS.sizeMinM} m). Was it exported in the wrong unit?`);

  report.dimensions = { width: round(width), height: round(height), depth: round(depth) };
  report.bounds = { min: min.map((v) => round(v, 4)) as [number, number, number], max: max.map((v) => round(v, 4)) as [number, number, number] };
  const centerX = (min[0] + max[0]) / 2;
  const centerZ = (min[2] + max[2]) / 2;
  report.origin = { groundOffset: round(min[1], 4), pivotX: round(centerX, 4), pivotZ: round(centerZ, 4) };
  report.footprint = { width: round(width), depth: round(depth), offsetX: round(centerX, 4), offsetZ: round(centerZ, 4) };

  const groundTolerance = Math.max(GLB_LIMITS.groundToleranceM, height * GLB_LIMITS.groundToleranceRatio);
  const grounded = Math.abs(min[1]) <= groundTolerance;
  const pivotTolerance = GLB_LIMITS.pivotToleranceRatio * Math.max(width, depth);
  const centred = Math.abs(centerX) <= pivotTolerance && Math.abs(centerZ) <= pivotTolerance;
  report.groundAligned = grounded && centred;
  if (!grounded) warnings.push(`Base sits ${fmt(min[1])} m from the ground (y=0). It will be re-grounded when placed.`);
  if (!centred) warnings.push(`Unusual pivot: the model's centre is ${fmt(centerX)} m / ${fmt(centerZ)} m off its origin. It will be re-centred when placed.`);

  if (options.family && UPRIGHT_FAMILIES.includes(options.family)) {
    const suspect = height < GLB_LIMITS.uprightMinHeightRatio * Math.max(width, depth);
    report.orientationSuspect = suspect;
    if (suspect) warnings.push(`Orientation looks wrong for a ${options.family}: it is only ${fmt(height)} m tall but ${fmt(Math.max(width, depth))} m across (Z-up export?).`);
  } else {
    report.orientationSuspect = false;
  }

  const expected = options.expectedDimensions;
  if (expected) {
    const [lo, hi] = GLB_LIMITS.expectedSizeRatio;
    const measured = { width, depth, height };
    const off = (["width", "depth", "height"] as const).filter((k) => {
      const want = expected[k];
      return want !== undefined && want > 0 && (measured[k] / want < lo || measured[k] / want > hi);
    });
    if (off.length > 0) warnings.push(`Measured size (${fmt(width)}×${fmt(depth)}×${fmt(height)} m) differs a lot from the expected size on ${off.join(", ")}: check the export unit.`);
  }

  // ── Weight ──
  if (triangles > GLB_LIMITS.trianglesMax) throw new Error(`${triangles.toLocaleString("en-US")} triangles is over the ${GLB_LIMITS.trianglesMax.toLocaleString("en-US")} limit a browser can hold. Decimate the model.`);
  if (triangles > GLB_LIMITS.trianglesWarn) warnings.push(`High triangle count (${triangles.toLocaleString("en-US")}): several instances may hurt frame rate.`);
  if (primitives > GLB_LIMITS.meshesWarn) warnings.push(`Many meshes (${primitives}): each costs a draw call. Merge parts where possible.`);
  if (report.materialCount > GLB_LIMITS.materialsWarn) warnings.push(`Many materials (${report.materialCount}): each adds a draw call. Consider a texture atlas.`);
  if (report.textureCount > GLB_LIMITS.texturesWarn) warnings.push(`Many textures (${report.textureCount}).`);

  // ── Texture sizes and references ──
  let maxEdge = 0;
  let memory = 0;
  let unread = 0;
  const oversized: string[] = [];
  images.forEach((img, i) => {
    if (img.uri !== undefined && !img.uri.startsWith("data:")) {
      warnings.push(`Texture "${img.uri}" is an external file and will not load: embed textures in the GLB.`);
      return;
    }
    let bytes: Uint8Array | null = null;
    if (img.bufferView !== undefined) {
      const view = json.bufferViews?.[img.bufferView];
      if (view && bin && view.buffer === 0) bytes = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    } else if (img.uri) {
      bytes = decodeBase64Prefix(img.uri);
    }
    const dims = bytes ? imageSize(bytes) : null;
    if (!dims) { unread++; return; }
    const edge = Math.max(dims.width, dims.height);
    maxEdge = Math.max(maxEdge, edge);
    memory += dims.width * dims.height * 4 * 1.33; // RGBA plus mip chain
    if (edge > GLB_LIMITS.textureEdgeWarn) oversized.push(`#${i} ${dims.width}×${dims.height}`);
  });
  if (maxEdge > 0) report.maxTextureSize = maxEdge;
  if (memory > 0) report.textureMemoryBytes = Math.round(memory);
  if (oversized.length > 0) warnings.push(`Huge texture${oversized.length > 1 ? "s" : ""} (${oversized.slice(0, 3).join(", ")}${oversized.length > 3 ? "…" : ""}): over ${GLB_LIMITS.textureEdgeWarn}px on a side.`);
  if (memory > GLB_LIMITS.textureMemoryWarnBytes) warnings.push(`Textures need about ${mb(memory)} of GPU memory once decoded.`);
  if (unread > 0 && images.length > 0 && maxEdge === 0) warnings.push("Texture sizes could not be read (unsupported image format), so texture weight is unchecked.");
}
