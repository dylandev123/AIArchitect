"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { useParams } from "next/navigation";
import { ContactShadows } from "@react-three/drei";
import { useProjectStore } from "@/store/useProjectStore";
import { generateHouseFromJson } from "@/lib/house/generateHouse";
import { generateTrees } from "@/lib/landscaping/trees";
import { generateGrassTufts } from "@/lib/landscaping/grass";
import { generateCars } from "@/lib/landscaping/cars";
import { generateFurnitureClusters } from "@/lib/landscaping/furniture";
import { yardHalfExtent } from "@/lib/landscaping/footprints";
import { planTerrain } from "@/lib/landscaping/terrain";
import { Tree } from "./Tree";
import { GrassField } from "./GrassField";
import { Car } from "./Car";
import { PatioFurnitureSet } from "./PatioFurnitureSet";

/** Soft dark halo just outside the walls — cheap ambient occlusion where the house meets the lawn. */
function FootprintAO({ width, depth }: { width: number; depth: number }) {
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
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
      <planeGeometry args={[width + pad * 2, depth + pad * 2]} />
      <meshBasicMaterial map={texture} transparent opacity={0.85} depthWrite={false} polygonOffset polygonOffsetFactor={-4} />
    </mesh>
  );
}

export function Scenery() {
  const params = useParams<{ projectId: string }>();
  const houseConfigJson = useProjectStore(
    (s) => s.getProject(params.projectId)?.houseConfigJson
  );

  const { trees, grassTufts, cars, furniture, halfExtent, house } = useMemo(() => {
    const { site } = generateHouseFromJson(houseConfigJson ?? "{}");
    if (!site) {
      return { trees: [], grassTufts: [], cars: [], furniture: [], halfExtent: 30, house: undefined };
    }
    const plan = planTerrain(site);
    return {
      trees: generateTrees(site, plan?.yardTrees),
      grassTufts: plan && !plan.grassTufts ? [] : generateGrassTufts(site),
      cars: generateCars(site),
      furniture: generateFurnitureClusters(site),
      halfExtent: yardHalfExtent(site),
      house: site.house,
    };
  }, [houseConfigJson]);

  return (
    <>
      {trees.map((tree) => (
        <Tree key={tree.id} tree={tree} />
      ))}
      <GrassField tufts={grassTufts} />
      {cars.map((car) => (
        <Car key={car.id} car={car} />
      ))}
      {furniture.map((cluster) => (
        <PatioFurnitureSet key={cluster.id} cluster={cluster} />
      ))}
      {house && <FootprintAO width={house.width} depth={house.depth} />}
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
