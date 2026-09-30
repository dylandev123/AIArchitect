import type { HousePrimitive } from "@/lib/house/types";
import type { CapabilityImplementation } from "../../types";
import { isMassTarget, toWorld } from "../massFrame";

const CORNERS = new Set(["ne", "nw", "se", "sw"]);

/**
 * Geometry only. Validation, fallbacks, telemetry and priority are owned by the generic engine. `corner` is
 * LOCAL to the mass (the stage that requests it resolves which corner faces the view — see
 * `parameterizeCapabilityIntent`); both panes and the mullion are built in the mass's own frame and turned with
 * it, so the glass stays on that corner for any rotation. Omitted, it defaults to the south-east corner.
 */
export const implementation: CapabilityImplementation = {
  apply({ target }, parameters) {
    if (!isMassTarget(target) || target.id !== parameters.massId) throw new Error("Corner glazing requires its target mass.");
    const corner = typeof parameters.corner === "string" && CORNERS.has(parameters.corner) ? parameters.corner : "se";
    const width = typeof parameters.width === "number" ? parameters.width : Math.min(target.width, target.depth) * .42;
    const height = typeof parameters.height === "number" ? parameters.height : 2.5;
    const sill = typeof parameters.sill === "number" ? parameters.sill : .55;
    const y = target.elevation + sill + height / 2;
    const sx = corner[1] === "e" ? 1 : -1, sz = corner[0] === "s" ? 1 : -1;
    const ew = sx > 0 ? "east" : "west", ns = sz > 0 ? "south" : "north";
    // Local corner, nudged just outside both faces.
    const cx = sx * (target.width / 2 + .018), cz = sz * (target.depth / 2 + .018);
    const at = (lx: number, lz: number): [number, number, number] => { const [x, z] = toWorld(target, lx, lz); return [x, y, z]; };
    const glass = { color: "#9dd9e8", roughness: .04, metalness: .12, transparent: true, opacity: .42 };
    const frame = { color: "#20272a", roughness: .36, metalness: .72 };
    const rotation: [number, number, number] = [0, target.rotation, 0];
    const id = `capability-corner-glazing-${target.id}`;
    const primitives: HousePrimitive[] = [
      { kind: "box", id: `${id}-${ew}-glass`, category: "window", label: `Corner Glazing · ${ew[0].toUpperCase()}${ew.slice(1)}`, position: at(cx, cz - sz * width / 2), rotation, size: [.035, height, width], ...glass },
      { kind: "box", id: `${id}-${ns}-glass`, category: "window", label: `Corner Glazing · ${ns[0].toUpperCase()}${ns.slice(1)}`, position: at(cx - sx * width / 2, cz), rotation, size: [width, height, .035], ...glass },
      { kind: "box", id: `${id}-mullion`, category: "window", label: "Corner Glazing · Mullion", position: at(cx, cz), rotation, size: [.07, height + .12, .07], ...frame },
    ];
    return { primitives, note: `Applied continuous ${ns}/${ew} corner glazing (local ${corner}).` };
  },
};
