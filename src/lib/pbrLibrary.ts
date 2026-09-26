import { useEffect, useState } from "react";
import * as THREE from "three";
import type { MaterialType } from "@/types/house";

/**
 * Bundled default PBR texture sets (ambientCG, CC0 — see public/textures/CREDITS.txt) for the stylised
 * architectural look. Each set is colour + GL normal + roughness at 1K. They are the defaults used whenever a
 * surface has no imported asset of its own; a missing or failing file falls back to the procedural canvas patterns.
 */

export type SurfaceKey = MaterialType | "paving" | "rock" | "grass";

export interface PbrSetDef {
  dir: string;
  /** Metres of surface covered by one repeat. */
  tile: number;
  normalScale: number;
  /** Multiplier on the roughness map so painted / glossy finishes keep the material's own feel. */
  roughnessGain: number;
  /** Stretches the albedo's light/dark variation around its mean (1 = as photographed), so grain and joints read at distance. */
  contrast: number;
  /** Lowest roughness the set's map may reach — stops glossy source photos glaring under a low sun. */
  roughFloor: number;
}

const set = (dir: string, tile: number, normalScale = 1, roughnessGain = 1, contrast = 1.4, roughFloor = 0.6): PbrSetDef => ({ dir, tile, normalScale, roughnessGain, contrast, roughFloor });

const PLASTER = set("plaster", 2.0, 1.1, 1, 2.4);
const CLAY = set("roof-clay", 1.6, 1.4);
const METAL = set("metal", 1.4, 0.8, 1, 1.2, 0.3);

export const SURFACE_PBR: Partial<Record<SurfaceKey, PbrSetDef>> = {
  stucco: PLASTER,
  render: set("plaster", 2.4, 0.9, 0.8, 2.4),
  concrete: set("concrete", 2.2, 1.1, 1, 1.9),
  stone: set("stone", 1.8, 1.5),
  brick: set("brick", 1.4, 1.4),
  wood: set("wood", 1.3, 1.3, 1, 1.7),
  timber: set("timber", 1.3, 1.3, 1, 1.7),
  cedar: set("cedar", 1.3, 1.3, 1, 1.7),
  tile: CLAY,
  terracotta: CLAY,
  slate: set("roof-slate", 1.6, 1.6),
  metal: METAL,
  zinc: METAL,
  copper: METAL,
  corten: set("corten", 1.4, 1, 1, 1.4, 0.45),
  paving: set("paving", 2.0, 1.3),
  rock: set("rock", 2.6, 1.6),
  grass: set("grass", 5, 1.1),
};

export interface PbrTextures {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
}

const cache = new Map<string, PbrTextures | "failed">();
const pending = new Map<string, Promise<PbrTextures | "failed">>();

const ALBEDO_TARGET = 0.85;

/**
 * Photographic albedo is neutralised so the material's colour stays in charge: each channel is normalised to its own
 * mean (keeping the texture's hue variation), mixed with plain luminance detail, and scaled to a light grey. The
 * tint (`color` on the material) then multiplies in — a "sage" stucco stays sage, but the trowel marks stay visible.
 */
