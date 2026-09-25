"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import * as THREE from "three";
import { useProjectStore } from "@/store/useProjectStore";
import { generateHouseFromJson } from "@/lib/house/generateHouse";
import { computeSiteBounds } from "@/lib/house/siteBounds";
import { getPoolDeckFootprint } from "@/lib/house/features/pools";
import { groundRect, planTerrain } from "@/lib/landscaping/terrain";
import { getGrassTextures, GRASS_TILE_METERS } from "@/lib/proceduralTextures";

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
        const footprint = getPoolDeckFootprint(pool, site.house);
        const [worldX, worldZ] = footprint.center;
        const localX = worldX;
        const localY = -worldZ;
        const hw = footprint.width / 2;
        const hd = footprint.depth / 2;

        const hole = new THREE.Path();
        hole.moveTo(localX - hw, localY - hd);
        hole.lineTo(localX - hw, localY + hd);
        hole.lineTo(localX + hw, localY + hd);
        hole.lineTo(localX + hw, localY - hd);
        hole.closePath();
        shape.holes.push(hole);
      }
    }

    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    return { geometry: geo, color: plan?.groundColor ?? "#48ae36" };
  }, [houseConfigJson]);

  // ShapeGeometry UVs are the shape's world-metre coordinates, so a 1/tile repeat gives a fixed-size lawn texture.
  const grass = useMemo(() => {
    const { map, bump } = getGrassTextures();
    const repeat = 1 / GRASS_TILE_METERS;
    const m = map.clone();
    const b = bump.clone();
    for (const tex of [m, b]) {
      tex.repeat.set(repeat, repeat);
      tex.needsUpdate = true;
    }
    return { map: m, bump: b };
  }, []);

  return (
    <mesh geometry={geometry} receiveShadow>
      {/* Mown-lawn texture tinted by the environment's ground colour */}
      <meshStandardMaterial
        color={color}
        map={grass.map}
        bumpMap={grass.bump}
        bumpScale={1.5}
        roughness={0.95}
        metalness={0.0}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
