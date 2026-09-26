import * as THREE from "three";
import { createRng, hashSeed } from "@/lib/landscaping/rng";
import type { SurfaceKey } from "@/lib/pbrLibrary";

/**
 * Small tileable canvas textures for the stylised (Sims/GTA-like) look: a greyscale colour map that the
 * material colour tints, plus a height map used as a bump map. Generated once per pattern on the client.
 * Materials that carry an imported PBR `assetId` never use these.
 */

export type SurfacePattern = "brick" | "stone" | "planks" | "grain" | "tiles" | "slate" | "seam";

export const SURFACE_PATTERN: Partial<Record<SurfaceKey, SurfacePattern>> = {
  paving: "stone",
  rock: "grain",
  brick: "brick",
  stone: "stone",
  wood: "planks",
  timber: "planks",
  cedar: "planks",
  stucco: "grain",
  render: "grain",
  concrete: "grain",
  marble: "grain",
  tile: "tiles",
  terracotta: "tiles",
  slate: "slate",
  metal: "seam",
  zinc: "seam",
  copper: "seam",
  corten: "seam",
};

/** World size in metres covered by one texture repeat. */
export const PATTERN_TILE_METERS: Record<SurfacePattern, number> = {
  brick: 1.2,
  stone: 1.8,
  planks: 1.0,
  grain: 2.5,
  tiles: 1.4,
  slate: 1.4,
  seam: 1.2,
};

export interface DetailTextures {
  map: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
}

const SIZE = 512;

function makeCanvas(size = SIZE): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  return [canvas, ctx];
}

const gray = (v: number) => {
  const c = Math.round(Math.max(0, Math.min(1, v)) * 255);
  return `rgb(${c},${c},${c})`;
};

function finish(canvas: HTMLCanvasElement, srgb: boolean): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

