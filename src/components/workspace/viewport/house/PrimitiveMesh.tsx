"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { HousePrimitive } from "@/lib/house/types";
import { useSceneStore } from "@/store/useSceneStore";
import { useAssetStore } from "@/store/useAssetStore";
import { deriveTextureUrls, hasUsableTextures } from "@/lib/textures";
import { featureKey, parseFeatureMeshId } from "@/lib/house/features/parseFeatureId";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { ShapedWaterSurface, WaterSurface } from "./WaterSurface";
import { getSurfaceTextures, PATTERN_TILE_METERS, SURFACE_PATTERN } from "@/lib/proceduralTextures";
import { SURFACE_PBR, usePbrSet, type SurfaceKey } from "@/lib/pbrLibrary";
import { macroVariation, macroVariationCacheKey } from "@/lib/materialVariation";
import { naturalGreen } from "../scenery/vegetation";

/** Box geometry whose UVs are in metres / tile, so a pattern keeps its real-world scale on any face size. */
function worldUvBox(size: [number, number, number], tile: number): THREE.BoxGeometry {
  const [sx, sy, sz] = size;
  const geometry = new THREE.BoxGeometry(sx, sy, sz);
  const uv = geometry.attributes.uv as THREE.BufferAttribute;
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z — four vertices each.
  const faces: [number, number][] = [[sz, sy], [sz, sy], [sx, sz], [sx, sz], [sx, sy], [sx, sy]];
  faces.forEach(([w, h], face) => {
    for (let i = 0; i < 4; i++) {
      const idx = face * 4 + i;
      uv.setXY(idx, (uv.getX(idx) * w) / tile, (uv.getY(idx) * h) / tile);
    }
  });
  uv.needsUpdate = true;
  return geometry;
}

/**
 * A box with rounded exposed edges. When a procedural surface pattern applies, UVs are re-projected in metres onto
 * whichever axis each vertex faces, so the pattern keeps its real-world scale across the curved edges too.
 */
function bevelBox(size: [number, number, number], radius: number, tile?: number): THREE.BufferGeometry {
  const [sx, sy, sz] = size;
  const geometry = new RoundedBoxGeometry(sx, sy, sz, 2, Math.min(radius, Math.min(sx, sy, sz) / 2 - 1e-3));
  if (tile) {
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    const normal = geometry.attributes.normal as THREE.BufferAttribute;
    const uv = geometry.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const ax = Math.abs(normal.getX(i));
      const ay = Math.abs(normal.getY(i));
      const az = Math.abs(normal.getZ(i));
      const [u, v] = ax >= ay && ax >= az ? [pos.getZ(i), pos.getY(i)] : ay >= az ? [pos.getX(i), pos.getZ(i)] : [pos.getX(i), pos.getY(i)];
      uv.setXY(i, u / tile, v / tile);
    }
    uv.needsUpdate = true;
  }
  return geometry;
}

/** Planar UVs for a flat-shaded triangle soup: along the slope on pitched faces, x/z on flat ones. */
function planarUvs(vertices: number[], tile: number): Float32Array {
  const uvs = new Float32Array((vertices.length / 3) * 2);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const u = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let t = 0; t < vertices.length; t += 9) {
    a.fromArray(vertices, t);
    b.fromArray(vertices, t + 3);
    c.fromArray(vertices, t + 6);
    normal.subVectors(c, b).cross(a.clone().sub(b)).normalize();
    if (Math.abs(normal.y) > 0.98) {
      u.set(1, 0, 0);
      v.set(0, 0, 1);
    } else {
      u.set(-normal.z, 0, normal.x).normalize();
      v.crossVectors(normal, u).normalize();
    }
    [a, b, c].forEach((p, i) => {
      uvs[(t / 3 + i) * 2] = p.dot(u) / tile;
      uvs[(t / 3 + i) * 2 + 1] = p.dot(v) / tile;
    });
  }
  return uvs;
}

/** Metres of a curved or free-form surface covered by one repeat of an imported PBR texture (before uvScale). */
const TRI_ASSET_TILE_METERS = 2;

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

