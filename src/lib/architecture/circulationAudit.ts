import type { ArchitecturalAssemblyPart, ArchitecturalDesignDocument, AssemblyHost, DoorOpening, MassVolume } from "./document";

/**
 * Objective circulation/occupancy findings over the authoritative document. It reports what the representation can
 * prove (doors, declared mass connections, slab hosts, railings) and states plainly what it cannot (stairs, floor
 * openings, interior partitions). It never judges design quality and never proposes geometry.
 */
export interface CirculationIssue {
  /** Stable key so an edit can be judged by the issues it introduces, not by pre-existing ones. */
  key: string;
  kind: "mass-unreachable" | "elevated-slab-unsupported" | "elevated-slab-unprotected" | "elevated-slab-inaccessible";
  targetId: string;
  message: string;
}
export interface CirculationAudit {
  issues: CirculationIssue[];
  /** Conditions the current geometry model cannot validate; reported, never assumed to pass. */
  limitations: string[];
}

type Slab = Extract<ArchitecturalAssemblyPart, { type: "slab" }>;
/** Door connections between masses: these relationship kinds declare a passable joint. */
const CONNECTING = new Set(["connected-to", "bridge-between", "adjacent-to"]);
const ELEVATED_M = 1;

const doors = (mass: MassVolume) => (mass.openings ?? []).filter((opening): opening is DoorOpening => opening.type === "door");
const doorOnLevel = (door: DoorOpening, level: number) => !door.floors || door.floors === "all" || (door.floors === "ground" ? level === 0 : level > 0);

/** The storey a slab stands on, from its semantic host first and its legacy fields second; "roof" is above the top floor. */
function slabLevel(slab: Slab, slabs: ReadonlyMap<string, Slab>, mass: MassVolume, seen = new Set<string>()): number | "roof" {
  const host: AssemblyHost | undefined = slab.host;
  if (host?.kind === "roof") return "roof";
  if (host?.kind === "slab") {
    const parent = slabs.get(host.slabId);
    if (!parent || seen.has(host.slabId)) return 0;
    seen.add(host.slabId);
    return slabLevel(parent, slabs, mass, seen);
  }
  if (host && "level" in host && host.level !== undefined) return host.level;
  if (slab.level !== undefined) return slab.level;
  return (slab.elevation ?? 0) >= ELEVATED_M ? Math.max(1, Math.round((slab.elevation ?? 0) / 3)) : 0;
}

const spansOverlap = (a: { start: number; end: number }, b: { start: number; end: number }) => Math.min(a.end, b.end) > Math.max(a.start, b.start);

export function auditCirculation(document: ArchitecturalDesignDocument): CirculationAudit {
  const issues: CirculationIssue[] = [];
  const limitations: string[] = [];
  const masses = document.massing.masses;
  const byId = new Map(masses.map((mass) => [mass.id, mass]));

  // Reachability: a mass with a ground-level door is reachable from the site; declared connections propagate it.
  const links = new Map<string, Set<string>>(masses.map((mass) => [mass.id, new Set<string>()]));
  const link = (a: string, b: string) => { if (byId.has(a) && byId.has(b)) { links.get(a)!.add(b); links.get(b)!.add(a); } };
  for (const mass of masses) {
    if (mass.parentId) link(mass.id, mass.parentId);
    for (const relationship of mass.relationships ?? []) if (CONNECTING.has(relationship.kind)) link(mass.id, relationship.target);
  }
  const reached = new Set(masses.filter((mass) => doors(mass).some((door) => doorOnLevel(door, 0))).map((mass) => mass.id));
  const queue = [...reached];
  while (queue.length) for (const next of links.get(queue.shift()!) ?? []) if (!reached.has(next)) { reached.add(next); queue.push(next); }
  for (const mass of masses) if (!reached.has(mass.id)) {
    issues.push({ key: `mass-unreachable:${mass.id}`, kind: "mass-unreachable", targetId: `mass:${mass.id}`, message: `mass:${mass.id} has no ground-level door and no declared connection (parentId or connected-to/bridge-between/adjacent-to) to a reachable mass.` });
  }
  if (masses.some((mass) => links.get(mass.id)!.size)) limitations.push("Interior openings between connected masses are not represented; a declared connection is assumed passable.");
  const multiStorey = masses.filter((mass) => mass.floors > 1);
  if (multiStorey.length) limitations.push(`Stairs and floor openings are not represented, so circulation between floors cannot be verified for ${multiStorey.map((mass) => `mass:${mass.id}`).join(", ")}.`);
  limitations.push("Rooms and interior partitions are not represented; room-level reachability cannot be verified.");

  // Elevated exterior slabs: support, edge protection and access, as far as the assembly vocabulary can show them.
  let roofSlab = false;
  for (const mass of masses) for (const assembly of mass.assemblies ?? []) {
    const slabs = new Map(assembly.parts.filter((part): part is Slab => part.type === "slab").map((slab) => [slab.id, slab]));
    for (const slab of slabs.values()) {
      const level = slabLevel(slab, slabs, mass);
      if (level === 0) continue;
      const target = `part:${mass.id}:${assembly.id}:${slab.id}`;
      if (slab.host?.kind === "slab" && !slabs.has(slab.host.slabId)) {
        issues.push({ key: `elevated-slab-unsupported:${target}`, kind: "elevated-slab-unsupported", targetId: target, message: `${target} is hosted on slab "${slab.host.slabId}", which does not exist in its assembly.` });
      }
      const railed = assembly.parts.some((part) => part.type === "railing" && part.slabId === slab.id && part.edges.includes("outer"));
      if (!railed) issues.push({ key: `elevated-slab-unprotected:${target}`, kind: "elevated-slab-unprotected", targetId: target, message: `${target} is an elevated slab with no railing on its outer edge.` });
      if (level === "roof") { roofSlab = true; continue; }
      if (level >= mass.floors) continue;
      const accessible = doors(mass).some((door) => door.facade === slab.facade && doorOnLevel(door, level) && spansOverlap(door, slab));
      if (!accessible) issues.push({ key: `elevated-slab-inaccessible:${target}`, kind: "elevated-slab-inaccessible", targetId: target, message: `${target} on level ${level} of the ${slab.facade} facade has no door opening onto it from mass:${mass.id}.` });
    }
  }
  for (const object of document.sceneObjects ?? []) {
    if ((object.kind !== "slab" && object.kind !== "surface") || object.host?.kind === "mass" || object.position[1] - object.size[1] / 2 < ELEVATED_M) continue;
    issues.push({ key: `elevated-slab-unsupported:scene:${object.id}`, kind: "elevated-slab-unsupported", targetId: `scene:${object.id}`, message: `scene:${object.id} is an elevated free-standing ${object.kind} with no mass host; free-standing support cannot be verified.` });
  }
  if (roofSlab) limitations.push("Roof terraces have no representable access (stairs/roof hatches); their access cannot be verified.");
  return { issues, limitations };
}

/** Issues the edit introduced. Pre-existing conditions are reported, not used to block an unrelated edit. */
export function introducedCirculationIssues(before: ArchitecturalDesignDocument, after: ArchitecturalDesignDocument): CirculationIssue[] {
  const existing = new Set(auditCirculation(before).issues.map((issue) => issue.key));
  return auditCirculation(after).issues.filter((issue) => !existing.has(issue.key));
}
