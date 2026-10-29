"use client";

import * as THREE from "three";

/** A small local botanical mesh: curved, feathered fronds rather than solid leaf silhouettes. */
function palmFronds(variant: number) {
  const vertices: number[] = [], colors: number[] = [];
  const dark = new THREE.Color("#344c2e"), light = new THREE.Color("#7c8750");
  function triangle(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, tint: THREE.Color) {
    for (const p of [a, b, c]) { vertices.push(p.x, p.y, p.z); colors.push(tint.r, tint.g, tint.b); }
  }
  for (let f = 0; f < 13; f++) {
    const angle = f * 2.39996 + variant * .8;
    const forward = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const across = new THREE.Vector3(-forward.z, 0, forward.x);
    const length = 3.6 + Math.sin(f * 4.7 + variant) * .6;
    const upright = f > 9 ? 2.5 : .5;
    const point = (t: number) => forward.clone().multiplyScalar(length * t).add(new THREE.Vector3(-.27, 9.5 + Math.sin(t * Math.PI) * 1.25 - 1.9 * t * t + upright * t, .15));
    for (let j = 0; j < 27; j++) {
      const t = .06 + j * .033;
      const origin = point(t);
      const leafLength = (.9 * Math.pow(Math.sin(Math.PI * t), .55) + .06) * (1 + .12 * Math.sin(j * 7 + f));
      const tint = dark.clone().lerp(light, .22 + .5 * t + .12 * Math.sin(f * 5 + j));
      // The fine central rib remains visible between the leaflets.
      const next = point(t + .034), rib = across.clone().multiplyScalar(.022 * (1 - t));
      triangle(origin.clone().add(rib), origin.clone().sub(rib), next, tint);
      for (const side of [-1, 1]) {
        const middle: THREE.Vector3[] = [], left: THREE.Vector3[] = [], right: THREE.Vector3[] = [];
        for (let k = 0; k <= 4; k++) {
          const u = k / 4;
          const p = origin.clone().addScaledVector(across, side * leafLength * u)
            .addScaledVector(forward, (.35 + .35 * t) * u)
            .add(new THREE.Vector3(0, .1 * Math.sin(Math.PI * u) - .35 * u * u, 0));
          const width = .075 * Math.sin(Math.PI * u) * (1 - .45 * t);
          middle.push(p.clone().add(new THREE.Vector3(0, .025 * Math.sin(Math.PI * u), 0)));
          left.push(p.clone().addScaledVector(forward, width));
          right.push(p.clone().addScaledVector(forward, -width));
        }
        for (let k = 0; k < 4; k++) {
          triangle(middle[k], left[k], left[k + 1], tint);
          triangle(middle[k], left[k + 1], middle[k + 1], tint);
          triangle(middle[k], middle[k + 1], right[k + 1], tint);
          triangle(middle[k], right[k + 1], right[k], tint.clone().multiplyScalar(.87));
        }
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function palmTrunk() {
  const geometry = new THREE.CylinderGeometry(.12, .26, 9.55, 12, 52);
  const positions = geometry.attributes.position;
  const colors: number[] = [];
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i) + 4.775, t = y / 9.55;
    const ring = .88 + .12 * Math.cos(y * 33);
    positions.setXYZ(i, positions.getX(i) + .7 * Math.sin(t * Math.PI) - .27 * t, y, positions.getZ(i) + .15 * t * t);
    const c = new THREE.Color("#95866a").multiplyScalar(ring);
    colors.push(c.r, c.g, c.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

// Shared immutable geometry, like the existing vegetation asset cache. No downloads or project assets.
const leaves = [palmFronds(0), palmFronds(1)];
const trunk = palmTrunk();
const bark = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .94 });
const leaf = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .78, side: THREE.DoubleSide });

export function TropicalPalm({ height, variant = 0 }: { height: number; variant?: number }) {
  return <group scale={height / 11} dispose={null} name="Feathered coconut palm">
    <mesh geometry={trunk} material={bark} castShadow receiveShadow />
    <mesh geometry={leaves[variant % 2]} material={leaf} castShadow receiveShadow />
  </group>;
}
