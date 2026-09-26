import * as THREE from "three";
import type { HouseConfig } from "@/types/house";
import type { SiteBounds } from "./siteBounds";
import { LEVEL_HEIGHT, ROOF_THICKNESS } from "./constants";

export interface CameraFit {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

export const CAMERA_FOV = 45;
const DEFAULT_ASPECT = 1.6;

/**
 * Frames the house from a consistent 3/4 angle. The distance is the one at which the bounding sphere fits the
 * viewport's tighter field of view (so tall houses and narrow windows are not cropped). Surrounding site structures
 * widen the frame, but only up to a limit — a sprawling site must not shrink the main house to a speck.
 */
export function computeCameraFit(config: HouseConfig, siteBounds?: SiteBounds, aspect = DEFAULT_ASPECT): CameraFit {
  const roofPitchHeight = Math.max(config.width, config.depth) * 0.35;
  const totalHeight =
    config.floors * LEVEL_HEIGHT + (config.roof === "flat" ? ROOF_THICKNESS : roofPitchHeight);

  const sphere = (halfWidth: number, halfDepth: number) => Math.hypot(halfWidth, halfDepth, totalHeight / 2);
  const houseRadius = sphere(config.width / 2, config.depth / 2);
  const siteRadius = siteBounds ? sphere(Math.max(config.width / 2, siteBounds.halfWidth), Math.max(config.depth / 2, siteBounds.halfDepth)) : houseRadius;
  const radius = houseRadius + Math.min(Math.max(0, siteRadius - houseRadius), houseRadius * 0.7);

  const vHalf = THREE.MathUtils.degToRad(CAMERA_FOV) / 2;
  const hHalf = Math.atan(Math.tan(vHalf) * Math.max(0.4, aspect));
  const distance = (radius / Math.sin(Math.min(vHalf, hHalf))) * 1.02;

  const direction = new THREE.Vector3(1, 0.5, 1).normalize();
  const target = new THREE.Vector3(0, totalHeight * 0.4, 0);
  const position = target.clone().addScaledVector(direction, distance);

  return { position, target };
}
