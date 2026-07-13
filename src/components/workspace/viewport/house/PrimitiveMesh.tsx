"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { HousePrimitive } from "@/lib/house/types";
import { useSceneStore } from "@/store/useSceneStore";
import { useAssetStore } from "@/store/useAssetStore";
import { deriveTextureUrls } from "@/lib/textures";
import { featureKey, parseFeatureMeshId } from "@/lib/house/features/parseFeatureId";
import { WaterSurface } from "./WaterSurface";

// ── Texture cache ─────────────────────────────────────────────────────────────

interface TextureSet {
  map: THREE.Texture | null;
  normalMap: THREE.Texture | null;
  roughnessMap: THREE.Texture | null;
  aoMap: THREE.Texture | null;
}

// Module-level caches keyed by "assetId::uvScale"
const textureSetCache = new Map<string, TextureSet>();
const pendingLoads = new Map<string, Promise<TextureSet>>();

function loadTextureSet(assetId: string, uvScale: number): Promise<TextureSet> {
  const cacheKey = `${assetId}::${uvScale}`;
  const cached = textureSetCache.get(cacheKey);
  if (cached) return Promise.resolve(cached);

  const existing = pendingLoads.get(cacheKey);
  if (existing) return existing;

  const asset = useAssetStore.getState().catalog.find((a) => a.id === assetId);
  if (!asset) return Promise.resolve({ map: null, normalMap: null, roughnessMap: null, aoMap: null });

  const urls = deriveTextureUrls(asset);
  const loader = new THREE.TextureLoader();

  const loadOne = (url: string | undefined): Promise<THREE.Texture | null> => {
    if (!url) return Promise.resolve(null);
    return new Promise((resolve) => {
      loader.load(
        url,
        (tex) => {
          const t = tex.clone();
          t.wrapS = THREE.RepeatWrapping;
          t.wrapT = THREE.RepeatWrapping;
          t.repeat.set(uvScale, uvScale);
          t.needsUpdate = true;
          resolve(t);
        },
        undefined,
        () => resolve(null) // gracefully fail — fall back to solid color
      );
    });
  };

  const promise = Promise.all([
    loadOne(urls.mapUrl),
    loadOne(urls.normalMapUrl),
    loadOne(urls.roughnessMapUrl),
    loadOne(urls.aoMapUrl),
  ]).then(([map, normalMap, roughnessMap, aoMap]) => {
    const result: TextureSet = { map, normalMap, roughnessMap, aoMap };
    textureSetCache.set(cacheKey, result);
    pendingLoads.delete(cacheKey);
    return result;
  });

  pendingLoads.set(cacheKey, promise);
  return promise;
}

function usePBRTextures(assetId: string | undefined, uvScale: number): TextureSet | null {
  const [textures, setTextures] = useState<TextureSet | null>(() => {
    // Seed from cache on first render to avoid a blank frame when already loaded
    if (!assetId) return null;
    return textureSetCache.get(`${assetId}::${uvScale}`) ?? null;
  });

  const cancelRef = useRef(false);

  useEffect(() => {
    cancelRef.current = false;

    if (!assetId) return;

    const cacheKey = `${assetId}::${uvScale}`;
    if (textureSetCache.has(cacheKey)) {
      // Already cached — set via async to avoid set-state-in-effect lint rule
      const cached = textureSetCache.get(cacheKey)!;
      const t = setTimeout(() => { if (!cancelRef.current) setTextures(cached); }, 0);
      return () => { cancelRef.current = true; clearTimeout(t); };
    }

    loadTextureSet(assetId, uvScale).then((result) => {
      if (!cancelRef.current) setTextures(result);
    });

    return () => { cancelRef.current = true; };
  }, [assetId, uvScale]);

  return textures;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PrimitiveMesh({ primitive }: { primitive: HousePrimitive }) {
  const featureRef = useMemo(() => parseFeatureMeshId(primitive.id), [primitive.id]);
  const selectionKey = featureRef ? featureKey(featureRef) : primitive.id;

  const isSelected = useSceneStore((s) => s.selectedKey === selectionKey);
  const selectKey = useSceneStore((s) => s.selectKey);

  const assetId = primitive.assetId;
  const uvScale = primitive.uvScale ?? 1;
  const textures = usePBRTextures(assetId, uvScale);

  const triGeometry = useMemo(() => {
    if (primitive.kind !== "triMesh") return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(primitive.vertices, 3));
    geometry.computeVertexNormals();
    return geometry;
  }, [primitive]);

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    selectKey(selectionKey);

    if (
      primitive.category === "room" &&
      primitive.kind === "box" &&
      primitive.id.endsWith("-floor")
    ) {
      const store = useSceneStore.getState();
      if (store.viewMode !== "room") {
        const [worldX, , worldZ] = primitive.position;
        const roomSize = Math.max(primitive.size[0], primitive.size[2]);
        const roomLabel = primitive.label.replace(/\s*Floor$/i, "");
        if (store.showRoof) store.toggleRoof();
        store.setViewMode("room");
        store.triggerCameraPreset("room", { worldX, worldZ, roomSize }, roomLabel);
      }
    }
  };

  const baseMaterialProps = {
    color: primitive.color,
    roughness: primitive.roughness ?? 0.85,
    metalness: primitive.metalness ?? 0,
    transparent: primitive.transparent ?? false,
    opacity: primitive.opacity ?? 1,
    emissive: isSelected ? "#f5a800" : "#000000",
    emissiveIntensity: isSelected ? 0.55 : 0,
  };

  // When textures are loaded, apply maps. Color becomes the baseColor tint (white = neutral).
  const texturedProps = textures
    ? {
        ...baseMaterialProps,
        color: textures.map ? "#ffffff" : primitive.color,
        map: textures.map ?? undefined,
        normalMap: textures.normalMap ?? undefined,
        roughnessMap: textures.roughnessMap ?? undefined,
        aoMap: textures.aoMap ?? undefined,
        // If we have a roughness map, let it drive roughness rather than the scalar
        roughness: textures.roughnessMap ? 1.0 : baseMaterialProps.roughness,
        aoMapIntensity: textures.aoMap ? 1.0 : 0,
      }
    : baseMaterialProps;

  if (primitive.kind === "box" && primitive.id.endsWith("-water")) {
    return (
      <WaterSurface position={primitive.position} width={primitive.size[0]} depth={primitive.size[2]} />
    );
  }

  if (primitive.kind === "box") {
    return (
      <mesh
        position={primitive.position}
        rotation={primitive.rotation}
        castShadow
        receiveShadow
        onClick={handleClick}
        userData={{ id: primitive.id }}
      >
        <boxGeometry args={primitive.size} />
        <meshStandardMaterial {...texturedProps} />
      </mesh>
    );
  }

  return (
    <mesh
      geometry={triGeometry!}
      castShadow
      receiveShadow
      onClick={handleClick}
      userData={{ id: primitive.id }}
    >
      <meshStandardMaterial {...baseMaterialProps} side={THREE.DoubleSide} />
    </mesh>
  );
}
