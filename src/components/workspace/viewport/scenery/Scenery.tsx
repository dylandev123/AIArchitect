"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { useParams } from "next/navigation";
import { ContactShadows } from "@react-three/drei";
import { useProjectStore } from "@/store/useProjectStore";
import { generateHouseFromJson } from "@/lib/house/generateHouse";
import { generateShrubs, generateTrees } from "@/lib/landscaping/trees";
import { generateGrassTufts } from "@/lib/landscaping/grass";
import { generateCars } from "@/lib/landscaping/cars";
import { generateFurnitureClusters } from "@/lib/landscaping/furniture";
import { placementBounds, type OutdoorAssetPlacement } from "@/lib/outdoor/placements";
import { yardHalfExtent } from "@/lib/landscaping/footprints";
import { planTerrain } from "@/lib/landscaping/terrain";
import { Shrub, Tree } from "./Tree";
import { GrassField } from "./GrassField";
import { Car } from "./Car";
import { PatioFurnitureSet } from "./PatioFurnitureSet";

/** Soft dark halo just outside the walls — cheap ambient occlusion where the house meets the lawn. */
function FootprintAO({ x = 0, z = 0, width, depth, rotation = 0 }: { x?: number; z?: number; width: number; depth: number; rotation?: number }) {
  const texture = useMemo(() => {
    const size = 256;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const steps = 28;
    ctx.fillStyle = "rgba(0,0,0,0.045)";
    for (let i = 0; i < steps; i++) {
      const inset = (i / steps) * (size / 2);
      ctx.fillRect(inset, inset, size - inset * 2, size - inset * 2);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
  const pad = 3.2;
  return (
    <mesh rotation={[-Math.PI / 2, 0, rotation]} position={[x, 0.012, z]}>
      <planeGeometry args={[width + pad * 2, depth + pad * 2]} />
      <meshBasicMaterial map={texture} transparent opacity={0.85} depthWrite={false} polygonOffset polygonOffsetFactor={-4} />
    </mesh>
  );
}

/** Footprints of the library furniture the project places, which procedural sets leave to it. */
function furnishedAreas(json: string | undefined) {
  try {
    const placements = (JSON.parse(json ?? "{}") as { outdoorAssetPlacements?: OutdoorAssetPlacement[] }).outdoorAssetPlacements ?? [];
    return placements.map(placementBounds).map((b) => ({ x0: b.x - b.w / 2, x1: b.x + b.w / 2, z0: b.z - b.d / 2, z1: b.z + b.d / 2 }));
  } catch {
    return [];
  }
}

export function Scenery() {
  const params = useParams<{ projectId: string }>();
  const houseConfigJson = useProjectStore(
    (s) => s.getProject(params.projectId)?.houseConfigJson
  );

  const { trees, shrubs, environment, grassTufts, cars, furniture, halfExtent, footprints } = useMemo(() => {
    const { site } = generateHouseFromJson(houseConfigJson ?? "{}");
    if (!site) {
      return { trees: [], shrubs: [], environment: undefined, grassTufts: [], cars: [], furniture: [], halfExtent: 30, footprints: [] };
    }
    const plan = planTerrain(site);
    const trees = generateTrees(site, plan?.yardTrees);
    return {
      trees,
      shrubs: generateShrubs(site, trees),
      environment: site.settings?.environment,
      grassTufts: plan && !plan.grassTufts ? [] : generateGrassTufts(site),
      cars: generateCars(site),
      furniture: generateFurnitureClusters(site, furnishedAreas(houseConfigJson)),
      halfExtent: yardHalfExtent(site),
      // One halo per building mass where they stand; the legacy house rectangle otherwise.
      footprints: site.buildingFootprints?.length
        ? site.buildingFootprints.map((m) => ({ key: m.id, x: m.cx, z: m.cz, width: m.width, depth: m.depth, rotation: m.rotation }))
        : [{ key: "house", x: site.house.center?.x ?? 0, z: site.house.center?.z ?? 0, width: site.house.width, depth: site.house.depth, rotation: 0 }],
    };
  }, [houseConfigJson]);

  return (
    <>
      {trees.map((tree) => (
        <Tree key={tree.id} tree={tree} environment={environment} />
      ))}
      {shrubs.map((shrub) => (
        <Shrub key={shrub.id} shrub={shrub} />
      ))}
      <GrassField tufts={grassTufts} />
      {cars.map((car) => (
        <Car key={car.id} car={car} />
      ))}
      {furniture.map((cluster) => (
        <PatioFurnitureSet key={cluster.id} cluster={cluster} />
      ))}
      {footprints.map(({ key, ...f }) => <FootprintAO key={key} {...f} />)}
      <ContactShadows
        position={[0, 0.015, 0]}
        opacity={0.6}
        scale={halfExtent * 2.4}
        blur={2.2}
        far={18}
        resolution={1024}
        color="#0a1408"
      />
    </>
  );
}
