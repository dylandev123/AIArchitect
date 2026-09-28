import { describe, it, expect } from 'vitest';
import { planOutdoorSpaces, realizeSpaces } from '../spaces';
import { placeOutdoorAssets, attachOutdoorAssets, placementsOverlap, type OutdoorAssetPlacement } from '../placements';
import { COMPONENTS } from '../components';
import { assembleVilla, VILLA_BRIEF } from '@/lib/library/__tests__/villaFixture';
import type { AssetIndexEntry } from '@/lib/library/retrieval';
import { analyzeGeneration } from '@/lib/library/generationLoop';
import { emptySnapshot } from '@/lib/library/store';
const library: AssetIndexEntry[] = Object.values(COMPONENTS).map(d => ({ id: `approved-${d.key}`, name: d.name, family: d.category, dimensions: d.dimensions, styleTags: ['modern', 'tropical'], tags: d.tags }));
describe('outdoor asset fixture generation', () => {
    it('rotates dining with an east-facing space', () => {
        const root = JSON.parse(attachOutdoorAssets(assembleVilla({ view: 'east', approach: 'west' }).json, VILLA_BRIEF, library));
        expect(root.outdoorAssetPlacements.find((p: OutdoorAssetPlacement) => p.role === 'dining-table')?.rotation[1]).toBeCloseTo(Math.PI / 2);
    });
    it('leaves unsupported and oversized Needs open', () => {
        const bad = library.map(a => ({ ...a, dimensions: { width: 100, depth: 100, height: 100 } }));
        const json = attachOutdoorAssets(assembleVilla().json, VILLA_BRIEF, bad);
        expect(JSON.parse(json).outdoorAssetPlacements).toEqual([]);
        const report = analyzeGeneration({ json, brief: VILLA_BRIEF, projectId: 'fixture', library: bad, retrieved: [], attached: [] }, emptySnapshot()).report;
        expect(report.spaces.find(s => s.kind === 'outdoor-dining')?.missing).toContain('dining-table');
        expect(report.assets.every(a => !a.applied)).toBe(true);
    });
    it('keeps circulation clear and never floats dependent chairs or pendants', () => {
      const fixture=assembleVilla();
      const before=JSON.parse(attachOutdoorAssets(fixture.json,VILLA_BRIEF,library));
      const table=before.outdoorAssetPlacements.find((p:OutdoorAssetPlacement)=>p.role==='dining-table');
      const root=JSON.parse(fixture.json);
      root.paths=[{x1:table.position[0]-8,z1:table.position[2],x2:table.position[0]+8,z2:table.position[2],width:1.5,bend:0,surface:'stone'}];
      const after=JSON.parse(attachOutdoorAssets(JSON.stringify(root),VILLA_BRIEF,library));
      expect(after.outdoorAssetPlacements.filter((p:OutdoorAssetPlacement)=>p.parentSpaceId==='outdoor-dining'&&['dining-table','dining-chair','pendant-light'].includes(p.role))).toEqual([]);
    });
    it('wires counters, stools and cabinets into a kitchen footprint', () => {
      const root=JSON.parse(assembleVilla().json);
      root.patios=[{wall:'south',offset:0,width:22,depth:10}];root.decks=[];root.pools=[];root.porches=[];
      const spaces=realizeSpaces(planOutdoorSpaces({brief:'Outdoor kitchen',scale:'luxury'}),root).filter(s=>s.kind==='outdoor-kitchen');
      const placed=placeOutdoorAssets(JSON.stringify(root),spaces,library,['modern','tropical']);
      expect(placed.map(p=>p.role)).toEqual(expect.arrayContaining(['kitchen-island','bar-stool','outdoor-fridge']));
    });
    it('places approved dining and pool components without modifying architecture', () => {
        const fixture = assembleVilla();
        const root = JSON.parse(attachOutdoorAssets(fixture.json, VILLA_BRIEF, library));
        const { outdoorAssetPlacements: placed, outdoorSpaces, ...architecture } = root;
        expect(outdoorSpaces.find((s: {
            id: string;
        }) => s.id === 'outdoor-dining').layout).toBeDefined();
        expect(architecture).toEqual(JSON.parse(fixture.json));
        for (let i = 0; i < placed.length; i++)
            for (let j = i + 1; j < placed.length; j++)
                expect(placementsOverlap(placed[i], placed[j]), `${placed[i].id} / ${placed[j].id}`).toBe(false);
        expect(placed).toEqual(expect.arrayContaining(['dining-table', 'dining-chair', 'pergola', 'pendant-light', 'sun-lounger'].map(role => expect.objectContaining({ role }))));
        const report = analyzeGeneration({ json: JSON.stringify(root), brief: VILLA_BRIEF, projectId: 'fixture', library, retrieved: [], attached: [] }, emptySnapshot()).report;
        expect(report.assets.find(a => a.component === 'dining-table')).toMatchObject({ status: 'Applied', applied: true });
        expect(placed.filter((p: OutdoorAssetPlacement) => p.role === 'dining-chair')).toHaveLength(4);
        expect(placed.filter((p: OutdoorAssetPlacement) => p.role === 'sun-lounger')).toHaveLength(2);
    });
});
