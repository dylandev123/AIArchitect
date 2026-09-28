import { deflateSync } from "node:zlib";
import { Color, Vector3 } from "three";
import type { BuiltAsset } from "../build";

/** Tiny software rasteriser (orthographic, z-buffered, lambert) used only to eyeball built assets in tests. Not shipped. */

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf: Uint8Array) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type: string, data: Uint8Array) => {
  const out = new Uint8Array(12 + data.length);
  const v = new DataView(out.buffer);
  v.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  v.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
};

export function encodePng(rgb: Uint8Array, w: number, h: number): Uint8Array {
  const raw = new Uint8Array((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) raw.set(rgb.subarray(y * w * 3, (y + 1) * w * 3), y * (w * 3 + 1) + 1);
  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, w);
  v.setUint32(4, h);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", new Uint8Array())];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** Renders a 3/4 view (yaw about y, pitch down) into an RGB buffer. */
export function renderAsset(asset: BuiltAsset, size = 360, yawDeg = 35, pitchDeg = 22): Uint8Array {
  const rgb = new Uint8Array(size * size * 3);
  for (let i = 0; i < rgb.length; i += 3) rgb.set([26, 28, 32], i);
  const depthBuf = new Float32Array(size * size).fill(-Infinity);
  const yaw = (yawDeg * Math.PI) / 180;
  const pitch = (pitchDeg * Math.PI) / 180;
  const reach = Math.max(asset.size.width, asset.size.depth, asset.size.height) * 1.25;
  const light = new Vector3(0.4, 0.9, 0.5).normalize();
  const project = (p: Vector3) => {
    const x1 = p.x * Math.cos(yaw) - p.z * Math.sin(yaw);
    const z1 = p.x * Math.sin(yaw) + p.z * Math.cos(yaw);
    const y1 = p.y - asset.size.height / 2;
    const y2 = y1 * Math.cos(pitch) - z1 * Math.sin(pitch);
    const z2 = y1 * Math.sin(pitch) + z1 * Math.cos(pitch);
    return { x: (x1 / reach + 0.5) * size, y: (0.5 - y2 / reach) * size, z: z2 };
  };
  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  // Opaque surfaces first, then transparent ones (glass) blended over them without writing depth, so a lantern's glow shows through.
  for (const mesh of [...asset.meshes].sort((a, b) => Number(a.surface.transparent) - Number(b.surface.transparent))) {
    const col = new Color(mesh.surface.color);
    // A glowing surface ignores lighting and is lifted by its emissive colour (intensity above 1 blooms toward white).
    const glow = mesh.surface.emissive ? new Color(mesh.surface.emissive).multiplyScalar(mesh.surface.emissiveIntensity) : null;
    const pos = mesh.geometry.getAttribute("position");
    const nor = mesh.geometry.getAttribute("normal");
    for (let t = 0; t < pos.count; t += 3) {
      a.fromBufferAttribute(pos, t); b.fromBufferAttribute(pos, t + 1); c.fromBufferAttribute(pos, t + 2);
      const n = new Vector3().fromBufferAttribute(nor, t).add(new Vector3().fromBufferAttribute(nor, t + 1)).add(new Vector3().fromBufferAttribute(nor, t + 2)).normalize();
      const shade = 0.5 + 0.6 * Math.max(0, n.dot(light));
      const [pa, pb, pc] = [project(a), project(b), project(c)];
      const minX = Math.max(0, Math.floor(Math.min(pa.x, pb.x, pc.x)));
      const maxX = Math.min(size - 1, Math.ceil(Math.max(pa.x, pb.x, pc.x)));
      const minY = Math.max(0, Math.floor(Math.min(pa.y, pb.y, pc.y)));
      const maxY = Math.min(size - 1, Math.ceil(Math.max(pa.y, pb.y, pc.y)));
      const area = (pb.x - pa.x) * (pc.y - pa.y) - (pb.y - pa.y) * (pc.x - pa.x);
      if (Math.abs(area) < 1e-9) continue;
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const w0 = ((pb.x - x) * (pc.y - y) - (pb.y - y) * (pc.x - x)) / area;
          const w1 = ((pc.x - x) * (pa.y - y) - (pc.y - y) * (pa.x - x)) / area;
          const w2 = 1 - w0 - w1;
          if (w0 < 0 || w1 < 0 || w2 < 0) continue;
          const z = w0 * pa.z + w1 * pb.z + w2 * pc.z;
          const i = y * size + x;
          // Larger z2 is nearer the camera (it sits above and toward the viewer).
          if (z <= depthBuf[i]) continue;
          const to8 = (v: number) => Math.round(Math.min(1, Math.pow(v * shade, 1 / 2.2)) * 255);
          if (mesh.surface.transparent) {
            const a = mesh.surface.opacity;
            const lit = glow ? [(col.r * shade + glow.r) / shade, (col.g * shade + glow.g) / shade, (col.b * shade + glow.b) / shade] : [col.r, col.g, col.b];
            for (let k = 0; k < 3; k++) rgb[i * 3 + k] = Math.round(rgb[i * 3 + k] * (1 - a) + to8(lit[k]) * a);
            continue;
          }
          depthBuf[i] = z;
          rgb.set(glow ? [to8((col.r * shade + glow.r) / shade), to8((col.g * shade + glow.g) / shade), to8((col.b * shade + glow.b) / shade)] : [to8(col.r), to8(col.g), to8(col.b)], i * 3);
        }
      }
    }
  }
  return rgb;
}
