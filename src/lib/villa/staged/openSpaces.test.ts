import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {describe, expect, it} from 'vitest';
import {z} from 'zod';
import {separateOpenSpaces} from './openSpaces';
import {applySlice, emptyDraft, measure} from './pipeline';
import {directionSchema, stageSchemas} from './spec';
import {validateMassing} from './validate';

const RAW = 'docs/architecture/staged-villa/live-1/raw-response.json';
const raw = () => JSON.parse(JSON.parse(readFileSync(RAW, 'utf8')).text);
const parse = () => z.object({direction: directionSchema, blocks: stageSchemas[2].shape.blocks}).strict().parse(raw());

describe('open spaces (real Terra response, preserved)', () => {
  it('leaves the preserved model response byte-identical', () => {
    expect(createHash('sha256').update(readFileSync(RAW)).digest('hex')).toBe('f1037423f36c26d789f673e1d1d588e734a7fb774685e0c2744f7e682e049bec');
  });
  it('the untruncated response now parses under the documented limits', () => {
    expect(() => parse()).not.toThrow();
  });
  it('turns the veranda into an open space with identity, position and size intact', () => {
    const {blocks, openSpaces} = separateOpenSpaces(parse().blocks);
    expect(blocks.map(b => b.id)).toEqual(['main-living-plinth', 'east-bedroom-wing', 'entry-pavilion', 'upper-bedroom-bar', 'upper-east-suite']);
    expect(openSpaces).toEqual([{id: 'south-veranda', role: parse().blocks[3].role, cx: 0, cz: 10.25, w: 18, d: 4.5, host: 'main-living-plinth', side: 's'}]);
    // Every enclosed block is passed through unchanged.
    for (const b of blocks) expect(parse().blocks.find(o => o.id === b.id)).toMatchObject(b);
  });
  it('is deterministic and keeps coherent, editable massing', () => {
    const run = () => applySlice(applySlice(emptyDraft({width: 60, depth: 48}), 1, parse().direction), 2, {blocks: parse().blocks});
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
    const m = measure(run(), 2, 0);
    expect(m.findings).toEqual([]);
    expect(m.scene!.elements.map(e => e.id).sort()).toEqual(['mass-east-bedroom-wing', 'mass-entry-pavilion', 'mass-main-living-plinth', 'mass-upper-bedroom-bar', 'mass-upper-east-suite', 'open-south-veranda']);
    expect(m.components!['open-south-veranda']).toBe('open:south-veranda');
  });
  it('honours an explicit open flag and rejects an unattached open space', () => {
    const b = (id: string, role: string, cx: number, extra = {}) => ({id, role, cx, cz: 0, w: 6, d: 6, level: 0 as const, ...extra});
    expect(separateOpenSpaces([b('a', 'house', 0), b('p', 'garden room', 6, {open: true})]).openSpaces[0]).toMatchObject({id: 'p', host: 'a', side: 'e'});
    expect(() => separateOpenSpaces([b('a', 'house', 0), b('p', 'covered veranda', 20)])).toThrow(/does not touch/);
    expect(() => separateOpenSpaces([b('a', 'house', 0), b('p', 'covered veranda', 3)])).toThrow(/overlaps/);
  });
  it('flags open spaces outside the site', () => {
    expect(validateMassing({site: {width: 60, depth: 48}, blocks: [], openSpaces: [{id: 'v', role: 'veranda', cx: 29, cz: 0, w: 6, d: 4, host: 'x', side: 's'}]}).map(f => f.code)).toEqual(expect.arrayContaining(['outside-site', 'open-space-host']));
  });
  it('stage 3 provider schema converts to JSON schema (recursive plan)', () => {
    expect(() => z.toJSONSchema(stageSchemas[3] as z.ZodType)).not.toThrow();
  });
});
