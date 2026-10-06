import type { HousePrimitive } from "@/lib/house/types";
import { box, type Paint } from "@/lib/house/architecture/parts";
import type { ArchitecturalAssembly, ArchitecturalAssemblyPart, AssemblyHost, MassFacade, MassVolume } from "../document";

/** Local, exterior rect shared by slabs, rails, posts and beams.  World placement happens once in the compiler. */
export interface HostedRect { x0: number; x1: number; z0: number; z1: number; }

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const span = (mass: Pick<MassVolume, "width" | "depth">, facade: MassFacade, start: number, end: number) => {
  const length = facade === "north" || facade === "south" ? mass.width : mass.depth;
  return { start: clamp(Math.min(start, end)) * length, end: clamp(Math.max(start, end)) * length, length };
};

/** A slab is additive: it touches the existing wall but never participates in its footprint, wall loop or roof. */
export function hostedSlabRect(mass: Pick<MassVolume, "width" | "depth">, part: Extract<ArchitecturalAssemblyPart, { type: "slab" }>): HostedRect {
  const { start, end } = span(mass, part.facade, part.start, part.end);
  const halfW = mass.width / 2, halfD = mass.depth / 2;
  switch (part.facade) {
    case "north": return { x0: -halfW + start, x1: -halfW + end, z0: -halfD - part.depth, z1: -halfD };
    case "south": return { x0: -halfW + start, x1: -halfW + end, z0: halfD, z1: halfD + part.depth };
    case "east": return { x0: halfW, x1: halfW + part.depth, z0: -halfD + start, z1: -halfD + end };
    case "west": return { x0: -halfW - part.depth, x1: -halfW, z0: -halfD + start, z1: -halfD + end };
  }
}

function facadePoint(mass: Pick<MassVolume, "width" | "depth">, facade: MassFacade, at: number, depth: number): [number, number] {
  const u = clamp(at);
  const halfW = mass.width / 2, halfD = mass.depth / 2;
  switch (facade) {
    case "north": return [-halfW + u * mass.width, -halfD - depth];
    case "south": return [-halfW + u * mass.width, halfD + depth];
    case "east": return [halfW + depth, -halfD + u * mass.depth];
    case "west": return [-halfW - depth, -halfD + u * mass.depth];
  }
}

type VerticalMass = Pick<MassVolume, "width" | "depth" | "floors" | "height">;

/** Resolves semantic support to a local Y. No design choices are made here. */
function hostElevation(part: Extract<ArchitecturalAssemblyPart, { type: "slab" | "post" | "beam" }>, mass: VerticalMass, levelHeight: number, slabs: ReadonlyMap<string, Extract<ArchitecturalAssemblyPart, { type: "slab" }>>, resolving = new Set<string>()): number | undefined {
  const legacy = () => (part.level ?? 0) * levelHeight + (part.elevation ?? 0);
  const host: AssemblyHost | undefined = part.host;
  if (!host) return legacy();
  if (host.kind === "roof") return (mass.height ?? mass.floors * levelHeight) + (host.offset ?? 0);
  if (host.kind === "floor" || host.kind === "facade") return host.level * levelHeight + (host.offset ?? 0);
  if (host.kind === "entrance" || host.kind === "terrace") return (host.level ?? 0) * levelHeight + (host.offset ?? 0);
  if (resolving.has(host.slabId)) return undefined;
  const slab = slabs.get(host.slabId);
  if (!slab) return undefined;
  resolving.add(host.slabId);
  const elevation = hostElevation(slab, mass, levelHeight, slabs, resolving);
  resolving.delete(host.slabId);
  return elevation === undefined ? undefined : elevation + (slab.thickness ?? .2) + (host.offset ?? 0);
}
const edgePaint = (paint: Paint) => ({ ...paint, transparent: true, opacity: Math.min(paint.opacity ?? .32, .42), roughness: .12 });

