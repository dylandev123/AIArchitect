import type { WallSide } from "@/types/house";
import type { HousePrimitive } from "../types";
import type { ResolvedMaterial } from "../materials";
import { buildWallRingPrimitives, type RoomFootprint } from "../primitiveBuilders";
import { box, hash01, overlapsDoor, paintOf, shade, type DoorSpan, type Paint } from "./parts";
import type { FoundationKind, WallConstruction } from "./profiles";

/** One storey of walls for a rectangular footprint. Shared by the main house and detached outbuildings. */
export interface WallRun {
  footprint: RoomFootprint;
  /** Bottom of the wall (top of the floor slab). */
  baseY: number;
  height: number;
  /** e.g. "wall-0" — sides are appended, giving the same ids the generic shell uses. */
  idPrefix: string;
  labelPrefix: string;
  material: ResolvedMaterial;
}

const LOG_COURSE = 0.3;
const LOG_THICKNESS = 0.34;
/** How far a notched log end sticks out past the corner. */
const LOG_CORNER_STICKOUT = 0.22;
const SIDES: WallSide[] = ["north", "south", "east", "west"];

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Horizontal log walls with saddle-notched corners: each side is a stack of round-ish log courses over a dark
 * chinking core. Courses alternate — on even ones the north/south logs run long and overshoot the corners, on odd
 * ones the east/west logs do — so the corners interlock the way real log corners do.
 * The core keeps the generic `wall-<n>-<side>` id; every log is `<core id>-log-<course>`.
 */
export function buildLogWalls(run: WallRun): HousePrimitive[] {
  const { footprint, baseY, height, idPrefix, labelPrefix, material } = run;
  const [cx, cz] = footprint.center;
  const halfW = footprint.width / 2;
  const halfD = footprint.depth / 2;
  const courses = Math.max(2, Math.round(height / LOG_COURSE));
  const courseH = height / courses;
  const logH = courseH - 0.03;
  const T = LOG_THICKNESS;
  const e = LOG_CORNER_STICKOUT;
  const log: Paint = paintOf(material);
  const chinking: Paint = paintOf(material, shade(material.color, 0.5));
  const out: HousePrimitive[] = [];

  const centers: Record<WallSide, [number, number]> = {
    north: [cx, cz - halfD + T / 2],
    south: [cx, cz + halfD - T / 2],
    east: [cx + halfW - T / 2, cz],
    west: [cx - halfW + T / 2, cz],
  };

  for (const side of SIDES) {
    const alongX = side === "north" || side === "south";
    const [px, pz] = centers[side];
    const coreId = `${idPrefix}-${side}`;
    out.push(
      box(coreId, "wall", `${labelPrefix} Core (${cap(side)})`, [px, baseY + height / 2, pz], alongX ? [footprint.width - 2 * e, height, T * 0.5] : [T * 0.5, height, footprint.depth - 2 * e], chinking)
    );
    for (let c = 0; c < courses; c++) {
      const longSide = (c % 2 === 0) === alongX;
      const length = alongX ? footprint.width : footprint.depth;
      const runLength = longSide ? length + 2 * e : length - 2 * T;
      const y = baseY + courseH * c + courseH / 2;
      out.push(
        box(
          `${coreId}-log-${c}`,
          "wall",
          `${labelPrefix} Log ${c + 1} (${cap(side)})`,
          [px, y, pz],
          alongX ? [runLength, logH, T] : [T, logH, runLength],
          log
        )
      );
    }
  }
  return out;
}

/** Plain rectangular wall ring — the generic construction. */
export function buildSolidWalls(run: WallRun): HousePrimitive[] {
  return buildWallRingPrimitives(run.footprint, run.baseY, run.height, run.idPrefix, run.labelPrefix, run.material.color, [], run.material);
}

export function buildWalls(construction: WallConstruction, run: WallRun): HousePrimitive[] {
  return construction === "log" ? buildLogWalls(run) : buildSolidWalls(run);
}

// ── Foundations ─────────────────────────────────────────────────────────────────────────────────

export interface FoundationInput {
  footprint: RoomFootprint;
  material: ResolvedMaterial;
  doors: readonly DoorSpan[];
  idPrefix?: string;
}

/**
 * Irregular fieldstone plinth: a course of stone blocks of varied size and height running round the base, each
 * standing a little proud of the wall. Blocks are skipped in front of doors. All positions are deterministic.
 */