function neutraliseAlbedo(image: HTMLImageElement, contrast: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(image, 0, 0);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  let r = 0, g = 0, b = 0, l = 0;
  const n = d.length / 4;
  for (let i = 0; i < d.length; i += 4) {
    r += d[i]; g += d[i + 1]; b += d[i + 2];
    l += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  }
  r /= n; g /= n; b /= n; l /= n;
  const k = ALBEDO_TARGET * 255;
  for (let i = 0; i < d.length; i += 4) {
    const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / l;
    const stretch = (v: number) => Math.max(0.05, 1 + (v - 1) * contrast);
    d[i] = Math.min(255, k * stretch(0.35 * (d[i] / r) + 0.65 * lum));
    d[i + 1] = Math.min(255, k * stretch(0.35 * (d[i + 1] / g) + 0.65 * lum));
    d[i + 2] = Math.min(255, k * stretch(0.35 * (d[i + 2] / b) + 0.65 * lum));
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Lifts a roughness map's floor: value' = floor + (1 - floor) * value. */
function remapRoughness(image: HTMLImageElement, floor: number): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(image, 0, 0);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = floor * 255 + (1 - floor) * d[i + 1];
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(canvas);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load ${url}`));
    image.src = url;
  });
}

function prepare(tex: THREE.Texture, srgb: boolean): THREE.Texture {
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

export function loadPbrSet(def: PbrSetDef): Promise<PbrTextures | "failed"> {
  const hit = cache.get(def.dir);
  if (hit) return Promise.resolve(hit);
  const inflight = pending.get(def.dir);
  if (inflight) return inflight;

  const base = `/textures/${def.dir}`;
  const loader = new THREE.TextureLoader();
  const promise = Promise.all([loadImage(`${base}/color.jpg`), loader.loadAsync(`${base}/normal.jpg`), loadImage(`${base}/rough.jpg`)])
    .then(([color, normal, rough]): PbrTextures => ({
      map: prepare(neutraliseAlbedo(color, def.contrast), true),
      normalMap: prepare(normal, false),
      roughnessMap: prepare(remapRoughness(rough, def.roughFloor), false),
    }))
    .catch((): "failed" => "failed")
    .then((result) => {
      cache.set(def.dir, result);
      pending.delete(def.dir);
      return result;
    });
  pending.set(def.dir, promise);
  return promise;
}

export interface PbrState {
  textures: PbrTextures | null;
  failed: boolean;
}

const IDLE: PbrState = { textures: null, failed: false };

/** Loads a bundled PBR set once (shared across every mesh that uses it). `failed` lets callers fall back to procedural detail. */
export function usePbrSet(def: PbrSetDef | undefined): PbrState {
  const [state, setState] = useState<PbrState>(() => {
    const hit = def ? cache.get(def.dir) : undefined;
    return hit ? (hit === "failed" ? { textures: null, failed: true } : { textures: hit, failed: false }) : IDLE;
  });

  useEffect(() => {
    if (!def) return;
    let cancelled = false;
    loadPbrSet(def).then((result) => {
      if (!cancelled) setState(result === "failed" ? { textures: null, failed: true } : { textures: result, failed: false });
    });
    return () => { cancelled = true; };
  }, [def]);

  return def ? state : IDLE;
}

/** Starts loading every bundled set so later material changes and regenerations find them already cached. */
export function preloadPbrLibrary(): void {
  const dirs = new Set<string>();
  for (const def of Object.values(SURFACE_PBR)) {
    if (def && !dirs.has(def.dir)) {
      dirs.add(def.dir);
      void loadPbrSet(def);
    }
  }
}

const READY_TIMEOUT_MS = 3000;

/**
 * True once every given set has loaded (or failed), or after a short timeout, whichever is first. Once true it stays
 * true, so a scene is held back only for its first paint: meshes then mount with their PBR maps already in hand instead
 * of flashing flat colour and popping to texture. Sets that arrive later (a new material) still swap in as before.
 */
export function usePbrReady(defs: PbrSetDef[]): boolean {
  const key = [...new Set(defs.map((d) => d.dir))].sort().join("|");
  const [ready, setReady] = useState(() => defs.every((d) => cache.has(d.dir)));

  useEffect(() => {
    if (ready) return;
    let cancelled = false;
    const unique = [...new Map(defs.map((d) => [d.dir, d])).values()];
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, READY_TIMEOUT_MS));
    Promise.race([Promise.all(unique.map(loadPbrSet)).then(() => undefined), timeout]).then(() => {
      if (!cancelled) setReady(true);
    });
    return () => { cancelled = true; };
    // `key` stands in for the defs array, which is rebuilt on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready]);

  return ready;
}
