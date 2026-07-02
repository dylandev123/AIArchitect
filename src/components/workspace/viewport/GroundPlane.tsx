"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import * as THREE from "three";
import { useProjectStore } from "@/store/useProjectStore";
import { generateHouseFromJson } from "@/lib/house/generateHouse";
import { computeSiteBounds } from "@/lib/house/siteBounds";
import { getPoolDeckFootprint } from "@/lib/house/features/pools";

const MIN_GROUND_HALF = 200;

export function GroundPlane() {
  const params = useParams<{ projectId: string }>();
  const houseConfigJson = useProjectStore(
    (s) => s.getProject(params.projectId)?.houseConfigJson
  );

  const geometry = useMemo(() => {
    const { site } = generateHouseFromJson(houseConfigJson ?? "{}");
    const bounds = site ? computeSiteBounds(site) : { halfWidth: MIN_GROUND_HALF, halfDepth: MIN_GROUND_HALF };
    const half = Math.max(MIN_GROUND_HALF, bounds.halfWidth + 60, bounds.halfDepth + 60);

    const shape = new THREE.Shape();
    shape.moveTo(-half, -half);
    shape.lineTo(half, -half);
    shape.lineTo(half, half);
    shape.lineTo(-half, half);
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
    return geo;
  }, [houseConfigJson]);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial color="#6f8a5c" roughness={1} side={THREE.DoubleSide} />
    </mesh>
  );
}
