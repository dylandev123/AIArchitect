/** Semantic intent is independent of renderer primitives and persisted scene versions.
 * Adapters keep original IDs. A vocabulary entry does not imply renderer support. */
export const OBJECT_TYPES = ['building', 'mass', 'wall', 'exterior-door', 'front-door', 'interior-door', 'window', 'roof', 'floor', 'ceiling', 'stair', 'ramp', 'elevator', 'balcony', 'terrace', 'pool', 'garden', 'planting-bed', 'plant', 'tree', 'path', 'driveway', 'garage', 'fence', 'gate', 'outdoor-furniture', 'lighting', 'material'] as const;
export type ObjectType = typeof OBJECT_TYPES[number];
/** Explicit adapter support, not a promise of organic geometry or new renderers. */
export const DIRECT_SCENE_KINDS: Partial<Record<ObjectType, readonly string[]>> = {
    building:['volume','plate','pavilion'], mass:['volume'], wall:['wall','screen'],
    'exterior-door':['entrance'], 'front-door':['entrance'], 'interior-door':['entrance'], window:['glazing'], roof:['roof'],
    floor:['plate'], ceiling:['plate'], stair:['plate','volume'], ramp:['plate','volume'], elevator:['volume'],
    balcony:['balcony','plate'], terrace:['plate'], pool:['water','plate'], garden:['plate'], 'planting-bed':['plate','volume'],
    plant:['volume'], tree:['volume'], path:['plate'], driveway:['plate'], garage:['volume','plate'],
    fence:['wall','screen'], gate:['entrance','screen'], 'outdoor-furniture':['sofa','volume'], lighting:['volume'],
};
export type EditOperation = 'changeMaterial' | 'editArchitecture' | 'move' | 'resize' | 'rotate' | 'create' | 'delete' | 'attach' | 'detach' | 'setConnectorEndpoints' | 'editLandscape' | 'editOpening';
export interface ObjectDefinition {
    type: ObjectType;
    category: 'architectural' | 'landscape' | 'furnishing' | 'decorative';
    aliases: readonly string[];
    editable: readonly string[];
    protected: readonly string[];
    hosts: readonly ObjectType[];
    connections: readonly ObjectType[];
    operations: readonly EditOperation[];
    collision: 'solid' | 'water-clearance' | 'ground-cover' | 'host-opening' | 'none';
    placement: 'supported' | 'ground' | 'fitted-host' | 'connector' | 'resource';
    preservation: 'target-fields-only';
}
const aliases: Record<ObjectType, string[]> = {
    building: ['building', 'house', 'residence', 'studio', 'shell'], mass: ['mass', 'wing'], wall: ['wall'],
    'exterior-door': ['exterior door', 'door', 'entrance'], 'front-door': ['front door', 'main entrance', 'entry door', 'door'], 'interior-door': ['interior door', 'door'],
    window: ['window', 'glazing'], roof: ['roof'], floor: ['floor', 'slab'], ceiling: ['ceiling'],
    stair: ['stair', 'stairs', 'staircase', 'steps'], ramp: ['ramp'], elevator: ['elevator', 'lift'],
    balcony: ['balcony'], terrace: ['terrace', 'deck', 'patio'], pool: ['pool', 'swimming pool'],
    garden: ['garden', 'lawn'], 'planting-bed': ['planting bed', 'flower bed'], plant: ['plant', 'shrub'], tree: ['tree', 'palm'],
    path: ['path', 'walkway'], driveway: ['driveway'], garage: ['garage', 'carport'], fence: ['fence'], gate: ['gate'],
    'outdoor-furniture': ['outdoor furniture', 'sofa', 'chair'], lighting: ['light', 'lighting', 'lamp'], material: ['material', 'finish'],
};
const landscape = new Set<ObjectType>(['garden', 'planting-bed', 'plant', 'tree', 'path', 'driveway']);
const doors = new Set<ObjectType>(['exterior-door', 'front-door', 'interior-door', 'window']);
const connectors = new Set<ObjectType>(['stair', 'ramp', 'elevator']);
export const OBJECT_REGISTRY: Readonly<Record<ObjectType, ObjectDefinition>> = Object.fromEntries(OBJECT_TYPES.map(type => {
    const opening = doors.has(type), connector = connectors.has(type);
    return [type, {
        type, aliases: aliases[type], category: landscape.has(type) ? 'landscape' : type === 'outdoor-furniture' ? 'furnishing' : type === 'lighting' || type === 'material' ? 'decorative' : 'architectural',
        editable: type === 'material' ? ['material', 'color'] : ['material', 'color', 'at', 'size', 'rotation', ...(opening ? ['opening'] : []), ...(connector ? ['endpoints'] : [])],
        protected: ['id', 'type', 'semanticType', 'kind', 'aliases', 'label', 'assemblyKind'],
        hosts: type === 'material' ? [] : opening ? ['wall'] : type === 'roof' ? ['building', 'mass', 'wall'] : type === 'plant' || type === 'tree' ? ['garden', 'planting-bed'] : ['building', 'mass', 'floor', 'terrace'],
        connections: connector ? ['floor', 'terrace', 'path'] : opening ? ['wall', 'floor'] : ['material'],
        operations: type === 'material' ? ['changeMaterial'] : ['changeMaterial', 'move', 'resize', 'rotate', 'create', 'delete', 'attach', 'detach', ...(opening ? ['editOpening' as const] : []), ...(connector ? ['setConnectorEndpoints' as const] : []), ...(landscape.has(type) ? ['editLandscape' as const] : ['editArchitecture' as const])],
        collision: type === 'material' || type === 'lighting' ? 'none' : type === 'pool' ? 'water-clearance' : opening ? 'host-opening' : type === 'garden' || type === 'planting-bed' ? 'ground-cover' : 'solid',
        placement: type === 'material' ? 'resource' : opening ? 'fitted-host' : connector ? 'connector' : landscape.has(type) || type === 'pool' ? 'ground' : 'supported',
        preservation: 'target-fields-only',
    } satisfies ObjectDefinition];
})) as unknown as Record<ObjectType, ObjectDefinition>;

