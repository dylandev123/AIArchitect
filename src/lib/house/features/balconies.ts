import type { BalconyConfig, HouseConfig, MaterialsConfig, WallSide } from "@/types/house";
import type { HousePrimitive } from "../types";
import { BALCONY_LIMITS, FLOOR_THICKNESS } from "../constants";
import { getWallAnchor, offsetOutward, pointOnWall } from "../wallAnchor";
import { buildFloorSlabPrimitive, buildWallRingPrimitives } from "../primitiveBuilders";
import { resolveMaterial } from "../materials";
import { clampNumber, readWall, requireNumbers, type FeatureValidation } from "./validateHelpers";
import type { ResolvedExteriorOptions } from "../catalog/types";
import { RAILING_STYLES } from "../catalog/railings";

const OPPOSITE: Record<WallSide, WallSide> = { north: "south", south: "north", east: "west", west: "east" };

export function validateBalcony(raw: unknown, house: HouseConfig): FeatureValidation<BalconyConfig> {
  if (typeof raw !== "object" || raw === null) {
    return { value: null, errors: ["must be an object."], warnings: [] };
  }
  const o = raw as Record<string, unknown>;
  const { values, errors } = requireNumbers(o, ["width", "depth", "offset"]);
  if (errors.length > 0) return { value: null, errors, warnings: [] };

  const warnings: string[] = [];
  const wall = readWall(o, "south");
  if (wall.warning) warnings.push(wall.warning);

  const defaultLevel = Math.max(1, house.floors - 1);
  const level = clampNumber(
    Math.round(typeof o.level === "number" ? o.level : defaultLevel),
    0,
    Math.max(0, house.floors - 1),
    "level",
    warnings
  );
  const width = clampNumber(values.width, BALCONY_LIMITS.width.min, BALCONY_LIMITS.width.max, "width", warnings);
  const depth = clampNumber(values.depth, BALCONY_LIMITS.depth.min, BALCONY_LIMITS.depth.max, "depth", warnings);
  const railingHeight = clampNumber(
    typeof o.railingHeight === "number" ? o.railingHeight : 1.0,
    BALCONY_LIMITS.railingHeight.min,
    BALCONY_LIMITS.railingHeight.max,
    "railingHeight",
    warnings
  );

  const wallLength = wall.value === "north" || wall.value === "south" ? house.width : house.depth;
  const offset = clampNumber(values.offset, 0, Math.max(0, wallLength - width), "offset", warnings);

  return { value: { wall: wall.value, level, offset, width, depth, railingHeight }, errors: [], warnings };
}

