import type { V3Scene, V3SceneObject } from "./scene";
import { getObjectBaseY, getObjectTopY, scaledDimensionsOf } from "./elevation";

/** Vertical gap within which an object counts as resting on its host's top (authored datums are rounded). */
const STACK_TOLERANCE = .35;
/** Only a nearly complete roof deck replaces the whole implicit roof; partial decks are clipped locally. */
const ROOF_TERRACE_COVERAGE = .85;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const hostIdOf = (o: V3SceneObject) => o.support?.hostId ?? o.support?.objectId ?? o.hostId;

/** Local storey count of a building mass; the single source for the compiler and storey targeting. */
export function v3MassLevelCount(o: V3SceneObject): number {
  const h = scaledDimensionsOf(o)[1];
  return clamp(Math.round(o.levels ?? Math.max(1, Math.round(h / 3.4))), 1, Math.max(1, Math.min(20, Math.floor(h / 2.2))));
}

/** The building mass `o` is explicitly stacked on: authored host relationship plus base at the host's top. */
function stackedHost(o: V3SceneObject, scene: V3Scene): V3SceneObject | undefined {
  const id = hostIdOf(o);
  const host = id ? scene.objects.find((candidate) => candidate.id === id && candidate.type === "building-mass") : undefined;
  return host && Math.abs(getObjectBaseY(o) - getObjectTopY(host)) <= STACK_TOLERANCE ? host : undefined;
}

/**
 * Building storey index of a mass's lowest local storey: 0 for a ground mass, the host's storeys (recursively) for
 * a mass explicitly stacked on another mass. Proximity alone never stacks; an explicit host relationship is required.
 */
export function v3StoreyBase(o: V3SceneObject, scene: V3Scene, seen: ReadonlySet<string> = new Set()): number {
  const host = stackedHost(o, scene);
  if (!host || seen.has(host.id)) return 0;
  return v3StoreyBase(host, scene, new Set([...seen, o.id])) + v3MassLevelCount(host);
}

export interface V3StoreyDiagnostic { code: "OPENING_FLOOR_UNRESOLVED" | "OPENING_FLOOR_AMBIGUOUS"; targetId: string; openingId: string; message: string; }

/**
 * Authored opening floor targets that cannot be resolved unambiguously. Rendering is unchanged by this report: it
 * exists so a target is never dropped silently.
 */
export function v3StoreyTargetingDiagnostics(scene: V3Scene): V3StoreyDiagnostic[] {
  const out: V3StoreyDiagnostic[] = [];
  for (const o of scene.objects) {
    if (o.type !== "building-mass" || !o.composition?.openings?.length) continue;
    const base = v3StoreyBase(o, scene), levels = v3MassLevelCount(o), openings = o.composition.openings;
    for (const op of openings) {
      if (op.floors === "upper" && base === 0 && levels === 1) {
        const elevated = getObjectBaseY(o) - (scene.site.baseElevation ?? 0) > 2.2;
        out.push(elevated
          ? { code: "OPENING_FLOOR_AMBIGUOUS", targetId: o.id, openingId: op.id, message: `${o.id} opening ${op.id} targets upper floors, but this elevated mass has no explicit building host; it is not rendered. Host the mass on the building below or use floors:"all".` }
          : { code: "OPENING_FLOOR_UNRESOLVED", targetId: o.id, openingId: op.id, message: `${o.id} opening ${op.id} targets upper floors, but the mass has a single ground storey; it is not rendered.` });
      }
      if (op.floors === "ground" && base > 0) {
        const superseded = openings.some((other) => other.facade === op.facade && other.floors !== "ground");
        out.push({ code: "OPENING_FLOOR_AMBIGUOUS", targetId: o.id, openingId: op.id, message: superseded
          ? `${o.id} is stacked at storey ${base} and has no ground storey; opening ${op.id} (floors:"ground") is not rendered because upper openings already define the ${op.facade} facade.`
          : `${o.id} is stacked at storey ${base} and has no ground storey; opening ${op.id} (floors:"ground") is applied to the mass's lowest storey.` });
      }
    }
  }
  return out;
}

/** Footprint rectangle in the host's local frame (rotation about Y). */
function localRect(o: V3SceneObject, frame: V3SceneObject) {
  const [w, , d] = scaledDimensionsOf(o), a = frame.transform.rotation[1], c = Math.cos(a), s = Math.sin(a);
  const dx = o.transform.position[0] - frame.transform.position[0], dz = o.transform.position[2] - frame.transform.position[2];
  const cx = dx * c - dz * s, cz = dx * s + dz * c;
  // A rotated child is bounded by its own axis-aligned extent in the host frame (conservative: overstates coverage only for skewed decks).
  const rel = o.transform.rotation[1] - a, ec = Math.abs(Math.cos(rel)), es = Math.abs(Math.sin(rel));
  const hw = (w * ec + d * es) / 2, hd = (w * es + d * ec) / 2;
  return { minX: cx - hw, maxX: cx + hw, minZ: cz - hd, maxZ: cz + hd };
}

/**
 * An authored walkable terrace that explicitly rests on `host` at its roof datum and covers most of the roof. When
 * present, the host's implicit roof plate would cut through the terrace, so the terrace is the roof surface.
 * Overlap alone never qualifies: the terrace must name the host as its support and sit on its top.
 */
export function v3RooftopTerrace(host: V3SceneObject, scene: V3Scene): V3SceneObject | undefined {
  if (host.type !== "building-mass" || host.composition?.footprint) return undefined;
  const [hw, , hd] = scaledDimensionsOf(host), top = getObjectTopY(host), roof = localRect(host, host);
  return scene.objects.find((o) => {
    if (o.type !== "terrace" || hostIdOf(o) !== host.id || (o.collision && o.collision !== "walkable")) return false;
    if (Math.abs(getObjectBaseY(o) - top) > STACK_TOLERANCE) return false;
    const r = localRect(o, host);
    const overlap = Math.max(0, Math.min(r.maxX, roof.maxX) - Math.max(r.minX, roof.minX)) * Math.max(0, Math.min(r.maxZ, roof.maxZ) - Math.max(r.minZ, roof.minZ));
    if (overlap < hw * hd * ROOF_TERRACE_COVERAGE) return false;
    // Test actual oriented deck containment, allowing the existing narrow roof-edge border.
    const [tw,,td]=scaledDimensionsOf(o),yaw=o.transform.rotation[1],c=Math.cos(yaw),s=Math.sin(yaw),hy=host.transform.rotation[1];
    return [-1,1].every(sx=>[-1,1].every(sz=>{
      const lx=sx*Math.max(0,hw/2-.5),lz=sz*Math.max(0,hd/2-.5);
      const dx=host.transform.position[0]+lx*Math.cos(hy)+lz*Math.sin(hy)-o.transform.position[0],dz=host.transform.position[2]-lx*Math.sin(hy)+lz*Math.cos(hy)-o.transform.position[2];
      return Math.abs(dx*c-dz*s)<=tw/2+1e-6 && Math.abs(dx*s+dz*c)<=td/2+1e-6;
    }));
  });
}
