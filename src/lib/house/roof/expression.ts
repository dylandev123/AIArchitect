import type { HousePrimitive } from "../types";
import type { ResolvedMaterial } from "../materials";
import { materialProps } from "../materials";

/** Reusable vocabulary for roof-to-wall assemblies. Values are metres. */
export type RoofExpressionParameters = {
  overhang?: number; verticalGap?: number; horizontalOffset?: { x?: number; z?: number };
  thickness?: number; fasciaDepth?: number; soffitMaterial?: "roof" | "exterior" | "dark";
  supportStyle?: "reveal" | "clerestory" | "band"; clerestoryHeight?: number;
  secondary?: { width?: number; depth?: number; elevation?: number; offsetX?: number; offsetZ?: number };
};

export type RoofExpressionInput = {
  id: string; width: number; depth: number; wallPlateY: number;
  roofMaterial: ResolvedMaterial; exteriorMaterial: ResolvedMaterial; parameters?: RoofExpressionParameters;
};

const number = (value: unknown, fallback: number, min = 0) => typeof value === "number" && Number.isFinite(value) ? Math.max(min, value) : fallback;

/**
 * A deterministic, flat roof assembly. The plane, fascia, soffit, wall plate/reveal,
 * support closure, optional clerestory, and secondary plane deliberately share one datum.
 */
export function buildRoofExpression(input: RoofExpressionInput): HousePrimitive[] {
  const p = input.parameters ?? {};
  const overhang = number(p.overhang, .6); const gap = number(p.verticalGap, 0);
  const thickness = number(p.thickness, .25, .08); const fascia = Math.min(number(p.fasciaDepth, thickness, .04), thickness);
  const offsetX = number(p.horizontalOffset?.x, 0, -100); const offsetZ = number(p.horizontalOffset?.z, 0, -100);
  const roofW = input.width + overhang * 2; const roofD = input.depth + overhang * 2;
  const planeBottom = input.wallPlateY + gap; const planeY = planeBottom + thickness / 2;
  const roofProps = materialProps(input.roofMaterial); const exteriorProps = materialProps(input.exteriorMaterial);
  const dark = { color: "#111619", roughness: .88, metalness: 0 };
  const prefix = input.id;
  const roofs: HousePrimitive[] = [
    { kind: "box", id: `${prefix}-plane`, category: "roof", label: "Roof Plane · expression", position: [offsetX, planeY, offsetZ], rotation: [0, 0, 0], size: [roofW, thickness, roofD], color: input.roofMaterial.color, ...roofProps },
    { kind: "box", id: `${prefix}-soffit`, category: "roof", label: "Roof Soffit", position: [offsetX, planeBottom + .018, offsetZ], rotation: [0, 0, 0], size: [roofW - .04, .036, roofD - .04], color: p.soffitMaterial === "exterior" ? input.exteriorMaterial.color : p.soffitMaterial === "dark" ? dark.color : input.roofMaterial.color, ...(p.soffitMaterial === "exterior" ? exteriorProps : p.soffitMaterial === "dark" ? dark : roofProps) },
  ];
  const fasciae: Array<[string, [number, number, number], [number, number, number]]> = [
    ["north", [offsetX, planeBottom + fascia / 2, offsetZ - roofD / 2 + .02], [roofW, fascia, .04]],
    ["south", [offsetX, planeBottom + fascia / 2, offsetZ + roofD / 2 - .02], [roofW, fascia, .04]],
    ["east", [offsetX + roofW / 2 - .02, planeBottom + fascia / 2, offsetZ], [.04, fascia, roofD]],
    ["west", [offsetX - roofW / 2 + .02, planeBottom + fascia / 2, offsetZ], [.04, fascia, roofD]],
  ];
  for (const [edge, position, size] of fasciae) roofs.push({ kind: "box", id: `${prefix}-fascia-${edge}`, category: "roof", label: `Roof Fascia · ${edge}`, position, rotation: [0, 0, 0], size, color: input.roofMaterial.color, ...roofProps });
  if (gap > .015) {
    const closureH = Math.min(gap, number(p.clerestoryHeight, gap, .08));
    const closureY = input.wallPlateY + closureH / 2;
    if (p.supportStyle === "clerestory") roofs.push({ kind: "box", id: `${prefix}-clerestory-band`, category: "roof", label: "Clerestory Band", position: [offsetX, closureY, offsetZ], rotation: [0, 0, 0], size: [Math.max(.2, input.width - .18), closureH, Math.max(.2, input.depth - .18)], color: "#9dd9e8", roughness: .04, metalness: .12, transparent: true, opacity: .4 });
    else roofs.push({ kind: "box", id: `${prefix}-${p.supportStyle === "band" ? "support-band" : "shadow-gap"}`, category: "roof", label: p.supportStyle === "band" ? "Recessed Roof Support Band" : "Roof Shadow Reveal", position: [offsetX, closureY, offsetZ], rotation: [0, 0, 0], size: [input.width, closureH, input.depth], ...dark });
  }
  if (p.secondary) {
    const s = p.secondary; const sw = number(s.width, input.width * .45, .2); const sd = number(s.depth, input.depth, .2); const sy = planeBottom + number(s.elevation, -.45, -20);
    roofs.push({ kind: "box", id: `${prefix}-secondary-plane`, category: "roof", label: "Secondary Roof Plane", position: [offsetX + number(s.offsetX, 0, -100), sy + thickness / 2, offsetZ + number(s.offsetZ, 0, -100)], rotation: [0, 0, 0], size: [sw, thickness, sd], color: input.roofMaterial.color, ...roofProps });
  }
  return roofs;
}
