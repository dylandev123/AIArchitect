"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useProjectStore } from "@/store/useProjectStore";
import { useSceneStore } from "@/store/useSceneStore";
import { generateHouseFromJson } from "@/lib/house/generateHouse";
import { PrimitiveMesh } from "./PrimitiveMesh";
import type { MaterialsConfig } from "@/types/house";
import { SURFACE_PBR, usePbrReady, type PbrSetDef, type SurfaceKey } from "@/lib/pbrLibrary";
import type { HousePrimitive } from "@/lib/house/types";
import { applyEdgeDetail, RENDER_BASE_BEVEL } from "@/lib/house/architecture/edgeDetail";
import { cutawayHiddenIds } from "@/lib/house/roomView";

/**
 * Which material a primitive is made of, recovered from its category and colour: the builders tint walls,
 * gables, roofs and trim with their zone's colour. Anything else (floors, glass, garages…) keeps a plain finish.
 */
const MASONRY_CATEGORIES = new Set<HousePrimitive["category"]>(["bay", "curvedWall", "arch", "foundation", "stairs"]);

function surfaceOf(primitive: HousePrimitive, materials: MaterialsConfig | undefined): SurfaceKey | undefined {
  if (!materials) return undefined;
  const color = primitive.color.toLowerCase();
  const is = (zone: keyof MaterialsConfig) => materials[zone].color.toLowerCase() === color;
  if (primitive.category === "roof") return is("roof") ? materials.roof.material : is("exterior") ? materials.exterior.material : undefined;
  // Masonry parts are shades of the exterior finish (or plain stone), so they take its pattern regardless of exact colour.
  if (MASONRY_CATEGORIES.has(primitive.category)) return materials.exterior.material;
  if (primitive.category === "retainingWall") return "stone";
  if (primitive.category === "rock") return "rock";
  if (primitive.category === "landscape") return "grass";
  if (primitive.category === "deck") return materials.decking.material;
  if (primitive.category === "patio" || primitive.category === "path" || primitive.category === "driveway" || primitive.category === "parking") return "paving";
  if (primitive.category === "wall") return is("exterior") ? materials.exterior.material : is("trim") ? materials.trim.material : undefined;
  return undefined;
}

export function HouseRenderer() {
  const params = useParams<{ projectId: string }>();
  const houseConfigJson = useProjectStore(
    (s) => s.getProject(params.projectId)?.houseConfigJson
  );
  const showRoof = useSceneStore((s) => s.showRoof);
  const cutawayLevel = useSceneStore((s) => s.cutawayLevel);

  const { model, site } = useMemo(
    () => generateHouseFromJson(houseConfigJson ?? "{}"),
    [houseConfigJson]
  );

  // Render-time finishing: a small bevel on trim-like boxes the design's tier left sharp (the model itself is unchanged).
  const finished = useMemo(() => (model ? applyEdgeDetail(model.primitives, RENDER_BASE_BEVEL) : []), [model]);

  // Stepping into a room hides the roof and whatever would block the view of it; the model is untouched.
  const cutaway = useMemo(
    () => (site && cutawayLevel !== null ? cutawayHiddenIds(finished, site.house, cutawayLevel) : null),
    [finished, site, cutawayLevel]
  );

  const surfaces = useMemo(
    () => finished.map((p) => surfaceOf(p, site?.materials)),
    [finished, site?.materials]
  );
  const pbrDefs = useMemo(() => {
    const defs = new Set<PbrSetDef>();
    for (const surface of surfaces) {
      const def = surface && SURFACE_PBR[surface];
      if (def) defs.add(def);
    }
    return [...defs];
  }, [surfaces]);
  const pbrReady = usePbrReady(pbrDefs);

  if (!model || !pbrReady) return null;

  const isVisible = (p: HousePrimitive) => (showRoof || p.category !== "roof") && !cutaway?.has(p.id);

  return (
    <group>
      {finished.map((primitive, i) =>
        isVisible(primitive) ? <PrimitiveMesh key={primitive.id} primitive={primitive} surface={surfaces[i]} /> : null
      )}
    </group>
  );
}
