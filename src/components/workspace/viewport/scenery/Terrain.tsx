"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import * as THREE from "three";
import { useProjectStore } from "@/store/useProjectStore";
import { generateHouseFromJson } from "@/lib/house/generateHouse";
import {
  buildApproachRoad,
  buildRollingMesh,
  buildTerrainMesh,
  generateEnvironmentScenery,
  planTerrain,
  type RoadRibbon,
  type SceneryShape,
  type TerrainMeshData,
} from "@/lib/landscaping/terrain";

/** Unit shapes shared by every instance; boxes and cones sit on y=0, blobs are centred. */
const GEOMETRY = {
  box: () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
  trunk: () => new THREE.CylinderGeometry(0.6, 1, 1, 6).translate(0, 0.5, 0),
  cone: () => new THREE.ConeGeometry(0.5, 1, 6).translate(0, 0.5, 0),
  roof: () => new THREE.ConeGeometry(0.72, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0),
  blob: () => new THREE.IcosahedronGeometry(0.5, 0),
};

function Instanced({ shapes, geometry, castShadow = true }: { shapes: SceneryShape[]; geometry: keyof typeof GEOMETRY; castShadow?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => GEOMETRY[geometry](), [geometry]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const euler = new THREE.Euler();
    const color = new THREE.Color();
    shapes.forEach((s, i) => {
      quat.setFromEuler(euler.set(0, s.rotY, 0));
      matrix.compose(new THREE.Vector3(s.x, s.y, s.z), quat, new THREE.Vector3(s.sx, s.sy, s.sz));
      mesh.setMatrixAt(i, matrix);
      mesh.setColorAt(i, color.set(s.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [shapes]);

  if (shapes.length === 0) return null;
  return (
    // Remount when the count changes: an InstancedMesh's capacity is fixed at creation.
    <instancedMesh key={shapes.length} ref={ref} args={[geo, undefined, shapes.length]} castShadow={castShadow} receiveShadow frustumCulled={false}>
      <meshStandardMaterial roughness={0.9} flatShading />
    </instancedMesh>
  );
}

function reliefGeometry(data: TerrainMeshData): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(data.normals, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(data.colors, 3));
  return geo;
}

function roadGeometry(road: RoadRibbon): THREE.BufferGeometry {
  const positions: number[] = [];
  for (let i = 0; i < road.points.length - 1; i++) {
    const [a0, a1] = road.points[i];
    const [b0, b1] = road.points[i + 1];
    // Wound to face up whichever way the road runs.
    const up = (b0[0] - a0[0]) * (a1[2] - a0[2]) - (b0[2] - a0[2]) * (a1[0] - a0[0]) > 0;
    const quad = up ? [a0, b0, b1, a0, b1, a1] : [a0, b1, b0, a0, a1, b1];
    for (const p of quad) positions.push(...p);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Procedural land around the house, driven by the project's `site` settings: uphill slope,
 * cliff/beach drop to the sea, and simple instanced scenery (trees, fields, streets, blocks).
 * Renders nothing for projects without site settings.
 */
export function Terrain() {
  const params = useParams<{ projectId: string }>();
  const houseConfigJson = useProjectStore((s) => s.getProject(params.projectId)?.houseConfigJson);

  const built = useMemo(() => {
    const { site } = generateHouseFromJson(houseConfigJson ?? "{}");
    const plan = site ? planTerrain(site) : undefined;
    if (!site || !plan) return undefined;
    const meshData = plan.slope !== "flat" || plan.edge !== undefined ? buildTerrainMesh(plan) : undefined;
    const road = buildApproachRoad(plan);
    const rolling = buildRollingMesh(plan);
    return {
      plan,
      relief: meshData ? reliefGeometry(meshData) : undefined,
      rolling: rolling ? reliefGeometry(rolling) : undefined,
      road: road ? { geometry: roadGeometry(road), color: road.color } : undefined,
      scenery: generateEnvironmentScenery(site, plan),
    };
  }, [houseConfigJson]);

  if (!built) return null;
  const { plan, relief, rolling, road, scenery } = built;
  const water = plan.water;

  return (
    <>
      {relief && (
        <mesh geometry={relief} receiveShadow castShadow>
          <meshStandardMaterial vertexColors roughness={0.95} flatShading side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
        </mesh>
      )}
      {rolling && (
        <mesh geometry={rolling} receiveShadow castShadow>
          <meshStandardMaterial vertexColors roughness={0.95} flatShading side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
        </mesh>
      )}
      {water && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, water.level, 0]}>
          <planeGeometry args={[900, 900]} />
          <meshStandardMaterial color={water.color} roughness={0.6} metalness={0} envMapIntensity={0.3} transparent opacity={0.94} />
        </mesh>
      )}
      {road && (
        <mesh geometry={road.geometry} receiveShadow>
          <meshStandardMaterial color={road.color} roughness={0.95} side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-3} polygonOffsetUnits={-3} />
        </mesh>
      )}
      <Instanced shapes={scenery.boxes} geometry="box" />
      <Instanced shapes={scenery.roofs} geometry="roof" />
      <Instanced shapes={scenery.rocks} geometry="blob" />
      <Instanced shapes={scenery.trees.trunks} geometry="trunk" />
      <Instanced shapes={scenery.trees.round} geometry="blob" />
      <Instanced shapes={scenery.trees.conifer} geometry="cone" />
    </>
  );
}
