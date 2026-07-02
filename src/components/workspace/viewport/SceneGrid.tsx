"use client";

import { Grid } from "@react-three/drei";
import { useSceneStore } from "@/store/useSceneStore";

export function SceneGrid() {
  const showGrid = useSceneStore((s) => s.showGrid);

  if (!showGrid) return null;

  return (
    <Grid
      position={[0, 0.01, 0]}
      args={[300, 300]}
      cellSize={1}
      cellThickness={0.4}
      cellColor="#5b6b58"
      sectionSize={10}
      sectionThickness={1}
      sectionColor="#3b82f6"
      fadeDistance={90}
      fadeStrength={1.2}
      infiniteGrid
    />
  );
}
