import * as THREE from "three";
import type { HouseConfig } from "@/types/house";
import type { SiteBounds } from "./siteBounds";
import { LEVEL_HEIGHT, ROOF_THICKNESS } from "./constants";

export interface CameraFit {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

/** Frames the house (and any surrounding site structures) from a consistent 3/4 isometric angle. */
export function computeCameraFit(config: HouseConfig, siteBounds?: SiteBounds): CameraFit {
  const roofPitchHeight = Math.max(config.width, config.depth) * 0.35;
  const totalHeight =
    config.floors * LEVEL_HEIGHT + (config.roof === "flat" ? ROOF_THICKNESS : roofPitchHeight);

  const halfWidth = Math.max(config.width / 2, siteBounds?.halfWidth ?? 0);
  const halfDepth = Math.max(config.depth / 2, siteBounds?.halfDepth ?? 0);
  const footprintDiagonal = Math.sqrt((halfWidth * 2) ** 2 + (halfDepth * 2) ** 2);
  const distance = Math.max(footprintDiagonal, totalHeight) * 1.6 + 4;

  const direction = new THREE.Vector3(1, 0.45, 1).normalize();
  const target = new THREE.Vector3(0, totalHeight / 2.5, 0);
  const position = target.clone().addScaledVector(direction, distance);

  return { position, target };
}
