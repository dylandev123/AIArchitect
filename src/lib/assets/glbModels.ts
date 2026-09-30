"use client";

import { useGenerationStore } from "@/store/useGenerationStore";

import { Box3, Group, Mesh, Vector3, Triangle } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { useSyncExternalStore } from "react";
import { useAssetStore } from "@/store/useAssetStore";
import type { CuratedAsset } from "@/types/assets";
import { loadAssetGlbBytes } from "./assetSync";
import { createModelCache, type ModelStatus } from "./modelCache";

/**
 * Game-style model loading for approved GLBs: lazy, cached, cloned per use.
 *
 *  - One parse per asset per session. Every feature that references the asset shares the cached template; each
 *    instance is a cheap clone that shares geometry and materials (never disposed while cached).
 *  - Models are normalised once on load: base on y=0, footprint centred on the origin, so placement is just a
 *    position + yaw + scale regardless of how the file's pivot was authored.
 *  - Failures are cached, so a missing or corrupt file costs one attempt, not one per frame.
 */

export interface LoadedGlb {
  /** Grounded, centred template. Never add this to a scene directly: use `instantiateGlb`. */
  template: Group;
  /** Natural size after normalising, metres. */
  size: Vector3;
  triangleCount: number;
}

const findAsset = (id: string): CuratedAsset | undefined => {
  const { catalog, queue } = useAssetStore.getState();
  return catalog.find((a) => a.id === id) ?? queue.find((a) => a.id === id);
};

