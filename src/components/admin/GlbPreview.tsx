"use client";

import { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import { Box3, Vector3 } from "three";
import { glbModels, instantiateGlb, useGlbStatus } from "@/lib/assets/glbModels";
import type { AssetValidationReport, CuratedAsset } from "@/types/assets";

/** Interactive review viewer for a queued GLB: orbit, ground grid, bounding box and collision footprint. */
export function GlbPreview({ asset }: { asset: CuratedAsset }) {
  const status = useGlbStatus(asset.id);
  const [showBox, setShowBox] = useState(true);
  const [showFootprint, setShowFootprint] = useState(true);

  useEffect(() => {
    void glbModels.load(asset.id);
  }, [asset.id]);

  const instance = useMemo(() => (status === "ready" ? instantiateGlb(asset.id) : null), [status, asset.id]);
  const size = status === "ready" ? glbModels.peek(asset.id)?.size : undefined;

  if (status === "failed") {
    return <div className="rounded-lg bg-red-500/10 px-3 py-6 text-center text-[11px] text-red-400">Could not load this model: {glbModels.error(asset.id)}</div>;
  }
  if (!instance || !size) {
    return <div className="rounded-lg bg-white/[0.03] px-3 py-6 text-center text-[11px] text-neutral-500">Loading model…</div>;
  }

  const reach = Math.max(size.x, size.y, size.z);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="h-64 overflow-hidden rounded-lg border border-white/8 bg-neutral-900">
        <Canvas shadows camera={{ position: [reach * 1.6, reach * 1.1, reach * 1.6], fov: 40, near: 0.05, far: reach * 40 }} dpr={[1, 2]}>
          <color attach="background" args={["#171717"]} />
          <hemisphereLight args={["#ffffff", "#404040", 1.1]} />
          <directionalLight position={[reach * 2, reach * 3, reach]} intensity={2.2} castShadow />
          <gridHelper args={[Math.ceil(reach * 3), Math.ceil(reach * 3), "#555555", "#2a2a2a"]} />
          <primitive object={instance} />
          {showBox && <BoundsBox size={size} />}
          {showFootprint && <Footprint size={size} footprint={asset.validation?.footprint} />}
          <OrbitControls makeDefault target={[0, size.y / 2, 0]} enableDamping />
        </Canvas>
      </div>
      <div className="flex gap-3 text-[11px] text-neutral-400">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={showBox} onChange={(e) => setShowBox(e.target.checked)} /> Bounding box
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={showFootprint} onChange={(e) => setShowFootprint(e.target.checked)} /> Collision footprint
        </label>
        <span className="ml-auto text-neutral-600">Model is shown grounded and centred, as it is placed.</span>
      </div>
    </div>
  );
}

function BoundsBox({ size }: { size: Vector3 }) {
  const box = useMemo(() => new Box3(new Vector3(-size.x / 2, 0, -size.z / 2), new Vector3(size.x / 2, size.y, size.z / 2)), [size]);
  return <box3Helper args={[box, "#f5a800"]} />;
}

/** The ground rectangle site planning treats as the model's collision footprint (centred, as the model is placed). */
function Footprint({ size, footprint }: { size: Vector3; footprint?: AssetValidationReport["footprint"] }) {
  const w = footprint?.width ?? size.x;
  const d = footprint?.depth ?? size.z;
  const points = useMemo<[number, number, number][]>(
    () => [[-w / 2, 0.01, -d / 2], [w / 2, 0.01, -d / 2], [w / 2, 0.01, d / 2], [-w / 2, 0.01, d / 2], [-w / 2, 0.01, -d / 2]],
    [w, d]
  );
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <planeGeometry args={[w, d]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.18} depthWrite={false} />
      </mesh>
      <Line points={points} color="#38bdf8" lineWidth={1.5} />
    </group>
  );
}
