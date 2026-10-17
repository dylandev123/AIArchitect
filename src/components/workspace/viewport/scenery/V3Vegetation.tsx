"use client";

import { useMemo } from "react";
import type { V3Scene } from "@/lib/v3/scene";
import { v3VegetationPlacements, type V3PlantPlacement } from "@/lib/v3/vegetation";
import { foliageTint, Vegetation } from "./vegetation";

function Plant({ plant }: { plant: V3PlantPlacement }) {
  const tint = useMemo(() => foliageTint(plant.foliageColor), [plant.foliageColor]);
  return (
    <group position={plant.position} rotation={[0, plant.rotationY, 0]}>
      <Vegetation kind={plant.kind} variant={plant.variant} height={plant.height} tint={tint} />
    </group>
  );
}

/** Presentation-only planting for V3 landscape zones (palms, trees, shrubs); derived per render, never persisted. */
export function V3Vegetation({ scene }: { scene: V3Scene }) {
  const plants = useMemo(() => {
    try { return v3VegetationPlacements(scene); } catch { return []; }
  }, [scene]);
  return <group>{plants.map((plant) => <Plant key={plant.id} plant={plant} />)}</group>;
}
