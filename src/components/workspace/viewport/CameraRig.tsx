"use client";

import { useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useSceneStore, type CameraPreset } from "@/store/useSceneStore";
import { useProjectStore } from "@/store/useProjectStore";
import { generateHouseFromJson } from "@/lib/house/generateHouse";
import { CAMERA_FOV, computeCameraFit } from "@/lib/house/cameraFit";
import { computeSiteBounds } from "@/lib/house/siteBounds";
import { CAMERA_FLIGHT_MS, listRooms, resolveRoomFocus, roomCameraGoal, type CameraGoal } from "@/lib/house/roomView";
import { DEFAULT_HOUSE_CONFIG } from "@/types/house";

interface Flight {
  fromPosition: THREE.Vector3;
  fromTarget: THREE.Vector3;
  fromFov: number;
  goal: { position: THREE.Vector3; target: THREE.Vector3; fov: number };
  elapsed: number;
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const goalOf = (position: THREE.Vector3, target: THREE.Vector3, fov = CAMERA_FOV) => ({ position, target, fov });

/**
 * Owns every deliberate camera move: reads the one-shot `cameraPreset` from the scene store and glides there instead of
 * cutting. Entering a room remembers the exterior pose so "Full House View" can put the camera back exactly where it was.
 * Renders nothing; must live inside the Canvas.
 */
export function CameraRig() {
  const params = useParams<{ projectId: string }>();
  const houseConfigJson = useProjectStore((s) => s.getProject(params.projectId)?.houseConfigJson);
  const cameraPreset = useSceneStore((s) => s.cameraPreset);
  const walkMode = useSceneStore((s) => s.walkMode);
  const get = useThree((s) => s.get);
  // Only used to re-run when orbit controls come or go (walk mode swaps them); the live objects are read via `get()`.
  const controlsInstance = useThree((s) => s.controls);

  const flight = useRef<Flight | null>(null);
  /** Exterior pose to return to; set when stepping in from outside, cleared once used or overridden. */
  const exteriorPose = useRef<CameraGoal | null>(null);

  useEffect(() => {
    const { size, camera: cam, controls: ctl } = get();
    const camera = cam as THREE.PerspectiveCamera;
    const controls = ctl as OrbitControlsImpl | null;
    if (!cameraPreset || !controls || walkMode) return;
    const aspect = size.width / Math.max(1, size.height);
    const { config, site } = generateHouseFromJson(houseConfigJson ?? "{}");
    const house = config ?? DEFAULT_HOUSE_CONFIG;
    const siteFit = () => computeCameraFit(house, site ? computeSiteBounds(site) : undefined, aspect);

    const resolve = (preset: CameraPreset): ReturnType<typeof goalOf> | null => {
      switch (preset) {
        case "site": {
          const fit = siteFit();
          return goalOf(fit.position, fit.target);
        }
        case "house": {
          const fit = computeCameraFit(house, undefined, aspect);
          return goalOf(fit.position, fit.target);
        }
        case "top": {
          const bounds = site ? computeSiteBounds(site) : { halfWidth: 15, halfDepth: 15 };
          const extent = Math.max(bounds.halfWidth, bounds.halfDepth) + 12;
          return goalOf(new THREE.Vector3(0, extent * 1.6, 0.001), new THREE.Vector3());
        }
        case "room": {
          const { rooms } = listRooms(houseConfigJson ?? "");
          const room = resolveRoomFocus(rooms, useSceneStore.getState().focusedRoom);
          if (!room) return null;
          const goal = roomCameraGoal(room);
          return goalOf(new THREE.Vector3(...goal.position), new THREE.Vector3(...goal.target), goal.fov);
        }
        case "exterior": {
          const saved = exteriorPose.current;
          if (saved) return goalOf(new THREE.Vector3(...saved.position), new THREE.Vector3(...saved.target), saved.fov);
          const fit = siteFit();
          return goalOf(fit.position, fit.target);
        }
      }
    };

    const goal = resolve(cameraPreset);
    if (goal) {
      // Remember where the exterior camera was, but never overwrite it while moving between rooms.
      if (cameraPreset === "room" && !exteriorPose.current) {
        exteriorPose.current = {
          position: camera.position.toArray(),
          target: controls.target.toArray(),
          fov: camera.fov,
        };
      }
      if (cameraPreset !== "room") exteriorPose.current = null;

      flight.current = {
        fromPosition: camera.position.clone(),
        fromTarget: controls.target.clone(),
        fromFov: camera.fov,
        goal,
        elapsed: 0,
      };
      controls.enabled = false;
    }
    useSceneStore.getState().triggerCameraPreset(null);
    // The preset is one-shot; the design and viewport size are read at the moment it fires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraPreset, controlsInstance, walkMode]);

  // Never leave orbiting disabled if the rig goes away mid-flight.
  useEffect(
    () => () => {
      const controls = get().controls as OrbitControlsImpl | null;
      if (controls) controls.enabled = true;
    },
    [get, controlsInstance]
  );

  useFrame((state, delta) => {
    const f = flight.current;
    const camera = state.camera as THREE.PerspectiveCamera;
    const controls = state.controls as OrbitControlsImpl | null;
    if (!f || !controls) return;
    f.elapsed += delta * 1000;
    const t = Math.min(1, f.elapsed / CAMERA_FLIGHT_MS);
    const k = ease(t);

    camera.position.lerpVectors(f.fromPosition, f.goal.position, k);
    controls.target.lerpVectors(f.fromTarget, f.goal.target, k);
    const fov = THREE.MathUtils.lerp(f.fromFov, f.goal.fov, k);
    if (fov !== camera.fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    controls.update();

    if (t >= 1) {
      flight.current = null;
      controls.enabled = true;
    }
  });

  return null;
}
