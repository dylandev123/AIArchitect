import m91 from "../__tests__/fixtures/mansions/mansion-91d583fe.json";
import m96 from "../__tests__/fixtures/mansions/mansion-9646933e.json";
import mf2 from "../__tests__/fixtures/mansions/mansion-f2149916.json";
import { materializeV3ArchitecturalObject } from "../architecture";
import type { V3Composition } from "../composition";
import type { V3Circulation } from "../interior";
import type { V3Scene, V3SceneObject } from "../scene";

/**
 * Offline DEV/test fixtures, never runtime or persistence authority. Functional variants of the three saved mansions. Each keeps every object, mass, roof, material and
 * unrelated opening of the saved scene, and adds only authored access: stairs/lifts as `interior.circulation`,
 * walkable glazed doors where a balcony or terrace is served, and one balcony moved off a shared wall.
 */
export type SavedMansion = "91d583fe" | "9646933e" | "f2149916";
export const SAVED_MANSIONS: SavedMansion[] = ["91d583fe", "9646933e", "f2149916"];
const SAVED: Record<SavedMansion, unknown> = { "91d583fe": m91, "9646933e": m96, "f2149916": mf2 };
/** A fresh deep copy of a saved mansion exactly as persisted. */
export function savedMansion(id: SavedMansion): V3Scene {
  return structuredClone((SAVED[id] as { v3Scene: V3Scene }).v3Scene);
}

type Opening = NonNullable<V3Composition["openings"]>[number];
const object = (scene: V3Scene, id: string) => { const found = scene.objects.find((o) => o.id === id); if (!found) throw new Error(`Missing ${id}`); return found; };
/** Replaces one authored opening in place (array order is semantic identity for nothing, but kept stable). */
function replaceOpening(o: V3SceneObject, id: string, next: Opening[]) {
  const openings = o.composition!.openings!, index = openings.findIndex((op) => op.id === id);
  if (index < 0) throw new Error(`Missing opening ${id} on ${o.id}`);
  openings.splice(index, 1, ...next);
}
function addCirculation(scene: V3Scene, entries: V3Circulation[]) {
  scene.interior = { ...(scene.interior ?? { storeys: [], rooms: [] }), circulation: [...(scene.interior?.circulation ?? []), ...entries] };
}
/** World plan centre → host-local footprint (all three hosts are unrotated, so this is a translation). */
function footprint(host: V3SceneObject, x: number, z: number, width: number, depth: number) {
  return { x: x - host.transform.position[0], z: z - host.transform.position[2], width, depth };
}

export function functionalMansion(id: SavedMansion): V3Scene {
  const scene = savedMansion(id);
  if (id === "91d583fe") {
    const pavilion = object(scene, "primary-pavilion");
    // The upper suite opens onto its loggia balcony; the living room slides open onto the garden court.
    replaceOpening(pavilion, "south-suite-glass", [{ id: "south-suite-glass", type: "glazed-door", facade: "south", floors: "upper", start: .12, end: .88, height: 2.7, operation: "sliding", reveal: .14, serves: "south-loggia-balcony" }]);
    replaceOpening(pavilion, "south-living-glass", [{ id: "south-living-glass", type: "glazed-door", facade: "south", floors: "ground", start: .06, end: .94, height: 3.2, operation: "sliding", reveal: .12, serves: "garden-courtyard" }]);
    addCirculation(scene, [{ id: "pavilion-stair", type: "stair", hostMassId: pavilion.id, fromLevel: 0, toLevel: 1, stairType: "u-shaped", direction: "north", turn: "right", footprint: footprint(pavilion, -6, -4, 2.6, 4.6), label: "Main stair" }]);
  }
  if (id === "9646933e") {
    const ground = object(scene, "main-residence-ground"), gallery = object(scene, "upper-bedroom-gallery"), guest = object(scene, "east-guest-wing");
    replaceOpening(ground, "great-room-glass", [{ id: "great-room-glass", type: "glazed-door", facade: "south", floors: "ground", start: .1, end: .64, height: 3.4, operation: "sliding", reveal: .14, serves: "south-lanai-terrace" }]);
    replaceOpening(gallery, "upper-south-bedroom-glazing", [{ id: "upper-south-bedroom-glazing", type: "glazed-door", facade: "south", floors: "upper", start: .08, end: .88, height: 2.7, operation: "sliding", reveal: .1, serves: "south-bedroom-balcony" }]);
    addCirculation(scene, [
      // Rises through the ground mass's roof into the stacked bedroom gallery above it.
      { id: "gallery-stair", type: "stair", hostMassId: ground.id, fromLevel: 0, toLevel: 1, stairType: "u-shaped", direction: "north", turn: "right", footprint: footprint(ground, -9, -3, 2.6, 4.6), label: "Gallery stair" },
      // Test-author landing correction: keep the exit approach inside the terrace, clear of the pergola.
      { id: "sky-terrace-stair", type: "stair", hostMassId: guest.id, fromLevel: 0, toLevel: 1, stairType: "l-shaped", direction: "east", turn: "left", footprint: footprint(guest, 15, -1, 4.4, 3.5), label: "Sky terrace stair" },
    ]);
  }
  if (id === "f2149916") {
    const pavilion = object(scene, "main-living-pavilion"), west = object(scene, "west-bedroom-wing"), east = object(scene, "east-bedroom-wing");
    // Authored (pre-orientation-repair) north faces the pool. The great room opens onto it at ground level only.
    replaceOpening(pavilion, "great-room-view", [
      { id: "great-room-view", type: "glazing-zone", facade: "north", floors: "upper", start: .08, end: .92, heightRatio: .9, frame: true, reveal: .34 },
      { id: "great-room-doors", type: "glazed-door", facade: "north", floors: "ground", start: .08, end: .92, height: 3.4, operation: "sliding", reveal: .34, serves: "pool-terrace" },
    ]);
    for (const [wing, assembly, slab] of [[west, "west-upper-balcony", "west-balcony-slab"], [east, "east-upper-balcony", "east-balcony-slab"]] as const) {
      // Each wing balcony leaves the wall it shares with the pavilion for the pool facade, with a door from the suite.
      const part = wing.composition!.assemblies!.find((a) => a.id === assembly)!.parts.find((p) => p.id === slab)!;
      if (part.type === "slab") Object.assign(part, { facade: "north", start: .2, end: .8 });
      wing.composition!.openings!.push({ id: `${assembly}-door`, type: "glazed-door", facade: "north", floors: "upper", start: .25, end: .75, height: 2.5, operation: "sliding", serves: assembly });
    }
    addCirculation(scene, [
      { id: "pavilion-stair", type: "stair", hostMassId: pavilion.id, fromLevel: 0, toLevel: 1, stairType: "u-shaped", direction: "north", turn: "right", footprint: footprint(pavilion, -5, 3, 2.6, 4.6), label: "Main stair" },
      // The wings' floor datums differ from the pavilion's, so each wing has its own stair.
      { id: "west-wing-stair", type: "stair", hostMassId: west.id, fromLevel: 0, toLevel: 1, stairType: "straight", direction: "south", footprint: footprint(west, -12.2, -3, 1.2, 5.6), label: "West wing stair" },
      { id: "east-wing-lift", type: "lift", hostMassId: east.id, fromLevel: 0, toLevel: 1, direction: "west", footprint: footprint(east, 12.4, -3.5, 1.8, 1.8), label: "East wing lift" },
    ]);
  }
  scene.objects = scene.objects.map(materializeV3ArchitecturalObject);
  return scene;
}
