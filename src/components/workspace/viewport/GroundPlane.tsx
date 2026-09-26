"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import * as THREE from "three";
import { useProjectStore } from "@/store/useProjectStore";
import { generateHouseFromJson } from "@/lib/house/generateHouse";
import { computeSiteBounds } from "@/lib/house/siteBounds";
import { getPoolDeckOutline } from "@/lib/house/features/pools";
import { groundRect, planTerrain } from "@/lib/landscaping/terrain";
import { getGrassTextures, GRASS_TILE_METERS } from "@/lib/proceduralTextures";
import { SURFACE_PBR, usePbrSet } from "@/lib/pbrLibrary";
import { macroVariation, macroVariationCacheKey } from "@/lib/materialVariation";
import { naturalGreen } from "./scenery/vegetation";

const MIN_GROUND_HALF = 200;

export function GroundPlane() {
  const params = useParams<{ projectId: string }>();
  const houseConfigJson = useProjectStore(
    (s) => s.getProject(params.projectId)?.houseConfigJson
  );

  const { geometry, color } = useMemo(() => {
    const { site } = generateHouseFromJson(houseConfigJson ?? "{}");
    const bounds = site ? computeSiteBounds(site) : { halfWidth: MIN_GROUND_HALF, halfDepth: MIN_GROUND_HALF };
    const half = Math.max(MIN_GROUND_HALF, bounds.halfWidth + 60, bounds.halfDepth + 60);

    // Beach/cliff sites end the ground at the shoreline; the terrain component draws the drop and sea.
    const plan = site ? planTerrain(site) : undefined;
    const { minX, maxX, minZ, maxZ } = groundRect(plan, half);
    const shape = new THREE.Shape();
    shape.moveTo(minX, -maxZ);
    shape.lineTo(maxX, -maxZ);
    shape.lineTo(maxX, -minZ);
    shape.lineTo(minX, -minZ);
    shape.closePath();

    if (site) {
      for (const pool of site.pools) {
        // The hole follows the pool's own outline, so a curved pool sits in a curved cut.
        const outline = getPoolDeckOutline(pool, site.house);
        const hole = new THREE.Path();
        outline.forEach(([wx, wz], i) => (i === 0 ? hole.moveTo(wx, -wz) : hole.lineTo(wx, -wz)));
        hole.closePath();
        shape.holes.push(hole);
      }
    }

    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    return { geometry: geo, color: plan?.groundColor ?? "#48ae36" };
  }, [houseConfigJson]);

  // ShapeGeometry UVs are the shape's world-metre coordinates, so a 1/tile repeat gives a fixed-size lawn texture.
  // The bundled grass PBR set is preferred; the procedural mown-lawn canvas is the fallback while it loads or if it fails.
  const grassDef = SURFACE_PBR.grass!;
  const pbr = usePbrSet(grassDef);
  const grass = useMemo(() => {
    const tile = pbr.textures ? grassDef.tile : GRASS_TILE_METERS;
    const source = pbr.textures
      ? { map: pbr.textures.map, normal: pbr.textures.normalMap, rough: pbr.textures.roughnessMap, bump: null }
      : { ...(({ map, bump }) => ({ map, bump, normal: null, rough: null }))(getGrassTextures()) };
    const clone = (tex: THREE.Texture | null) => {
      if (!tex) return null;
      const t = tex.clone();
      t.repeat.set(1 / tile, 1 / tile);
      t.needsUpdate = true;
      return t;
    };
    return { map: clone(source.map)!, bump: clone(source.bump), normal: clone(source.normal), rough: clone(source.rough) };
  }, [pbr.textures, grassDef.tile]);
  const tint = useMemo(() => naturalGreen(color), [color]);

  return (
    <mesh geometry={geometry} receiveShadow>
      {/* Mown-lawn texture tinted by the environment's ground colour */}
      <meshStandardMaterial
        color={tint}
        map={grass.map}
        bumpMap={grass.bump ?? undefined}
        bumpScale={1.5}
        normalMap={grass.normal ?? undefined}
        normalScale={new THREE.Vector2(0.9, 0.9)}
        roughnessMap={grass.rough ?? undefined}
        roughness={0.95}
        metalness={0.0}
        side={THREE.DoubleSide}
        onBeforeCompile={macroVariation}
        customProgramCacheKey={macroVariationCacheKey}
      />
    </mesh>
  );
}
