import {validateScene, type ArchitecturalScene} from '../scene/model';
import {compileHouse} from './compile';
import {houseSpecSchema, type HouseSpec} from './spec';

/** Saved house = spec (source of truth) + compiled scene + edit history. Scene alone also loads in the normal viewer. */
export interface SavedHouse {format: 'staged-house-save-1'; spec: HouseSpec; scene: ArchitecturalScene; history: {instruction: string; summary?: string}[]}

export const saveHouse = (spec: HouseSpec, scene: ArchitecturalScene, history: SavedHouse['history'] = []): string =>
  JSON.stringify({format: 'staged-house-save-1', spec, scene, history} satisfies SavedHouse);

/** Reload recompiles from the spec and refuses a save whose scene no longer matches (hand-edited / stale). */
export function loadHouse(text: string) {
  const raw = JSON.parse(text);
  if (raw.format !== 'staged-house-save-1') throw Error('Not a staged-house save.');
  const spec = houseSpecSchema.parse(raw.spec), scene = validateScene(raw.scene);
  const rebuilt = compileHouse(spec, 5);
  if (JSON.stringify(rebuilt.scene.elements) !== JSON.stringify(scene.elements)) throw Error('Saved scene does not match its spec; reload from the spec or re-save.');
  return {spec, scene, components: rebuilt.components, history: raw.history as SavedHouse['history']};
}