export function buildFieldstoneFoundation({ footprint, doors, idPrefix = "foundation" }: FoundationInput): HousePrimitive[] {
  const [cx, cz] = footprint.center;
  const halfW = footprint.width / 2;
  const halfD = footprint.depth / 2;
  const base = "#8a8478";
  const out: HousePrimitive[] = [];

  SIDES.forEach((side, sideIndex) => {
    const alongX = side === "north" || side === "south";
    const length = alongX ? footprint.width : footprint.depth;
    let u = alongX ? -0.16 : 0.1;
    const end = alongX ? length + 0.16 : length - 0.1;
    let i = 0;
    while (u < end - 0.3) {
      const seed = sideIndex * 100 + i;
      const w = Math.min(end - u, 0.75 + hash01(seed) * 0.55);
      const h = 0.42 + hash01(seed + 0.5) * 0.24;
      const proud = 0.1 + hash01(seed + 0.9) * 0.08;
      const mid = u + w / 2;
      i += 1;
      const blocked = overlapsDoor(doors, side, u, u + w, 0.3);
      u += w + 0.02;
      if (blocked) continue;
      const outward = proud / 2;
      const px = side === "east" ? cx + halfW + outward : side === "west" ? cx - halfW - outward : cx - halfW + mid;
      const pz = side === "north" ? cz - halfD - outward : side === "south" ? cz + halfD + outward : cz - halfD + mid;
      out.push(
        box(
          `${idPrefix}-${side}-${i - 1}`,
          "wall",
          `Fieldstone (${cap(side)})`,
          [px, h / 2, pz],
          alongX ? [w, h, proud + 0.2] : [proud + 0.2, h, w],
          { color: shade(base, 0.82 + hash01(seed + 0.3) * 0.36), roughness: 0.92, metalness: 0.02 }
        )
      );
    }
  });
  return out;
}

/**
 * A raised masonry plinth band with ventilation grilles — the base a Caribbean house stands on. It leaves each
 * door clear and steps 0.1 m proud of the wall.
 */
export function buildRaisedPlinth({ footprint, material, doors, idPrefix = "plinth" }: FoundationInput): HousePrimitive[] {
  const [cx, cz] = footprint.center;
  const halfW = footprint.width / 2;
  const halfD = footprint.depth / 2;
  const H = 0.7;
  const proud = 0.1;
  const band: Paint = paintOf(material, shade(material.color, 0.93));
  const vent: Paint = { color: shade(material.color, 0.3), roughness: 0.9, metalness: 0 };
  const out: HousePrimitive[] = [];

  SIDES.forEach((side) => {
    const alongX = side === "north" || side === "south";
    const length = alongX ? footprint.width : footprint.depth;
    // Split the side into runs between doors.
    const cuts = doors.filter((d) => d.wall === side).sort((a, b) => a.from - b.from);
    const runs: [number, number][] = [];
    let cursor = 0;
    for (const d of cuts) {
      if (d.from - 0.15 > cursor) runs.push([cursor, d.from - 0.15]);
      cursor = Math.max(cursor, d.to + 0.15);
    }
    if (cursor < length) runs.push([cursor, length]);

    runs.forEach(([from, to], r) => {
      const len = to - from;
      if (len < 0.3) return;
      const mid = (from + to) / 2;
      const outward = proud / 2;
      const px = side === "east" ? cx + halfW + outward : side === "west" ? cx - halfW - outward : cx - halfW + mid;
      const pz = side === "north" ? cz - halfD - outward : side === "south" ? cz + halfD + outward : cz - halfD + mid;
      out.push(
        box(`${idPrefix}-${side}-${r}`, "wall", `Plinth (${cap(side)})`, [px, H / 2, pz], alongX ? [len, H, proud + 0.2] : [proud + 0.2, H, len], band)
      );
      // Grilles every ~2.4 m, centred in the run.
      const grilles = Math.floor(len / 2.4);
      for (let g = 0; g < grilles; g++) {
        const gu = from + (len * (g + 0.5)) / grilles;
        const gx = side === "east" ? cx + halfW + proud + 0.015 : side === "west" ? cx - halfW - proud - 0.015 : cx - halfW + gu;
        const gz = side === "north" ? cz - halfD - proud - 0.015 : side === "south" ? cz + halfD + proud + 0.015 : cz - halfD + gu;
        out.push(box(`${idPrefix}-${side}-${r}-vent-${g}`, "wall", `Plinth Vent (${cap(side)})`, [gx, H * 0.5, gz], alongX ? [0.7, 0.32, 0.03] : [0.03, 0.32, 0.7], vent));
      }
    });
  });
  return out;
}

export function buildFoundation(kind: FoundationKind, input: FoundationInput): HousePrimitive[] {
  if (kind === "fieldstone") return buildFieldstoneFoundation(input);
  if (kind === "raised-plinth") return buildRaisedPlinth(input);
  return [];
}
