"use client";

import { Suspense, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Scene } from "./Scene";
import { ViewportToolbar } from "./ViewportToolbar";
import { QuickActions } from "./QuickActions";
import { useSceneStore } from "@/store/useSceneStore";
import { useProjectStore } from "@/store/useProjectStore";
import { generateHouseFromJson } from "@/lib/house/generateHouse";
import { computeCameraFit } from "@/lib/house/cameraFit";
import { computeSiteBounds } from "@/lib/house/siteBounds";
import { DEFAULT_HOUSE_CONFIG } from "@/types/house";

function toTuple(v: { x: number; y: number; z: number }): [number, number, number] {
  return [v.x, v.y, v.z];
}

export function Viewport() {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const selectKey = useSceneStore((s) => s.selectKey);
  const params = useParams<{ projectId: string }>();
  const houseConfigJson = useProjectStore(
    (s) => s.getProject(params.projectId)?.houseConfigJson
  );

  const initialFit = useMemo(() => {
    const { config, site } = generateHouseFromJson(houseConfigJson ?? "{}");
    const bounds = site ? computeSiteBounds(site) : undefined;
    return computeCameraFit(config ?? DEFAULT_HOUSE_CONFIG, bounds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleResetCamera = () => {
    const controls = controlsRef.current;
    if (!controls) return;
    const { config, site } = generateHouseFromJson(houseConfigJson ?? "{}");
    const bounds = site ? computeSiteBounds(site) : undefined;
    const fit = computeCameraFit(config ?? DEFAULT_HOUSE_CONFIG, bounds);
    controls.object.position.copy(fit.position);
    controls.target.copy(fit.target);
    controls.update();
  };

  return (
    <div className="relative h-full w-full">
      <Canvas
        shadows
        camera={{ position: toTuple(initialFit.position), fov: 45, near: 0.1, far: 5000 }}
        className="!h-full !w-full"
        onPointerMissed={() => selectKey(null)}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableDamping
          dampingFactor={0.08}
          target={toTuple(initialFit.target)}
          minDistance={2}
          maxDistance={400}
          maxPolarAngle={Math.PI / 2 - 0.02}
        />
      </Canvas>

      <ViewportToolbar onResetCamera={handleResetCamera} />
      <QuickActions />
    </div>
  );
}
