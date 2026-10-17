import * as THREE from "three";
import type { V3SceneSite } from "./scene";

/**
 * V3 sites own their ground: the compiled V3 terrain (with pool excavations) covers the authored site rectangle. The
 * V2 lawn is then only the surrounding landscape, with the site cut out so the two never overlap or z-fight.
 * Shape space is (x, -z), matching GroundPlane's rotateX(-π/2).
 */
export function v3GroundSurroundShape(site: Pick<V3SceneSite, "width" | "depth">, half: number): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(-half, half);
  shape.lineTo(half, half);
  shape.lineTo(half, -half);
  shape.lineTo(-half, -half);
  shape.closePath();
  // A hole runs opposite to the outline.
  const hw = site.width / 2, hd = site.depth / 2, hole = new THREE.Path();
  hole.moveTo(-hw, hd);
  hole.lineTo(-hw, -hd);
  hole.lineTo(hw, -hd);
  hole.lineTo(hw, hd);
  hole.closePath();
  shape.holes.push(hole);
  return shape;
}
