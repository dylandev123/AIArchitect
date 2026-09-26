"use client";

import { useEffect, useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { useSceneStore } from "@/store/useSceneStore";
import { fitScale, type AssetPlacement } from "@/lib/assets/placement";
import { glbModels, instantiateGlb, noteGlbRendered } from "@/lib/assets/glbModels";
import type { AssetValidationReport } from "@/types/assets";

/**
 * A library GLB standing in for one procedural feature. It is only mounted once the model has loaded (the
 * procedural version draws until then and whenever loading fails), and it carries the feature's own id, so
 * selecting it selects the same feature the procedural version would have.
 */
export function GlbFeature({ placement, projectId, footprint }: { placement: AssetPlacement; projectId: string; footprint?: AssetValidationReport["footprint"] }) {
  const { featureId, assetId, x, z, yaw, width, depth } = placement;
  const instance = useMemo(() => instantiateGlb(assetId), [assetId]);
  // The stored collision footprint sizes the fit; without one the model's measured size does.
  const scale = useMemo(() => {
    const size = glbModels.peek(assetId)?.size;
    return fitScale({ width, depth }, footprint ?? (size ? { width: size.x, depth: size.z } : undefined));
  }, [assetId, footprint, width, depth]);

  useEffect(() => {
    if (instance) noteGlbRendered(projectId, featureId, assetId);
  }, [instance, projectId, featureId, assetId]);

  if (!instance) return null;

  const select = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    useSceneStore.getState().selectKey(featureId);
  };

  return (
    <group name={featureId} userData={{ id: featureId, assetId }} position={[x, 0, z]} rotation={[0, yaw, 0]} scale={scale} onClick={select}>
      <primitive object={instance} />
    </group>
  );
}
