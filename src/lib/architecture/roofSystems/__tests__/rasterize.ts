import { deflateSync } from "node:zlib";
import type { HousePrimitive } from "@/lib/house/types";

/**
 * A tiny deterministic software renderer for fixture images: orthographic three-quarter view, z-buffer, flat
 * Lambert shading. It draws exactly what the compiler emitted — no WebGL, no textures — and stands in for a
 * covering's texture by ruling the primitive's own fitted pattern coordinates (course lines and staggered
 * joints at the integers), so a wrong fit or orientation shows up in the image.
 */
type V3 = [number, number, number];
interface Tri { p: [V3, V3, V3]; rgb: V3; uv?: [number, number][] }

const hex = (c: string): V3 => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: V3): V3 => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

function triangles(primitives: readonly HousePrimitive[]): Tri[] {
  const out: Tri[] = [];
  for (const p of primitives) {
    const rgb = hex(p.color);
    if (p.kind === "triMesh") {
      for (let i = 0; i + 8 < p.vertices.length; i += 9) {
        const v = (k: number): V3 => [p.vertices[i + k * 3], p.vertices[i + k * 3 + 1], p.vertices[i + k * 3 + 2]];
        const t = (i / 3) * 2;
        out.push({ p: [v(0), v(1), v(2)], rgb, ...(p.uvs ? { uv: [0, 1, 2].map((k) => [p.uvs![t + k * 2], p.uvs![t + k * 2 + 1]] as [number, number]) } : {}) });
      }
      continue;
    }
    // three.js "XYZ" Euler: v' = Rx · Ry · Rz · v.
    const [rx, ry, rz] = p.rotation;
    const rotate = ([x, y, z]: V3): V3 => {
      [x, y] = [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz)];
      [x, z] = [x * Math.cos(ry) + z * Math.sin(ry), -x * Math.sin(ry) + z * Math.cos(ry)];
      [y, z] = [y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)];
      return [x + p.position[0], y + p.position[1], z + p.position[2]];
    };
    const c = (i: number, j: number, k: number) => rotate([(i - 0.5) * p.size[0], (j - 0.5) * p.size[1], (k - 0.5) * p.size[2]]);
    const glass = p.transparent ? ([70, 100, 120] as V3) : rgb;
    for (const [a, b, d, e] of [[c(0, 0, 0), c(1, 0, 0), c(1, 1, 0), c(0, 1, 0)], [c(0, 0, 1), c(1, 0, 1), c(1, 1, 1), c(0, 1, 1)], [c(0, 0, 0), c(0, 0, 1), c(0, 1, 1), c(0, 1, 0)], [c(1, 0, 0), c(1, 0, 1), c(1, 1, 1), c(1, 1, 0)], [c(0, 1, 0), c(1, 1, 0), c(1, 1, 1), c(0, 1, 1)], [c(0, 0, 0), c(1, 0, 0), c(1, 0, 1), c(0, 0, 1)]]) {
      out.push({ p: [a, b, d], rgb: glass }, { p: [a, d, e], rgb: glass });
    }
  }
  return out;
}

export interface RenderOptions { width?: number; height?: number; /** Direction from the scene toward the camera. */ from?: V3 }

