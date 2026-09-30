import { resolveMasses } from "./compiler";
import type { ArchitecturalDesignDocument, MassVolume } from "./document";
import { v2SiteFrameForDocument } from "./siteFrame";
import type { SitePlanContext } from "./sitePlanContract";

/** V2 opening coordinates projected into the renderer's world frame (x=east, z=south), on the masses as resolved and rendered. */
function v2EntrancePoints(masses: readonly MassVolume[]): { x: number; z: number }[] {
  const points: { x: number; z: number }[] = [];
  for (const mass of masses) for (const opening of mass.openings ?? []) {
    if (opening.type !== "door" || (opening.floors && opening.floors !== "ground" && opening.floors !== "all")) continue;
    const u = (opening.start + opening.end) / 2;
    let x = 0, z = 0;
    if (opening.facade === "north") { x = (u - .5) * mass.width; z = -mass.depth / 2; }
    if (opening.facade === "south") { x = (u - .5) * mass.width; z = mass.depth / 2; }
    if (opening.facade === "east") { x = mass.width / 2; z = (u - .5) * mass.depth; }
    if (opening.facade === "west") { x = -mass.width / 2; z = (u - .5) * mass.depth; }
    const c = Math.cos(mass.rotation), s = Math.sin(mass.rotation);
    points.push({ x: mass.position.x + x * c + z * s, z: mass.position.z - x * s + z * c });
  }
  return points;
}

/**
 * The Site Plan's frame is the rendered building: the dominant mass where it actually stands (the renderer anchors
 * wall/offset features to the same centre — see HouseConfig.center), every mass's footprint, and the real doors.
 */
export function sitePlanContextForDocument(brief: string, document: ArchitecturalDesignDocument): SitePlanContext | undefined {
  const frame = v2SiteFrameForDocument(document);
  if (!frame) return undefined;
  const { anchor } = frame;
  return {
    brief, house: { width: anchor.width, depth: anchor.depth, floors: anchor.floors, center: frame.center },
    viewDirection: document.siteStrategy.viewDirection, arrivalDirection: document.siteStrategy.arrivalDirection,
    entrancePoints: v2EntrancePoints(resolveMasses(document)), masses: frame.masses,
  };
}
