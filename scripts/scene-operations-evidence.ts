import { writeFileSync } from 'node:fs';
import { z } from 'zod';
import { laderaScene } from '../src/lib/villa/scene/example';
import { sceneSchema,applySceneOperations,type SceneOperation } from '../src/lib/villa/scene/model';
const dir='docs/villa-playground/scene-operations';
const operations:SceneOperation[]=[{op:'resize',id:'bridge-roof',size:[17,.3,10]},{op:'move',id:'suite-screen',at:[3.8,6.5,1.3]}];
for(const [name,value] of Object.entries({'ladera.scene':laderaScene,'edits':operations,'ladera-edited.scene':applySceneOperations(laderaScene,operations),'scene.schema':z.toJSONSchema(sceneSchema)}))writeFileSync(`${dir}/${name}.json`,JSON.stringify(value,null,2));
