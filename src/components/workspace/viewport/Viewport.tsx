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
import { ArchitecturalFloorPlan } from "./ArchitecturalFloorPlan";
import { ArchitecturalViewControls } from "./ArchitecturalViewControls";
import { DEFAULT_ARCHITECTURAL_VIEW } from "@/lib/v3/architecturalPlanning";
import { isV3PlanEvaluation } from "@/lib/v3/architecturalPlanEvaluation";
import { compileV3Scene } from "@/lib/v3/scene";
import { Scene } from "./Scene";
import { ViewportToolbar } from "./ViewportToolbar";
import { CameraRig } from "./CameraRig";
import { RoomNavigator } from "./RoomNavigator";
import { QuickActions } from "./QuickActions";
import { GenerationOverlay } from "./GenerationOverlay";
import { V3ArchitecturalValidationBanner } from "./V3ArchitecturalValidationBanner";
import { V3FailedPreviewBanner } from "./V3FailedPreviewBanner";
import { useNeedsGeneration } from "./useNeedsGeneration";
import { useRoomFocusSync } from "../useRoomFocus";
import { useSceneStore } from "@/store/useSceneStore";
import { useProjectStore } from "@/store/useProjectStore";
import { generateHouseFromJson } from "@/lib/house/generateHouse";
import { CAMERA_FOV, computeCameraFit } from "@/lib/house/cameraFit";
import { computeSiteBounds } from "@/lib/house/siteBounds";
import { preloadPbrLibrary } from "@/lib/pbrLibrary";
import { DEFAULT_HOUSE_CONFIG } from "@/types/house";
import type { TimeOfDay } from "@/types/project";
import { useActiveV3RenderSource } from "@/store/useActiveV3RenderSource";
import { computeV3CameraFit, getV3PresentationBounds } from "@/lib/v3/presentation";

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
  const selectKey = useSceneStore((s) => s.selectKey);
  const walkMode = useSceneStore((s) => s.walkMode);
  const setWalkMode = useSceneStore((s) => s.setWalkMode);

  useEffect(() => preloadPbrLibrary(), []);

  const blank = useNeedsGeneration();
  const params = useParams<{ projectId: string }>();
  useRoomFocusSync(params.projectId);
  const houseConfigJson = useProjectStore(
    (s) => s.getProject(params.projectId)?.houseConfigJson
  );
  const timeOfDay: TimeOfDay = useProjectStore(
    (s) => s.getProject(params.projectId)?.timeOfDay ?? "midday"
  );
  const activeV3 = useActiveV3RenderSource(params.projectId, houseConfigJson);
  const v3Presentation = !!activeV3.scene;
  const architecturalView = useProjectStore(s => s.getProject(params.projectId)?.architecturalView) ?? DEFAULT_ARCHITECTURAL_VIEW;
  const evaluation=!!activeV3.scene&&isV3PlanEvaluation(activeV3.scene);
  const isPlan = v3Presentation && (evaluation||architecturalView.mode === "floor-plan");
  const isBlueprint = v3Presentation && (architecturalView.mode === "blueprint" || architecturalView.mode === "massing");
  // Geometry is memoized by source, never by floor, view, zoom or selection.
  const planModel = useMemo(() => activeV3.scene&&!evaluation ? compileV3Scene(activeV3.scene) : null, [activeV3.scene,evaluation]);

  const initialFit = useMemo(() => {
    try {
      if (activeV3.scene) {
        return computeV3CameraFit(getV3PresentationBounds(activeV3.scene,evaluation?{id:"plan-camera-bounds",primitives:[]}:undefined));
      }
    } catch { /* fall through to legacy parse */ }
    const { config, site } = generateHouseFromJson(houseConfigJson ?? "{}");
    const bounds = site ? computeSiteBounds(site) : undefined;
    return computeCameraFit(config ?? DEFAULT_HOUSE_CONFIG, bounds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative h-full w-full">
      <div className={`absolute inset-0 ${isPlan ? "invisible pointer-events-none" : ""}`} aria-hidden={isPlan}>
      {!evaluation&&<KeyboardControls map={WALK_MAP}>
        <Canvas
          shadows="soft"
          dpr={[1, 1.75]}
          frameloop={isPlan ? "never" : "always"}
          gl={{ toneMapping: THREE.NeutralToneMapping, localClippingEnabled: true }}
          camera={{ position: toTuple(initialFit.position), fov: CAMERA_FOV, near: 0.1, far: 5000 }}
          className="!h-full !w-full"
          onPointerMissed={() => selectKey(null)}
        >
          <Suspense fallback={null}>
            <Scene timeOfDay={timeOfDay} v3Presentation={v3Presentation} v3Site={activeV3.scene?.site} blueprint={isBlueprint} />
          </Suspense>
          <CameraRig />

          {walkMode ? (
            <>
              <WalkController />
              <PointerLockControls makeDefault onUnlock={() => setWalkMode(false)} />
            </>
          ) : (
            <OrbitControls
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
      </KeyboardControls>}
      </div>
      {isPlan && activeV3.scene && (planModel||evaluation) && <ArchitecturalFloorPlan key={`${architecturalView.buildingId}-${architecturalView.floor}`} scene={activeV3.scene} model={planModel} floor={architecturalView.floor} buildingId={architecturalView.buildingId} readOnly={activeV3.source !== "persisted"} />}
      {activeV3.scene && <ArchitecturalViewControls projectId={params.projectId} scene={activeV3.scene} />}

      {/* Walk mode hint — shown until user clicks to capture mouse */}
      {walkMode && (
        <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-6">
          <div className="rounded-xl border border-white/10 bg-neutral-900/80 px-4 py-2 text-xs text-neutral-400 backdrop-blur">
            Click in viewport to capture mouse · WASD to move · ESC to exit
          </div>
        </div>
      )}

      {!isPlan && <ViewportToolbar onEnterWalk={() => setWalkMode(true)} />}
      <V3FailedPreviewBanner />
      <V3ArchitecturalValidationBanner projectId={params.projectId} />
      {!isPlan && !isBlueprint && <RoomNavigator projectId={params.projectId} />}
      <GenerationOverlay />
      {!blank && !isPlan && <QuickActions />}
    </div>
  );
}
