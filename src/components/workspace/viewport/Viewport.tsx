"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  PointerLockControls,
  KeyboardControls,
  useKeyboardControls,
} from "@react-three/drei";
import type { KeyboardControlsEntry } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Scene } from "./Scene";
import { ViewportToolbar } from "./ViewportToolbar";
import { QuickActions } from "./QuickActions";
import { GenerationOverlay } from "./GenerationOverlay";
import { useNeedsGeneration } from "./useNeedsGeneration";
import { useSceneStore } from "@/store/useSceneStore";
import { useProjectStore } from "@/store/useProjectStore";
import { generateHouseFromJson } from "@/lib/house/generateHouse";
import { computeCameraFit } from "@/lib/house/cameraFit";
import { computeSiteBounds } from "@/lib/house/siteBounds";
import { DEFAULT_HOUSE_CONFIG } from "@/types/house";
import type { TimeOfDay } from "@/types/project";

type WalkKey = "forward" | "backward" | "left" | "right";

const WALK_MAP: KeyboardControlsEntry<WalkKey>[] = [
  { name: "forward",  keys: ["KeyW", "ArrowUp"] },
  { name: "backward", keys: ["KeyS", "ArrowDown"] },
  { name: "left",     keys: ["KeyA", "ArrowLeft"] },
  { name: "right",    keys: ["KeyD", "ArrowRight"] },
];

const EYE_HEIGHT = 1.7;

function WalkController() {
  const [, getKeys] = useKeyboardControls<WalkKey>();
  const snapped = useRef(false);

  useFrame((state, delta) => {
    const cam = state.camera;

    // Snap to eye height on first frame
    if (!snapped.current) {
      cam.position.y = EYE_HEIGHT;
      snapped.current = true;
    }

    const { forward, backward, left, right } = getKeys();
    if (!forward && !backward && !left && !right) return;

    const speed = 5 * delta;
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();

    const strafe = new THREE.Vector3(-dir.z, 0, dir.x);

    if (forward)  cam.position.addScaledVector(dir, speed);
    if (backward) cam.position.addScaledVector(dir, -speed);
    if (left)     cam.position.addScaledVector(strafe, -speed);
    if (right)    cam.position.addScaledVector(strafe, speed);

    cam.position.y = EYE_HEIGHT;
  });

  return null;
}

function toTuple(v: { x: number; y: number; z: number }): [number, number, number] {
  return [v.x, v.y, v.z];
}

export function Viewport() {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const selectKey = useSceneStore((s) => s.selectKey);
  const cameraPreset = useSceneStore((s) => s.cameraPreset);
  const roomFocusTarget = useSceneStore((s) => s.roomFocusTarget);
  const triggerCameraPreset = useSceneStore((s) => s.triggerCameraPreset);
  const walkMode = useSceneStore((s) => s.walkMode);
  const setWalkMode = useSceneStore((s) => s.setWalkMode);

  const blank = useNeedsGeneration();
  const params = useParams<{ projectId: string }>();
  const houseConfigJson = useProjectStore(
    (s) => s.getProject(params.projectId)?.houseConfigJson
  );
  const timeOfDay: TimeOfDay = useProjectStore(
    (s) => s.getProject(params.projectId)?.timeOfDay ?? "midday"
  );

  const initialFit = useMemo(() => {
    const { config, site } = generateHouseFromJson(houseConfigJson ?? "{}");
    const bounds = site ? computeSiteBounds(site) : undefined;
    return computeCameraFit(config ?? DEFAULT_HOUSE_CONFIG, bounds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** One-shot camera preset: fires when set, immediately resets to null.
   *  Skip when controlsRef is null (OrbitControls unmounted in walk mode). */
  useEffect(() => {
    if (!cameraPreset || !controlsRef.current) return;
    const controls = controlsRef.current;
    const { config, site } = generateHouseFromJson(houseConfigJson ?? "{}");

    switch (cameraPreset) {
      case "site": {
        const bounds = site ? computeSiteBounds(site) : undefined;
        const fit = computeCameraFit(config ?? DEFAULT_HOUSE_CONFIG, bounds);
        controls.object.position.copy(fit.position);
        controls.target.copy(fit.target);
        break;
      }
      case "house": {
        const fit = computeCameraFit(config ?? DEFAULT_HOUSE_CONFIG);
        controls.object.position.copy(fit.position);
        controls.target.copy(fit.target);
        break;
      }
      case "top": {
        const bounds = site ? computeSiteBounds(site) : { halfWidth: 15, halfDepth: 15 };
        const extent = Math.max(bounds.halfWidth, bounds.halfDepth) + 12;
        controls.object.position.set(0, extent * 1.6, 0.001);
        controls.target.set(0, 0, 0);
        break;
      }
      case "room": {
        if (roomFocusTarget) {
          const { worldX, worldZ, roomSize } = roomFocusTarget;
          const dist = Math.max(roomSize * 1.5, 4.5);
          controls.object.position.set(worldX + dist * 0.35, dist * 0.85, worldZ + dist);
          controls.target.set(worldX, 0.35, worldZ);
        }
        break;
      }
    }

    controls.update();
    triggerCameraPreset(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraPreset]);

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
      <KeyboardControls map={WALK_MAP}>
        <Canvas
          shadows="soft"
          camera={{ position: toTuple(initialFit.position), fov: 45, near: 0.1, far: 5000 }}
          className="!h-full !w-full"
          onPointerMissed={() => selectKey(null)}
        >
          <Suspense fallback={null}>
            <Scene timeOfDay={timeOfDay} />
          </Suspense>

          {walkMode ? (
            <>
              <WalkController />
              <PointerLockControls makeDefault onUnlock={() => setWalkMode(false)} />
            </>
          ) : (
            <OrbitControls
              ref={controlsRef}
              makeDefault
              enableDamping
              autoRotate={blank}
              autoRotateSpeed={0.35}
              dampingFactor={0.08}
              target={toTuple(initialFit.target)}
              minDistance={2}
              maxDistance={400}
              maxPolarAngle={Math.PI / 2 - 0.02}
            />
          )}
        </Canvas>
      </KeyboardControls>

      {/* Walk mode hint — shown until user clicks to capture mouse */}
      {walkMode && (
        <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-6">
          <div className="rounded-xl border border-white/10 bg-neutral-900/80 px-4 py-2 text-xs text-neutral-400 backdrop-blur">
            Click in viewport to capture mouse · WASD to move · ESC to exit
          </div>
        </div>
      )}

      <ViewportToolbar
        onResetCamera={handleResetCamera}
        onEnterWalk={() => setWalkMode(true)}
      />
      <GenerationOverlay />
      {!blank && <QuickActions />}
    </div>
  );
}
