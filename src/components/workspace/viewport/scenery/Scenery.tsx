"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { ContactShadows } from "@react-three/drei";
import { useProjectStore } from "@/store/useProjectStore";
import { generateHouseFromJson } from "@/lib/house/generateHouse";
import { generateTrees } from "@/lib/landscaping/trees";
import { generateGrassTufts } from "@/lib/landscaping/grass";
import { generateCars } from "@/lib/landscaping/cars";
import { generateFurnitureClusters } from "@/lib/landscaping/furniture";
import { yardHalfExtent } from "@/lib/landscaping/footprints";
import { Tree } from "./Tree";
import { GrassField } from "./GrassField";
import { Car } from "./Car";
import { PatioFurnitureSet } from "./PatioFurnitureSet";

export function Scenery() {
  const params = useParams<{ projectId: string }>();
  const houseConfigJson = useProjectStore(
    (s) => s.getProject(params.projectId)?.houseConfigJson
  );

  const { trees, grassTufts, cars, furniture, halfExtent } = useMemo(() => {
    const { site } = generateHouseFromJson(houseConfigJson ?? "{}");
    if (!site) {
      return { trees: [], grassTufts: [], cars: [], furniture: [], halfExtent: 30 };
    }
    return {
      trees: generateTrees(site),
      grassTufts: generateGrassTufts(site),
      cars: generateCars(site),
      furniture: generateFurnitureClusters(site),
      halfExtent: yardHalfExtent(site),
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
      <ContactShadows
        position={[0, 0.015, 0]}
        opacity={0.35}
        scale={halfExtent * 2.2}
        blur={2.2}
        far={12}
        resolution={512}
        color="#0a1208"
      />
    </>
  );
}