export function buildBalcony(
  config: BalconyConfig,
  house: HouseConfig,
  materials: MaterialsConfig,
  index: number,
  opts?: ResolvedExteriorOptions
): HousePrimitive[] {
  const anchor = getWallAnchor(house, config.wall, config.level);
  const base = pointOnWall(anchor, config.offset + config.width / 2);
  const center = offsetOutward(base, anchor, config.depth / 2);
  const baseY = anchor.origin[1];

  const isNS = config.wall === "north" || config.wall === "south";
  const footprintWidth = isNS ? config.width : config.depth;
  const footprintDepth = isNS ? config.depth : config.width;
  const footprint = { center: [center[0], center[2]] as [number, number], width: footprintWidth, depth: footprintDepth };

  const decking = resolveMaterial(materials.decking);
  const trim = resolveMaterial(materials.trim);

  const idPrefix = `balcony-${index}`;
  const label = `Balcony ${index + 1}`;
  const primitives: HousePrimitive[] = [];
  const railKey = opts?.railingStyle ?? "iron";
  const railEntry = RAILING_STYLES[railKey];

  primitives.push(
    buildFloorSlabPrimitive(
      footprint,
      baseY - FLOOR_THICKNESS,
      FLOOR_THICKNESS,
      `${idPrefix}-platform`,
      `${label} Platform`,
      decking.color,
      decking
    )
  );

  // concrete-wall / solid → existing ring builder
  if (railEntry.kind === "solid" || railKey === "concrete-wall") {
    primitives.push(
      ...buildWallRingPrimitives(
        footprint,
        baseY,
        config.railingHeight,
        `${idPrefix}-railing`,
        `${label} Railing`,
        railEntry.color ?? trim.color,
        [OPPOSITE[config.wall]],
        { color: railEntry.color ?? trim.color, roughness: railEntry.roughness, metalness: railEntry.metalness }
      )
    );
  } else if (railEntry.kind === "glass") {
    // Glass slab panels on 3 exposed sides
    const railColor = railEntry.color ?? "#a8c8e0";
    const glassH = config.railingHeight;
    const hw = footprint.width / 2;
    const hd = footprint.depth / 2;
    const [cx, cz] = footprint.center;
    const SLAB_T = 0.04;
    const sides: { id: string; pos: [number,number,number]; size: [number,number,number] }[] = [];
    if (config.wall !== "north")  sides.push({ id: "n", pos: [cx, baseY + glassH/2, cz - hd + SLAB_T/2], size: [footprint.width, glassH, SLAB_T] });
    if (config.wall !== "south")  sides.push({ id: "s", pos: [cx, baseY + glassH/2, cz + hd - SLAB_T/2], size: [footprint.width, glassH, SLAB_T] });
    if (config.wall !== "east")   sides.push({ id: "e", pos: [cx + hw - SLAB_T/2, baseY + glassH/2, cz], size: [SLAB_T, glassH, footprint.depth] });
    if (config.wall !== "west")   sides.push({ id: "w", pos: [cx - hw + SLAB_T/2, baseY + glassH/2, cz], size: [SLAB_T, glassH, footprint.depth] });
    sides.forEach(({ id, pos, size }) => {
      primitives.push({ kind: "box", id: `${idPrefix}-rail-${id}`, category: "balcony", label: `${label} Rail`, position: pos, rotation: [0,0,0], size, color: railColor, roughness: railEntry.roughness ?? 0.05, metalness: railEntry.metalness ?? 0.05, transparent: true, opacity: railEntry.opacity ?? 0.45 });
    });
  } else {
    // posts + top rail
    const hw = footprint.width / 2;
    const hd = footprint.depth / 2;
    const [cx, cz] = footprint.center;
    const postW = railEntry.elementSize ?? 0.06;
    const topRailH = 0.06;
    const postColor = railEntry.color ?? trim.color;
    const postRough = railEntry.roughness ?? trim.roughness;
    const postMetal = railEntry.metalness ?? trim.metalness;

    // Top rail along 3 exposed sides (omit the wall-attached side)
    const railSides: { id: string; pos: [number,number,number]; size: [number,number,number] }[] = [];
    if (config.wall !== "north")  railSides.push({ id: "n", pos: [cx, baseY + config.railingHeight - topRailH/2, cz - hd], size: [footprint.width, topRailH, postW] });
    if (config.wall !== "south")  railSides.push({ id: "s", pos: [cx, baseY + config.railingHeight - topRailH/2, cz + hd], size: [footprint.width, topRailH, postW] });
    if (config.wall !== "east")   railSides.push({ id: "e", pos: [cx + hw, baseY + config.railingHeight - topRailH/2, cz], size: [postW, topRailH, footprint.depth] });
    if (config.wall !== "west")   railSides.push({ id: "w", pos: [cx - hw, baseY + config.railingHeight - topRailH/2, cz], size: [postW, topRailH, footprint.depth] });
    railSides.forEach(({ id, pos, size }) => {
      primitives.push({ kind: "box", id: `${idPrefix}-toprail-${id}`, category: "balcony", label: `${label} Top Rail`, position: pos, rotation: [0,0,0], size, color: postColor, roughness: postRough, metalness: postMetal });
    });

    const postH = config.railingHeight - topRailH;

    if (railEntry.horizontal) {
      // Horizontal cable / bar style — N evenly-spaced bars on each exposed face
      const N = Math.max(2, railEntry.density ?? 3);
      const barH = railEntry.elementSize ?? 0.012;
      for (let i = 1; i <= N; i++) {
        const barY = baseY + (postH / (N + 1)) * i;
        if (config.wall !== "north") primitives.push({ kind: "box", id: `${idPrefix}-cable-n-${i}`, category: "balcony", label: `${label} Cable`, position: [cx, barY, cz - hd] as [number,number,number], rotation: [0,0,0] as [number,number,number], size: [footprint.width, barH, postW] as [number,number,number], color: postColor, roughness: postRough, metalness: postMetal });
        if (config.wall !== "south") primitives.push({ kind: "box", id: `${idPrefix}-cable-s-${i}`, category: "balcony", label: `${label} Cable`, position: [cx, barY, cz + hd] as [number,number,number], rotation: [0,0,0] as [number,number,number], size: [footprint.width, barH, postW] as [number,number,number], color: postColor, roughness: postRough, metalness: postMetal });
        if (config.wall !== "east")  primitives.push({ kind: "box", id: `${idPrefix}-cable-e-${i}`, category: "balcony", label: `${label} Cable`, position: [cx + hw, barY, cz] as [number,number,number], rotation: [0,0,0] as [number,number,number], size: [postW, barH, footprint.depth] as [number,number,number], color: postColor, roughness: postRough, metalness: postMetal });
        if (config.wall !== "west")  primitives.push({ kind: "box", id: `${idPrefix}-cable-w-${i}`, category: "balcony", label: `${label} Cable`, position: [cx - hw, barY, cz] as [number,number,number], rotation: [0,0,0] as [number,number,number], size: [postW, barH, footprint.depth] as [number,number,number], color: postColor, roughness: postRough, metalness: postMetal });
      }
    } else {
      // Vertical posts at regular spacing along each exposed side
      const spacing = Math.max(0.15, (1 / (railEntry.density ?? 2)));
      const addPosts = (idBase: string, xStart: number, zStart: number, xEnd: number, zEnd: number) => {
        const dx = xEnd - xStart; const dz = zEnd - zStart;
        const len = Math.sqrt(dx*dx + dz*dz);
        const n = Math.max(2, Math.round(len / spacing));
        for (let i = 0; i <= n; i++) {
          const t = i / n;
          const px = xStart + dx * t;
          const pz = zStart + dz * t;
          const py = baseY + postH / 2;
          primitives.push({ kind: "box", id: `${idPrefix}-post-${idBase}-${i}`, category: "balcony", label: `${label} Post`, position: [px, py, pz] as [number,number,number], rotation: [0,0,0] as [number,number,number], size: [postW, postH, postW] as [number,number,number], color: postColor, roughness: postRough, metalness: postMetal });
        }
      };
      if (config.wall !== "north")  addPosts("n", cx - hw, cz - hd, cx + hw, cz - hd);
      if (config.wall !== "south")  addPosts("s", cx - hw, cz + hd, cx + hw, cz + hd);
      if (config.wall !== "east")   addPosts("e", cx + hw, cz - hd, cx + hw, cz + hd);
      if (config.wall !== "west")   addPosts("w", cx - hw, cz - hd, cx - hw, cz + hd);
    }
  }

  return primitives.map((p) => ({ ...p, category: "balcony" as const }));
}
