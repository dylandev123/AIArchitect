import type { RoofSystem } from "./types";

/**
 * The Roof System registry. Systems register once at module load (see `systems.ts`); registration order is
 * the tie-break wherever a choice between systems is otherwise even, so it is part of the deterministic output.
 */
const systems = new Map<string, RoofSystem>();

export function registerRoofSystem(system: RoofSystem): void {
  if (systems.has(system.id)) throw new Error(`Roof system "${system.id}" is already registered.`);
  systems.set(system.id, system);
}

export function getRoofSystem(id: string): RoofSystem | undefined { return systems.get(id); }
export function listRoofSystems(): RoofSystem[] { return [...systems.values()]; }
