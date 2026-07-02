"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useProjectStore } from "@/store/useProjectStore";
import { useSceneStore } from "@/store/useSceneStore";
import { generateHouseFromJson } from "@/lib/house/generateHouse";
import { PrimitiveMesh } from "./PrimitiveMesh";

export function HouseRenderer() {
  const params = useParams<{ projectId: string }>();
  const houseConfigJson = useProjectStore(
    (s) => s.getProject(params.projectId)?.houseConfigJson
  );
  const showRoof = useSceneStore((s) => s.showRoof);

  const { model } = useMemo(
    () => generateHouseFromJson(houseConfigJson ?? "{}"),
    [houseConfigJson]
  );

  if (!model) return null;

  const primitives = showRoof ? model.primitives : model.primitives.filter((p) => p.category !== "roof");

  return (
    <group>
      {primitives.map((primitive) => (
        <PrimitiveMesh key={primitive.id} primitive={primitive} />
      ))}
    </group>
  );
}
