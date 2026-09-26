"use client";

import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { buildVegetation, type VegetationKind } from "@/lib/landscaping/vegetationGeometry";

/**
 * Vegetation model loader. `/models/vegetation/manifest.json` lists lightweight GLBs (baked by
 * scripts/build-vegetation.mjs, or dropped in by hand); each kind can have several variants. If the manifest, a file,
 * or the whole folder is missing, the same species are built procedurally in the browser, so scenery never breaks.
 *
 * GLBs authored here carry vertex colours and named "bark" / "leaf" meshes, which we render with shared, species-tinted
 * materials. Third-party GLBs without vertex colours keep their own materials.
 */

const MODEL_ROOT = "/models/vegetation";

interface ManifestEntry {
  id: string;
  kind: VegetationKind;
  variant: number;
  file: string;
}

interface Piece {
  geometry: THREE.BufferGeometry;
  role: "bark" | "leaf";
  /** Set when the source has no vertex colours, so its own material is kept. */
  material?: THREE.Material;
}

export interface VegetationAsset {
  pieces: Piece[];
  height: number;
  radius: number;
}

let manifestPromise: Promise<ManifestEntry[]> | undefined;

function loadManifest(): Promise<ManifestEntry[]> {
  manifestPromise ??= fetch(`${MODEL_ROOT}/manifest.json`)
    .then((res) => (res.ok ? res.json() : { models: [] }))
    .then((json: { models?: ManifestEntry[] }) => (Array.isArray(json.models) ? json.models : []))
    .catch(() => []);
  return manifestPromise;
}

const assetCache = new Map<string, Promise<VegetationAsset | null>>();

function measure(pieces: Piece[]): { height: number; radius: number } {
  const box = new THREE.Box3();
  for (const p of pieces) box.union(new THREE.Box3().setFromBufferAttribute(p.geometry.attributes.position as THREE.BufferAttribute));
  return { height: Math.max(0.01, box.max.y), radius: Math.max(0.01, box.max.x, -box.min.x, box.max.z, -box.min.z) };
}

function loadAsset(entry: ManifestEntry): Promise<VegetationAsset | null> {
  let hit = assetCache.get(entry.file);
  if (!hit) {
    hit = new GLTFLoader()
      .loadAsync(`${MODEL_ROOT}/${entry.file}`)
      .then((gltf) => {
        const pieces: Piece[] = [];
        gltf.scene.updateMatrixWorld(true);
        gltf.scene.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (!mesh.isMesh) return;
          const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
          const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
          const name = `${mesh.name} ${material.name}`;
          const role = /bark|trunk|stem|wood/i.test(name) ? "bark" : "leaf";
          pieces.push({ geometry, role, material: geometry.attributes.color ? undefined : material });
        });
        return pieces.length > 0 ? { pieces, ...measure(pieces) } : null;
      })
      .catch(() => null);
    assetCache.set(entry.file, hit);
  }
  return hit;
}

function proceduralAsset(kind: VegetationKind, variant: number): VegetationAsset {
  const parts = buildVegetation(kind, variant);
  const pieces: Piece[] = [{ geometry: parts.leaf, role: "leaf" }];
  if (parts.bark) pieces.unshift({ geometry: parts.bark, role: "bark" });
  return { pieces, height: parts.height, radius: parts.radius };
}

const proceduralCache = new Map<string, VegetationAsset>();

function getProcedural(kind: VegetationKind, variant: number): VegetationAsset {
  const key = `${kind}:${variant}`;
  let asset = proceduralCache.get(key);
  if (!asset) {
    asset = proceduralAsset(kind, variant);
    proceduralCache.set(key, asset);
  }
  return asset;
}

const PROCEDURAL_VARIANTS: Record<VegetationKind, number> = { oak: 3, "oak-tall": 2, pine: 2, cypress: 1, palm: 2, shrub: 2, "shrub-flowering": 2 };

type State = { asset: VegetationAsset } | "loading";

/** Resolves the asset for a species: the GLB if the manifest has one, else the procedural build. */
function useVegetationAsset(kind: VegetationKind, variant: number): VegetationAsset | null {
  const [resolved, setResolved] = useState<{ key: string; state: State }>({ key: "", state: "loading" });
  const key = `${kind}:${variant}`;

  useEffect(() => {
    let cancelled = false;
    loadManifest().then(async (manifest) => {
      const candidates = manifest.filter((m) => m.kind === kind);
      const asset = candidates.length > 0 ? await loadAsset(candidates[variant % candidates.length]) : null;
      if (!cancelled) setResolved({ key, state: { asset: asset ?? getProcedural(kind, variant % PROCEDURAL_VARIANTS[kind]) } });
    });
    return () => { cancelled = true; };
  }, [kind, variant, key]);

  return resolved.key === key && resolved.state !== "loading" ? resolved.state.asset : null;
}

// ── Shared materials ──────────────────────────────────────────────────────────

const barkMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
const leafMaterials = new Map<string, THREE.MeshStandardMaterial>();

function leafMaterial(tint: THREE.Color): THREE.MeshStandardMaterial {
  const key = tint.getHexString();
  let mat = leafMaterials.get(key);
  if (!mat) {
    mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, color: tint, side: THREE.DoubleSide });
    leafMaterials.set(key, mat);
  }
  return mat;
}

/** Species tint from the placement's foliage colour: mostly neutral so vertex shading dominates, nudged toward the hue. */
export function foliageTint(hex: string): THREE.Color {
  const c = new THREE.Color(hex);
  const peak = Math.max(c.r, c.g, c.b, 0.001);
  return new THREE.Color(1, 1, 1).lerp(new THREE.Color(c.r / peak, c.g / peak, c.b / peak), 0.45);
}

interface VegetationProps {
  kind: VegetationKind;
  variant: number;
  /** Total height in metres the plant should stand. */
  height: number;
  tint: THREE.Color;
}

/** One plant, ground-anchored at the group origin. Renders nothing for the instant the manifest is being read. */
export function Vegetation({ kind, variant, height, tint }: VegetationProps) {
  const asset = useVegetationAsset(kind, variant);
  const scale = asset ? height / asset.height : 1;
  const leaf = useMemo(() => leafMaterial(tint), [tint]);
  if (!asset) return null;
  return (
    <group scale={scale}>
      {asset.pieces.map((piece, i) => (
        <mesh key={i} geometry={piece.geometry} castShadow receiveShadow material={piece.material ?? (piece.role === "bark" ? barkMaterial : leaf)} />
      ))}
    </group>
  );
}

/** Pulls the game-bright greens toward a more natural, sunlit lawn: slightly less saturated and a touch darker. */
export function naturalGreen(hex: string): THREE.Color {
  const hsl = { h: 0, s: 0, l: 0 };
  new THREE.Color(hex).getHSL(hsl);
  return new THREE.Color().setHSL(hsl.h, hsl.s * 0.78, hsl.l * 0.9);
}
