import {villaSpec} from '@/lib/villa/staged/villa.fixture';
import {compileHouse, type Stage} from '@/lib/villa/staged/compile';
import {sceneRelationshipIssues} from '@/lib/villa/scene/relationships';
for (const stage of [2,3,4,5] as Stage[]) {
  try {
    const c = compileHouse(villaSpec, stage);
    const issues = stage>=3 ? sceneRelationshipIssues(c.scene) : [];
    console.log(`stage ${stage}: ${c.scene.elements.length} elements, ${issues.length} relationship issues`);
    for (const i of issues.slice(0,12)) console.log('  -', i.rule, i.message.slice(0,200));
  } catch (e) { console.log(`stage ${stage} FAILED`, (e as Error).message.slice(0,600)); }
}
