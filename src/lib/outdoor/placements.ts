import type { AssetCategory } from '@/types/library';
import type { AssetIndexEntry } from '@/lib/library/retrieval';
import { matchComponent } from '@/lib/library/spaceAssets';
import { COMPONENTS } from './components';
import { planOutdoorSpaces, realizeSpaces, type OutdoorSpace } from './spaces';
import { generateHouseFromJson } from '@/lib/house/generateHouse';
import { extractStyleTags } from '@/lib/library/taxonomy';
import { inferSiteHints } from '@/lib/house/siteSettings';
import { inferScaleFromBrief, isProjectScale } from '@/lib/house/scale';
import { styleTagsForProjectStyle } from '@/lib/library/requests';
import type { HousePrimitive } from '@/lib/house/types';
export interface OutdoorAssetPlacement {
    id: string;
    assetId: string;
    parentSpaceId: string;
    category: AssetCategory;
    position: [
        number,
        number,
        number
    ];
    rotation: [
        number,
        number,
        number
    ];
    scale: number;
    role: string;
    relationship?: {
        type: 'around' | 'above' | 'covers';
        targetId: string;
    };
    dimensions: {
        width: number;
        depth: number;
        height: number;
    };
}
type Bounds = {
    x: number;
    z: number;
    w: number;
    d: number;
    y: number;
    h: number;
};
function bounds(p: HousePrimitive): Bounds {
    if (p.kind === 'box') {
        const c = Math.abs(Math.cos(p.rotation[1])), s = Math.abs(Math.sin(p.rotation[1]));
        return { x: p.position[0], z: p.position[2], w: p.size[0] * c + p.size[2] * s, d: p.size[2] * c + p.size[0] * s, y: p.position[1] - p.size[1] / 2, h: p.size[1] };
    }
    const xs = p.vertices.filter((_, i) => i % 3 === 0), ys = p.vertices.filter((_, i) => i % 3 === 1), zs = p.vertices.filter((_, i) => i % 3 === 2);
    const lo = [Math.min(...xs), Math.min(...ys), Math.min(...zs)], hi = [Math.max(...xs), Math.max(...ys), Math.max(...zs)];
    return { x: (lo[0] + hi[0]) / 2, z: (lo[2] + hi[2]) / 2, w: hi[0] - lo[0], d: hi[2] - lo[2], y: lo[1], h: hi[1] - lo[1] };
}
const overlaps = (a: Bounds, b: Bounds, gap = 0.15) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 + gap && Math.abs(a.z - b.z) < (a.d + b.d) / 2 + gap;
export function placementBounds(p: OutdoorAssetPlacement): Bounds {
    const c = Math.abs(Math.cos(p.rotation[1])), s = Math.abs(Math.sin(p.rotation[1]));
    return { x: p.position[0], z: p.position[2], y: p.position[1], h: p.dimensions.height, w: p.dimensions.width * c + p.dimensions.depth * s, d: p.dimensions.depth * c + p.dimensions.width * s };
}
/** Conservative solid bounds, except the known open four-post pergola envelope. */
export function placementVolumes(q: OutdoorAssetPlacement): Bounds[] {
    if (q.role !== 'pergola')
        return [placementBounds(q)];
    const yaw = q.rotation[1];
    return [-1, 1].flatMap(x => [-1, 1].map(z => {
        const dx = x * (q.dimensions.width / 2 - 0.15), dz = z * (q.dimensions.depth / 2 - 0.15);
        return { ...placementBounds(q), x: q.position[0] + dx * Math.cos(yaw) + dz * Math.sin(yaw), z: q.position[2] - dx * Math.sin(yaw) + dz * Math.cos(yaw), w: 0.4, d: 0.4 };
    })).concat([{ ...placementBounds(q), y: q.position[1] + q.dimensions.height - 0.3, h: 0.3 }]);
}
export function placementsOverlap(a: OutdoorAssetPlacement, b: OutdoorAssetPlacement): boolean {
    return placementVolumes(a).some(x => placementVolumes(b).some(y => overlaps(x, y) && x.y + x.h > y.y + 0.001 && y.y + y.h > x.y + 0.001));
}
export const SUPPORTED_COMPONENTS = new Set(['dining-table', 'dining-chair', 'pergola', 'pendant-light', 'sun-lounger', 'side-table', 'lounge-armchair', 'outdoor-bench', 'bar-stool', 'kitchen-island', 'outdoor-fridge', 'bar-counter', 'lantern', 'path-light', 'planter', 'garden-pot', 'fire-pit', 'parasol', 'cabana']);
/** Read-only scene geometry supplies surfaces and keep-outs; no architecture is mutated. */
export function placeOutdoorAssets(json: string, spaces: readonly OutdoorSpace[], library: readonly AssetIndexEntry[], styles: readonly string[]): OutdoorAssetPlacement[] {
    const { model } = generateHouseFromJson(json);
    if (!model)
        return [];
    const surfaces = model.primitives.filter(p => p.category === 'patio' || (p.category === 'deck' && p.id.includes('slab'))).map(bounds);
    const pools = model.primitives.filter(p => p.category === 'pool' && p.id.endsWith('-water')).map(bounds);
    const root = JSON.parse(json);
    const viewYaw = ({ south: 0, east: Math.PI / 2, north: Math.PI, west: -Math.PI / 2 } as Record<string, number>)[root.site?.viewDirection] ?? 0;
    const obstacles = model.primitives.filter(p => p.category === 'deck' ? !p.id.includes('slab') : !['patio', 'landscape', 'slope'].includes(p.category)).map(bounds);
    const placed: OutdoorAssetPlacement[] = [];
    for (const space of [...spaces].sort((a, b) => Number(b.kind === 'outdoor-dining') - Number(a.kind === 'outdoor-dining'))) {
        if (!space.realized)
            continue;
        type Frame = Bounds & {
            yaw: number;
            localW: number;
            localD: number;
        };
        const frame = (b: Bounds, yaw: number): Frame => ({ ...b, yaw, localW: Math.abs(Math.cos(yaw)) * b.w + Math.abs(Math.sin(yaw)) * b.d, localD: Math.abs(Math.cos(yaw)) * b.d + Math.abs(Math.sin(yaw)) * b.w });
        let zones: Frame[] = [];
        if (space.kind === 'pool-lounge') {
            zones = pools.flatMap(p => {
                return [true, false].flatMap(alongX => [-1, 1].map(side => {
                    const yaw = alongX ? (side === 1 ? Math.PI : 0) : (side === 1 ? -Math.PI / 2 : Math.PI / 2);
                    const b = { x: p.x + (alongX ? 0 : side * (p.w / 2 + 2.1)), z: p.z + (alongX ? side * (p.d / 2 + 2.1) : 0), w: alongX ? p.w : 3.2, d: alongX ? 3.2 : p.d, y: 0, h: 0 };
                    return frame(b, yaw);
                }));
            });
        }
        else if (['garden', 'quiet-retreat', 'fire-pit-lounge'].includes(space.kind)) {
            zones = model.primitives.filter(p => p.category === 'landscape').map(p => frame(bounds(p), viewYaw));
        }
        else if (space.kind === 'arrival-court') {
            zones = model.primitives.filter(p => p.category === 'porch' && p.id.includes('slab')).map(p => frame(bounds(p), viewYaw + Math.PI));
        }
        else if (['outdoor-dining', 'outdoor-kitchen', 'pool-bar', 'main-outdoor-living', 'view-terrace'].includes(space.kind)) {
            zones = surfaces.filter(p => p.x * Math.sin(viewYaw) + p.z * Math.cos(viewYaw) > 0).map(p => frame(p, viewYaw));
        }
        if (!zones.length)
            continue;
        // Prefer the frame with most usable area; keep the pool's view-side edge when equally sized.
        const clearScore = (f: Frame) => [-0.25, 0.25].filter(at => {
            const x = f.x + f.localW * at * Math.cos(f.yaw), z = f.z - f.localW * at * Math.sin(f.yaw);
            const b = { x, z, w: 0.7 * Math.abs(Math.cos(f.yaw)) + 2 * Math.abs(Math.sin(f.yaw)), d: 2 * Math.abs(Math.cos(f.yaw)) + 0.7 * Math.abs(Math.sin(f.yaw)), y: 0, h: 1 };
            return !obstacles.some(o => overlaps(b, o, 0.35)) && !placed.some(p => overlaps(b, placementBounds(p)));
        }).length;
        const zone = zones.sort((a, b) => (space.kind === 'pool-lounge' ? clearScore(b) - clearScore(a) : 0) || b.localW * b.localD - a.localW * a.localD || (b.x - a.x) * Math.sin(viewYaw) + (b.z - a.z) * Math.cos(viewYaw))[0];
        const w = Math.min(zone.localW, space.footprint.width), d = Math.min(zone.localD, space.footprint.depth);
        space.layout = { center: [zone.x, zone.y + zone.h, zone.z], width: w, depth: d, yaw: zone.yaw };
        const world = (x: number, z: number): [
            number,
            number
        ] => [zone.x + x * Math.cos(zone.yaw) + z * Math.sin(zone.yaw), zone.z - x * Math.sin(zone.yaw) + z * Math.cos(zone.yaw)];
        const table = () => placed.find(p => p.parentSpaceId === space.id && p.role === 'dining-table');
        const priority: Record<string, number> = { 'dining-table': -6, pergola: -5, 'dining-chair': -4, 'pendant-light': -3, 'kitchen-island': -2, 'bar-counter': -2, 'fire-pit': -2 };
        const keys = [...space.components.required, ...space.components.preferred].sort((a, b) => (priority[a] ?? 0) - (priority[b] ?? 0));
        for (const key of keys) {
            if (!SUPPORTED_COMPONENTS.has(key))
                continue;
            const def = COMPONENTS[key], asset = matchComponent(library, def, styles);
            if (asset?.placementReady === false || !asset?.dimensions?.width || !asset.dimensions.depth || !asset.dimensions.height)
                continue;
            const dim = { width: asset.dimensions.width, depth: asset.dimensions.depth, height: asset.dimensions.height };
            if (!Object.values(dim).every(v => Number.isFinite(v) && v > 0))
                continue;
            const edgeX = (w - dim.width) / 2 - 0.4, edgeZ = (d - dim.depth) / 2 - 0.4;
            let candidates: [
                number,
                number,
                number,
                number
            ][] = [];
            const t = table();
            const canopy = placed.find(p => p.parentSpaceId === space.id && p.role === 'pergola');
            const counter = placed.find(p => p.parentSpaceId === space.id && ['kitchen-island', 'bar-counter'].includes(p.role));
            if (key === 'dining-table' || key === 'fire-pit' || key === 'pergola')
                candidates = [[0, 0, 0, 0]];
            else if (key === 'dining-chair' && t) {
                const dz = t.dimensions.depth / 2 + dim.depth / 2 + 0.25;
                candidates = [[-t.dimensions.width / 4, -dz, 0, 0], [t.dimensions.width / 4, -dz, 0, 0], [-t.dimensions.width / 4, dz, Math.PI, 0], [t.dimensions.width / 4, dz, Math.PI, 0]];
            }
            else if (key === 'pendant-light' && t && canopy)
                candidates = [[0, 0, 0, canopy.dimensions.height - 0.31 - dim.height]];
            else if (key === 'sun-lounger')
                candidates = [[-w / 4, 0, 0, 0], [w / 4, 0, 0, 0]];
            else if (key === 'kitchen-island' || key === 'bar-counter')
                candidates = [[0, edgeZ, Math.PI, 0]];
            else if (key === 'bar-stool' && counter)
                candidates = [[-counter.dimensions.width / 4, edgeZ - counter.dimensions.depth - dim.depth / 2 - 0.6, 0, 0], [counter.dimensions.width / 4, edgeZ - counter.dimensions.depth - dim.depth / 2 - 0.6, 0, 0]];
            else if (key !== 'bar-stool' && key !== 'pendant-light' && key !== 'dining-chair')
                candidates = [[-edgeX, -edgeZ, 0, 0], [edgeX, -edgeZ, 0, 0], [-edgeX, edgeZ, Math.PI, 0], [edgeX, edgeZ, Math.PI, 0], [-edgeX, 0, Math.PI / 2, 0], [edgeX, 0, -Math.PI / 2, 0], [0, edgeZ, Math.PI, 0]];
            let count = 0;
            for (const [dx, dz, yaw, lift] of candidates) {
                const p: OutdoorAssetPlacement = { id: `outdoor-${space.id}-${key}-${count}`, assetId: asset.id, parentSpaceId: space.id, category: def.category, position: [world(dx, dz)[0], zone.y + zone.h + lift, world(dx, dz)[1]], rotation: [0, zone.yaw + yaw, 0], scale: 1, role: key, dimensions: dim, ...(t && key !== 'dining-table' ? { relationship: { type: key === 'pergola' ? 'covers' : key === 'pendant-light' ? 'above' : 'around', targetId: key === 'pendant-light' && canopy ? canopy.id : t.id } as OutdoorAssetPlacement['relationship'] } : {}) };
                const b = placementBounds(p);
                const localW = dim.width * Math.abs(Math.cos(yaw)) + dim.depth * Math.abs(Math.sin(yaw));
                const localD = dim.depth * Math.abs(Math.cos(yaw)) + dim.width * Math.abs(Math.sin(yaw));
                if (Math.abs(dx) + localW / 2 > w / 2 - 0.2 || Math.abs(dz) + localD / 2 > d / 2 - 0.2)
                    continue;
                // Reserve a 0.8m entry lane from the house edge to the dining group; edge objects never occupy its centre.
                if (!['dining-table', 'dining-chair', 'pergola', 'pendant-light'].includes(key) && Math.abs(dx) < 0.5 && dz < 0)
                    continue;
                if (obstacles.some(o => overlaps(b, o, 0.35)))
                    continue;
                // A pergola's roof and four corner posts are distinct occupied volumes, not a solid box.
                if (placed.some(q => placementsOverlap(p, q)))
                    continue;
                placed.push(p);
                count++;
                if (!['dining-chair', 'sun-lounger', 'planter', 'path-light', 'bar-stool', 'lounge-armchair'].includes(key))
                    break;
            }
        }
    }
    return placed;
}
export function attachOutdoorAssets(json: string, brief: string, library: readonly AssetIndexEntry[]): string {
    const root = JSON.parse(json);
    try {
        const styles = [...new Set([...extractStyleTags(brief), ...styleTagsForProjectStyle(root.exteriorOptions?.style)])];
        const spaces = realizeSpaces(planOutdoorSpaces({ brief, scale: isProjectScale(root.site?.projectScale) ? root.site.projectScale : inferScaleFromBrief(brief), tier: root.site?.designTier, environment: root.site?.environment ?? inferSiteHints(brief).environment, styles, viewDirection: root.site?.viewDirection, approachSide: root.site?.approachSide }), root);
        root.outdoorAssetPlacements = placeOutdoorAssets(json, spaces, library, styles);
        root.outdoorSpaces = spaces;
    }
    catch (error) {
        root.outdoorAssetPlacements = [];
        root.outdoorAssetPlacementFailure = error instanceof Error ? error.message : String(error);
        console.error("[outdoor-assets] placement failed", root.outdoorAssetPlacementFailure);
    }
    return JSON.stringify(root);
}
