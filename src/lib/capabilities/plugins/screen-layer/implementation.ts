import type { HousePrimitive } from "@/lib/house/types";
import type { CapabilityImplementation } from "../../types";
import { facadeFrame, isMassTarget, localFacadeFacing, massHeight, toWorld, type LocalFacade } from "../massFrame";

const SIDES = new Set(["north", "south", "east", "west"]);
const MAX_BATTENS = 90;
const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

/**
 * Geometry only. Unlike Brise Soleil's few deep fins, a screen layer is a fine, continuous veil: many slender
 * battens framed by head and foot rails, standing a little proud of the facade. Built in the mass's local frame
 * and turned with it, so it stays on its facade for any mass rotation.
 */
export const implementation: CapabilityImplementation = {
  apply({ target }, parameters) {
    if (!isMassTarget(target) || target.id !== parameters.massId) throw new Error("Screen Layer requires its target mass.");
    const side = typeof parameters.facade === "string" && SIDES.has(parameters.facade) ? (parameters.facade as LocalFacade) : undefined;
    if (!side) throw new Error("Screen Layer requires a valid facade.");
    const facade = localFacadeFacing(target, side);
    const frame = facadeFrame(target, facade);
    const start = Math.max(0, Math.min(1, num(parameters.start, 0.04)));
    const end = Math.max(0, Math.min(1, num(parameters.end, 0.96)));
    if (end - start < 0.02) throw new Error("Screen Layer span is empty.");
    const depth = Math.max(0.15, num(parameters.depth, 0.55));
    const sill = Math.max(0, num(parameters.sill, 0));
    const height = Math.max(0.5, Math.min(num(parameters.height, massHeight(target) - 0.25), massHeight(target) - sill));
    const battenWidth = Math.max(0.02, num(parameters.battenWidth, 0.05));
    const spanLength = (end - start) * frame.length;
    const count = Math.min(MAX_BATTENS, Math.max(3, Math.round(spanLength / Math.max(0.08, num(parameters.spacing, 0.22))) + 1));
    const yaw = target.rotation;
    const alongX = frame.tangent[0] !== 0;
    const size = (along: number, h: number, across: number): [number, number, number] => (alongX ? [along, h, across] : [across, h, along]);
    const paint = { color: "#6b5b45", roughness: 0.8, metalness: 0.02 };
    const place = (u: number, y: number): [number, number, number] => { const [lx, lz] = frame.at(u, depth); const [x, z] = toWorld(target, lx, lz); return [x, y, z]; };
    const base = target.elevation + sill;
    const id = `capability-screen-layer-${target.id}-${side}`;
    const primitives: HousePrimitive[] = [];
    for (let i = 0; i < count; i++) {
      const u = start + ((end - start) * i) / (count - 1);
      primitives.push({ kind: "box", id: `${id}-batten-${i}`, category: "wall", label: "Screen Layer · Batten", position: place(u, base + height / 2), rotation: [0, yaw, 0], size: size(battenWidth, height, 0.04), ...paint });
    }
    for (const [name, y] of [["foot", base + 0.04], ["head", base + height - 0.04]] as const) {
      primitives.push({ kind: "box", id: `${id}-${name}-rail`, category: "wall", label: "Screen Layer · Rail", position: place((start + end) / 2, y), rotation: [0, yaw, 0], size: size(spanLength, 0.08, 0.08), ...paint });
    }
    return { primitives, note: `Added a ${count}-batten screen over ${target.id}'s ${side} facade (local ${facade}).` };
  },
};
