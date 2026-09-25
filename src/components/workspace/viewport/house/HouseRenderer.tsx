"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useProjectStore } from "@/store/useProjectStore";
import { useSceneStore } from "@/store/useSceneStore";
import { generateHouseFromJson } from "@/lib/house/generateHouse";
import { PrimitiveMesh } from "./PrimitiveMesh";
import type { MaterialsConfig, MaterialType } from "@/types/house";
import type { HousePrimitive } from "@/lib/house/types";

/**
 * Which material a primitive is made of, recovered from its category and colour: the builders tint walls,
 * gables, roofs and trim with their zone's colour. Anything else (floors, glass, garages…) keeps a plain finish.
 */
function surfaceOf(primitive: HousePrimitive, materials: MaterialsConfig | undefined): MaterialType | undefined {
  if (!materials || primitive.assetId) return undefined;
  const color = primitive.color.toLowerCase();
  const is = (zone: keyof MaterialsConfig) => materials[zone].color.toLowerCase() === color;
  if (primitive.category === "roof") return is("roof") ? materials.roof.material : is("exterior") ? materials.exterior.material : undefined;
  if (primitive.category === "wall") return is("exterior") ? materials.exterior.material : is("trim") ? materials.trim.material : undefined;
  return undefined;
}

export function HouseRenderer() {
  const params = useParams<{ projectId: string }>();
  const houseConfigJson = useProjectStore(
    (s) => s.getProject(params.projectId)?.houseConfigJson
  );
  const showRoof = useSceneStore((s) => s.showRoof);

  const { model, site } = useMemo(
    () => generateHouseFromJson(houseConfigJson ?? "{}"),
    [houseConfigJson]
  );

  if (!model) return null;

  const primitives = showRoof ? model.primitives : model.primitives.filter((p) => p.category !== "roof");

  return (
    <group>
      {primitives.map((primitive) => (
        <PrimitiveMesh key={primitive.id} primitive={primitive} surface={surfaceOf(primitive, site?.materials)} />
      ))}
    </group>
  );
}
