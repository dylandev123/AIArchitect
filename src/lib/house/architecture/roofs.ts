import type { HousePrimitive } from "../types";
import type { ResolvedMaterial } from "../materials";
import { buildGableRoof } from "../roof/gableRoof";
import { buildHipRoof } from "../roof/hipRoof";
import { box, paintOf, planeLength, shade, tiltInPlane, type Paint } from "./parts";
import type { RoofShape } from "./profiles";

export interface StyledRoofInput {
  width: number;
  depth: number;
  baseY: number;
  idPrefix: string;
  roof: ResolvedMaterial;
  exterior: ResolvedMaterial;
  trim: ResolvedMaterial;
  glass: ResolvedMaterial;
  shape: RoofShape;
  /** Unit vector from the house toward its entrance side (x east, z south). */
  approach: [number, number];
}

// ── Cabin: steep gable with exposed timber ─────────────────────────────────────────────────────

/**
 * Deep-pitched gable roof with the timber that makes it read as a cabin: a ridge beam, outrigger rafter tails
 * along both eaves, and an exposed truss (tie beam, king post and struts) plus barge boards on each gable end.
 */
export function buildCabinRoof(i: StyledRoofInput): HousePrimitive[] {
  const { width, depth, baseY, idPrefix, shape } = i;
  const out = buildGableRoof(width, depth, baseY, idPrefix, i.roof, i.exterior, shape);
  const timber: Paint = paintOf(i.trim);
  const ridgeAlongX = width >= depth;
  const long = ridgeAlongX ? width : depth;
  const span = ridgeAlongX ? depth : width;
  const rise = Math.max(0.6, span * shape.pitch);
  const ridgeY = baseY + rise;
  const halfRidge = long / 2 + shape.rakeOverhang;
  const halfSpan = span / 2 + shape.overhang;
  // Ridge along X → gable planes are perpendicular to X and trusses lie in the YZ plane.
  const plane = ridgeAlongX ? "yz" : "xy";
  const at = (along: number, y: number, across: number): [number, number, number] => (ridgeAlongX ? [along, y, across] : [across, y, along]);
  const boxAlong = (a: number, h: number, c: number): [number, number, number] => (ridgeAlongX ? [a, h, c] : [c, h, a]);

  out.push(box(`${idPrefix}-ridge-beam`, "roof", "Ridge Beam", at(0, ridgeY + 0.04, 0), boxAlong(halfRidge * 2 + 0.3, 0.24, 0.24), timber));

  // Rafter tails: short outriggers under both eaves.
  const tails = Math.max(2, Math.floor(long / 0.9));
  for (let t = 0; t < tails; t++) {
    const along = -long / 2 + (long * (t + 0.5)) / tails;
    for (const sign of [-1, 1]) {
      const reach = shape.overhang + 0.05;
      out.push(
        box(
          `${idPrefix}-tail-${sign < 0 ? "a" : "b"}-${t}`,
          "roof",
          "Rafter Tail",
          at(along, baseY - 0.11, sign * (span / 2 + reach / 2 - 0.05)),
          boxAlong(0.13, 0.16, reach),
          timber
        )
      );
    }
  }

  // Gable-end trusses and barge boards. Each lies in the vertical plane of its gable, just outside the gable
  // triangle; sizes are (thickness across the plane, height, extent within the plane) and are flipped when the
  // ridge runs along Z.
  const tieY = baseY + rise * 0.28;
  const tieHalf = halfSpan * 0.72 * 0.98;
  for (const [end, sign] of [["a", -1], ["b", 1]] as const) {
    const planeAt = sign * (halfRidge + 0.06);
    const member = (name: string, label: string, y: number, across: number, size: [number, number, number], rotation: [number, number, number] = [0, 0, 0]) =>
      out.push(box(`${idPrefix}-truss-${end}-${name}`, "roof", label, at(planeAt, y, across), ridgeAlongX ? size : [size[2], size[1], size[0]], timber, rotation));

    member("tie", "Truss Tie Beam", tieY, 0, [0.18, 0.2, tieHalf * 2]);
    member("king", "Truss King Post", (tieY + ridgeY) / 2, 0, [0.18, ridgeY - tieY, 0.2]);
    for (const s of [-1, 1]) {
      // Strut from the foot of the king post up to the rafter, halfway to the eave.
      const dz = s * halfSpan * 0.5;
      const y1 = ridgeY - rise * 0.5;
      const dy = y1 - (tieY + 0.1);
      member(`strut-${s < 0 ? "a" : "b"}`, "Truss Strut", tieY + 0.1 + dy / 2, dz / 2, [0.16, planeLength(dz, dy), 0.16], tiltInPlane(plane, dz, dy));
    }

    // Barge boards run up both rake edges of the gable triangle, eave to apex.
    for (const s of [-1, 1]) {
      const toApex = -s * halfSpan;
      out.push(
        box(
          `${idPrefix}-barge-${end}-${s < 0 ? "a" : "b"}`,
          "roof",
          "Barge Board",
          at(sign * (halfRidge + 0.03), baseY + rise / 2, (s * halfSpan) / 2),
          ridgeAlongX ? [0.1, planeLength(toApex, rise), 0.26] : [0.26, planeLength(toApex, rise), 0.1],
          timber,
          tiltInPlane(plane, toApex, rise)
        )
      );
    }
  }
  return out;
}

// ── Modern luxury: floating plate ──────────────────────────────────────────────────────────────