function railsForSlab(id: string, slab: Extract<ArchitecturalAssemblyPart, { type: "slab" }>, rail: Extract<ArchitecturalAssemblyPart, { type: "railing" }>, rect: HostedRect, y: number, glass: Paint): HousePrimitive[] {
  const thickness = rail.thickness ?? .045;
  const height = rail.height;
  const outerAlongX = slab.facade === "north" || slab.facade === "south";
  const outer = slab.facade === "north" || slab.facade === "west"
    ? (outerAlongX ? { x: (rect.x0 + rect.x1) / 2, z: rect.z0, size: [rect.x1 - rect.x0, height, thickness] as [number, number, number] } : { x: rect.x0, z: (rect.z0 + rect.z1) / 2, size: [thickness, height, rect.z1 - rect.z0] as [number, number, number] })
    : (outerAlongX ? { x: (rect.x0 + rect.x1) / 2, z: rect.z1, size: [rect.x1 - rect.x0, height, thickness] as [number, number, number] } : { x: rect.x1, z: (rect.z0 + rect.z1) / 2, size: [thickness, height, rect.z1 - rect.z0] as [number, number, number] });
  const start = outerAlongX
    ? { x: rect.x0, z: (rect.z0 + rect.z1) / 2, size: [thickness, height, rect.z1 - rect.z0] as [number, number, number] }
    : { x: (rect.x0 + rect.x1) / 2, z: rect.z0, size: [rect.x1 - rect.x0, height, thickness] as [number, number, number] };
  const end = outerAlongX
    ? { x: rect.x1, z: (rect.z0 + rect.z1) / 2, size: [thickness, height, rect.z1 - rect.z0] as [number, number, number] }
    : { x: (rect.x0 + rect.x1) / 2, z: rect.z1, size: [rect.x1 - rect.x0, height, thickness] as [number, number, number] };
  const choices = { outer, start, end };
  return [...new Set(rail.edges)].map((edge) => {
    const member = choices[edge];
    return box(`${id}-${rail.id}-${edge}`, "wall", "Assembly Railing", [member.x, y + height / 2, member.z], member.size, edgePaint(glass));
  });
}

/** Mechanical construction only. The assembly's name/intent never branches compiler behavior. */
export function buildArchitecturalAssemblies(mass: VerticalMass & { assemblies?: readonly ArchitecturalAssembly[] }, levelHeight: number, slabPaint: Paint, structuralPaint: Paint, glassPaint: Paint): HousePrimitive[] {
  const primitives: HousePrimitive[] = [];
  for (const assembly of mass.assemblies ?? []) {
    const slabs = new Map(assembly.parts.filter((part): part is Extract<ArchitecturalAssemblyPart, { type: "slab" }> => part.type === "slab").map((part) => [part.id, part]));
    for (const part of assembly.parts) {
      const prefix = `assembly-${assembly.id}`;
      if (part.type === "slab") {
        const rect = hostedSlabRect(mass, part), thickness = part.thickness ?? .2, y = hostElevation(part, mass, levelHeight, slabs);
        if (y === undefined) continue;
        primitives.push(box(`${prefix}-${part.id}`, "floor", "Assembly Slab", [(rect.x0 + rect.x1) / 2, y + thickness / 2, (rect.z0 + rect.z1) / 2], [rect.x1 - rect.x0, thickness, rect.z1 - rect.z0], slabPaint));
      } else if (part.type === "railing") {
        const slab = slabs.get(part.slabId); if (!slab) continue;
        const elevation = hostElevation(slab, mass, levelHeight, slabs); if (elevation === undefined) continue;
        const rect = hostedSlabRect(mass, slab), slabY = elevation + (slab.thickness ?? .2);
        primitives.push(...railsForSlab(prefix, slab, part, rect, slabY, glassPaint));
      } else if (part.type === "post") {
        const size = part.size ?? .2, [x, z] = facadePoint(mass, part.facade, part.at, part.depth);
        const y = hostElevation(part, mass, levelHeight, slabs); if (y === undefined) continue;
        primitives.push(box(`${prefix}-${part.id}`, "wall", "Assembly Post", [x, y + part.height / 2, z], [size, part.height, size], structuralPaint));
      } else if (part.type === "beam") {
        const { start, end } = span(mass, part.facade, part.start, part.end);
        const [x, z] = facadePoint(mass, part.facade, (start + end) / (2 * (part.facade === "north" || part.facade === "south" ? mass.width : mass.depth)), part.depth);
        const y = hostElevation(part, mass, levelHeight, slabs); if (y === undefined) continue;
        const length = end - start, thickness = part.thickness ?? .2;
        const size: [number, number, number] = part.facade === "north" || part.facade === "south" ? [length, part.height, thickness] : [thickness, part.height, length];
        primitives.push(box(`${prefix}-${part.id}`, "wall", "Assembly Beam", [x, y + part.height / 2, z], size, structuralPaint));
      }
    }
  }
  return primitives;
}