export function renderPng(primitives: readonly HousePrimitive[], options: RenderOptions = {}): Buffer {
  const W = (options.width ?? 1200) * 2, H = (options.height ?? 760) * 2;
  const toCamera = unit(options.from ?? [0.62, 0.62, 1]);
  const right = unit(cross([0, 1, 0], toCamera)), up = cross(toCamera, right);
  const light = unit([0.35, 0.85, 0.55]);
  const tris = triangles(primitives);
  const xs: number[] = [], ys: number[] = [];
  for (const t of tris) for (const p of t.p) { xs.push(dot(p, right)); ys.push(dot(p, up)); }
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const k = Math.min((W * 0.9) / (x1 - x0), (H * 0.86) / (y1 - y0));
  const ox = W / 2 - ((x0 + x1) / 2) * k, oy = H / 2 + ((y0 + y1) / 2) * k;
  const color = new Float32Array(W * H * 3), depth = new Float32Array(W * H).fill(-Infinity);
  for (let i = 0; i < W * H; i++) { const g = 236 - 22 * (Math.floor(i / W) / H); color[i * 3] = g; color[i * 3 + 1] = g + 3; color[i * 3 + 2] = g + 8; }

  for (const t of tris) {
    let n = unit(cross(sub(t.p[1], t.p[0]), sub(t.p[2], t.p[0])));
    if (dot(n, toCamera) < 0) n = [-n[0], -n[1], -n[2]];
    const shadeK = 0.5 + 0.5 * Math.max(0, dot(n, light));
    const s = t.p.map((p) => [ox + dot(p, right) * k, oy - dot(p, up) * k, dot(p, toCamera)]);
    const area = (s[1][0] - s[0][0]) * (s[2][1] - s[0][1]) - (s[2][0] - s[0][0]) * (s[1][1] - s[0][1]);
    if (Math.abs(area) < 1e-9) continue;
    const bx0 = Math.max(0, Math.floor(Math.min(s[0][0], s[1][0], s[2][0]))), bx1 = Math.min(W - 1, Math.ceil(Math.max(s[0][0], s[1][0], s[2][0])));
    const by0 = Math.max(0, Math.floor(Math.min(s[0][1], s[1][1], s[2][1]))), by1 = Math.min(H - 1, Math.ceil(Math.max(s[0][1], s[1][1], s[2][1])));
    for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w1 = ((px - s[0][0]) * (s[2][1] - s[0][1]) - (s[2][0] - s[0][0]) * (py - s[0][1])) / area;
      const w2 = ((s[1][0] - s[0][0]) * (py - s[0][1]) - (px - s[0][0]) * (s[1][1] - s[0][1])) / area;
      const w0 = 1 - w1 - w2;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const z = w0 * s[0][2] + w1 * s[1][2] + w2 * s[2][2];
      const i = y * W + x;
      if (z <= depth[i]) continue;
      depth[i] = z;
      let kk = shadeK;
      if (t.uv) {
        const u = w0 * t.uv[0][0] + w1 * t.uv[1][0] + w2 * t.uv[2][0], v = w0 * t.uv[0][1] + w1 * t.uv[1][1] + w2 * t.uv[2][1];
        const course = Math.floor(v + 1e-6), fv = v - course, fu = u + (course % 2 ? 0.5 : 0);
        if (fv < 0.14) kk *= 0.66; else if (fu - Math.floor(fu) < 0.12) kk *= 0.84;
      }
      color[i * 3] = t.rgb[0] * kk; color[i * 3 + 1] = t.rgb[1] * kk; color[i * 3 + 2] = t.rgb[2] * kk;
    }
  }

  // 2×2 box downsample, then PNG (filter 0 scanlines).
  const w = W / 2, h = H / 2, raw = Buffer.alloc(h * (w * 3 + 1));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) {
    const at = (dx: number, dy: number) => color[((y * 2 + dy) * W + x * 2 + dx) * 3 + c];
    raw[y * (w * 3 + 1) + 1 + x * 3 + c] = Math.max(0, Math.min(255, Math.round((at(0, 0) + at(1, 0) + at(0, 1) + at(1, 1)) / 4)));
  }
  return png(w, h, raw);
}

const CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let i = 0; i < 8; i++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function chunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  let c = 0xffffffff;
  for (const b of body) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0); body.copy(out, 4); out.writeUInt32BE((c ^ 0xffffffff) >>> 0, body.length + 4);
  return out;
}
function png(width: number, height: number, raw: Buffer): Buffer {
  const head = Buffer.alloc(13);
  head.writeUInt32BE(width, 0); head.writeUInt32BE(height, 4); head[8] = 8; head[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", head), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}
