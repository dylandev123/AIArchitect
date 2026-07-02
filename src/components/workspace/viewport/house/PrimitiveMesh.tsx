"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { HousePrimitive } from "@/lib/house/types";
import { useSceneStore } from "@/store/useSceneStore";
import { featureKey, parseFeatureMeshId } from "@/lib/house/features/parseFeatureId";
import { WaterSurface } from "./WaterSurface";

export function PrimitiveMesh({ primitive }: { primitive: HousePrimitive }) {
  const featureRef = useMemo(() => parseFeatureMeshId(primitive.id), [primitive.id]);
  const selectionKey = featureRef ? featureKey(featureRef) : primitive.id;

  const isSelected = useSceneStore((s) => s.selectedKey === selectionKey);
  const selectKey = useSceneStore((s) => s.selectKey);

  const triGeometry = useMemo(() => {
    if (primitive.kind !== "triMesh") return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(primitive.vertices, 3));
    geometry.computeVertexNormals();
    return geometry;
  }, [primitive]);

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    selectKey(selectionKey);
  };

  const materialProps = {
    color: primitive.color,
    roughness: primitive.roughness ?? 0.85,
    metalness: primitive.metalness ?? 0,
    transparent: primitive.transparent ?? false,
    opacity: primitive.opacity ?? 1,
    emissive: isSelected ? "#f59e0b" : "#000000",
    emissiveIntensity: isSelected ? 0.45 : 0,
  };

  if (primitive.kind === "box" && primitive.id.endsWith("-water")) {
    return (
      <WaterSurface position={primitive.position} width={primitive.size[0]} depth={primitive.size[2]} />
    );
  }

  if (primitive.kind === "box") {
    return (
      <mesh
        position={primitive.position}
        rotation={primitive.rotation}
        castShadow
        receiveShadow
        onClick={handleClick}
        userData={{ id: primitive.id }}
      >
        <boxGeometry args={primitive.size} />
        <meshStandardMaterial {...materialProps} />
      </mesh>
    );
  }

  return (
    <mesh
      geometry={triGeometry!}
      castShadow
      receiveShadow
      onClick={handleClick}
      userData={{ id: primitive.id }}
    >
      <meshStandardMaterial {...materialProps} side={THREE.DoubleSide} />
    </mesh>
  );
}