/**
 * A thin, deeply cantilevered flat roof plate with a slim steel edge and dark soffit, carrying a stepped rooftop
 * pavilion (a glazed box under its own plate) set back from the entrance side.
 */
export function buildFloatingRoof(i: StyledRoofInput & { pavilion?: boolean }): HousePrimitive[] {
  const { width, depth, baseY, idPrefix, shape } = i;
  const plateW = width + shape.overhang * 2;
  const plateD = depth + shape.overhang * 2;
  const T = 0.3;
  const edge = paintOf(i.trim);
  const out: HousePrimitive[] = [
    box(`${idPrefix}-slab`, "roof", "Roof Plate", [0, baseY + T / 2, 0], [plateW, T, plateD], paintOf(i.roof)),
    box(`${idPrefix}-soffit`, "roof", "Roof Soffit", [0, baseY - 0.02, 0], [plateW - 0.12, 0.06, plateD - 0.12], edge),
    box(`${idPrefix}-edge-n`, "roof", "Roof Edge (North)", [0, baseY + T / 2, -plateD / 2 + 0.03], [plateW, T + 0.06, 0.06], edge),
    box(`${idPrefix}-edge-s`, "roof", "Roof Edge (South)", [0, baseY + T / 2, plateD / 2 - 0.03], [plateW, T + 0.06, 0.06], edge),
    box(`${idPrefix}-edge-e`, "roof", "Roof Edge (East)", [plateW / 2 - 0.03, baseY + T / 2, 0], [0.06, T + 0.06, plateD], edge),
    box(`${idPrefix}-edge-w`, "roof", "Roof Edge (West)", [-plateW / 2 + 0.03, baseY + T / 2, 0], [0.06, T + 0.06, plateD], edge),
  ];

  if (i.pavilion !== false) {
    const pw = width * 0.44;
    const pd = depth * 0.5;
    const ph = 2.7;
    const [ax, az] = i.approach;
    const back = Math.min(width, depth) * 0.12;
    const px = -ax * back;
    const pz = -az * back;
    const y0 = baseY + T;
    out.push(
      box(`${idPrefix}-pavilion`, "roof", "Rooftop Pavilion", [px, y0 + ph / 2, pz], [pw, ph, pd], paintOf(i.exterior)),
      box(`${idPrefix}-pavilion-plate`, "roof", "Pavilion Roof Plate", [px, y0 + ph + 0.11, pz], [pw + 1.0, 0.22, pd + 1.0], paintOf(i.roof, shade(i.roof.color, 0.9)))
    );
    // Glazing on the entrance-facing side of the pavilion.
    const facesZ = Math.abs(az) > 0.5;
    const half = (facesZ ? pd : pw) / 2 + 0.02;
    out.push(
      box(
        `${idPrefix}-pavilion-glass`,
        "roof",
        "Pavilion Glazing",
        [px + ax * half, y0 + ph / 2, pz + az * half],
        facesZ ? [pw * 0.8, ph * 0.72, 0.05] : [0.05, ph * 0.72, pd * 0.8],
        paintOf(i.glass)
      )
    );
  }
  return out;
}

// ── Caribbean: deep-eaved hip with cupola ──────────────────────────────────────────────────────

/** Steep hip roof with very deep eaves, a ridge cap and a louvered cupola crowning the ridge. */
export function buildVerandaHipRoof(i: StyledRoofInput): HousePrimitive[] {
  const { width, depth, baseY, idPrefix, shape } = i;
  const out = buildHipRoof(width, depth, baseY, idPrefix, i.roof, i.exterior, shape);
  const longer = Math.max(width, depth);
  const shorter = Math.min(width, depth);
  const ridgeY = baseY + Math.max(0.6, shorter * shape.pitch);
  const ridgeLen = longer - shorter;
  const trim = paintOf(i.trim);

  if (ridgeLen > 0.4) {
    const alongX = width >= depth;
    out.push(box(`${idPrefix}-ridge-cap`, "roof", "Ridge Cap", [0, ridgeY + 0.05, 0], alongX ? [ridgeLen + 0.3, 0.14, 0.3] : [0.3, 0.14, ridgeLen + 0.3], paintOf(i.roof, shade(i.roof.color, 0.8))));
  }

  // Cupola: a small stucco lantern with louvres on each face under its own hip roof.
  const C = Math.min(1.5, shorter * 0.16);
  const CH = 1.0;
  const cy = ridgeY - 0.15;
  out.push(box(`${idPrefix}-cupola`, "roof", "Cupola", [0, cy + CH / 2, 0], [C, CH, C], paintOf(i.exterior)));
  const louver = paintOf(i.trim);
  for (const [side, dx, dz] of [["n", 0, -1], ["s", 0, 1], ["e", 1, 0], ["w", -1, 0]] as const) {
    out.push(
      box(`${idPrefix}-cupola-louver-${side}`, "roof", "Cupola Louvre", [dx * (C / 2 + 0.015), cy + CH / 2, dz * (C / 2 + 0.015)], dx === 0 ? [C * 0.6, CH * 0.6, 0.03] : [0.03, CH * 0.6, C * 0.6], louver)
    );
  }
  out.push(...buildHipRoof(C + 0.5, C + 0.5, cy + CH, `${idPrefix}-cupola-roof`, i.roof, i.exterior, { pitch: 0.7, overhang: 0.05 }));
  out.push(box(`${idPrefix}-finial`, "roof", "Finial", [0, cy + CH + (C + 0.5) * 0.7 + 0.2, 0], [0.06, 0.4, 0.06], trim));
  return out;
}