export function PrimitiveMesh({ primitive, surface }: { primitive: HousePrimitive; surface?: SurfaceKey }) {
  const featureRef = useMemo(() => parseFeatureMeshId(primitive.id), [primitive.id]);
  const selectionKey = featureRef ? featureKey(featureRef) : primitive.id;

  const isSelected = useSceneStore((s) => s.selectedKey === selectionKey);
  const selectKey = useSceneStore((s) => s.selectKey);

  // An imported asset only counts when its maps resolve to a usable URL; otherwise the surface falls back to the bundled set.
  const assetId = useAssetStore((st) => hasUsableTextures(st.catalog.find((a) => a.id === primitive.assetId))) ? primitive.assetId : undefined;
  const uvScale = primitive.uvScale ?? 1;
  const textures = usePBRTextures(assetId, uvScale);

  // Surface detail, only when no imported PBR asset supplies the surface: the bundled PBR set first, procedural canvas
  // patterns as the fallback (surfaces without a set, or a set that fails to load).
  const libraryDef = !assetId && surface ? SURFACE_PBR[surface] : undefined;
  const library = usePbrSet(libraryDef);
  const libraryPending = !!libraryDef && !library.textures && !library.failed;
  const pattern = !assetId && surface && !libraryPending && !library.textures ? SURFACE_PATTERN[surface] : undefined;
  const detail = useMemo(() => (pattern ? getSurfaceTextures(pattern) : null), [pattern]);
  // UVs are in metres / tile so a pattern keeps its real-world scale on any face size.
  const tile = library.textures && libraryDef ? libraryDef.tile : pattern ? PATTERN_TILE_METERS[pattern] : 1;
  const worldUv = !!pattern || !!library.textures;

  const triGeometry = useMemo(() => {
    if (primitive.kind !== "triMesh") return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(primitive.vertices, 3));
    // Procedural patterns tile in metres; an imported PBR set repeats once per TRI_ASSET_TILE_METERS (times its uvScale).
    if (worldUv) geometry.setAttribute("uv", new THREE.BufferAttribute(planarUvs(primitive.vertices, tile), 2));
    else if (assetId) geometry.setAttribute("uv", new THREE.BufferAttribute(planarUvs(primitive.vertices, TRI_ASSET_TILE_METERS), 2));
    geometry.computeVertexNormals();
    return geometry;
  }, [primitive, worldUv, tile, assetId]);

  const boxGeometry = useMemo(() => {
    if (primitive.kind !== "box") return null;
    if (primitive.bevel && primitive.bevel > 0) return bevelBox(primitive.size, primitive.bevel, worldUv ? tile : undefined);
    return worldUv ? worldUvBox(primitive.size, tile) : null;
  }, [primitive, worldUv, tile]);

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    const store = useSceneStore.getState();

    // From the whole-house view a click on a room's floor steps into that room; inside a room it selects as usual.
    if (featureRef?.type === "room" && primitive.id.endsWith("-floor") && !store.focusedRoom) {
      store.enterRoom({ index: featureRef.index });
      return;
    }
    selectKey(selectionKey);
  };

  const baseMaterialProps = {
    color: surface === "grass" ? `#${naturalGreen(primitive.color).getHexString()}` : primitive.color,
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

  // Water over an arbitrary outline (curved pools, rivers) gets the animated ripple shader.
  if (primitive.kind === "triMesh" && primitive.id.endsWith("-water")) {
    return <ShapedWaterSurface vertices={primitive.vertices} color={primitive.color} opacity={primitive.opacity} />;
  }

  // Glass. Windows and doors sit on a solid wall box, so plain low-opacity glass would just tint the wall pale blue.
  // Panes never write depth: the half-res ambient occlusion pass would otherwise treat them as opaque geometry and
  // stamp blocky darkening onto the glass. The wall box behind already supplies the occlusion. They get a deep-tinted, part-metallic pane instead — it mirrors the sky like real glazing and reads dark against the
  // facade. Railings and glazed roofs (nothing solid behind) stay clear and tinted.
  const isGlass = !!primitive.transparent && (primitive.opacity ?? 1) < 0.95;
  const glazing = isGlass && (primitive.category === "window" || primitive.category === "door");
  const glassColor = glazing ? `#${new THREE.Color(primitive.color).multiplyScalar(0.42).getHexString()}` : primitive.color;
  const glass = isGlass ? (
    <meshPhysicalMaterial
      color={glassColor}
      transparent
      opacity={glazing ? 0.86 : Math.min(primitive.opacity ?? 0.4, 0.42)}
      roughness={glazing ? 0.02 : 0.03}
      metalness={glazing ? 0.62 : 0.1}
      envMapIntensity={glazing ? 2.2 : 2.4}
      clearcoat={1}
      clearcoatRoughness={0.02}
      ior={1.5}
      depthWrite={false}
      emissive={baseMaterialProps.emissive}
      emissiveIntensity={baseMaterialProps.emissiveIntensity}
      side={THREE.DoubleSide}
    />
  ) : null;

  const lib = library.textures;
  const detailProps = lib && libraryDef
    ? {
        map: lib.map,
        normalMap: lib.normalMap,
        normalScale: new THREE.Vector2(libraryDef.normalScale, libraryDef.normalScale),
        roughnessMap: lib.roughnessMap,
        roughness: Math.min(1, (primitive.roughness ?? 0.85) * libraryDef.roughnessGain * 1.15),
      }
    : detail
      ? { map: detail.map, bumpMap: detail.bump, bumpScale: 2.2 }
      : {};
  // Tone patchiness and grounding only where a surface carries real detail — plain trim and floors stay clean.
  // Map presence changes the shader program, so the material is remounted when detail arrives (R3F won't flag needsUpdate).
  const materialKey = lib ? "pbr" : detail ? "pattern" : textures ? "asset" : "plain";
  const variation = worldUv ? { onBeforeCompile: macroVariation, customProgramCacheKey: macroVariationCacheKey } : {};

  if (primitive.kind === "box") {
    return (
      <mesh
        position={primitive.position}
        rotation={primitive.rotation}
        castShadow={!isGlass}
        receiveShadow={!isGlass}
        onClick={handleClick}
        userData={{ id: primitive.id }}
      >
        {boxGeometry ? <primitive object={boxGeometry} attach="geometry" /> : <boxGeometry args={primitive.size} />}
        {glass ?? <meshStandardMaterial key={materialKey} {...texturedProps} {...(textures ? {} : detailProps)} {...variation} />}
      </mesh>
    );
  }

  return (
    <mesh
      geometry={triGeometry!}
      castShadow={!isGlass}
      receiveShadow={!isGlass}
      onClick={handleClick}
      userData={{ id: primitive.id }}
    >
      {glass ?? <meshStandardMaterial key={materialKey} {...(textures ? texturedProps : baseMaterialProps)} {...(textures ? {} : detailProps)} {...variation} side={THREE.DoubleSide} />}
    </mesh>
  );
}