/** Bytes for an asset: its remote `modelUrl` if it has one, else the library's stored file (IndexedDB cache, then the server). */
async function readModelBytes(id: string): Promise<ArrayBuffer> {
  const url = findAsset(id)?.modelUrl;
  if (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Model download failed (HTTP ${res.status}).`);
    return res.arrayBuffer();
  }
  return loadAssetGlbBytes(id);
}

export async function parseGlb(bytes: ArrayBuffer): Promise<LoadedGlb> {
  const gltf = await new GLTFLoader().parseAsync(bytes, "");
  let triangleCount = 0;
  gltf.scene.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const index = mesh.geometry.index;
    triangleCount += (index ? index.count : mesh.geometry.getAttribute("position").count) / 3;
  });
  if (triangleCount === 0) throw new Error("The GLB contains no mesh.");

  const box = new Box3().setFromObject(gltf.scene);
  const size = box.getSize(new Vector3());
  if (!Number.isFinite(size.x + size.y + size.z) || size.x <= 0 || size.y <= 0 || size.z <= 0) throw new Error("The GLB has invalid dimensions.");
  // Ground it and centre its footprint, whatever pivot the file was authored with.
  gltf.scene.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  const template = new Group();
  template.add(gltf.scene);
  template.updateMatrixWorld(true);
  return { template, size, triangleCount: Math.round(triangleCount) };
}

const usedThisSession = new Set<string>();

export const glbModels = createModelCache<LoadedGlb>(
  async (id) => parseGlb(await readModelBytes(id)),
  {
    // A model that fails to load counts against the asset (once per session per asset) so retrieval can demote it.
    onFailed: (id, error) => {
      console.warn(`[glb] ${id} failed to load; omitting the model:`, error);
      useAssetStore.getState().recordAssetOutcome(id, "failure");
    },
  }
);

// An asset that leaves the catalog and queue (removed, rejected) must not keep serving its cached model.
useAssetStore.subscribe((state, prev) => {
  const ids = new Set([...state.catalog, ...state.queue].map((a) => a.id));
  for (const a of [...prev.catalog, ...prev.queue]) if (!ids.has(a.id)) glbModels.invalidate(a.id);
});

/**
 * Notes that a placed model rendered. Counted once per (project, feature, asset) per session, so re-renders and
 * remounts don't inflate use counts.
 */
export function noteGlbRendered(projectId: string, featureId: string, assetId: string, trackingId = featureId): void {
  useGenerationStore.getState().noteAsset(projectId, trackingId, "Rendered");
  const key = `${projectId}:${featureId}:${assetId}`;
  if (usedThisSession.has(key)) return;
  usedThisSession.add(key);
  useAssetStore.getState().recordAssetOutcome(assetId, "success");
}

/** A fresh, independently-transformable copy of a loaded model (geometry and materials shared). */
export function instantiateGlb(id: string): Group | null {
  const loaded = glbModels.peek(id);
  return loaded ? (cloneSkinned(loaded.template) as Group) : null;
}

/** Drop a cached model (file replaced or asset removed) so the next use reloads or falls back. */
export function forgetGlb(id: string): void {
  glbModels.invalidate(id);
}

/**
 * Warms the cache for assets a scene is about to need (or will need soon), a couple at a time and only when the
 * browser is idle, so background loading never competes with interaction. Safe to call repeatedly.
 */
export function preloadGlbs(ids: readonly string[], concurrency = 2): void {
  const queue = ids.filter((id) => glbModels.status(id) === "idle");
  const idle = (fn: () => void) => (typeof requestIdleCallback === "function" ? requestIdleCallback(fn) : setTimeout(fn, 0));
  const next = () => {
    const id = queue.shift();
    if (id === undefined) return;
    idle(() => void glbModels.load(id).then(next));
  };
  for (let i = 0; i < Math.min(concurrency, queue.length); i++) next();
}

/** React hook: re-renders whenever any model's load status changes. */
export function useGlbCacheVersion(): number {
  return useSyncExternalStore(glbModels.subscribe, glbModels.version, glbModels.version);
}

/** React hook: one model's status, live. */
export function useGlbStatus(id: string | undefined): ModelStatus {
  useGlbCacheVersion();
  return id ? glbModels.status(id) : "idle";
}

/** Loading never rejects a house render; each absent decoration records its own failure. */
export async function loadPlacedAssets(projectId: string, placements: readonly import('./placement').AssetPlacement[], usable: readonly import('./placement').AssetPlacement[]): Promise<Set<string>> {
  const blocked = new Set<string>();
  await Promise.all(placements.map(async p => {
    const valid = usable.find(u => u.featureId === p.featureId);
    const loaded = valid ? await glbModels.load(valid.assetId) : null;
    if (!loaded) {
      blocked.add(p.featureId);
      useGenerationStore.getState().noteAsset(projectId, p.trackingId ?? p.featureId, 'Failed', valid ? glbModels.error(valid.assetId) ?? 'Asset failed to load.' : 'Asset is missing or no longer approved.');
    }
  }));
  // A library pergola need not have the planner's standard four-post geometry. Check its
  // actual GLB triangles against the occupied bounds underneath before showing it.
  for (const p of usable.filter(p=>!p.kind && p.category==='pergola' && !blocked.has(p.featureId))) {
    const instance=instantiateGlb(p.assetId)!;
    const size=glbModels.peek(p.assetId)!.size;
    instance.scale.setScalar(Math.min(p.scale??1,p.width/size.x,p.depth/size.z,(p.height??size.y)/size.y));
    instance.position.set(p.x,p.y??0,p.z); instance.rotation.y=p.yaw; instance.updateMatrixWorld(true);
    const boxes=usable.filter(q=>!q.kind && q.featureId!==p.featureId && !blocked.has(q.featureId)).map(q=>{
      const c=Math.abs(Math.cos(q.yaw)),s=Math.abs(Math.sin(q.yaw));
      const w=q.width*c+q.depth*s,d=q.depth*c+q.width*s;
      return new Box3(new Vector3(q.x-w/2+0.02,q.y??0,q.z-d/2+0.02),new Vector3(q.x+w/2-0.02,(q.y??0)+(q.height??1),q.z+d/2-0.02));
    });
    let collision=false;
    instance.traverse(o=>{
      if(collision || !(o as Mesh).isMesh) return;
      const mesh=o as Mesh, geometry=mesh.geometry, positions=geometry.getAttribute('position'), indices=geometry.index;
      const triangle=new Triangle();
      for(let i=0;i<(indices?.count??positions.count);i+=3) {
        for(const [n,v] of [triangle.a,triangle.b,triangle.c].entries()) v.fromBufferAttribute(positions,indices?indices.getX(i+n):i+n).applyMatrix4(mesh.matrixWorld);
        if(boxes.some(box=>box.intersectsTriangle(triangle))) {collision=true;break;}
      }
    });
    if(collision) {blocked.add(p.featureId);useGenerationStore.getState().noteAsset(projectId,p.trackingId??p.featureId,'Failed','The model geometry intersects another outdoor asset.');}
  }
  for (const p of usable) {
    if (!p.supportId) continue;
    const support=usable.find(s=>s.featureId===p.supportId);
    if (!support || blocked.has(support.featureId) || glbModels.status(support.assetId)!=='ready') {blocked.add(p.featureId);useGenerationStore.getState().noteAsset(projectId,p.trackingId??p.featureId,'Failed','The supporting asset could not be rendered.');}
  }
  return blocked;
}