export interface SemanticObject {
    id: string;
    type: ObjectType;
    label: string;
    aliases: readonly string[];
    /** World position, derived by the adapter, never guessed from ID spelling. */
    position: readonly [number, number, number];
    yaw?: number;
    hostId?: string;
    memberIds: readonly string[];
    /** Keep assembly parts directly addressable without competing with its root noun. */
    suppressTypeAliases?: boolean;
}

export function requestedCreationType(prompt: string): ObjectType {
    const text = prompt.toLowerCase().split(/\b(?:behind|around|beside|within|near|along|under|over|on|in|next to)\b/)[0];
    const scores = OBJECT_TYPES.map(type => ({type,score:Math.max(0,...OBJECT_REGISTRY[type].aliases.map(a => new RegExp(`\\b${a}s?\\b`).test(text) ? a.length : 0))}));
    const best = Math.max(...scores.map(s => s.score));
    const matches = scores.filter(s => s.score === best && best > 0);
    if (matches.length !== 1) throw new SemanticEditError('ambiguous-target','Name one supported object type to create.');
    return matches[0].type;
}

export class SemanticEditError extends Error {
    constructor(public readonly code: 'ambiguous-target' | 'unknown-target' | 'unsupported-edit' | 'preservation', message: string, public readonly candidates: readonly string[] = []) { super(message); this.name = 'SemanticEditError'; }
}

/** UI selection and camera right-vector are evidence; provider-authored IDs are not. */
export function resolveSemanticTarget(objects: readonly SemanticObject[], query: string, context: {selectedId?: string; cameraRight?: readonly [number, number, number]} = {}): SemanticObject {
    const text = query.toLowerCase().replace(/[-_]/g, ' ').split(/\bwithout\b|\bwhile preserving\b|\bbut keep\b/)[0];
    if (context.selectedId) {
        const selected = objects.find(o => o.id === context.selectedId);
        if (!selected) throw new SemanticEditError('unknown-target', 'Selected object no longer exists.');
        const nouns = OBJECT_TYPES.filter(type => type !== 'material').map(type => ({type,score:Math.max(0,...OBJECT_REGISTRY[type].aliases.map(a => new RegExp(`\\b${a}s?\\b`).test(text) ? a.length : 0))}));
        const best = Math.max(...nouns.map(n => n.score));
        if (best > 0 && !nouns.some(n => n.score === best && n.type === selected.type)) throw new SemanticEditError('ambiguous-target','Selected object conflicts with the requested object type.');
        return selected;
    }
    const matches = objects.map(object => ({object, score: Math.max(0, ...[object.id, object.label, ...object.aliases, ...(object.suppressTypeAliases ? [] : OBJECT_REGISTRY[object.type].aliases)].map(alias => {
        const a = alias.toLowerCase().replace(/[-_]/g, ' ');
        return new RegExp(`\\b${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?\\b`).test(text) ? a.length : 0;
    }))}));
    const best = Math.max(0, ...matches.map(m => m.score));
    let candidates = matches.filter(m => m.score === best && best > 0).map(m => m.object);
    if (/\b(left|right)\b/.test(text)) {
        if (!context.cameraRight || Math.hypot(...context.cameraRight) < .99) throw new SemanticEditError('ambiguous-target', 'A camera frame is required for left/right targeting.', candidates.map(o => o.id));
        const right = context.cameraRight;
        const project = (o: SemanticObject) => o.position.reduce((s, v, i) => s + v * right[i], 0);
        candidates.sort((a, b) => project(a) - project(b));
        if (/\bright\b/.test(text)) candidates.reverse();
        if (candidates.length > 1 && Math.abs(project(candidates[0]) - project(candidates[1])) > .01) candidates = [candidates[0]];
    }
    if (candidates.length !== 1) throw new SemanticEditError(candidates.length ? 'ambiguous-target' : 'unknown-target', candidates.length ? 'Choose a specific object before editing.' : 'No existing object matches this request.', candidates.map(o => o.id));
    return candidates[0];
}

/** Order-independent object comparison; array order and numeric values remain exact. */
export function stable(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
    if (value && typeof value === 'object') return `{${Object.entries(value).filter(([,v]) => v !== undefined).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${JSON.stringify(k)}:${stable(v)}`).join(',')}}`;
    return JSON.stringify(value) ?? 'undefined';
}
export function changedFields(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(k => stable(before[k]) !== stable(after[k]));
}