/** Seamless value-noise fbm in [0,1] over a size×size grid. */
function tileableNoise(size: number, rng: () => number, octaves = [4, 8, 16, 32]): Float32Array {
  const out = new Float32Array(size * size);
  let amp = 1;
  let total = 0;
  for (const cells of octaves) {
    const lattice = Float32Array.from({ length: cells * cells }, () => rng());
    const step = size / cells;
    for (let y = 0; y < size; y++) {
      const gy = y / step;
      const y0 = Math.floor(gy);
      const fy = gy - y0;
      const sy = fy * fy * (3 - 2 * fy);
      for (let x = 0; x < size; x++) {
        const gx = x / step;
        const x0 = Math.floor(gx);
        const fx = gx - x0;
        const sx = fx * fx * (3 - 2 * fx);
        const at = (ix: number, iy: number) => lattice[(iy % cells) * cells + (ix % cells)];
        const top = at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx;
        const bottom = at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx;
        out[y * size + x] += (top * (1 - sy) + bottom * sy) * amp;
      }
    }
    total += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

// ── Grass ─────────────────────────────────────────────────────────────────────

let grassCache: DetailTextures | undefined;

/** Mown-lawn texture: soft mottling plus fine blade flecks. One repeat covers ~GRASS_TILE_METERS. */
export const GRASS_TILE_METERS = 7;

export function getGrassTextures(): DetailTextures {
  if (grassCache) return grassCache;
  const rng = createRng(hashSeed("grass-texture"));
  const noise = tileableNoise(SIZE, rng, [8, 16, 32, 64]);
  const [colorCanvas, cctx] = makeCanvas();
  const [heightCanvas, hctx] = makeCanvas();
  const img = cctx.createImageData(SIZE, SIZE);
  const himg = hctx.createImageData(SIZE, SIZE);
  for (let i = 0; i < noise.length; i++) {
    const n = noise[i];
    const shade = 0.84 + (n - 0.5) * 0.3;
    const c = Math.round(Math.max(0, Math.min(1, shade)) * 255);
    const h = Math.round(Math.max(0, Math.min(1, 0.5 + (n - 0.5) * 1.4)) * 255);
    img.data.set([c, c, c, 255], i * 4);
    himg.data.set([h, h, h, 255], i * 4);
  }
  cctx.putImageData(img, 0, 0);
  hctx.putImageData(himg, 0, 0);

  // Blade flecks, wrapped across the tile edges so the repeat stays seamless.
  for (let i = 0; i < 9000; i++) {
    const x = rng() * SIZE;
    const y = rng() * SIZE;
    const len = 3 + rng() * 6;
    const angle = -Math.PI / 2 + (rng() - 0.5) * 1.1;
    const light = rng() > 0.5;
    for (const dx of [-SIZE, 0, SIZE]) {
      for (const dy of [-SIZE, 0, SIZE]) {
        if (x + dx < -10 || x + dx > SIZE + 10 || y + dy < -10 || y + dy > SIZE + 10) continue;
        for (const [ctx, value] of [[cctx, light ? 1 : 0.62], [hctx, light ? 0.95 : 0.25]] as const) {
          ctx.strokeStyle = gray(value);
          ctx.globalAlpha = 0.5;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(x + dx, y + dy);
          ctx.lineTo(x + dx + Math.cos(angle) * len, y + dy + Math.sin(angle) * len);
          ctx.stroke();
        }
      }
    }
  }
  cctx.globalAlpha = hctx.globalAlpha = 1;

  grassCache = { map: finish(colorCanvas, true), bump: finish(heightCanvas, false) };
  return grassCache;
}

// ── Building surfaces ─────────────────────────────────────────────────────────

const surfaceCache = new Map<SurfacePattern, DetailTextures>();

export function getSurfaceTextures(pattern: SurfacePattern): DetailTextures {
  const cached = surfaceCache.get(pattern);
  if (cached) return cached;

  const rng = createRng(hashSeed("surface", pattern));
  const [colorCanvas, c] = makeCanvas();
  const [heightCanvas, h] = makeCanvas();

  /** Paints one cell into both maps, wrapping across the tile edge. */
  const cell = (x: number, y: number, w: number, hgt: number, shade: number, height: number, draw?: (ctx: CanvasRenderingContext2D, v: "c" | "h", x: number, y: number, w: number, h: number) => void) => {
    for (const dx of [-SIZE, 0, SIZE]) {
      for (const dy of [-SIZE, 0, SIZE]) {
        const px = x + dx;
        const py = y + dy;
        if (px + w < 0 || px > SIZE || py + hgt < 0 || py > SIZE) continue;
        c.fillStyle = gray(shade);
        c.fillRect(px, py, w, hgt);
        h.fillStyle = gray(height);
        h.fillRect(px, py, w, hgt);
        draw?.(c, "c", px, py, w, hgt);
        draw?.(h, "h", px, py, w, hgt);
      }
    }
  };
  const fillAll = (shade: number, height: number) => {
    c.fillStyle = gray(shade);
    c.fillRect(0, 0, SIZE, SIZE);
    h.fillStyle = gray(height);
    h.fillRect(0, 0, SIZE, SIZE);
  };
  /** Darkens the lower edge of a cell so overlapping tiles read as layered. */
  const lowerShadow = (strength: number) => (ctx: CanvasRenderingContext2D, _v: "c" | "h", x: number, y: number, w: number, hh: number) => {
    const g = ctx.createLinearGradient(0, y, 0, y + hh);
    g.addColorStop(0, `rgba(0,0,0,0)`);
    g.addColorStop(0.6, `rgba(0,0,0,0)`);
    g.addColorStop(1, `rgba(0,0,0,${strength})`);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, hh);
  };

  switch (pattern) {
    case "brick": {
      fillAll(0.5, 0);
      const rows = 8;
      const cols = 4;
      const rh = SIZE / rows;
      const cw = SIZE / cols;
      const gap = 5;
      for (let r = 0; r < rows; r++) {
        for (let col = 0; col < cols; col++) {
          const x = col * cw + (r % 2 ? cw / 2 : 0);
          cell(x + gap / 2, r * rh + gap / 2, cw - gap, rh - gap, 0.78 + rng() * 0.22, 0.75 + rng() * 0.25);
        }
      }
      break;
    }
    case "stone": {
      fillAll(0.45, 0);
      const heights = [0.19, 0.23, 0.17, 0.24, 0.17];
      let y = 0;
      for (const rowH of heights) {
        const rh = rowH * SIZE;
        const count = 2 + Math.floor(rng() * 2);
        const cuts = Array.from({ length: count - 1 }, () => rng()).sort((a, b) => a - b);
        const edges = [0, ...cuts, 1];
        for (let i = 0; i < count; i++) {
          const x = edges[i] * SIZE;
          const w = (edges[i + 1] - edges[i]) * SIZE;
          cell(x + 3, y + 3, w - 6, rh - 6, 0.68 + rng() * 0.32, 0.65 + rng() * 0.35);
        }
        y += rh;
      }
      break;
    }
    case "planks": {
      const boards = 8;
      const bh = SIZE / boards;
      for (let i = 0; i < boards; i++) {
        const shade = 0.8 + rng() * 0.2;
        cell(0, i * bh, SIZE, bh, shade, 0.85);
        // Grain streaks
        for (let s = 0; s < 26; s++) {
          const yy = i * bh + 4 + rng() * (bh - 8);
          const alpha = 0.06 + rng() * 0.12;
          for (const ctx of [c, h]) {
            ctx.strokeStyle = `rgba(0,0,0,${alpha})`;
            ctx.lineWidth = 1 + rng();
            ctx.beginPath();
            ctx.moveTo(0, yy);
            ctx.bezierCurveTo(SIZE * 0.3, yy + (rng() - 0.5) * 4, SIZE * 0.7, yy + (rng() - 0.5) * 4, SIZE, yy);
            ctx.stroke();
          }
        }
        c.fillStyle = "rgba(0,0,0,0.45)";
        c.fillRect(0, i * bh, SIZE, 3);
        h.fillStyle = "rgba(0,0,0,0.9)";
        h.fillRect(0, i * bh, SIZE, 3);
      }
      break;
    }
    case "grain": {
      const noise = tileableNoise(SIZE, rng, [8, 16, 32, 64]);
      const img = c.createImageData(SIZE, SIZE);
      const himg = h.createImageData(SIZE, SIZE);
      for (let i = 0; i < noise.length; i++) {
        const v = noise[i];
        const shade = Math.round((0.86 + (v - 0.5) * 0.3) * 255);
        const height = Math.round((0.4 + v * 0.6) * 255);
        img.data.set([shade, shade, shade, 255], i * 4);
        himg.data.set([height, height, height, 255], i * 4);
      }
      c.putImageData(img, 0, 0);
      h.putImageData(himg, 0, 0);
      break;
    }
    case "tiles": {
      fillAll(0.6, 0.2);
      const rows = 8;
      const cols = 6;
      const rh = SIZE / rows;
      const cw = SIZE / cols;
      const shadow = lowerShadow(0.5);
      for (let r = 0; r < rows; r++) {
        for (let col = 0; col < cols; col++) {
          const x = col * cw + (r % 2 ? cw / 2 : 0);
          const shade = 0.82 + rng() * 0.18;
          cell(x + 2, r * rh, cw - 4, rh, shade, 0.95, shadow);
        }
      }
      break;
    }
    case "slate": {
      fillAll(0.5, 0.1);
      const rows = 10;
      const cols = 5;
      const rh = SIZE / rows;
      const cw = SIZE / cols;
      const shadow = lowerShadow(0.4);
      for (let r = 0; r < rows; r++) {
        for (let col = 0; col < cols; col++) {
          const x = col * cw + (r % 2 ? cw / 2 : 0);
          cell(x + 2, r * rh + 1, cw - 4, rh, 0.66 + rng() * 0.34, 0.8 + rng() * 0.2, shadow);
        }
      }
      break;
    }
    case "seam": {
      fillAll(0.9, 0.6);
      const panels = 6;
      const pw = SIZE / panels;
      for (let i = 0; i < panels; i++) {
        cell(i * pw, 0, pw, SIZE, 0.84 + rng() * 0.14, 0.6);
        // Raised standing seam with a dark shadow line beside it
        cell(i * pw, 0, 7, SIZE, 1, 1);
        cell(i * pw + 7, 0, 4, SIZE, 0.55, 0.3);
      }
      break;
    }
  }

  const textures = { map: finish(colorCanvas, true), bump: finish(heightCanvas, false) };
  surfaceCache.set(pattern, textures);
  return textures;
}

// ── Water ─────────────────────────────────────────────────────────────────────

let waterCache: THREE.CanvasTexture | undefined;

/** Tileable ripple normal map (sum of a few integer-frequency waves), scrolled by WaterSurface. */
export function getWaterNormalMap(): THREE.CanvasTexture {
  if (waterCache) return waterCache;
  const size = 256;
  const [canvas, ctx] = makeCanvas(size);
  const img = ctx.createImageData(size, size);
  const waves = [
    { kx: 3, ky: 1, amp: 1.0, phase: 0.4 },
    { kx: -2, ky: 4, amp: 0.8, phase: 1.9 },
    { kx: 5, ky: -3, amp: 0.5, phase: 3.1 },
    { kx: 1, ky: 6, amp: 0.4, phase: 5.2 },
  ];
  const tau = Math.PI * 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let dx = 0;
      let dy = 0;
      for (const w of waves) {
        const arg = tau * ((w.kx * x + w.ky * y) / size) + w.phase;
        const d = Math.cos(arg) * w.amp * tau;
        dx += d * w.kx;
        dy += d * w.ky;
      }
      const nx = -dx * 0.05;
      const ny = -dy * 0.05;
      const len = Math.hypot(nx, ny, 1);
      const i = (y * size + x) * 4;
      img.data[i] = ((nx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  waterCache = finish(canvas, false);
  waterCache.anisotropy = 4;
  return waterCache;
}
