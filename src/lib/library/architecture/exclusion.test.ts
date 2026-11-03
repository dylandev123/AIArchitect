/** Explicit client exclusions outrank retrieved suggestions. Replays the retained brief of the end-to-end diagnostic against the preserved library
 * snapshot and the code seeds: no model call, no database, no change to the knowledge itself. */
import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {latestKnowledge} from './service';
import {legacyRecipeKnowledge} from './legacyRecipes';
import {retrieveArchitecturalKnowledge,excludedByBrief,featureFrequency,SPECIFIC_FEATURE_MAX_RECORDS} from './retrieval';
const D='docs/architecture/';
const snap=JSON.parse(readFileSync(`${D}unified-knowledge/library-snapshot.json`,'utf8'));
const library=[...latestKnowledge(snap.architecturalKnowledge),...legacyRecipeKnowledge(snap.recipes)];
const brief:string=JSON.parse(readFileSync(`${D}e2e-generation-diagnostic-2026-11-03/brief.json`,'utf8')).prompt;
const retainedTrace:string[]=JSON.parse(readFileSync(`${D}e2e-generation-diagnostic-2026-11-03/stage-a-input.json`,'utf8')).knowledge.selectedRecords.map((r:{id:string})=>r.id);
const ids=(b:string)=>retrieveArchitecturalKnowledge(library,b,'generate',{canonical:true}).selected.map(s=>s.id);

describe('the retained brief says a rectangular pool is requested, "not an unsupported infinity-edge amenity"',()=>{
  const result=retrieveArchitecturalKnowledge(library,brief,'generate',{canonical:true});
  it('no infinity record reaches the provider-facing text, and each is excluded for the stated reason',()=>{
    expect(result.selected.map(s=>s.id)).not.toContain('infinity-pool');
    expect(result.selected.map(s=>s.id)).not.toContain('pool-infinity-limit');
    expect(result.text).not.toMatch(/infinity/i);
    const why=Object.fromEntries(result.metrics.excluded.filter(e=>/explicitly excludes/.test(e.reason)).map(e=>[e.id,e.reason]));
    expect(why).toEqual({'infinity-pool':'brief explicitly excludes infinity','pool-infinity-limit':'brief explicitly excludes infinity edge'});
  });
  it('the retained selection is otherwise unchanged: only the contradictory record is replaced, by another pool-design record',()=>{
    const now=result.selected.map(s=>s.id),dropped=retainedTrace.filter(i=>!now.includes(i)),added=now.filter(i=>!retainedTrace.includes(i));
    expect(dropped).toEqual(['infinity-pool']);
    expect(added).toHaveLength(1);
    expect(added[0]).toMatch(/^pool-/);
    expect(result.selected).toHaveLength(12);
  });
  it('useful pool design knowledge is not removed: pool records other than the infinity ones remain eligible',()=>{
    const pool=library.filter(e=>/^pool-/.test(e.id)&&!/infinity/.test(e.id));
    expect(pool.length).toBeGreaterThan(8);
    expect(pool.every(e=>!excludedByBrief(e,brief,featureFrequency(library)))).toBe(true);
  });
  it('broad words in an exclusion do not remove every record that uses them',()=>{
    // "No three-pavilion arrangement" and the "edge" of "infinity-edge" must not exclude pavilion or edge records.
    expect(ids(brief).some(i=>/pavilion/.test(i))).toBe(true);
    const freq=featureFrequency(library);
    expect(freq.get('edge')??0).toBeGreaterThan(SPECIFIC_FEATURE_MAX_RECORDS);
    expect(freq.get('pavilion')??0).toBeGreaterThan(SPECIFIC_FEATURE_MAX_RECORDS);
    expect(freq.get('infinity')??0).toBeLessThanOrEqual(SPECIFIC_FEATURE_MAX_RECORDS);
  });
});

describe('the same feature, wanted or excluded, in other briefs',()=>{
  const estate='A Caribbean waterfront estate worth $25 million with six bedroom suites, terraces and a rectangular swimming pool';
  it('requested: an infinity-edge pool brings the infinity records, exactly as before',()=>{
    expect(ids(`${estate} with an infinity edge pool`)).toEqual(expect.arrayContaining(['infinity-pool']));
  });
  it.each([
    ['not an unsupported infinity-edge amenity'],['avoid an infinity edge'],['without an infinity edge'],['no infinity-edge detail'],['rather than an infinity pool'],
  ])('excluded: "%s"',phrase=>{
    const got=ids(`${estate}, ${phrase}.`);
    expect(got).not.toContain('infinity-pool');expect(got).not.toContain('pool-infinity-limit');
  });
  it('mentioning infinity without excluding it is not an exclusion',()=>{
    expect(excludedByBrief(library.find(e=>e.id==='infinity-pool')!,'An infinity pool is welcome.',featureFrequency(library))).toBeUndefined();
  });
});
