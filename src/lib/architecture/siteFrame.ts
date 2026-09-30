import { pickDominantMass, resolveMasses } from "./compiler";
import { isArchitecturalDesignDocument, validateArchitecturalDesignDocument, type ArchitecturalDesignDocument, type MassVolume } from "./document";
import type { MassFootprint } from "./massFootprint";
export * from "./massFootprint";

/**
 * Where a V2 project's site is anchored. `center` is the resolved world centre of the dominant mass — the volume the
 * Site Plan's wall/offset features (entrance, driveway, terrace, pool) are authored against — and `masses` is the
 * complete footprint every site placement and collision check must respect.
 */
export interface V2SiteFrame { center: { x: number; z: number }; anchor: MassVolume; masses: MassFootprint[] }

/** A cantilever overhangs the ground on one side; scenery and paths must keep clear of it all the same. */
function footprintOf(mass: MassVolume): MassFootprint {
  let width = mass.width, depth = mass.depth, lx = 0, lz = 0;
  const c = mass.cantilever;
  if (c && c.distance > 0) {
    if (c.direction === "east" || c.direction === "west") { width += c.distance; lx = (c.direction === "east" ? 1 : -1) * c.distance / 2; }
    else { depth += c.distance; lz = (c.direction === "south" ? 1 : -1) * c.distance / 2; }
  }
  const cos = Math.cos(mass.rotation), sin = Math.sin(mass.rotation);
  return { id: mass.id, cx: mass.position.x + lx * cos + lz * sin, cz: mass.position.z - lx * sin + lz * cos, width, depth, rotation: mass.rotation };
}

export function v2SiteFrameForDocument(document: ArchitecturalDesignDocument): V2SiteFrame | undefined {
  if (validateArchitecturalDesignDocument(document).length) return undefined;
  const masses = resolveMasses(document);
  const anchor = pickDominantMass(masses);
  if (!anchor) return undefined;
  return { center: { x: anchor.position.x, z: anchor.position.z }, anchor, masses: masses.map(footprintOf) };
}

/** The frame of a project JSON root's V2 document, when it carries a valid one. */
export function v2SiteFrame(root: unknown): V2SiteFrame | undefined {
  if (typeof root !== "object" || root === null) return undefined;
  const r = root as Record<string, unknown>;
  const document = r.architecturalDesignDocument ?? r.architectureDocument;
  return isArchitecturalDesignDocument(document) ? v2SiteFrameForDocument(document) : undefined;
}
